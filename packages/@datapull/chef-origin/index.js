const util = require('util');
const chef_api = require("chef-api");

class ChefOrigin {

    constructor(config) {
        this.config = config;
    }

    get originDeclaration() {
        return {
            name: ['Chef', this.config.organization].join(':'),
            runner: this.pullData.bind(this)
        };
    }

    async pullData(config) {
        console.log('[Chef] pulling data for ', config.searchName);

        const options = {
            user_name: config.username,
            key_path: config.key_path,
            url: config.apiUrl
        };

        const chef = new chef_api();
        const nodes = await util.promisify(chef.getNodes)()
        const results = [];
        for (const nodeName in nodes) {
            if (nodes.hasOwnProperty(nodeName)) {
                console.log(nodeName);
                const node = await util.promisify(chef.getNode)(nodeName);
                results.push({
                    name: nodeName,
                    chef_environment: node['chef_environment'],
                    run_list: node['run_list']
                });
            }
        }

        return results;
    }
}

async function sleep(msec) {
    return new Promise(resolve => setTimeout(resolve, msec));
}

exports.datapullStep = {
    isOrigin: true,
    constructor: ChefOrigin
};
