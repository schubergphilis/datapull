const template = require('lodash/template');
const pad = require('lodash/padStart');
const moment = require('moment');
const uuidv4 = require('uuid/v4');

exports.buildMessage = function (messageTemplate, pipeline, data) {
  if (!pipeline.timestamp) {
    pipeline.timestamp = Date.now();
  }
  if (!pipeline.uuid) {
    pipeline.uuid = uuidv4();
  }

  const pipelineDate = new Date(pipeline.timestamp);
  const dataString = JSON.stringify(data);

  const templateVars = Object.assign({}, {
    pipeline: {
      config: {
        raw: pipeline.config,
        processed: pipeline.processedConfig
      },
      timestamp: pipeline.timestamp,
      uuid: pipeline.uuid,
      date: pipelineDate,
      time: {
        year: pipelineDate.getFullYear(),
        month: pad(String(pipelineDate.getMonth() + 1), 2, '0')
      }
    },
    moment: moment,
    env: process.env,
    uuidv4: uuidv4
  }, {data: dataString}, {rawData: data}, {originRawData: pipeline.originRawData});

  const templateSettings = {
    interpolate: /\${([\s\S]+?)}/g,
  };

  function replaceVariables(obj) {
    const r = {};
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (typeof v === 'object') {
        r[k] = replaceVariables(obj[k]);
      } else {
        // parse the template:
        try {
          r[k] = template(v, templateSettings)(templateVars);

          // check for numeric values:
          if (!isNaN(r[k])) {
            r[k] = Number(r[k]);
          }

          // check for boolean values:
          if (r[k] === 'true') {
            r[k] = true;
          }
          if (r[k] === 'false') {
            r[k] = false;
          }

          // check if the value is json parseable:
          if (typeof r[k] === 'string' && r[k].startsWith("{") && r[k].endsWith("}")) {
            try {
              r[k] = JSON.parse(r[k]);
            } catch (err) {
              // no-op
            }
          }
        } catch (e) {
          console.warn(`[Pipeline message build] Could not parse template for key ${k}, got exception: ${e}`);
          console.warn(`[Pipeline message build] Setting ${k} value to null`);
          r[k] = null;
        }
      }
    });
    return r;
  }

  return replaceVariables(Object.assign({}, messageTemplate));
};
