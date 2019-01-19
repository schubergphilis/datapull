import {PipelineBuilder, PipelineConfig} from '@datapull/pipeline';
import {createLogger, DEBUG} from 'bunyan';
import * as program from 'commander';
import * as fs from 'fs';
import {Container, inject, injectable} from 'inversify';
import 'reflect-metadata';
import {RunOptions} from './options/run-options';
import {ConfigParser} from './parsers/config-parser';
import {YamlParser} from './parsers/yaml-parser';
import {Types} from './symbols';

@injectable()
class DatapullCli {
  constructor(
    @inject(Types.ConfigParser) private fileParser: ConfigParser,
    @inject(Types.PipelineBuilder) private pipelinesBuilder: PipelineBuilder,
    @inject('logger') private logger: Console,
  ) {
  }

  private static get version(): string {
    const packageJson = fs.readFileSync('./package.json').toString('utf-8');
    const json = JSON.parse(packageJson);
    return json.version;
  }

  buildPipelines(file: string) {
    let fileContents;
    try {
      fileContents = fs.readFileSync(file, 'utf-8');
    } catch (e) {
      console.error("Exception while reading specified file");
      console.error(e);
      return;
    }

    if (!fileContents) {
      console.error("Could not read specified file", file);
      throw Error("Could not read specified file");
    }

    let pipelineConfig: PipelineConfig;
    try {
      pipelineConfig = this.fileParser.parse(fileContents);
    } catch (err) {
      console.error('[ERROR] Could not parse file', file, err);
      throw err;
    }

    let pipelines;
    try {
      pipelines = this.pipelinesBuilder.build(pipelineConfig);
    } catch (e) {
      console.error("Could not build the pipeline");
      console.error(e);
      return [];
    }

    return pipelines;
  }

  runPipelines(file: string, options: RunOptions) {
    this.logger.info('Running pipelines', file);
    this.logger.debug('[OPTIONS] ', options.maxConcurrent, options.noPush);

    const pipelines = this.buildPipelines(file);
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

  runCLI() {
    program
      .version(DatapullCli.version)
      .usage("<command> [options]");

    program
      .command("run <file>")
      .option('--maxConcurrent <number>', "How many pipelines to run concurrently", 10)
      .option('--noPush <boolean>', "Run pipeline without pushing messages to the final destination", false)
      .action(this.runPipelines.bind(this));

    program.parse(process.argv);
  }
}

export function run() {
  const logger = createLogger({name: '@datapull/cli'});
  logger.level(DEBUG);

  const container = new Container();
  container.bind(DatapullCli).toSelf();
  container.bind(Types.ConfigParser).to(YamlParser);
  container.bind(Types.PipelineBuilder).to(PipelineBuilder);
  container.bind('logger').toConstantValue(logger);
  container.get(DatapullCli).runCLI();

}

if (require.main === module) {
  run();
}
