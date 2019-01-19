import {injectable} from 'inversify';
import 'reflect-metadata';

@injectable()
export class PipelineBuilder {
  private logger: Console;

  constructor() {
    this.logger = console;
  }

  build(config: PipelineConfig): Pipeline {
    this.logger.log('building a new pipeline', config);
    return new Pipeline();
  }
}

export interface PipelineConfig {

}

export class Pipeline {

}
