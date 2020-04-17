const processConfig = require('@sbp-datapull/json-config').processConfig;
const mysql = require('mysql');
const template = require('lodash/template');

class MySQLOrigin {
  constructor(stepConfig) {
    // replace variables in the config:
    try {
      this.config = processConfig(stepConfig);
    } catch (err) {
      throw Error(`Could not parse config of mysql origin ${err}`);
    }
  }

  get originDeclaration() {
    return {
      name: ['mysql', this.config.endpoint].join(':'),
      runner: this.pullData.bind(this)
    };
  }

  pullData(pipelineConfig) {
    // merge step and pipeline configs:
    let mergedConfig = Object.assign(
      {
        port: 3306
      },
      pipelineConfig ? pipelineConfig.mysql || {} : {},
      this.config
    );

    // validate config:
    if (!mergedConfig.host) {
      throw Error(
        'mysql Origin: host is not set up. Please specify `host` in the config'
      );
    }
    if (!mergedConfig.database) {
      throw Error(
        'mysql Origin: database is not set up. Please specify `database` in the config'
      );
    }
    if (!mergedConfig.user) {
      throw Error(
        'mysql Origin: user is not set up. Please specify `user` in the config'
      );
    }
    if (!mergedConfig.password) {
      throw Error(
        'mysql Origin: password is not set up. Please specify `password` in the config'
      );
    }
    if (!mergedConfig.queryTemplate) {
      throw Error(
        'mysql Origin: queryTemplate is not set up. Please specify `queryTemplate` in the config'
      );
    }

    // build mysql client:
    const connection = new mysql.createConnection({
      host: mergedConfig.host,
      user: mergedConfig.user,
      port: mergedConfig.port,
      password: mergedConfig.password,
      database: mergedConfig.database
    });

    // prepare the query:
    const data = {
      pipelineConfig: pipelineConfig
    };
    const query = template(mergedConfig.queryTemplate, {
      interpolate: /\${([\s\S]+?)}/g
    })(data);

    console.log(`[mysql Origin] Running the query: ${query}`);

    return new Promise((resolve, reject) => {
      connection.connect(err => {
        if (err) {
          console.error('[mysql origin] error connecting', err);
          return reject(err);
        }
      });

      connection.query(query, (err, results /*, fields*/) => {
        if (err) {
          console.error('[mysql origin] error running query', err);
          this.closeConnection(connection);
          return reject(err);
        }

        this.closeConnection(connection);
        resolve(results);
      });
    });
  }

  closeConnection(connection) {
    console.log('[mysql origin] closing connection now');
    connection.end(function(err) {
      if (err) {
        console.error(
          '[mysql origin] error closing connection gracefully',
          err
        );
        connection.destroy();
        console.log('[mysql origin] connection is destroyed');
        return;
      }

      console.log('[mysql origin] connection is closed');
    });
  }
}

exports.datapullStep = {
  isOrigin: true,
  constructor: MySQLOrigin
};
