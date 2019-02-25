const processConfig = require('@datapull/json-config').processConfig;
const got = require('got');

class AtlassianOrigin {
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
      const path = `/rest/api/latest/user/search?startAt=${index}&maxResults=${this.batchSize}&username=%`;
      const response = await this.getRequest(path);
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

    // lists all Confluence groups and finds members for each group

    let groupsResponse = await this.getGroups(`/wiki/rest/api/group?start=0&limit=${this.batchSize}`, groups);

    while ('next' in groupsResponse.body['_links']) {
      groupsResponse = await this.getGroups(
          groupsResponse.body['_links']['context']  + groupsResponse.body['_links']['next'],
          groups);
    }

    for (const groupName of groups) {
      const path = `/wiki/rest/api/group/${groupName}/member?start=0&limit=${this.batchSize}`;

      let membersResponse = await this.getMembers(path, users);
      while ('next' in membersResponse.body['_links']) {
        membersResponse = await this.getMembers(
            membersResponse.body['_links']['context'] + membersResponse.body['_links']['next'],
            users);
      }
    }

    return Array.from(users.values());
  }

  async getMembers(path, users) {
    let membersResponse = await this.getRequest(path);
    for (const user of membersResponse.body['results']) {
      users.set(user['accountId'], user);
    }
    return membersResponse;
  }

  async getGroups(path, groups) {
    let groupsResponse = await this.getRequest(path);
    for (const result of groupsResponse.body['results']) {
      groups.push(result['name']);
    }
    return groupsResponse;
  }

  async getRequest(path) {
    const options = {
      protocol: 'https:',
      method: 'get',
      host: `${this.organisation}.atlassian.net`,
      path: path,
      auth: `${this.username}:${this.password}`,
      json: true
    };
    console.log(`[Atlassian Origin] HTTP GET ${options.host}${options.path}`);
    return await got(options);
  }
}

exports.datapullStep = {
  isOrigin: true,
  constructor: AtlassianOrigin
};
