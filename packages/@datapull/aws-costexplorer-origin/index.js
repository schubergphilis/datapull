const aws = require('aws-sdk');

class AwsOrigin {
  constructor(config) {
    this.config = config;
  }

  get originDeclaration() {
    return {
      name: ['AWS Cost Explorer', this.config.service, this.config.method].join(':'),
      runner: this.pullData.bind(this)
    };
  }

  pullData(config) {
    console.log('[AWS Cost Explorer Origin] fetching data');

    const client = new aws.CostExplorer(Object.assign({
      region: 'us-east-1'   // currently it's the only region where Cost Explorer API is available
    }, config));

    return new Promise(async (resolve, reject) => {
      try {
        const resp = await client.getCostAndUsage(this.config.costQueryParams).promise();
        console.log('[AWS Cost Explorer Origin] response', JSON.stringify(resp));
        resolve(resp);
      } catch (err) {
        console.error('[AWS Cost Explorer Origin] ERROR ', err);
        return reject(err);
      }
    });
  }
}

exports.datapullStep = {
  isOrigin: true,
  constructor: AwsOrigin
};
