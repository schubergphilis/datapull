const deepMap = require('deep-map');
const template = require('lodash/template');

// replaces variables in config objects:
function processConfig(config) {
  console.log('[JsonConfig] replace variables with ENV variables if needed');
  const data = {
    env: process.env
  };
  return deepMap(config, value => template(value, {
    interpolate: /\${([\s\S]+?)}/g,
  })(data));
}

class JsonConfig {
  constructor(config) {
    this.config = config;
  }

  buildPipelines(incomingConfigurations = []) {
    const r = [];

    // first initial config to start with:
    if (incomingConfigurations.length === 0) {
      incomingConfigurations.push({});
    }

    this.config.items.forEach(item => {
      Object.values(item).forEach(newConfig => {
        incomingConfigurations.forEach(existingConfig => {
          // extend incoming configurations with all keys from current configuration:
          const config = Object.assign(
            {},
            existingConfig,
            newConfig
          );
          r.push(config);
        });
      })
    });

    return r;
  }
  process(config) {
    return processConfig(config);
  }
}

exports.processConfig = processConfig;

exports.datapullStep = {
  isConfiguration: true,
  constructor: JsonConfig,

};
