const processConfig = require('@datapull/json-config').processConfig;
const got = require('got');

class AtlassianOrigin {
  constructor(stepConfig) {
    const config = processConfig(stepConfig);
    this.organisation = config.organisation;
    this.username = config.username;
    this.password = config.password;
    this.batchSize = Number(config.batchSize || 50);
    this.service = config.service;
    this.includeInactiveUsers = config.includeInactiveUsers || false;
    if (this.service === 'jira' && this.batchSize > 50) {
      throw new Error(`Atlassian API does not support returning more than 1000 users per call, you requested ${this.batchSize}`);
    }
  }

  get originDeclaration() {
    return {
      name: ['Atlassian', this.organisation].join(':'),
      runner: this.pullData.bind(this)
    };
  }

  // To list all Atlassian users in specific organisation,
  // that have access to jira tool,
  // we have to find all users that are members of 'jira-software-users'.
  // For those who have an access to confluence,
  // we have to retrieve members of 'confluence-users' group.
  async pullData(_) {
    if (this.service === 'jira') {
      console.log(`[Atlassian Origin] pulling ${this.service} user data for ${this.organisation} with batch size ${this.batchSize}`);
      return await this.getUsers('jira-software-users');
    }

    if (this.service === 'confluence') {
      console.log(`[Atlassian Origin] pulling ${this.service} user data for ${this.organisation} with batch size ${this.batchSize}`);
      return await this.getUsers('confluence-users');

    }
    throw Error(`Atlassian Origin] ${this.service} is not supported. It must be jira or confluence`)
  }

  async getUsers(groupName) {
    let data = [];

    let index = 0;
    let membersResponse = await this.getRequest(groupName, index);
    data = membersResponse.body['values'];

    while (!membersResponse.body['isLast']) {
      index += this.batchSize;
      membersResponse = await this.getRequest(groupName, index);
      data = data.concat(membersResponse.body['values']);
    }
    return data;
  }

  async getRequest(groupName, index) {
    const options = {
      protocol: 'https:',
      method: 'get',
      host: `${this.organisation}.atlassian.net`,
      path:  `/rest/api/3/group/member?groupname=${groupName}&includeInactiveUsers=${this.includeInactiveUsers}&startAt=${index}&maxResults=${this.batchSize}`,
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
