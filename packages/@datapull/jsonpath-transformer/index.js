var jp = require('jsonpath');

class JsonPathTransformer {
  constructor(config) {
    this.config = config;
  }
  transform(data) {
    const selectedData = jp.query(data, this.config);
    // console.log('[JsonPathTransformer]', JSON.stringify(selectedData));
    return Promise.resolve(selectedData);
  }
}

exports.datapullStep = {
  isTransformer: true,
  constructor: JsonPathTransformer
};
