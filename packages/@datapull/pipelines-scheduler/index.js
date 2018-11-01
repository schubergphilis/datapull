const datapullPipeline = require('@datapull/pipeline');
const Bottleneck = require("bottleneck");

const SECONDS = 1000;
const MINUTES = 60 * SECONDS;

class Scheduler {
  constructor(config) {
    this.config = config;
    this.scheduleName = this.config.name || 'Untitled schedule';
  }

  launch(pipelines) {
    if (this.config.runImmediately) {
      return this.run(pipelines);
    }

    if (this.config.runEveryXMinutes) {
      console.log(`[Pipelines Scheduler] scheduling ${pipelines.length} pipelines run for every ${this.config.runEveryXMinutes} minutes`);
      setInterval(this.run.bind(this, pipelines), this.config.runEveryXMinutes * MINUTES);
    }
  }

  run(pipelines) {
    // setup the limiter:const rateLimitConfig = pipelineConfig.rateLimiter || {};
    const maxConcurrent = this.config.maxConcurrent || 100;

    const limiter = new Bottleneck(maxConcurrent);

    // run pipelines:
    const now = Date.now();

    console.log(`[Pipelines Scheduler] ${this.scheduleName}: starting new pipelines run. pipeline timestamp:`, now);
    console.log(`[Pipelines Scheduler] ${this.scheduleName}: number of pipelines scheduled:`, pipelines.length);
    console.log(`[Pipelines Scheduler] ${this.scheduleName}: number of pipelines to run in parallel:`, maxConcurrent);

    pipelines.forEach((pipeline, idx) => {

      // all pipelines should have the same timestamp:
      pipeline.timestamp = now;

      console.log(`[main] ${this.config.pipelineConfig.dryRun ? 'dry' : ''} run for pipeline #${idx}: ${pipeline.timestamp}`);

      limiter.schedule(datapullPipeline.run, pipeline, this.config.pipelineConfig || {});
    });


    limiter.on('idle', () => {
      console.log(`[Pipelines Scheduler] Schedule "${this.scheduleName}" queue is now idle`);
    });

    limiter.on('dropped', (dropped) => {
      console.warn(`[Pipelines Scheduler] Pipeline is dropped in schedule "${this.scheduleName}"`, dropped);
    });

    return limiter;
  }
}

exports.Scheduler = Scheduler;
