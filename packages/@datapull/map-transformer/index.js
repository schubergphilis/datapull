class MapTransformer {
  constructor(config) {
    this.config = config;
  }
  transform(data) {
    let r = [];

    // take all the keys of all the objects in the item and return them as a list of { _key: key, _value: value} pairs
    if (this.config === 'objectKeysValuesToList') {

      data.forEach(item => {
        Object.keys(item).map(k => {
          return { _key: k, _value: item[k]};
        }).forEach(transformedItem => {
          r.push(transformedItem);
        });
      });
      return Promise.resolve(r);
    }

    if (this.config === 'mergeArrays') {
      r = [].concat.apply([], data);
      return Promise.resolve(r);
    }

    throw Error(`Unsupported map method: ${this.config}`);
  }
}

exports.datapullStep = {
  isTransformer: true,
  constructor: MapTransformer
};
