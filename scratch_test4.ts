import { DbConnection } from './src/module_bindings/index.js';

console.log("Starting test...");

const c = DbConnection.builder()
  .withUri('wss://maincloud.spacetimedb.com')
  .withDatabaseName('categoria-k4x5z')
  .onConnect((conn) => {
    conn.subscriptionBuilder()
      .onApplied(() => {
        console.log("onApplied FIRED!");
        process.exit(0);
      })
      .subscribe([
            'SELECT * FROM system_setting',
      ]);
  })
  .build();
