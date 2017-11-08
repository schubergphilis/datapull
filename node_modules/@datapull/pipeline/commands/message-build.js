const template = require('lodash/template');
const pad = require('lodash/padStart');

exports.buildMessage = function (messageTemplate, pipeline, data) {
  if (!pipeline.timestamp) {
    pipeline.timestamp = Date.now();
  }

  const pipelineDate = new Date(pipeline.timestamp);
  const dataString = JSON.stringify(data);

  const templateVars = Object.assign({}, {
    pipeline: {
      timestamp: pipeline.timestamp,
      date: pipelineDate,
      time: {
        year: pipelineDate.getFullYear(),
        month: pad(String(pipelineDate.getMonth() + 1), 2, '0')
      }
    }
  }, {data: dataString}, {rawData: data});

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
        r[k] = template(v, templateSettings)(templateVars);

        // check for numeric values:
        if (!isNaN(r[k])) {
          r[k] = Number(r[k]);
        }
      }
    });
    return r;
  }

  return replaceVariables(Object.assign({}, messageTemplate));
};
