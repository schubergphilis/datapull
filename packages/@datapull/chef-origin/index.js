const util = require('util');
const fs = require('fs');
const chef_api = require("chef-api");
const Bottleneck = require("bottleneck");

class ChefOrigin {

    constructor(stepConfig) {}

    get originDeclaration() {
        return {
            name: ['Chef'].join(':'),
            runner: this.pullData.bind(this)
        };
    }

    async pullData(pipelineConfig) {
        console.log('[Chef] pulling data for ', pipelineConfig.apiUrl);

        if (!pipelineConfig.key_path) {
          console.error(`[Chef origin] key path is not specified`);
          throw Error(`Key path is not specified`);
        }

        if (!fs.existsSync(pipelineConfig.key_path)) {
          console.error(`[Chef origin] key does not exist in the given path ${pipelineConfig.key_path}`);
          throw Error(`Key does not exist in the given path ${pipelineConfig.key_path}`);
        }

        const options = {
            user_name: pipelineConfig.username,
            key_path: pipelineConfig.key_path,
            url: pipelineConfig.apiUrl
        };

        const chef = new chef_api();
        chef.config(options);
        const nodes = await util.promisify(chef.getNodes)();

        // setup rate limiter:
        const rateLimitConfig = pipelineConfig.rateLimiter || {};
        const maxConcurrent = rateLimitConfig.maxConcurrent || 10;
        const minTime = rateLimitConfig.minTimeBetweenRequestsMs || 200;
        const highWater = rateLimitConfig.highWater || -1;
        const rateLimitStrategy = rateLimitConfig.rateLimitStrategy || 'BLOCK';
        const rejectOnDrop = 'rejectOnDrop' in rateLimitConfig ? rateLimitConfig.rejectOnDrop : true;

        const limiter = new Bottleneck(maxConcurrent, minTime, highWater, Bottleneck.strategy[rateLimitStrategy], rejectOnDrop);

        // get info of every node with a separate request:
        const results = Object.keys(nodes).map(nodeName => limiter.schedule(util.promisify(chef.getNode), nodeName));
        return await Promise.all(results);
    }
}

exports.datapullStep = {
    isOrigin: true,
    constructor: ChefOrigin
};
