const aws = require('aws-sdk');
const pick = require('lodash/pick');
const processConfig = require('@datapull/json-config').processConfig;

class AwsDestination {
  constructor(config) {
    // replace variables in the config:
    try {
      this.config = processConfig(config);
    } catch (err) {
      throw Error(`Could not parse config of AWS Destination ${err}`);
    }

    // parse service.method string
    const runnerParts = this.config.runner.split('.');
    this.config.service = runnerParts[1];
    this.config.method = runnerParts[2];


    // instantiate the service
    const Service = aws[this.config.service];
    this.serviceClient = new Service(pick(this.config, ['region', 'accessKeyId', 'secretAccessKey']));

    // check if required method is in the service
    if (!this.serviceClient[this.config.method]) {
      throw Error(`No such method found in AWS sdk ${this.config.service} service`, this.config.method);
    }
  }
  buildPipelines(pipelines) {
    pipelines.forEach(p => {
      p.destination = {
        name: ['AWS', this.config.service, this.config.method].join(':'),
        runner: this.sendMessages.bind(this)
      };
    });

    return pipelines;
  }
  sendMessages(messages, dryRun) {
    if (messages.length === 0) {
      console.log('[AWS Destination] Nothing to push: 0 messages');
      return Promise.resolve("No messages to push");
    }

    console.log(`[AWS Destination] pushing ${messages.length} messages to aws`);

    return new Promise((resolve, reject) => {
      const params = {};

      if (this.config.service === 'Kinesis') {
        params.StreamName = this.config.stream;
        params.Records = messages.map(data => {
          return {Data: JSON.stringify(data), PartitionKey: this.config.partitionKey};
        });
      }

      if (dryRun) {
        console.log("[AwsDestination] Dry run: skipping sending messages");
        params.Records.forEach(r => {
          console.log(r);
        });
        return resolve("Dry run");
      }

      // validate the config
      if (!this.config.accessKeyId) {
        throw Error(`Destination API access key is empty`);
      }

      if (!this.config.secretAccessKey) {
        throw Error(`Destination API secret key is empty`);
      }

      if (!this.config.region) {
        return reject(`Destination region is not specified`);
      }

      this.serviceClient[this.config.method].call(this.serviceClient, params, (err, resp) => {
        if (err) {
          console.error('[AWS Destination] ERROR ', err);
          return reject(err);
        }

        if (resp.FailedRecordCount > 0) {
          console.error('FailedRecordCount', resp.FailedRecordCount);
        }

        resolve(resp);
      });
    });
  }
}

exports.datapullStep = {
  isDestination: true,
  constructor: AwsDestination
};
