const SPACETIME_DEFAULT_HOST = 'wss://maincloud.spacetimedb.com';
const SPACETIME_DEFAULT_DB_NAME = 'categoria-k4x5z';

const normalizeSpacetimeHost = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return SPACETIME_DEFAULT_HOST;

  const withoutTrailingSlash = raw.replace(/\/+$/, '');
  const withScheme = /^[a-z]+:\/\//i.test(withoutTrailingSlash)
    ? withoutTrailingSlash
    : `wss://${withoutTrailingSlash}`;

  let normalized = withScheme
    .replace(/^https:\/\//i, 'wss://')
    .replace(/^http:\/\//i, 'ws://');

  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && normalized.startsWith('ws://')) {
    normalized = normalized.replace(/^ws:\/\//i, 'wss://');
  }

  return normalized;
};

export const SPACETIME_HOST = normalizeSpacetimeHost(
  import.meta.env.VITE_SPACETIMEDB_HOST ||
    import.meta.env.VITE_SPACETIME_HOST ||
    import.meta.env.VITE_SPACETIMEDB_URI,
);

export const SPACETIME_DB_NAME =
  import.meta.env.VITE_SPACETIMEDB_DB_NAME ||
  import.meta.env.VITE_SPACETIME_DB_NAME ||
  import.meta.env.VITE_SPACETIMEDB_DATABASE ||
  SPACETIME_DEFAULT_DB_NAME;

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
