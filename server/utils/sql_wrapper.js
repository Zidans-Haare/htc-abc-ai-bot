// SQL wrapper for multi-DB support
const sqliteQueries = require('./sql_raw_sqlite');
const postgresQueries = require('./sql_raw_postgresql');
const mysqlQueries = require('./sql_raw_mysql');

function getDbServer() {
  const url = process.env.DATABASE_URL || '';
  if (url.startsWith('file:')) return 'sqlite';
  if (url.startsWith('sqlite:')) return 'sqlite';
  if (url.startsWith('postgresql:') || url.startsWith('postgres:')) return 'postgresql';
  if (url.startsWith('mysql:')) return 'mysql';
  return 'sqlite'; // default
}

function raw_sql_wrapper(query_type) {
  const dbServer = getDbServer();
  let queryModule;
  if (dbServer === 'sqlite') {
    queryModule = sqliteQueries;
  } else if (dbServer === 'postgresql') {
    queryModule = postgresQueries;
  } else if (dbServer === 'mysql') {
    queryModule = mysqlQueries;
  } else {
    throw new Error(`Unsupported DB server: ${dbServer}`);
  }

  if (!queryModule[query_type]) {
    throw new Error(`Query type '${query_type}' not found for ${dbServer}`);
  }

  return queryModule[query_type]();
}

module.exports = { raw_sql_wrapper, getDbServer };