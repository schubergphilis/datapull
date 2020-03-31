var jp = require('jsonpath');

/**
 * Example:
 *
 * source tree:

 {
   Results: [
    {
       value1: "A"
       value2: "B",
       subResults: [
         { value3: "C" },
         { value3: "D" },
       ]
    }
   ]
 }

 * configure the transform step:
 *
 - jsonpath-flatlist:
     query: $.subResults.*
     captureParentFields:
       - value1
       - value2

 * The result of transformation will be:

   [ { value1: "A", value2: "B" value3: "C" }, { value1: "A", value2: "B", value3: "D" } ]

 */
class JsonPathFlatListTransformer {
  constructor(config) {
    console.log('[JsonPathFlatListTransformer]', config);
    this.config = config;
  }
  transform(data) {
    // find all nodes for specified query:
    const nodes = jp.nodes(data, this.config.query);
    const selectedData = [];

    nodes.forEach(node => {
      const value = node.value;
      const fullPath = node.path;
      const currentPath = [];

      // start querying for parent objects for each found node:
      fullPath.forEach(part => {
        currentPath.push(part);

        const parentNodes = jp.query(data, currentPath.join('.'));
        if (parentNodes.length === 0) {
          return;
        }

        // if a parent object has a property that is specified in the config, put that property to a resulting node
        this.config.captureParentFields.forEach(key => {
          if (parentNodes[0].hasOwnProperty(key)) {
            value[key] = parentNodes[0][key];
          }
        });
      });

      selectedData.push(value);
    });

    return Promise.resolve(selectedData);
  }
}

exports.datapullStep = {
  isTransformer: true,
  constructor: JsonPathFlatListTransformer
};
