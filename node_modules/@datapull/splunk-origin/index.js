const request = require('request-promise-native');

class SplunkOrigin {

    constructor(config) {
        this.config = config;
    }

    get originDeclaration() {
        return {
            name: ['Splunk', this.config.customer].join(':'),
            runner: this.pullData.bind(this)
        };
    }

    async pullData(config) {
        console.log('[Splunk] pulling data for ', config.searchName);

        const apiUrl = this.apiUrl;
        const auth = {user: config.username,pass: config.password};

        // Splunk operates with self-signed certificates, thus we need
        // to disable certificate checks completely.
        const agentOptions = {rejectUnauthorized: false};

        // Submit search job, acquire search id which will be used for
        // status polling and fetching results
        const searchRequest = await request({
            uri: `${config.apiUrl}/services/saved/searches/${config.searchName}/dispatch?output_mode=json`,
            method: 'POST',
            agentOptions: agentOptions,
            auth: auth,
            json: true
        });

        const sid = searchRequest['sid'];
        if (sid === undefined) {
            throw new Error('Could not get search id');
        }

        let done = false;
        do {
            await sleep(2000);
            const status = await request({
                uri: `${config.apiUrl}/services/search/jobs/${sid}?output_mode=json`,
                method: 'GET',
                agentOptions: agentOptions,
                auth: auth,
                json: true
            });
            done = status['entry'][0]['content']['dispatchState'] === 'DONE';
        } while (!done);

        const results = await request({
            uri: `${config.apiUrl}/services/search/jobs/${sid}/results?output_mode=json`,
            method: 'GET',
            agentOptions: agentOptions,
            auth: auth,
            json: true
        });
        return results;
    }
}

async function sleep(msec) {
    return new Promise(resolve => setTimeout(resolve, msec));
}

exports.datapullStep = {
    isOrigin: true,
    constructor: SplunkOrigin
};
