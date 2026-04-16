import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { DbConnection } from '../module_bindings';
import { getSpacetimeConnectionConfig } from '../services/spacetime';
import { getPortalSession, getPortalCredentialsForRole, type PortalSession } from '../services/portalAuth';

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

        // ── Portal login reducer ───────────────────────────────────────────
        if (currentSession) {
          const credentials = getPortalCredentialsForRole(currentSession.role);
          if (credentials) {
            const reducers = c.reducers as any;
            const loginFn = reducers.portalLogin || reducers.portal_login;
            if (typeof loginFn === 'function') {
              Promise.resolve(loginFn({
                role: currentSession.role,
                username: credentials.username,
                password: credentials.password
              }))
                .then(() => {
                  if (isMounted) setPortalAuthReady(true);
                })
                .catch((e) => {
                  console.error('Error enviando portal_login:', e);
                  if (isMounted) setPortalAuthReady(false);
                });
            } else {
              if (isMounted) setPortalAuthReady(true);
            }
          }
        }

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
        const portalQueries = currentSession ? [
          'SELECT * FROM user_profile',
          'SELECT * FROM user_faculty_assignment',
          'SELECT * FROM api_config',
          'SELECT * FROM openrouter_config',
          'SELECT * FROM resend_config',
          'SELECT * FROM email_template',
          'SELECT * FROM rag_config',
          // Omitimos content_base64 porque ahora usamos R2_URL a traves de storage_path
          'SELECT document_key, file_name, file_type, file_size_bytes, bucket_name, storage_path, active, uploaded_by, uploaded_at, updated_at FROM rag_document',
          // Omitimos json_content
          'SELECT normative_key, title, document_id, bucket_name, storage_path, active, uploaded_by, uploaded_at, updated_at FROM rag_normative',
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
        ] : [];

        c.subscriptionBuilder()
          .onApplied(() => {
            if (isMounted) setGlobalDataReady(true);
          })
          .onError((err) => {
            console.error('Subscription error in SpacetimeContext', err);
          })
          .subscribe([...baseQueries, ...portalQueries]);
      })
      .onConnectError((_ctx: unknown, err: unknown) => {
        console.error('Global Spacetime connect error:', err);
        if (isMounted) setConnected(false);
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
