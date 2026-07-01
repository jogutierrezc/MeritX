import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { DbConnection } from '../module_bindings';
import { getSpacetimeConnectionConfig } from '../services/spacetime';
import {
  clearPortalSession,
  getPortalSession,
  getPortalCredentialsForRole,
  isInvalidPortalCredentialsError,
  type PortalSession,
} from '../services/portalAuth';

interface SpacetimeContextType {
  connection: DbConnection | null;
  connected: boolean;
  portalAuthReady: boolean;
  globalDataReady: boolean;
  session: PortalSession | null;
}

const SpacetimeContext = createContext<SpacetimeContextType>({
  connection: null,
  connected: false,
  portalAuthReady: false,
  globalDataReady: false,
  session: null,
});

export const useSpacetime = () => useContext(SpacetimeContext);

export const SpacetimeProvider = ({ children }: { children: ReactNode }) => {
  const [connection, setConnection] = useState<DbConnection | null>(null);
  const [connected, setConnected] = useState(false);
  const [portalAuthReady, setPortalAuthReady] = useState(false);
  const [globalDataReady, setGlobalDataReady] = useState(false);
  const [session, setSession] = useState<PortalSession | null>(getPortalSession());

  useEffect(() => {
    const { host, databaseName } = getSpacetimeConnectionConfig();
    let isMounted = true;

    const conn = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(databaseName)
      .onConnect((c: DbConnection) => {
        if (!isMounted) return;
        setConnected(true);
        setConnection(c);

        const currentSession = getPortalSession();
        setSession(currentSession);

        const subscribeQueries = (queries: string[]) => {
          c.subscriptionBuilder()
            .onApplied(() => {
              if (isMounted) setGlobalDataReady(true);
            })
            .onError((err) => {
              // Keep app usable with cached/local module subscriptions even if one global query fails.
              console.warn('Subscription warning in SpacetimeContext', err);
              if (isMounted) setGlobalDataReady(true);
            })
            .subscribe(queries);
        };

        // ── Subscripciones optimizadas por bandwidth ───────────────────────
        //
        // OPTIMIZACIÓN 1 — portal_session ELIMINADA del subscribe global.
        //   Antes: cada login de cualquier usuario enviaba una actualización a
        //   TODOS los clientes conectados (mayor fuente de bandwidth según el dashboard).
        //   Ahora: la sesión se valida solo vía el reducer portal_login, no via sync reactivo.
        //
        // OPTIMIZACIÓN 2 — Columnas masivas EXCLUIDAS del subscribe global:
        //   - rag_document.content_base64  → archivos completos en base64 (MB cada uno)
        //   - rag_normative.json_content   → texto JSON extenso por normativa
        //   Estas se leen on-demand desde el módulo que las necesita.
        //
        // OPTIMIZACIÓN 3 — Tablas privadas solo si hay sesión activa.
        //   Un visitante anónimo en /inicio ya NO recibe 20+ tablas privadas.

        // Tablas base: catálogos pequeños, siempre necesarios (anónimos y autenticados)
        const baseQueries = [
          'SELECT * FROM portal_role',
          'SELECT * FROM faculty',
          'SELECT * FROM academic_program',
          'SELECT * FROM convocatoria',
        ];

        // Tablas de portal: solo para usuarios autenticados
        const portalQueries = [
          'SELECT * FROM user_profile',
          'SELECT * FROM user_faculty_assignment',
          'SELECT * FROM api_config',
          'SELECT * FROM openrouter_config',
          'SELECT * FROM resend_config',
          'SELECT * FROM email_template',
          'SELECT * FROM rag_config',
          // Mantener la forma completa de la fila evita desalineaciones de decode en algunos clientes/bindings.
          // Enviamos un placeholder para columnas grandes para no transferir payloads pesados.
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

        const subscribeBaseOnly = () => {
          // portalAuthReady = true solo si NO hay sesión pendiente de autenticar
          // Si hay sesión pero el login falló → false
          // Si no hay sesión → false (no hay sesión admin activa)
          if (isMounted) setPortalAuthReady(false);
          subscribeQueries(baseQueries);
        };

        // ── Portal login reducer ───────────────────────────────────────────
        const attemptLogin = (retryCount = 0) => {
          if (!isMounted) return;

          const currentRetrySession = getPortalSession();
          setSession(currentRetrySession);

          if (!currentRetrySession) {
            subscribeBaseOnly();
            return;
          }

          const credentials = getPortalCredentialsForRole(currentRetrySession.role);
          const reducers = c.reducers as any;
          const loginFn = reducers.portalLogin || reducers.portal_login;

          if (!credentials || typeof loginFn !== 'function') {
            subscribeBaseOnly();
            return;
          }

          Promise.resolve(loginFn({
            role: currentRetrySession.role,
            username: credentials.username,
            password: credentials.password,
          }))
            .then(() => {
              if (!isMounted) return;
              setPortalAuthReady(true);
              subscribeQueries([...baseQueries, ...portalQueries]);
            })
            .catch((e) => {
              if (isInvalidPortalCredentialsError(e)) {
                clearPortalSession();
                if (isMounted) setSession(null);
                subscribeBaseOnly();
                return;
              }

              console.error('Error enviando portal_login:', e);

              // Reintentar hasta 3 veces con backoff de 2s, 4s, 8s
              if (retryCount < 3) {
                const delay = 2000 * Math.pow(2, retryCount);
                console.log(`Reintentando portal_login en ${delay}ms (intento ${retryCount + 1}/3)...`);
                setTimeout(() => attemptLogin(retryCount + 1), delay);
                // Mientras tanto, cargar datos base para que la UI no se quede congelada
                subscribeQueries(baseQueries);
              } else {
                subscribeBaseOnly();
              }
            });
        };

        if (currentSession) {
          attemptLogin();
          return;
        }

        // Sin sesión guardada: modo anónimo, no hay sesión admin activa
        setPortalAuthReady(false);
        subscribeQueries(baseQueries);
      })
      .onConnectError((_ctx: unknown, err: unknown) => {
        console.error('Global Spacetime connect error:', err);
        if (isMounted) {
          setConnected(false);
          setPortalAuthReady(false);
        }
      })
      .build();

    return () => {
      isMounted = false;
      conn.disconnect();
    };
  }, []);

  return (
    <SpacetimeContext.Provider value={{ connection, connected, portalAuthReady, globalDataReady, session }}>
      {children}
    </SpacetimeContext.Provider>
  );
};
