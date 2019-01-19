import * as program from 'commander';
import * as fs from 'fs';
import {RunOptions} from './options/run-options';
import {Pipeline} from '@datapull/pipeline';

class DatapullCli {
  private static get version(): string {
    const packageJson = fs.readFileSync('./package.json').toString('utf-8');
    const json = JSON.parse(packageJson);
    return json.version;
  }

  static buildPipelines(file: string) {
    let fileContents;
    try {
      fileContents = fs.readFileSync(file, 'utf-8');
    } catch (e) {
      console.error("Exception while reading specified file");
      console.error(e);
      return;
    }

    if (!fileContents) {
      console.error("Could not read specified file");
      return;
    }

    const pipelineConfig = Pipeline.parse(fileContents);
    if (!pipelineConfig) {
      return;
    }

    let pipelines;
    try {
      pipelines = Pipeline.build(pipelineConfig);
    } catch (e) {
      console.error("Could not build the pipeline");
      console.error(e);
      return [];
    }

    return pipelines;
  }

  static runPipelines(file: string, options: RunOptions) {
    console.log('[OPTIONS] ', options.maxConcurrent, options.noPush);

    const pipelines = DatapullCli.buildPipelines(file);
    console.log('pipelines', pipelines);

    // const scheduler = new Scheduler({
    //   name: "CLI single schedule",
    //   maxConcurrent: options.maxConcurrent,
    //   runImmediately: true,
    //   runEveryXMinutes: 60,
    //   pipelineConfig: {
    //     dryRun: options.noPush
    //   }
    // });

    // scheduler.launch(pipelines);
  }

  static runCLI() {
    program
      .version(DatapullCli.version)
      .usage("<command> [options]");

    program
      .command("run <file>")
      .option('--maxConcurrent <number>', "How many pipelines to run concurrently", 10)
      .option('--noPush <boolean>', "Run pipeline without pushing messages to the final destination", false)
      .action(DatapullCli.runPipelines);

    program.parse(process.argv);
  }
}

export function run() {
  DatapullCli.runCLI();
}

if (require.main === module) {
  run();
}
