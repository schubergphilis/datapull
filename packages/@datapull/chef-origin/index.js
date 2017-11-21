const util = require('util');
const request = require('request-promise-native');
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
            organization: this.config.organization
        };

        const chef = new chef_api();
        chef.config(options);
        nodes = utils.promisify(chef.getNodes)()
        console.log(nodes);

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
