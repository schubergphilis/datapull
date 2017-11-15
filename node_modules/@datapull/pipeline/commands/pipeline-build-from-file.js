const fs = require('fs');
const parse = require('./pipeline-parse').parse;
const build = require('./pipeline-build').build;

exports.buildFromFile = function (file) {
  // read config:
  let fileContents;
  try {
    fileContents = fs.readFileSync(file, 'utf-8');
  } catch (e) {
    console.error("Could not read specified file");
    console.error(e);
    return;
  }

  // parse file with config:
  const pipelineConfig = parse(fileContents);
  if (!pipelineConfig) {
    console.error("Could not parse pipeline config");
    return;
  }

  let pipelines;
  try {
    pipelines = build(pipelineConfig);
  } catch (e) {
    console.error("Could not build the pipeline");
    console.error(e);
    return;
  }

  return pipelines;
};
