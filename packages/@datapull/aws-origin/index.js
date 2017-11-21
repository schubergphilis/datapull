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

    return new Promise((resolve, reject) => {
      serviceClient[this.config.method].call(serviceClient, params, (err, resp) => {
        if (err) {
          console.error('[AWS Origin] ERROR ', err);
          return reject(err);
        }

        resolve(resp);
      });
    });
  }
}

exports.datapullStep = {
  isOrigin: true,
  constructor: AwsOrigin
};