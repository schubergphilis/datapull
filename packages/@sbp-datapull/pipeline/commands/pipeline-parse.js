const parser = require('js-yaml');

exports.parse = function (yaml) {
  try {
    return parser.load(yaml);
  } catch (e) {
    console.error("Could not load yaml file");
    console.error(e);
    return undefined;
  }
};
