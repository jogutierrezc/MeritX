export const SPACETIME_HOST =
  import.meta.env.VITE_SPACETIMEDB_HOST || 'wss://maincloud.spacetimedb.com';

export const SPACETIME_DB_NAME =
  import.meta.env.VITE_SPACETIMEDB_DB_NAME || 'categoria-k4x5z';

export const SPACETIME_TOKEN_KEY = `${SPACETIME_HOST}/${SPACETIME_DB_NAME}/auth_token`;

export const getSpacetimeConnectionConfig = () => ({
  host: SPACETIME_HOST,
  databaseName: SPACETIME_DB_NAME,
  tokenKey: SPACETIME_TOKEN_KEY,
});

export const getSpacetimeCommandHints = () => ({
  publish: 'npm run spacetime:publish',
  generate: 'npm run spacetime:generate',
  sql: 'npm run spacetime:sql -- "SELECT * FROM application"',
});
