const processConfig = require('@datapull/json-config').processConfig;
const got = require('got');
const url = require('url');

class HttpApiOrigin {
  constructor(stepConfig) {
    // replace variables in the config:
    try {
      this.config = processConfig(stepConfig);
    } catch (err) {
      throw Error(`Could not parse config of Okta origin ${err}`);
    }
  }

  get originDeclaration() {
    return {
      name: ['Okta', this.config.method, this.config.url].join(':'),
      runner: this.pullData.bind(this)
    };
  }

  pullData(pipelineConfig) {
    console.log('[Okta Origin] fetching', this.method, this.url);

    // merge step and pipeline configs:
    let mergedConfig = Object.assign(
      {
        method: 'get',
        pageSize: 200,
      },
      pipelineConfig ? pipelineConfig.okta || {} : {},
      this.config
    );

    // validate config:
    if (!mergedConfig.url) {
      throw Error('Okta Origin: url is not set up. Please specify `url` in the config');
    }

    const API_KEY = mergedConfig.apiKey;
    const URL = url.parse(mergedConfig.url);
    const METHOD = String(mergedConfig.method).toLowerCase();

    if (!got[METHOD]) {
      throw Error(`Okta Origin: unsupported method: ${METHOD}`);
    }

    if (!API_KEY) {
      throw Error(`Okta Origin: please specify an API KEY in the config`);
    }

    if (this.config.isPaginatedList) {
      const fetchListData = (url, paginationLink, accumulatedData) => {

        return got[METHOD](paginationLink || url, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `SSWS ${API_KEY}`,
          }
        }).then(resp => {
          const json = JSON.parse(resp.body);

          if (Array.isArray(json)) {
            if (resp.headers.link) {
              const nextLink = this.getNextLink(resp.headers.link);
              if (nextLink) {
                return fetchListData(url, nextLink, accumulatedData.concat(json));
              }
            }

            return accumulatedData.concat(json);
          }
        });
      };

      return new Promise((resolve, reject) => {
        fetchListData(URL, null, [])
          .then(accumulatedData => {
            resolve(accumulatedData);
          })
          .catch(err => {
            console.error('[Okta origin]', err);
            reject(`[Okta origin] could not fetch data ${err}`);
          });
      });
    }

    throw new Error(`Okta Origin: set isPaginatedList to true, other types of request are not currently supported.`);
  }

  getNextLink(linkHeader) {
    const parts = linkHeader.split(',');

    const nextLinks = parts
      .filter(p => {
        return p.match(/rel=\"next\"/);
      });

    if (!nextLinks.length) {
      return null;
    }

    const matches = nextLinks[0].match(/\<(.*)\>/);

    if (matches.length > 1) {
      return matches[1];
    }

    return null;
  }
}

exports.datapullStep = {
  isOrigin: true,
  constructor: HttpApiOrigin
};
