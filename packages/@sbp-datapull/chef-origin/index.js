const fs = require('fs');
const requests = require('request-promise');
const Bottleneck = require('bottleneck');
const { getContentSHA, getUrlPath } = require('./utils');
const { join } = require('path')

class ChefOrigin {
  constructor(stepConfig) {
    this.stepConfig = stepConfig
  }

  get originDeclaration() {
    return {
      name: ['Chef'].join(':'),
      runner: this.pullData.bind(this)
    };
  }

  async pullData(pipelineConfig) {
    this.config = {
      apiUrl: pipelineConfig.apiUrl,
      headers: this.getAuthHeaders(pipelineConfig)
    }

    console.debug(`[Chef] pulling data for ${pipelineConfig.apiUrl}`);

    if (!pipelineConfig.key && !pipelineConfig.key_path) {
      console.error('[Chef origin] key path or key must be specified');
      throw Error('Key path or key must be specified');
    }

    if (pipelineConfig.key_path) {
      if (!fs.existsSync(pipelineConfig.key_path)) {
        console.error('[Chef origin] key does not exist in the given path');
        throw Error('Key does not exist in the given path');
      }
    }

    const nodes = await this.getNodes()

    // setup rate limiter:
    const rateLimitConfig = pipelineConfig.rateLimiter || {};
    const maxConcurrent = rateLimitConfig.maxConcurrent || 10;
    const minTime = rateLimitConfig.minTimeBetweenRequestsMs || 200;
    const highWater = rateLimitConfig.highWater || -1;
    const rateLimitStrategy = rateLimitConfig.rateLimitStrategy || 'BLOCK';
    const rejectOnDrop =
      'rejectOnDrop' in rateLimitConfig ? rateLimitConfig.rejectOnDrop : true;

    const limiter = new Bottleneck(
      maxConcurrent,
      minTime,
      highWater,
      Bottleneck.strategy[rateLimitStrategy],
      rejectOnDrop
    );

    // get info of every node with a separate request:
    const results = Object.keys(nodes).map(nodeName =>
      limiter.schedule(this.getOneNode.bind(this), nodeName)
    );
    return await Promise.all(results);
  }

  async getNodes() {
    const requestUrl = join(this.config.apiUrl, 'nodes')

    return requests.get(requestUrl, { headers:this.config.headers })
  }

  async getOneNode(nodeId){
    const requestUrl = join(this.config.apiUrl, 'nodes', nodeId)

    return requests.get(requestUrl, { headers:this.config.headers })
  }

  getAuthHeaders(pipelineConfig){
    const urlPath = getUrlPath(pipelineConfig.apiUrl)
    const hashedUrlPath = getContentSHA(urlPath)
    const contentHash = getContentSHA((pipelineConfig.body ? JSON.stringify(pipelineConfig.body) : ''))
    const timestamp = new Date().toISOString().replace(/\....Z/, 'Z');

    const requestHeaders = {
        'Method': 'GET',
        'Hashed Path': hashedUrlPath,
        'X-Ops-Content-Hash': contentHash,
        'X-Ops-Timestamp': timestamp,
        'X-Ops-UserId': pipelineConfig.username
    }
    const requestHeadersString = Object.entries(requestHeaders)
      .map(([key,value])=>`${key}:${value}`).join('\n')
    const signature = Buffer.from(requestHeadersString).toString('base64');

    const authHeaders = {
        'Accept': 'application/json',
        'X-Ops-Timestamp': timestamp,
        'X-Ops-UserId': pipelineConfig.username,
        'X-Ops-Content-Hash': contentHash,
        'X-Chef-Version': '0.10.4',
        'X-Ops-Sign': 'version=1.0'
    }

    signature.match(/.{1,60}/g).forEach((section, index)=>{
      const name = `X-Ops-Authorization-${index}`
      authHeaders[name] = section
    })

    console.debug('[Chef] Auth Headers:', authHeaders)
    return authHeaders
  }
}

exports.datapullStep = {
  isOrigin: true,
  constructor: ChefOrigin
};
