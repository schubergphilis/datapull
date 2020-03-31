const program = require('commander');
const Table = require('cli-table2');
const fs = require('fs');
const datapullPipeline = require('@sbp-datapull/pipeline');
const Scheduler = require('@sbp-datapull/pipelines-scheduler').Scheduler;
const packagejson = require('./package.json');

const buildPipelines = function (file)
{
  let fileContents;
  try
  {
    fileContents = fs.readFileSync(file, 'utf-8');
  } catch (e)
  {
    console.error('Could not read specified file');
    console.error(e);
  }

  const pipelineConfig = datapullPipeline.parse(fileContents);
  if (!pipelineConfig)
  {
    return;
  }

  let pipelines;
  try
  {
    pipelines = datapullPipeline.build(pipelineConfig);
  } catch (e)
  {
    console.error('Could not build the pipeline');
    console.error(e);
    return [];
  }

  return pipelines;
};

exports.run = function ()
{
  console.log('Datapull version', packagejson.version);

  program.version(packagejson.version).usage('<command> [options]');

  program.command('plan <file>').action(function (file)
  {
    const pipelines = buildPipelines(file);

    console.log(`${pipelines.length} pipelines planned:`);

    // output table:

    pipelines.forEach(p =>{
      const table = new Table({
        head: ['config', 'origin', 'transformers', 'destination'],
        colWidths: [45, 30, 30, 30]
      });

      const configValues = Object.values(p.config);
      const rowSpan = configValues.length;
      table.push([
        JSON.stringify(configValues[0]),
        { rowSpan, content: p.origin.name },
        {
          rowSpan,
          content: p.transformers.map(t => `${t.name}(${t.config})`).join('\n')
        },
        { rowSpan, content: p.destination.name }
      ]);
      for (let i = 1; i < configValues.length; i++)
      {
        table.push([JSON.stringify(configValues[i])]);
      }

      console.log(table.toString());
      console.log();

      console.log('The following template will be used to build messages:');
      console.log(p.messageTemplate);
      console.log();

      console.log('Message preview:');
      console.log(
        datapullPipeline.buildMessage(p.messageTemplate, {}, 'sample data')
      );
    });
  });

  program
    .command('preview <file>')
    .option(
      '--maxConcurrent <number>',
      'How many pipelines to run concurrently'
    )
    .action(function (file, options)
    {
      const pipelines = buildPipelines(file);

      const scheduler = new Scheduler({
        name: 'CLI single schedule',
        maxConcurrent: options.maxConcurrent,
        runImmediately: true,
        runEveryXMinutes: 60,
        pipelineConfig: {
          dryRun: true
        }
      });

      scheduler.launch(pipelines);
    });

  program.command('stats <file>').action(function (file)
  {
    const pipelines = buildPipelines(file);
    pipelines.forEach((pipeline, idx) =>
    {
      console.log(`[CLI stats] Dry run for pipeline #${idx}`);
      datapullPipeline.statsOnly(pipeline).catch(err =>
      {
        console.log(`[CLI stats] pipeline #${idx} failed`, err);
      });
    });
  });

  program
    .command('run <file>')
    .option(
      '--maxConcurrent <number>',
      'How many pipelines to run concurrently'
    )
    .action(function (file, options)
    {
      const pipelines = buildPipelines(file);

      const scheduler = new Scheduler({
        name: 'CLI single schedule',
        maxConcurrent: options.maxConcurrent,
        runImmediately: true,
        runEveryXMinutes: 60,
        pipelineConfig: {
          dryRun: false
        }
      });

      scheduler.launch(pipelines);
    });

  program.parse(process.argv);
};
