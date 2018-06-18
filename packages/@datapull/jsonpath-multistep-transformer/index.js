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
     transform:
       - jsonpath-multistep:
       steps:
       - query: $.Results.*
       - query: $.subResults.*
         captureFromPreviousStep:
           value1: $.value1

 * The result of transformation will be:

   [ { value1: "A", value3: "C" }, { value1: "A", value3: "D" } ]

 */
class JsonPathMultistepTransformer {
  constructor(config) {
    console.log('[JsonPathMultistepTransformer]', config);
    this.config = config;
  }
  transform(data) {
    let selectedData = data;

    this.config.steps.forEach(step => {
      // if working with list of items, treat each item as a root of a separate tree
      if (Array.isArray(selectedData)) {
        let r = [];
        selectedData.forEach(parent => {
          let children = jp.query(parent, step.query);

          // capture requested values from parent object:
          if (step.captureFromPreviousStep) {
            children.forEach(item => {
              Object.keys(step.captureFromPreviousStep).forEach(key => {
                const q = step.captureFromPreviousStep[key];
                let value = jp.query(parent, q);
                if (Array.isArray(value) && value.length === 1) {
                  item[key] = value[0];
                } else {
                  item[key] = value;
                }
              });
            });
          }
          r = r.concat(children);
        });
        selectedData = r;
        return;
      }

      selectedData = jp.query(selectedData, step.query);
    });
    return Promise.resolve(selectedData);
  }
}

exports.datapullStep = {
  isTransformer: true,
  constructor: JsonPathMultistepTransformer
};
