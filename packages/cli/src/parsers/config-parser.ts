import {PipelineConfig} from '@datapull/pipeline';

export interface ConfigParser {
  parse(input: string): PipelineConfig
}
