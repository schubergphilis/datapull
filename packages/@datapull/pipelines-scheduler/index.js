const datapullPipeline = require('@datapull/pipeline');

const SECONDS = 1000;
const MINUTES = 60 * SECONDS;

class Scheduler {
  constructor(config) {
    this.config = config;
  }

  launch(pipelines) {
    if (this.config.runImmediately) {
      this.run(pipelines);
    }

    if (this.config.runEveryXMinutes) {
      setInterval(this.run.bind(this, pipelines), this.config.runEveryXMinutes * MINUTES);
    }
  }

  run(pipelines) {
    // run pipelines:
    const now = Date.now();
    console.log('starting new pipelines run:', now);
    pipelines.forEach((pipeline, idx) => {

      // all pipelines should have the same timestamp:
      pipeline.timestamp = now;

      console.log(`[main] run for pipeline #${idx}: ${pipeline.timestamp}`);

      datapullPipeline
        .run(pipeline, this.config.dryRun)
        .catch(err => {
          console.log(`[main] pipeline #${idx} failed`, err);
        });
    });
  }
}

exports.Scheduler = Scheduler;