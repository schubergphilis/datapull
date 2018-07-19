const aws = require('aws-sdk');

class AwsOrigin {
  constructor(config) {
    this.config = config;

    const runnerParts = this.config.runner.split('.');
    this.config.service = runnerParts[1];
    this.config.method = runnerParts[2];
  }

  get originDeclaration() {
    return {
      name: ['AWS', this.config.service, this.config.method].join(':'),
      runner: this.pullData.bind(this)
    };
  }

  pullData(config) {
    console.log('[AWS Origin] fetching aws', this.config.service, this.config.method);

    if (!aws[this.config.service]) {
      return Promise.reject(`No such service found in AWS sdk`, this.config.service);
    }

    const Service = aws[this.config.service];
    const serviceClient = new Service(config);

    if (!serviceClient[this.config.method]) {
      return Promise.reject(`No such method found in AWS sdk ${this.config.service} service`, this.config.method);
    }

    if (!config.accessKeyId) {
      return Promise.reject(`API access key is empty`);
    }

    if (!config.secretAccessKey) {
      return Promise.reject(`API secret key is empty`);
    }

    if (!config.region) {
      return Promise.reject(`region is not specified`);
    }

    let params = {};
    if (this.config.requestParams) {
      params = Object.assign({}, this.config.requestParams);
    }
    console.log('[AWS Origin] params', params);

    /**
     * AWS API doesn't have a unified results field in list responses.
     * Instead it would output results in fields like Accounts or Instances.
     * Here we just merge the results of two list responses together
     * without knowing which field has the results in advance.
     *
     * @param newResponse
     * @param prevResponse
     * @returns {*}
     */
    const mergeResults = (newResponse, prevResponse) => {
      Object.keys(newResponse).forEach(key => {
        if (Array.isArray(prevResponse[key]) && Array.isArray(newResponse[key])) {
          newResponse[key] = newResponse[key].concat(prevResponse[key]);
        }
      });

      return newResponse;
    };

    const countResults = (results) => {
      let count = 0;
      Object.keys(results).forEach(key => {
        if (Array.isArray(results[key])) {
          count += results[key].length;
        }
      });
      return count;
    };

    const getAllInList = async (nextToken, results) => {
      if (nextToken) {
        params.NextToken = nextToken;
      }

      const resp = await serviceClient[this.config.method].call(serviceClient, params).promise();
      const newResults = mergeResults(resp, results);
      if (resp.NextToken) {
        return await getAllInList(resp.NextToken, newResults);
      }
      return newResults;
    };

    return new Promise(async (resolve, reject) => {
      const resp = await getAllInList(null, {});

      console.log(`[AWS Origin] fetched ${countResults(resp)} results from ${this.config.service}.${this.config.method}`);

      if (!this.config.awsDetailsCall) {
        return resolve(resp);
      }

      // For every item in the response, make a details call:
      try {
        const details = await this.pullDataFromDetailsCall(this.config.awsDetailsCall, config, resp);
        return resolve(details);
      } catch (err) {
        return reject(err);
      }
    });
  }

  async pullDataFromDetailsCall(detailsCallConfig, clientConfig, listCallResponse) {
    // validate the config:
    if (!detailsCallConfig.itemsListKey) {
      throw Error("[AWS Origin] Please specify `itemsListKey` in `awsDetailsCall`");
    }
    if (!detailsCallConfig.itemKey) {
      throw Error("[AWS Origin] Please specify `itemKey` in `awsDetailsCall`");
    }
    if (!detailsCallConfig.method) {
      throw Error("[AWS Origin] Please specify `method` in `awsDetailsCall`");
    }
    if (!detailsCallConfig.keyParam) {
      throw Error("[AWS Origin] Please specify `keyParam` in `awsDetailsCall`");
    }

    // get the item keys from list call:
    const items = listCallResponse[detailsCallConfig.itemsListKey];
    if (!Array.isArray(items)) {
      throw Error("[AWS Origin] Could not get a list of items to make details call");
    }

    const keys = items.map(i => i[detailsCallConfig.itemKey]).filter(i => i);

    if (keys.length === 0) {
      console.warn("[AWS Origin] Details call won't be done because 0 items are found in the list call response")
      return [];
    }

    // configure the aws client
    const runnerParts = detailsCallConfig.method.split('.');
    if (runnerParts.length < 2) {
      throw Error("[AWS Origin] `method` in `awsDetailsCall` should specify name of the service and name of the method for a details call");
    }

    const DetailsService = aws[runnerParts[0]];
    if (!DetailsService) {
      throw Error("[AWS Origin] no service found to make a details call: " + runnerParts[0]);
    }

    const detailsMethod = runnerParts[1];
    const detailsServiceClient = new DetailsService(clientConfig);

    // make the calls
    const detailCalls = keys.map(k => {
      return new Promise((detailsCallResolve, detailsCallReject) => {
        detailsServiceClient[detailsMethod].call(detailsServiceClient, {
          [detailsCallConfig.keyParam]: k
        }, (err, resp) => {
          if (err) {
            console.error('[AWS Origin] Details call ERROR ', err);
            return detailsCallReject(err);
          }

          detailsCallResolve(resp)
        })
      });
    });

    // wait for every call to resolve
    try {
      const responses = await Promise.all(detailCalls);
      return responses;
    } catch (err) {
      console.error("[AWS Origin] One or all of details call failed", err);
      throw err;
    }
  }
}

exports.datapullStep = {
  isOrigin: true,
  constructor: AwsOrigin
};
