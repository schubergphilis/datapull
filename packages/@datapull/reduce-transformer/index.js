class ReduceTransformer {
  constructor(config) {
    this.config = config;
  }
  transform(data) {
    if (this.config === 'count') {
      return Promise.resolve(data.length);
    }

    throw Error(`Unsupported reduce method ${this.config}`);
  }
}

exports.datapullStep = {
  isTransformer: true,
  constructor: ReduceTransformer
};
