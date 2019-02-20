const processConfig = require('@datapull/json-config').processConfig;
const got = require('got');

class HttpApiOrigin {
  constructor(stepConfig) {
    const config = processConfig(stepConfig);
    this.organisation = config.organisation;
    this.username = config.username;
    this.password = config.password;
    this.batchSize = Number(config.batchSize || 1000);
    this.service = config.service;
    if (this.service === 'jira' && this.batchSize > 1000) {
      throw new Error(`Atlassian API does not support returning more than 1000 users per call, you requested ${this.batchSize}`);
    }
  }

  get originDeclaration() {
    return {
      name: ['Atlassian', this.organisation].join(':'),
      runner: this.pullData.bind(this)
    };
  }

  async pullData(_) {
    if (this.service === 'jira') {
      console.log(`[Atlassian Origin] pulling ${this.service} user data for ${this.organisation} with batch size ${this.batchSize}`);
      return await this.getJiraData();
    }

    if (this.service === 'confluence') {
      console.log(`[Atlassian Origin] pulling ${this.service} user data for ${this.organisation} with batch size ${this.batchSize}`);
      return await this.getConfluenceData();
    }
    throw Error(`Atlassian Origin] ${this.service} is not supported. It must be jira or confluence`)
  }

  async getJiraData() {
    let data = [];

    // Since Atlassian does not have a proper API for listing all
    // users in specific organisation, we are abusing "search" API to
    // find all users and then paginate through them in an ad-hoc
    // way. Note that said search API does not support pagination out
    // of the box, so we simply iterate through results until hit an
    // "incomplete" page.
    let index = 0;

    while (true) {
      const options = {
        protocol: 'https:',
        method: 'get',
        host: `${this.organisation}.atlassian.net`,
        path: `/rest/api/latest/user/search?startAt=${index}&maxResults=${this.batchSize}&username=%`,
        auth: `${this.username}:${this.password}`,
        json: true
      };
      console.log(`[Atlassian Origin] HTTP GET ${options.host}/${options.path}`);
      const response = await got(options);
      data = data.concat(response.body);

      // The definition of "incomplete page" is right here, number of
      // results is smaller than requested batch size
      if (response.body.length < this.batchSize) {
        break
      }
      index += this.batchSize;
    }
    return data;
  }

  async getConfluenceData() {
    let groups = [];
    let users = new Map();

    // Since Atlassian does not have a proper API for listing all
    // users in specific organisation, we have to list all Confluence groups and
    // find all users and then paginate through them in an ad-hoc
    // way. Note that said search API does not support pagination out
    // of the box, so we simply iterate through results until hit an
    // "incomplete" page.
    let index = 0;

    while (true) {
      const options = {
        protocol: 'https:',
        method: 'get',
        host: `${this.organisation}.atlassian.net`,
        path: `/wiki/rest/api/group?start=${index}&limit=${this.batchSize}`,
        auth: `${this.username}:${this.password}`,
        json: true
      };
      console.log(`[Atlassian Origin] HTTP GET ${options.host}${options.path}`);
      const response = await got(options);
      for (const result of response.body['results']) {
        groups.push(result['name']);
      }

      // The definition of "incomplete page" is right here, number of
      // results is smaller than requested batch size
      if (response.body['size'] < this.batchSize) {
        break
      }
      index += this.batchSize;
    }

    for(const groupName of groups ) {
      let index = 0;
      while (true) {
        const options = {
          protocol: 'https:',
          method: 'get',
          host: `${this.organisation}.atlassian.net`,
          path: `/wiki/rest/api/group/${groupName}/member?start=${index}&limit=${this.batchSize}`,
          auth: `${this.username}:${this.password}`,
          json: true
        };
        console.log(`[Atlassian Origin] HTTP GET ${options.host}${options.path}`);
        const response = await got(options);
        for (const user of response.body['results']) {
            users.set(user['accountId'], user)
        }

        // The definition of "incomplete page" is right here, number of
        // results is smaller than requested batch size
        if (response.body['size']  < this.batchSize) {
          break
        }
        index += this.batchSize;
      }
    }

    return Array.from(users.values());
  }
}

exports.datapullStep = {
  isOrigin: true,
  constructor: HttpApiOrigin
};
