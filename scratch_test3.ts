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
        const rc = Array.from((conn as any).db.portal_role.iter()).length;
        console.log("roles:", rc);
        process.exit(0);
      })
      .onError((err) => {
        console.error("Subscription Error:", err);
        process.exit(1);
      })
      .subscribe([
            'SELECT * FROM portal_role',
            'SELECT * FROM user_profile',
            'SELECT * FROM faculty',
            'SELECT * FROM user_faculty_assignment',
            'SELECT * FROM api_config',
            'SELECT * FROM openrouter_config',
            'SELECT * FROM resend_config',
            'SELECT * FROM email_template',
            'SELECT * FROM system_setting',
            'SELECT * FROM rag_config',
            'SELECT * FROM rag_document',
            'SELECT * FROM rag_normative',
      ]);
  })
  .build();
