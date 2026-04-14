import { DbConnection } from './src/module_bindings/index.js';

console.log("DbConnection builder exists:", typeof DbConnection.builder === 'function');
// Create a fake module representation just to see the instance
const config = {
  host: 'wss://maincloud.spacetimedb.com',
  databaseName: 'categoria-k4x5z',
  tokenKey: 'test'
};

const c = DbConnection.builder().withUri(config.host).withDatabaseName(config.databaseName).build();

console.log("Has db property:", 'db' in c);
console.log("Type of db property:", typeof c.db);
console.log("Keys of db:", c.db ? Object.keys(c.db) : 'no db');

process.exit(0);
