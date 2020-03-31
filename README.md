# Datapull

Datapull pulls data from 3rd-party APIs and pushes it to a destination of choice.

Pipelines are described in a declarative way using `datapull.yml` format.

Example pipelines can be found in the `examples/` folder.

## Supported Origins

- Generic REST API (roadmap)
- AWS
- Splunk
- Okta (roadmap)
- DataDog (roadmap)

# Supported transformations

- `jsonpath` - pick fields from origin's response
- `filter` - exclude data from the data set
- `map` - transform the data
- `reduce` - reduce the data set to a single value / value object

## Destinations

- Amazon Kinesis Stream

# How to use

1. Install Datapull:
   `$ npm install @sbp-datapull/pipeline --save`

2. Install needed plugins:
   `$ npm install @sbp-datapull/aws-origin @sbp-datapull/aws-destination @sbp-datapull/jsonpath-transformer --save`

3. Build your yaml definition (see `examples/` folder for an example)

4. Build your pipelines:

```
const datapullPipeline = require('@sbp-datapull/pipeline');
const pipelines = datapullPipeline.buildFromFile(file);
```

5. Run your pipelines:

```
const Scheduler = require('@sbp-datapull/pipelines-scheduler');
const scheduler = new Scheduler({
  runImmediately: true,
  runEveryXMinutes: 60,
  dryRun: true
});
scheduler.launch(pipelines);
```
