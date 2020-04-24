const processConfig = require('@sbp-datapull/json-config').processConfig;
const got = require('got');

class AtlassianOrigin {
  constructor(stepConfig) {
    const config = processConfig(stepConfig);
    this.organisation = config.organisation;
    this.username = config.username;
    this.password = config.password;
    if (!config.groupName) {
      throw new Error('[Atlassian Origin] Group name must be specified!');
    }
    this.groupName = config.groupName;
    this.batchSize = Number(config.batchSize || 50);
    if (this.batchSize > 50) {
      throw new Error(
        `Atlassian API does not support returning more than 50 users per call, you requested ${this.batchSize}`
      );
    }
    this.includeInactiveUsers = config.includeInactiveUsers || false;
  }

  get originDeclaration() {
    return {
      name: ['Atlassian', this.organisation].join(':'),
      runner: this.pullData.bind(this)
    };
  }
  // This origin pulls data from Atlassian Cloud REST API.
  // We list all Jira users who are members of a group
  // which name is passed in configuration parameter.
  async pullData() {
    console.debug(
      `[Atlassian Origin] pulling ${this.groupName} user data for ${this.organisation} with batch size ${this.batchSize}`
    );

    let index = 0;
    let membersResponse = await this.getRequest(index);
    let data = membersResponse.body['values'];

    while (!membersResponse.body['isLast']) {
      index += this.batchSize;
      membersResponse = await this.getRequest(index);
      data = data.concat(membersResponse.body['values']);
    }
    return data;
  }

  async getRequest(index) {
    const options = {
      protocol: 'https:',
      method: 'get',
      host: `${this.organisation}.atlassian.net`,
      path: `/rest/api/3/group/member?groupname=${this.groupName}&includeInactiveUsers=${this.includeInactiveUsers}&startAt=${index}&maxResults=${this.batchSize}`,
      auth: `${this.username}:${this.password}`,
      json: true
    };
    console.debug(`[Atlassian Origin] HTTP GET ${options.host}${options.path}`);
    return await got(options);
  }
}

exports.datapullStep = {
  isOrigin: true,
  constructor: AtlassianOrigin
};
