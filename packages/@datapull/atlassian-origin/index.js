const processConfig = require('@datapull/json-config').processConfig;
const got = require('got');
const url = require('url');
const http = require('https');
const qs = require('querystring');

class HttpApiOrigin {
    constructor(stepConfig) {
        // replace variables in the config:
        try {
            this.config = processConfig(stepConfig);
        } catch (err) {
            throw Error(`Could not parse config of Atlassian origin ${err}`);
        }
    }

    get originDeclaration() {
        return {
            name: ['Atlassian', this.method, this.url].join(':'),
            runner: this.pullData.bind(this)
        };
    }

    pullData(pipelineConfig) {
        console.log('[Atlassian Origin] fetching', this.method, this.url);

        let mergedConfig = Object.assign(
            {
                method: 'get',
                pageSize: 200,
            },
            pipelineConfig ? pipelineConfig.atlassian || {} : {},
            this.config
        );

        // validate config:
        if (!mergedConfig.url) {
            throw Error('Atlassian Origin: url is not set up. Please specify `url` in the config');
        }

        if (!mergedConfig.username) {
            throw Error('Atlassian Origin: username for basic auth is not set up');
        }
        if (!mergedConfig.password) {
            throw Error('Atlassian Origin: password for basic auth is not set up');
        }
        const auth = `${mergedConfig.username}:${mergedConfig.password}`;



    }

}

exports.datapullStep = {
    isOrigin: true,
    constructor: HttpApiOrigin
};
