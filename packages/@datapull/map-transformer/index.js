class MapTransformer {
  constructor(config) {
    this.config = config;
  }
  transform(data) {
    let r = [];

    const method = this.config.method || this.config;

    // take all the keys of all the objects in the item and return them as a list of { _key: key, _value: value} pairs
    if (method === 'objectKeysValuesToList') {

      data.forEach(item => {
        Object.keys(item).map(k => {
          const r = { _key: k, _value: item[k]};

          if (this.config.keepKeys) {
            const keptEntries = Object.entries(item)
              .filter(([key]) => this.config.keepKeys.includes(key))
              .reduce((obj, [key, val]) => Object.assign(obj, { [key]: val }), {});

            Object.assign(r, keptEntries);
          }

          return r;
        }).forEach(transformedItem => {
          r.push(transformedItem);
        });
      });
      return Promise.resolve(r);
    }

    if (method === 'mergeArrays') {
      return Promise.resolve([].concat(...data));
    }

    throw Error(`Unsupported map method: ${method}`);
  }
}

exports.datapullStep = {
  isTransformer: true,
  constructor: MapTransformer
};
