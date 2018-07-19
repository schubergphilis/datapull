const processConfig = require('@datapull/json-config').processConfig;
const Client = require('pg').Client;

class RedshiftDestination {
  constructor(config) {
    // replace variables in the config:
    try {
      this.config = processConfig(config);
    } catch (err) {
      throw Error(`Could not parse config of Redshift Destination ${err}`);
    }

    ['user', 'host', 'database', 'password', 'port'].forEach(param => {
      if (!this.config[param]) {
        throw Error(`[Redshift destination] Parameter "${param}" is required for this destination`);
      }
    });

    this.clientConfig = {
      user: this.config.user,
      host: this.config.host,
      database: this.config.database,
      password: this.config.password,
      ssl: true,
      port: this.config.port
    };
  }

  buildPipelines(pipelines) {
    pipelines.forEach(p => {
      p.destination = {
        name: ['Redshift', this.config.host, this.config.table].join(':'),
        runner: this.insertNewRows.bind(this)
      };
    });

    return pipelines;
  }

  async insertNewRows(messages) {
    const client = new Client(this.clientConfig);

    await client.connect();

    let insertCount = 0;
    let skipCount = 0;

    await client.query('begin transaction read write');

    for (let m of messages) {
      const keys = [];
      const placeholders = [];
      const values = [];
      Object.keys(m).map(key => {
        keys.push(key);
        values.push(m[key]);
        placeholders.push(`\$${placeholders.length + 1}`); // $1, $2, $3...
      });

      if (this.config.primaryKey && m[this.config.primaryKey]) {
        const checkExistingRowQuery = `SELECT count(*) as c FROM ${this.config.table} WHERE ${this.config.primaryKey} = $1`;
        const resp = await client.query(checkExistingRowQuery, [m[this.config.primaryKey]]);
        if (resp.rows[0].c > 0) {
          console.log(`[Redshift destination] Row with primary key ${m[this.config.primaryKey]} already exists in target table`);
          skipCount += 1;
          await client.query('end transaction');
          continue;
        }
      }

      const insertQuery = `INSERT INTO ${this.config.table} (${keys.join(',')}) VALUES (${placeholders.join(',')})`;

      const insert = await client.query(insertQuery, values);
      insertCount += insert.rowCount;
    }

    await client.query('end transaction');

    console.log(`[Redshift destination] ${insertCount} row(s) inserted into ${this.config.table}. ${skipCount} message(s) skipped.`);
  }
}

exports.datapullStep = {
  isDestination: true,
  constructor: RedshiftDestination
};
