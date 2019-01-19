import {inject, injectable} from 'inversify';
import 'reflect-metadata';

@injectable()
export class PipelineBuilder {

  constructor(@inject('logger') private logger: Console) {
  }

  build(config: PipelineConfig): Pipeline {
    this.logger.info('building a new pipeline');
    this.logger.debug(config);
    return new Pipeline();
  }
}

export interface PipelineConfig {

}

export class Pipeline {

}
