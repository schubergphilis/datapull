export class Pipeline {
  static parse(pipelineConfig: string): object {
    console.log('pipeline parsed!', pipelineConfig);
    return {};
  }

  static build(config: object) {
    console.log('build', config);
  }
}
