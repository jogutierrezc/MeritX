import { DbConnection } from './src/module_bindings/index.js';

console.log("Starting test...");

const config = {
  host: 'wss://maincloud.spacetimedb.com',
  databaseName: 'categoria-k4x5z'
};

const c = DbConnection.builder()
  .withUri(config.host)
  .withDatabaseName(config.databaseName)
  .onConnect((conn) => {
    console.log("Connected!");

    conn.subscriptionBuilder()
      .onApplied(() => {
        console.log("onApplied FIRED!");
        const facultyCount = Array.from((conn as any).db.faculty.iter()).length;
        console.log("Number of faculties:", facultyCount);
        const rolesCount = Array.from((conn as any).db.portal_role.iter()).length;
        console.log("Number of roles:", rolesCount);
        
        process.exit(0);
      })
      .onError((err) => {
        console.error("Subscription Error:", err);
        process.exit(1);
      })
      .subscribe([
        'SELECT * FROM faculty',
        'SELECT * FROM portal_role'
      ]);
  })
  .onConnectError((err) => {
    console.error("Connect error:", err);
    process.exit(1);
  })
  .build();

// adding timeout to exit if hangs
setTimeout(() => {
    console.log("Timeout! onApplied didn't fire.");
    process.exit(1);
}, 10000);
