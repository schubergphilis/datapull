import {PipelineConfig} from '@datapull/pipeline/src';
import {injectable} from 'inversify';
import {ConfigParser} from './config-parser';

const parser = require('js-yaml');

@injectable()
export class YamlParser implements ConfigParser {
  parse(input: string): PipelineConfig {
    return parser.load(input);
  }
}
