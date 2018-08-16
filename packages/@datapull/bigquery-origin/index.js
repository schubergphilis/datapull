const processConfig = require('@datapull/json-config').processConfig;
const template = require('lodash/template');


class BigQueryOrigin {
  constructor(stepConfig) {
    // replace variables in the config:
    try {
      this.config = processConfig(stepConfig);
    } catch (err) {
      throw Error(`Could not parse config of BigQuery origin ${err}`);
    }
  }

  get originDeclaration() {
    return {
      name: ['BigQuery', this.config.endpoint].join(':'),
      runner: this.pullData.bind(this)
    };
  }

  pullData(pipelineConfig) {
    // merge step and pipeline configs:
    let mergedConfig = Object.assign(
      {
        // TODO: some defaults
      },
      pipelineConfig ? pipelineConfig.bigQuery || {} : {},
      this.config
    );

    // validate config:
    if (!mergedConfig.query) {
      throw Error('BigQuery Origin: query is not set up. Please specify `query` in the config');
    }

    // build bigquery client:
    const bq = ???; // TODO


    // prepare the query:
    const data = {
      pipelineConfig: pipelineConfig
    };
    const query = template(mergedConfig.queryTemplate, {
      interpolate: /\${([\s\S]+?)}/g,
    })(data);


    // execute the query:
    console.log(`[BigQuery Origin] Running the query: ${query}`);

    return bq.query(query)
      .catch(err => {
      console.error('[BigQuery Origin]', err);
      throw err;
    })
  }
}

exports.datapullStep = {
  isOrigin: true,
  constructor: BigQueryOrigin
};
