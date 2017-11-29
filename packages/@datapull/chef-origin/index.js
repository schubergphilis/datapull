const util = require('util');
const fs = require('fs');
const chef_api = require("chef-api");

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
        const results = [];
        for (const nodeName in nodes) {
            if (nodes.hasOwnProperty(nodeName)) {
                const node = util.promisify(chef.getNode)(nodeName);
                results.push(node);
            }
        }

        return await Promise.all(results);
    }
}

exports.datapullStep = {
    isOrigin: true,
    constructor: ChefOrigin
};
