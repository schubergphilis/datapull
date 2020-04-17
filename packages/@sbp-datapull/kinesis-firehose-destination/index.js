const aws = require('aws-sdk');
const pick = require('lodash/pick');
const processConfig = require('@sbp-datapull/json-config').processConfig;
const splitIntoBatches = require('./util/batch-splitter');
const Bottleneck = require('bottleneck');

const SECONDS = 1000;

function delay(t) {
  return new Promise(resolve => {
    setTimeout(resolve, t);
  });
}

class KinesisFirehoseDestination {
  constructor(config) {
    // replace variables in the config:
    try {
      this.config = processConfig(config);
    } catch (err) {
      throw Error(`Could not parse config of Firehose Destination ${err}`);
    }

    // parse service.method string
    const runnerParts = this.config.runner.split('.');
    this.config.service = runnerParts[1];
    this.config.method = runnerParts[2];

    // instantiate the service
    this.serviceClient = new aws.Firehose(
      pick(this.config, ['region', 'accessKeyId', 'secretAccessKey', 'roleArn'])
    );
  }

  buildPipelines(pipelines) {
    pipelines.forEach(p => {
      p.destination = {
        name: 'AWS:Firehose',
        runner: this.sendMessages.bind(this)
      };
    });

    return pipelines;
  }
  sendMessages(messages, dryRun) {
    if (messages.length === 0) {
      console.log('[Firehose Destination] Nothing to push: 0 messages');
      return Promise.resolve('No messages to push');
    }

    console.log(
      '[Firehose Destination] ' + messages.length + ' message(s) to send'
    );

    return new Promise((resolve, reject) => {
      const params = {};

      params.DeliveryStreamName = this.config.stream;
      params.Records = messages.map(data => {
        let message = JSON.stringify(data);
        if (this.config.appendNewLine) {
          message += '\n';
        }
        return { Data: message };
      });

      if (dryRun) {
        console.log(
          '[Firehose Destination] Dry run: skipping sending messages.'
        );
        params.Records.forEach(r => {
          console.log(r);
        });
        return resolve('Dry run');
      }

      const sendToFirehose = records => {
        return new Promise((resolve, reject) => {
          console.log(
            `[Firehose Destination] pushing ${params.Records.length} messages to aws (out of ${messages.length} total)`
          );

          const sendAttempt = records => {
            params.Records = records;

            let collectionSize = 0;
            records.forEach(r => {
              collectionSize += r.Data.length;
            });

            console.log(
              `[Firehose Destination] attempting to send ${records.length} messages. Collection size: ${collectionSize}`
            );

            this.serviceClient['putRecordBatch'].call(
              this.serviceClient,
              params,
              (err, resp) => {
                if (err) {
                  console.error('[Firehose Destination] ERROR ', err);
                  return reject(err);
                }

                // check if some of the messages were not consumed:
                if (resp.FailedPutCount > 0) {
                  console.error(
                    `[Firehose Destination] FailedPutCount ${resp.FailedPutCount}`
                  );

                  // retry after delay:
                  delay(5 * SECONDS).then(() => {
                    sendAttempt(
                      records.slice(-1 * Number(resp.FailedPutCount))
                    );
                  });
                  return;
                }

                // job finished:
                console.log(
                  `[Firehose Destination] finished sending ${params.Records.length} messages`
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
            `[Firehose Destination] could not split records into batches`,
            err
          );
          return reject(err);
        }

        const messagesTotal = params.Records.length;
        console.log(
          `[Firehose Destination] pushing ${messagesTotal} messages in ${chunks.length} chunk(s)`
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
        const promises = chunks.map(ch => limiter.schedule(sendToFirehose, ch));
        Promise.all(promises)
          .then(responses => {
            console.log(
              `[Firehose Destination] finished sending ${messagesTotal} messages in ${chunks.length} chunk(s)`
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
  constructor: KinesisFirehoseDestination
};
