const processConfig = require('@datapull/json-config').processConfig;
const Influx = require('influx');
const template = require('lodash/template');

class InfluxOrigin {
  constructor(stepConfig) {
    // replace variables in the config:
    try {
      this.config = processConfig(stepConfig);
    } catch (err) {
      throw Error(`Could not parse config of Influx origin ${err}`);
    }
  }

  get originDeclaration() {
    return {
      name: ['InfluxDB', this.config.endpoint].join(':'),
      runner: this.pullData.bind(this)
    };
  }

  pullData(pipelineConfig) {
    // merge step and pipeline configs:
    let mergedConfig = Object.assign(
      {
        port: 443,
        protocol: 'https'
      },
      pipelineConfig ? pipelineConfig.influx || {} : {},
      this.config
    );

    // validate config:
    if (!mergedConfig.endpoint) {
      throw Error('Influx Origin: endpoint is not set up. Please specify `endpoint` in the config');
    }
    if (!mergedConfig.database) {
      throw Error('Influx Origin: database is not set up. Please specify `database` in the config');
    }
    if (!mergedConfig.username) {
      throw Error('Influx Origin: username is not set up. Please specify `username` in the config');
    }
    if (!mergedConfig.password) {
      throw Error('Influx Origin: password is not set up. Please specify `password` in the config');
    }
    if (!mergedConfig.queryTemplate) {
      throw Error('Influx Origin: queryTemplate is not set up. Please specify `queryTemplate` in the config');
    }

    // build influx client:
    const influx = new Influx.InfluxDB({
      host: mergedConfig.endpoint,
      port: mergedConfig.port,
      database: mergedConfig.database,
      username: mergedConfig.username,
      password: mergedConfig.password,
      protocol: mergedConfig.protocol
    });

    // prepare the query:
    const data = {
      pipelineConfig: pipelineConfig
    };
    const query = template(mergedConfig.queryTemplate, {
      interpolate: /\${([\s\S]+?)}/g,
    })(data);

    console.log(`[Influx Origin] Running the query: ${query}`);

    return influx.query(query)
      .catch(err => {
      console.error('[Influx origin]', err);
      throw err;
    })
  }
}

exports.datapullStep = {
  isOrigin: true,
  constructor: InfluxOrigin
};
