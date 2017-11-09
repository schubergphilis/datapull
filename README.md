# Datapull

Datapull pulls data from 3rd-party APIs and pushes it to a destination of choice.

Pipelines are described in a declarative way using `datapull.yml` format.

Example pipelines can be found in the `examples/` folder. 

## Supported Origins

* AWS SDK
* Okta (roadmap)
* DataDog (roadmap)
* Generic REST API (roadmap)

# Supported transformations

* `jsonpath` - pick fields from origin's response
* `count` - count the number of returned rows

## Destinations

* Amazon Kinesis Stream

# How to use
1. Install Datapull:
`$ npm install @datapull/pipeline --save`

2. Install needed plugins:
`$ npm install @datapull/aws-origin @datapull/aws-destination @datapull/jsonpath-transformer --save`

3. Build your yaml definition (see `examples/` folder)

4. Parse the file with the config:
```
const datapullPipeline = require('@datapull/pipeline');

const pipelineConfig = datapullPipeline.parse(fileContents);
if (!pipelineConfig) {
  console.error("Could not parse pipeline config");
  return;
}
```

5. Build pipelines out of your config:
```
try {
  pipelines = datapullPipeline.build(pipelineConfig);
} catch (e) {
  console.error("Could not build the pipeline");
  console.error(e);
  return;
}
```

6. Run your pipeline ('dryRun=true' will not send any messages to the destination):
```
const dryRun = true;
datapullPipeline
      .run(pipeline, dryRun)
      .catch(err => {
        console.log(`[main] pipeline #${idx} failed`, err);
      });
```
