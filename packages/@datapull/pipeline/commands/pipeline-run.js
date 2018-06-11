const buildMessage = require('./message-build').buildMessage;

exports.run = function (pipeline, options={}) {
  // prepare config:
  let config = null;

  if (!pipeline.timestamp) {
    pipeline.timestamp = Date.now();
  }

  if (pipeline.configProcessors) {
    console.log('[Pipeline] Run configuration');
    pipeline.configProcessors.forEach(processor => {
      config = processor.process(config || pipeline.config);
    });
  }

  pipeline.processedConfig = config;

  // run origin
  if (!pipeline.origin || !pipeline.origin.runner) {
    console.warn('[Pipeline] this pipeline does not have an origin or an origin runner')
    return;
  }
  return pipeline.origin.runner(config)
    .catch(err => {
      console.error('[Pipeline] failed pulling data from ', pipeline.origin.name, ':', err)
      throw err;
    })
    .then(resp => {
      pipeline.originRawData = resp;
      console.log(`[Pipeline] starting to transform data with ${pipeline.transformers.length} transformers`);

      return new Promise((resolve, reject) => {
        let transformedData = resp;

        // run transforms
        const transformers = pipeline.transformers.slice();
        (function runTransformers(idx) {

          if (!transformers[idx]) {  // no more transformers left
            return resolve(transformedData);
          }

          if(!transformers[idx].runner.transform) {
            return reject(`The transformer "${transformers[idx].name}" does not have a "transform" method`)
          }

          // transform data and recursively call runTransformer to proceed with the transformation chain
          transformers[idx].runner.transform(transformedData || resp)
            .catch(err => {
              console.error("Could not transform", transformers[idx].name, err);
              reject(err);
            })
            .then(data => {
              transformedData = data;
              runTransformers(idx + 1);
            });

        }(0));  // initialize the recursive "runTransformers" method
      });
    })
    .catch(err => {
      console.error('[Pipeline] transformation failed', pipeline.origin.name, ':', err);
      throw err;
    })
    .then(transformedData => {

      if (!pipeline.destination.runner) {
        return console.warn('[Pipeline] destination does not specify a runner');
      }

      // build message / messages:
      let messages = [];
      if (Array.isArray(transformedData)) {
        messages = transformedData.map(d => buildMessage(pipeline.messageTemplate, pipeline, d));
      } else {
        messages[0] = buildMessage(pipeline.messageTemplate, pipeline, transformedData);
      }

      // show stats if needed:
      if (options.showMessageSizes) {
        messages.forEach(m => {
          console.log('[Pipeline] base64 record size', new Buffer(JSON.stringify(m)).toString('base64').length);
        });
      }

      if (options.showOriginConfig) {
        console.log(`[Pipeline] config`, config);
      }

      if (options.showMessagesCount) {
        console.log(`[Pipeline] messages to be delivered: ${messages.length}`);
      }

      if (options.stopBeforeDestination) {
        return;
      }

      // run destination
      return pipeline.destination.runner(messages, options.dryRun);
    })
    .catch(err => {
      console.error('[Pipeline] sending failed', pipeline.origin.name, ':', err)
      throw err;
    })
    .then(resp => {
      console.log('[Pipeline] finished');
    });
};
