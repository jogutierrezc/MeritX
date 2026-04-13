export type PortalRole = 'admin' | 'decano' | 'cap' | 'cepi' | 'talento_humano';

export type PortalSession = {
  role: PortalRole;
  username: string;
  loginAt: string;
  password?: string;
};

const STORAGE_KEY = 'meritx.portal.session';
const BOOTSTRAP_ADMIN_KEY = 'meritx.portal.bootstrap-admin';

const CREDENTIALS = {
  admin: {
    username: import.meta.env.VITE_ADMIN_USER || 'admin',
    password: import.meta.env.VITE_ADMIN_PASSWORD || 'Admin123!',
  },
  decano: {
    username: import.meta.env.VITE_DECANO_USER || 'decano',
    password: import.meta.env.VITE_DECANO_PASSWORD || 'Decano123!',
  },
  cap: {
    username: import.meta.env.VITE_CAP_USER || 'cap',
    password: import.meta.env.VITE_CAP_PASSWORD || 'Cap123!',
  },
  cepi: {
    username: import.meta.env.VITE_CEPI_USER || 'cepi',
    password: import.meta.env.VITE_CEPI_PASSWORD || 'Cepi123!',
  },
  talento_humano: {
    username: import.meta.env.VITE_TALENTO_HUMANO_USER || 'talentohumano',
    password: import.meta.env.VITE_TALENTO_HUMANO_PASSWORD || 'Talento123!',
  },
} as const;

type BootstrapAdmin = {
  username: string;
  password: string;
  createdAt: string;
};

const getBootstrapAdmin = (): BootstrapAdmin | null => {
  try {
    const raw = window.localStorage.getItem(BOOTSTRAP_ADMIN_KEY);
    return raw ? (JSON.parse(raw) as BootstrapAdmin) : null;
  } catch {
    return null;
  }
};

export const getPortalCredentialsForRole = (
  role: PortalRole,
  expectedUsername?: string,
): { username: string; password: string } | null => {
  const activeSession = getPortalSession();
  if (activeSession?.role === role && activeSession.password) {
    const sessionUsername = activeSession.username.trim().toLowerCase();
    if (!expectedUsername || sessionUsername === expectedUsername.trim().toLowerCase()) {
      return {
        username: sessionUsername,
        password: activeSession.password,
      };
    }
  }

  const source = role === 'admin' ? getBootstrapAdmin() || CREDENTIALS.admin : CREDENTIALS[role];
  const candidate = {
    username: source.username.trim().toLowerCase(),
    password: source.password,
  };

  if (!expectedUsername) return candidate;
  if (candidate.username !== expectedUsername.trim().toLowerCase()) return null;
  return candidate;
};

export const canCreateFirstAdmin = () => !getBootstrapAdmin();

export const createFirstAdmin = (username: string, password: string): boolean => {
  if (!canCreateFirstAdmin()) return false;

  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername || !password.trim()) return false;

  const payload: BootstrapAdmin = {
    username: cleanUsername,
    password,
    createdAt: new Date().toISOString(),
  };

  window.localStorage.setItem(BOOTSTRAP_ADMIN_KEY, JSON.stringify(payload));
  return true;
};

export const getPortalSession = (): PortalSession | null => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PortalSession) : null;
  } catch {
    return null;
  }
};

export const savePortalSession = (session: PortalSession) => {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const clearPortalSession = () => {
  window.sessionStorage.removeItem(STORAGE_KEY);
};

export const authenticatePortal = (
  role: PortalRole,
  username: string,
  password: string,
): PortalSession | null => {
  const inputUser = username.trim().toLowerCase();
  const inputPassword = password.trim();
  const config = role === 'admin' ? getBootstrapAdmin() || CREDENTIALS.admin : CREDENTIALS[role];
  const matches = inputUser === config.username.trim().toLowerCase() && inputPassword === config.password;
  if (!matches) return null;
  return {
    role,
    username: config.username.trim().toLowerCase(),
    loginAt: new Date().toISOString(),
    password: config.password,
  };
};

export const canAccessRole = (session: PortalSession | null, requiredRole: PortalRole) => {
  if (!session) return false;
  if (session.role === 'admin') return true;
  return session.role === requiredRole;
};

export const getRequiredRoleForModule = (moduleId: string): PortalRole | null => {
  if (moduleId === 'decano') return 'decano';
  if (moduleId === 'cap') return 'cap';
  if (moduleId === 'cepi') return 'cepi';
  if (moduleId === 'talento_humano') return 'talento_humano';
  if (['expedientes', 'reportes', 'config'].includes(moduleId)) return 'admin';
  return null;
};
