import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { DbConnection } from '../module_bindings';
import { getSpacetimeConnectionConfig } from '../services/spacetime';
import {
  clearPortalSession,
  getPortalSession,
  getPortalCredentialsForRole,
  isInvalidPortalCredentialsError,
  PORTAL_SESSION_CHANGED_EVENT,
  type PortalSession,
} from '../services/portalAuth';

interface SpacetimeContextType {
  connection: DbConnection | null;
  connected: boolean;
  portalAuthReady: boolean;
  globalDataReady: boolean;
  session: PortalSession | null;
  reconnectSession: () => Promise<boolean>;
}

const SpacetimeContext = createContext<SpacetimeContextType>({
  connection: null,
  connected: false,
  portalAuthReady: false,
  globalDataReady: false,
  session: null,
  reconnectSession: async () => false,
});

export const useSpacetime = () => useContext(SpacetimeContext);

export const SpacetimeProvider = ({ children }: { children: ReactNode }) => {
  const [connection, setConnection] = useState<DbConnection | null>(null);
  const [connected, setConnected] = useState(false);
  const [portalAuthReady, setPortalAuthReady] = useState(false);
  const [globalDataReady, setGlobalDataReady] = useState(false);
  const [session, setSession] = useState<PortalSession | null>(getPortalSession());

  // ─── Sesión del portal: queries y lógica de login ──────────────────────

  const baseQueries = [
    'SELECT * FROM portal_role',
    'SELECT * FROM faculty',
    'SELECT * FROM academic_program',
    'SELECT * FROM convocatoria',
  ];

  const portalQueries = [
    'SELECT * FROM user_profile',
    'SELECT * FROM user_faculty_assignment',
    'SELECT * FROM api_config',
    'SELECT * FROM openrouter_config',
    'SELECT * FROM resend_config',
    'SELECT * FROM email_template',
    'SELECT * FROM rag_config',
    "SELECT document_key, file_name, file_type, file_size_bytes, bucket_name, storage_path, NULL AS content_base_64, active, uploaded_by, uploaded_at, updated_at FROM rag_document",
    "SELECT normative_key, title, document_id, '' AS json_content, bucket_name, storage_path, active, uploaded_by, uploaded_at, updated_at FROM rag_normative",
    'SELECT * FROM application',
    'SELECT * FROM application_title',
    'SELECT * FROM application_language',
    'SELECT * FROM application_publication',
    'SELECT * FROM application_experience',
    'SELECT * FROM application_audit',
    'SELECT * FROM application_audit_criterion',
    'SELECT * FROM application_decano_document',
    'SELECT * FROM application_decano_review',
    'SELECT * FROM application_analysis_version',
    'SELECT * FROM audit_criterion_event',
    'SELECT * FROM audit_event',
    'SELECT * FROM audit_score_snapshot',
    'SELECT * FROM report_snapshot',
  ];

  // ─── Conexión principal ────────────────────────────────────────────────

  useEffect(() => {
    const { host, databaseName } = getSpacetimeConnectionConfig();
    let isMounted = true;
    let currentConn: DbConnection | null = null;

    const subscribeQueries = (c: DbConnection, queries: string[]) => {
      c.subscriptionBuilder()
        .onApplied(() => {
          if (isMounted) setGlobalDataReady(true);
        })
        .onError((err) => {
          console.warn('Subscription warning in SpacetimeContext', err);
          if (isMounted) setGlobalDataReady(true);
        })
        .subscribe(queries);
    };

    const subscribeBaseOnly = (c: DbConnection) => {
      if (isMounted) setPortalAuthReady(false);
      subscribeQueries(c, baseQueries);
    };

    const attemptLogin = (c: DbConnection, retryCount = 0) => {
      if (!isMounted) return;

      const currentRetrySession = getPortalSession();
      if (isMounted) setSession(currentRetrySession);

      if (!currentRetrySession) {
        subscribeBaseOnly(c);
        return;
      }

      const credentials = getPortalCredentialsForRole(currentRetrySession.role);
      const reducers = c.reducers as any;
      const loginFn = reducers.portalLogin || reducers.portal_login;

      if (!credentials || typeof loginFn !== 'function') {
        subscribeBaseOnly(c);
        return;
      }

      Promise.resolve(
        loginFn({
          role: currentRetrySession.role,
          username: credentials.username,
          password: credentials.password,
        }),
      )
        .then(() => {
          if (!isMounted) return;
          setPortalAuthReady(true);
          subscribeQueries(c, [...baseQueries, ...portalQueries]);
        })
        .catch((e) => {
          if (isInvalidPortalCredentialsError(e)) {
            clearPortalSession();
            if (isMounted) setSession(null);
            subscribeBaseOnly(c);
            return;
          }

          console.error('Error enviando portal_login:', e);

          if (retryCount < 3) {
            const delay = 2000 * Math.pow(2, retryCount);
            console.log(`Reintentando portal_login en ${delay}ms (intento ${retryCount + 1}/3)...`);
            setTimeout(() => attemptLogin(c, retryCount + 1), delay);
            subscribeQueries(c, baseQueries);
          } else {
            subscribeBaseOnly(c);
          }
        });
    };

    const conn = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(databaseName)
      .onConnect((c: DbConnection) => {
        if (!isMounted) return;
        currentConn = c;
        setConnected(true);
        setConnection(c);

        const currentSession = getPortalSession();
        setSession(currentSession);

        if (currentSession) {
          attemptLogin(c);
          return;
        }

        setPortalAuthReady(false);
        subscribeQueries(c, baseQueries);
      })
      .onConnectError((_ctx: unknown, err: unknown) => {
        console.error('Global Spacetime connect error:', err);
        if (isMounted) {
          setConnected(false);
          setPortalAuthReady(false);
        }
      })
      .build();

    // ─── Listener de cambios de sesión (login/logout posterior) ──────────
    const handleSessionChange = () => {
      if (!isMounted) return;
      const updatedSession = getPortalSession();
      setSession(updatedSession);

      // Si hay una conexión activa y hay una sesión nueva, intentar login
      if (currentConn && updatedSession) {
        setPortalAuthReady(false);
        attemptLogin(currentConn);
      } else if (!updatedSession) {
        // Sesión removida — resetear estado
        setPortalAuthReady(false);
        if (currentConn) {
          subscribeQueries(currentConn, baseQueries);
        }
      }
    };

    window.addEventListener(PORTAL_SESSION_CHANGED_EVENT, handleSessionChange);

    return () => {
      isMounted = false;
      window.removeEventListener(PORTAL_SESSION_CHANGED_EVENT, handleSessionChange);
      conn.disconnect();
    };
  }, []);

  // ─── Función para reconectar sesión manualmente ────────────────────────

  const reconnectSession = useCallback(async (): Promise<boolean> => {
    const currentConn = connection;
    if (!currentConn || !connected) {
      console.warn('[reconnectSession] No hay conexión activa.');
      return false;
    }

    const currentSession = getPortalSession();
    if (!currentSession) {
      console.warn('[reconnectSession] No hay sesión guardada. Debe iniciar sesión desde /auth.');
      return false;
    }

    const credentials = getPortalCredentialsForRole(currentSession.role);
    const reducers = currentConn.reducers as any;
    const loginFn = reducers.portalLogin || reducers.portal_login;

    if (!credentials || typeof loginFn !== 'function') {
      console.warn('[reconnectSession] No se pudieron obtener credenciales o reducer no disponible.');
      return false;
    }

    try {
      setPortalAuthReady(false);
      await loginFn({
        role: currentSession.role,
        username: credentials.username,
        password: credentials.password,
      });
      setPortalAuthReady(true);
      // Re-subscribir con datos completos
      currentConn.subscriptionBuilder()
        .subscribe([...baseQueries, ...portalQueries]);
      return true;
    } catch (e) {
      console.error('[reconnectSession] Error al reconectar sesión:', e);
      if (isInvalidPortalCredentialsError(e)) {
        clearPortalSession();
        setSession(null);
      }
      setPortalAuthReady(false);
      return false;
    }
  }, [connection, connected]);

  return (
    <SpacetimeContext.Provider
      value={{ connection, connected, portalAuthReady, globalDataReady, session, reconnectSession }}
    >
      {children}
    </SpacetimeContext.Provider>
  );
};
