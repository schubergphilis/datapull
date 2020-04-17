var jp = require('jsonpath');

class MapTransformer {
  constructor(config) {
    this.config = config;
  }
  transform(data) {
    return new Promise((resolve, reject) => {
      // find condition method (it will check if an item passes a condition or not)
      if (!this.config.condition) {
        return reject("No filter condition is specified in filter transformer");
      }

      // parse the condition name / condition arguments
      const configConditionsParts = String(this.config.condition).split(':');
      const configCondition = configConditionsParts.shift();

      const conditions = this.conditions();
      if (!conditions[configCondition]) {
        return reject(`No known filter condition: ${configCondition}`);
      }

      const conditionMethod = conditions[configCondition].bind(this);

      // filter the items:
      const r = data.filter(item => {
        // pick a value to apply condition to:
        if (this.config.value) {
          const value = jp.query(item, this.config.value);
          if (value.length === 0) {
            return false; // this should not be in the resulting data set
          }
          return conditionMethod(value[0], configConditionsParts);
        }

        // apply the condition to the whole item:
        return conditionMethod(item, configConditionsParts);
      });

      resolve(r);
    });
  }

  conditions() {
    return {
      isNumeric(value) {
        return require('./conditions/is-numeric').isNumeric(value);
      },
      isNot(value, isNotValue) {
        return require('./conditions/is-not').isNot(value, isNotValue);
      }
    };
  }
}

exports.datapullStep = {
  isTransformer: true,
  constructor: MapTransformer
};
