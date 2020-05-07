const crypto = require('crypto');
const URL = require('url')

exports.getContentSHA = content => {
  const accumulator = crypto.createHash('sha1')
  accumulator.update(content)
  return accumulator.digest('base64')
}

exports.getUrlPath = url =>{
  return URL.parse(url).path;
}
