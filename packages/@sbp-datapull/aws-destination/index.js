const aws = require('aws-sdk');
const pick = require('lodash/pick');
const processConfig = require('@sbp-datapull/json-config').processConfig;
const splitIntoBatches = require('./util/batch-splitter');
const Bottleneck = require('bottleneck');

const SECONDS = 1000;
const sts = new aws.STS()

function delay(t) {
  return new Promise(resolve => {
    setTimeout(resolve, t);
  });
}

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
    this.serviceClient = new Service(
      pick(this.config, ['region', 'accessKeyId', 'secretAccessKey', 'roleArn'])
    );

    // check if required method is in the service
    if (!this.serviceClient[this.config.method]) {
      throw Error(
        `No such method found in AWS sdk ${this.config.service} service: ${this.config.method}`
      );
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
      console.debug('[AWS Destination] Nothing to push: 0 messages');
      return Promise.resolve('No messages to push');
    }

    console.debug('[AWS Destination] ' + messages.length + ' message(s) to send');

    return new Promise(async (resolve, reject) => {
      const params = {};

      if (this.config.service === 'Kinesis') {
        params.StreamName = this.config.stream;
        params.Records = messages.map(data => {
          return {
            Data: JSON.stringify(data),
            PartitionKey: this.config.partitionKey
          };
        });
      }

      if (dryRun) {
        console.warn('[AWS Destination] Dry run: skipping sending messages.');
        return resolve('Dry run');
      }

      if (this.config.roleArn) {
        const stsParams = {
          RoleArn: this.config.roleArn,
          RoleSessionName: `${Date.now()}`
        };
        console.debug(`Trying to assume role as [${this.config.roleArn}]`);
        const { Credentials } = await sts.assumeRole(stsParams).promise();
        const { AccessKeyId, SecretAccessKey, SessionToken } = Credentials
        this.serviceClient.config.update({
          accessKeyId: AccessKeyId,
          secretAccessKey: SecretAccessKey,
          sessionToken: SessionToken,
        })
      }

      const sendToKinesis = records => {
        return new Promise(async (resolve, reject) => {
          console.debug(
            `[AWS Destination] pushing ${params.Records.length} messages to aws (out of ${messages.length} total)`
          );
          const sendAttempt = records => {
            params.Records = records;

            let collectionSize = 0;
            records.forEach(r => {
              collectionSize += r.Data.length + r.PartitionKey.length;
            });

            console.debug(
              `[AWS Destination] attempting to send ${records.length} messages. Collection size: ${collectionSize}`
            );

            this.serviceClient[this.config.method].call(
              this.serviceClient,
              params,
              (err, resp) => {
                if (err) {
                  console.error('CONFIG', this.config)
                  console.error('[AWS Destination]', err);
                  return reject(err);
                }

                // check if some of the messages were not consumed:
                if (resp.FailedRecordCount > 0) {
                  console.error(
                    `[AWS Destination] FailedRecordCount ${resp.FailedRecordCount}`
                  );

                  // retry after delay:
                  delay(5 * SECONDS).then(() => {
                    sendAttempt(
                      records.slice(-1 * Number(resp.FailedRecordCount))
                    );
                  });
                  return;
                }

                // job finished:
                console.debug(
                  `[AWS Destination] finished sending ${params.Records.length} messages`
                );
                resolve(resp);
              }
            );
          };
          sendAttempt(records);
        });
      };

      // split messages into chunks:
      splitIntoBatches(params.Records, (err, chunks) => {
        if (err) {
          console.error(
            '[AWS Destination] could not split records into batches',
            err
          );
          return reject(err);
        }

        const messagesTotal = params.Records.length;
        console.debug(
          `[AWS Destination] pushing ${messagesTotal} messages in ${chunks.length} chunk(s)`
        );

        // setup rate limiter:
        const config = this.config || {};
        const rateLimitConfig = config.rateLimiter || {};
        const maxConcurrent = rateLimitConfig.maxConcurrent || 1;
        const minTime = rateLimitConfig.minTimeBetweenRequestsMs || 1100;
        const highWater = rateLimitConfig.highWater || -1;
        const rateLimitStrategy =
          rateLimitConfig.rateLimitStrategy || 'OVERFLOW';
        const rejectOnDrop =
          'rejectOnDrop' in rateLimitConfig
            ? rateLimitConfig.rejectOnDrop
            : false;

        const limiter = new Bottleneck(
          maxConcurrent,
          minTime,
          highWater,
          Bottleneck.strategy[rateLimitStrategy],
          rejectOnDrop
        );

        // start sending:
        const promises = chunks.map(ch => limiter.schedule(sendToKinesis, ch));
        Promise.all(promises)
          .then(responses => {
            console.debug(
              `[AWS Destination] finished sending ${messagesTotal} messages in ${chunks.length} chunk(s)`
            );
            resolve(responses);
          })
          .catch(err => reject(err));
      });
    });
  }
}

exports.datapullStep = {
  isDestination: true,
  constructor: AwsDestination
};
