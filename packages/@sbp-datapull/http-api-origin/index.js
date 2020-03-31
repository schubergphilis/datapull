const http = require('https');
const qs = require('querystring');
const processConfig = require('@sbp-datapull/json-config').processConfig;
const url = require('url');

class HttpApiOrigin {
  constructor(config) {
    // replace variables in the config:
    try {
      this.config = processConfig(config);
    } catch (err) {
      throw Error(`Could not parse config of HTTP API origin ${err}`);
    }

    this.method = this.config.method || 'get';
    this.url = url.parse(this.config.url);

    if (!this.url) {
      throw Error('HTTP Origin: url is not set up');
    }
  }

  get originDeclaration() {
    return {
      name: ['HTTP', this.method, this.url].join(':'),
      runner: this.pullData.bind(this)
    };
  }

  async customAuth(config) {
    return new Promise((resolve, reject) => {
      if (config.auth !== 'custom') {
        return resolve();
      }

      const options = {
        hostname: config.customAuth.hostname,
        port: config.customAuth.port || 443,
        path: config.customAuth.path,
        method: config.customAuth.method
      };

      if (config.customAuth.headers) {
        options.headers = config.customAuth.headers;
      }

      const req = http.request(options, res => {
        const { statusCode } = res;

        if (statusCode !== 200) {
          res.resume(); // consume response data to free up memory
          return reject(
            new Error(`Request Failed. Status Code: ${statusCode}`)
          );
        }

        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', chunk => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            let parsedData = rawData;
            if (config.customAuth.format === 'json') {
              parsedData = JSON.parse(rawData);
            }

            if (config.customAuth.secretKey) {
              parsedData = parsedData[config.customAuth.secretKey];
            }

            if (!parsedData) {
              return reject(
                new Error('Could not get credentials (custom auth)')
              );
            }

            resolve(parsedData);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', e => {
        reject(e);
      });

      // write data to request body
      req.write(config.customAuth.body || '');
      req.end();
    });
  }

  pullData(config) {
    console.log('[HTTP Origin] fetching', this.method, this.url);

    return new Promise(async (resolve, reject) => {
      let credentials;
      try {
        credentials = await this.customAuth(this.config);
      } catch (err) {
        reject(err);
      }

      const options = {
        hostname: this.url.hostname,
        port: 443,
        path: this.url.path,
        method: this.method
      };

      if (this.config.queryParams) {
        options.path += `?${qs.stringify(this.config.queryParams)}`;
      }

      if (this.config.auth === 'basic') {
        if (!config.username) {
          throw Error('HTTP Origin: username for basic auth is not set up');
        }
        if (!config.password) {
          throw Error('HTTP Origin: password for basic auth is not set up');
        }
        options.auth = `${config.username}:${config.password}`;
      }

      if (this.config.headers) {
        options.headers = {};
        for (let k of Object.keys(this.config.headers)) {
          const value = this.config.headers[k];
          options.headers[k] = String(value).replace(
            'customAuth.credentials',
            credentials
          );
        }
      }

      const req = http.request(options, res => {
        const { statusCode } = res;

        if (statusCode !== 200) {
          res.resume(); // consume response data to free up memory
          return reject(
            new Error(`Request Failed. Status Code: ${statusCode}`)
          );
        }

        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', chunk => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            let parsedData = rawData;
            if (this.config.format === 'json') {
              parsedData = JSON.parse(rawData);
            }

            resolve(parsedData);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', e => {
        reject(e);
      });

      // write data to request body
      req.write('');
      req.end();
    });
  }
}

exports.datapullStep = {
  isOrigin: true,
  constructor: HttpApiOrigin
};
