const http = require('https');
const processConfig = require('@datapull/json-config').processConfig;
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

  pullData(config) {
    console.log('[HTTP Origin] fetching', this.method, this.url);

    return new Promise((resolve, reject) => {

      const options = {
        hostname: this.url.hostname,
        port: 443,
        path: this.url.path,
        method: this.method
      };

      if (this.config.auth === 'basic') {
        if (!config.username) {
          throw Error('HTTP Origin: username for basic auth is not set up');
        }
        if (!config.password) {
          throw Error('HTTP Origin: password for basic auth is not set up');
        }
        options.auth = `${config.username}:${config.password}`;
      }

      const req = http.request(options, (res) => {
        const {statusCode} = res;

        let error;
        if (statusCode !== 200) {
          error = `Request Failed. Status Code: ${statusCode}`;
        }

        if (error) {
          res.resume(); // consume response data to free up memory
          return reject(error);
        }

        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
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

      req.on('error', (e) => {
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
