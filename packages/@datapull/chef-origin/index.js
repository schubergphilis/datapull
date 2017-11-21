const util = require('util');
const objectPath = require('object-path');
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
        chef.config(options);
        const nodes = await util.promisify(chef.getNodes)()
        const results = [];
        for (const nodeName in nodes) {
            if (nodes.hasOwnProperty(nodeName)) {
                const node = await util.promisify(chef.getNode)(nodeName);
                const info = {
                    name: nodeName,
                    chef_environment: node['chef_environment'],
                    automatic: {
                        cpu: {
                            total: objectPath.get(node, 'automatic.cpu.total'),
                            cores: objectPath.get(node, 'automatic.cpu.cores'),
                            real: objectPath.get(node, 'automatic.cpu.real')
                        },
                        kernel: {
                            name: objectPath.get(node, 'automatic.kernel.name'),
                            os: objectPath.get(node, 'automatic.kernel.os')
                        },
                        filesystem: objectPath.get(node, 'automatic.filesystem'),
                        memory: {
                            total: objectPath.get(node, 'automatic.memory.total'),
                            free: objectPath.get(node, 'automatic.memory.free')
                        },
                        ec2: {
                            instance_id: objectPath.get(node, 'automatic.ec2.instance_id'),
                            instance_type: objectPath.get(node, 'automatic.ec2.instance_type')
                        },
                        os: objectPath.get(node, 'automatic.os'),
                        os_version: objectPath.get(node, 'automatic.os_version'),
                        platform: objectPath.get(node, 'automatic.platform'),
                        uptime_seconds: objectPath.get(node, 'automatic.uptime_seconds'),
                        last_contact: new Date(1000 * objectPath.get(node, 'automatic.ohai_time', 0)),
                        hostname: objectPath.get(node, 'automatic.hostname'),
                        packages: objectPath.get(node, 'automatic.packages'),
                        cookbooks: objectPath.get(node, 'automatic.cookbooks')
                    },
                    run_list: node['run_list']

                };
                console.log(info);
                results.push(info);
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
