exports.parse = require('./commands/pipeline-parse').parse;
exports.build = require('./commands/pipeline-build').build;
exports.buildMessage = require('./commands/message-build').buildMessage;

exports.run = require('./commands/pipeline-run').run;
exports.dryRun = function (pipeline) {
  return exports.run(pipeline, { dryRun: true });
};
exports.statsOnly = function (pipeline) {
  return exports.run(pipeline, { dryRun: true, stopBeforeDestination: true, showMessagesCount: true, showOriginConfig: true });
};

exports.buildFromFile = require('./commands/pipeline-build-from-file').buildFromFile;
