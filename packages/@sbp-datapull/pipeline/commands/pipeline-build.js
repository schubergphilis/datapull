const deepcopy = require('deepcopy');
const omitBy = require('lodash/omitBy');

exports.build = function(config) {
  // 1 - get all the pipeline steps:
  const pipelineSteps = {
    configurations: [],
    origins: [],
    transformers: [],
    destinations: []
  };
  Object.keys(config)
    .filter(i => config[i].runner) // all top-level objects that do not specify a "runner" are ignored
    .forEach(k => {
      const runner = config[k].runner;
      const runnerParts = runner.split('.');
      const runnerModuleName = `@sbp-datapull/${runnerParts[0]}`;
      const runnerModule = require(runnerModuleName).datapullStep;

      const pureConfig = omitBy(config[k], function(_, k) {
        return k === 'extendMessage';
      });

      if (runnerModule.isConfiguration) {
        pipelineSteps.configurations.push({
          k,
          runner: new runnerModule.constructor(pureConfig),
          config: config[k]
        });
      }

      if (runnerModule.isTransformer) {
        pipelineSteps.transformers.push({
          k,
          runner: new runnerModule.constructor(pureConfig),
          config: config[k]
        });
      }

      if (runnerModule.isOrigin) {
        pipelineSteps.origins.push({
          k,
          runner: new runnerModule.constructor(pureConfig),
          config: config[k]
        });
      }

      if (runnerModule.isDestination) {
        pipelineSteps.destinations.push({
          k,
          runner: new runnerModule.constructor(pureConfig),
          config: config[k]
        });
      }
    });

  // 2 - start building pipelines (one yaml file may result in multiple pipelines)
  let pipelines = [];

  console.debug(
    '[Pipeline] Intermediate pipelineSteps.configurations',
    pipelineSteps.configurations.length
  );
  console.debug(
    '[Pipeline] Intermediate pipelineSteps.origins',
    pipelineSteps.origins.length
  );

  // 2.1 - configuration:
  const configProcessors = [];
  pipelineSteps.configurations.forEach(configurator => {
    if (!configurator.runner.buildPipelines) {
      console.warn(configurator.k, 'does not define `buildPipelines` method');
      return;
    }
    pipelines = configurator.runner.buildPipelines(pipelines);

    // extend message template:
    pipelines.forEach(p => {
      if (p.extendMessage) {
        if (!p.messageTemplate) {
          p.messageTemplate = {};
        }
        p.messageTemplate = Object.assign(
          {},
          p.messageTemplate,
          p.extendMessage
        );
      }
    });

    if (configurator.runner.process) {
      configProcessors.push(configurator.runner);
    }
  });

  pipelines = pipelines.map(p => {
    return { config: p, configProcessors, messageTemplate: p.messageTemplate };
  });

  // if there is no config defined, create an empty one:
  if (!pipelines.length) {
    pipelines.push({
      config: {},
      configProcessors: [],
      messageTemplate: {}
    });
  }

  console.debug('[Pipeline] intermediate pipelines length:', pipelines.length);

  // 3 - set up origins:
  const newPipelines = [];

  pipelineSteps.origins.forEach(origin => {
    if (!origin.runner.originDeclaration) {
      console.warn(origin.k, 'does not define `originDeclaration` method');
      return;
    }

    pipelines.forEach(p => {
      const originDeclaration = origin.runner.originDeclaration;

      // get transformers that are defined on the origin level:
      if (origin.config.transform) {
        originDeclaration.transformers = [];

        origin.config.transform.forEach(transformer => {
          Object.keys(transformer).forEach(transformerName => {
            const transformerConfig = transformer[transformerName];
            originDeclaration.transformers.push({
              name: transformerName,
              config: transformerConfig
            });
          });
        });
      }

      // if there is already an origin defined, branch out a new pipeline with this origin
      if (p.origin) {
        newPipelines.push(
          Object.assign(deepcopy(p), {
            origin: Object.assign({}, originDeclaration, {
              extendMessage: origin.config.extendMessage
            })
          })
        );
      } else {
        p.origin = Object.assign({}, originDeclaration, {
          extendMessage: origin.config.extendMessage
        });
        newPipelines.push(p);
      }
    });
  });

  pipelines = newPipelines;

  pipelines.forEach(p => {
    // extend message template:
    if (!p.messageTemplate) {
      p.messageTemplate = {};
    }
    if (p.origin.extendMessage) {
      p.messageTemplate = Object.assign(
        {},
        p.messageTemplate,
        p.origin.extendMessage
      );
    }
  });

  // 4 - set up transformers that are set on the origin level:
  pipelines.forEach(p => {
    if (p.origin && p.origin.transformers) {
      p.origin.transformers.forEach(t => {
        if (!p.transformers) {
          p.transformers = [];
        }

        const transformerModuleName = `@sbp-datapull/${t.name}-transformer`;
        const transformerModule = require(transformerModuleName).datapullStep;
        if (!transformerModule.isTransformer) {
          console.error('Module is not transformer: ', t.name);
        }
        p.transformers.push(
          Object.assign({}, t, {
            runner: new transformerModule.constructor(t.config)
          })
        );
      });
    }
  });

  // 5 - setup global transformers
  pipelines.forEach(p => {
    if (!p.transformers) {
      p.transformers = [];
    }
  });
  pipelineSteps.transformers.forEach(transformer => {
    if (!transformer.runner.buildPipelines) {
      console.warn(transformer.k, 'does not define `buildPipelines` method');
      return;
    }
    pipelines = transformer.runner.buildPipelines(pipelines);
  });

  // 6 - set up destinations:
  pipelineSteps.destinations.forEach(destination => {
    if (!destination.runner.buildPipelines) {
      console.warn(destination.k, 'does not define `buildPipelines` method');
      return;
    }
    pipelines = destination.runner.buildPipelines(pipelines);

    // extend message template:
    if (destination.config.extendMessage) {
      pipelines.forEach(p => {
        if (!p.messageTemplate) {
          p.messageTemplate = {};
        }
        p.messageTemplate = Object.assign(
          {},
          p.messageTemplate,
          destination.config.extendMessage
        );
      });
    }
  });

  return pipelines;
};
