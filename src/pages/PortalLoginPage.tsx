import React, { useState } from 'react';
import { Lock } from 'lucide-react';

import AppLogo from '../components/Common/AppLogo';
import { DbConnection } from '../module_bindings';
import type { PortalRole, PortalSession } from '../services/portalAuth';
import { getSpacetimeConnectionConfig } from '../services/spacetime';

interface Props {
  role: PortalRole;
  onLogin: (session: PortalSession) => void;
  compact?: boolean;
}

const PORTAL_LABELS: Record<PortalRole, { title: string; badge: string }> = {
  decano: {
    title: 'Acceso Consejo de Facultad',
    badge: 'Acceso protegido para verificación inicial de postulación',
  },
  cap: {
    title: 'Acceso Portal CAP (Comité de Asuntos Profesorales)',
    badge: 'Acceso protegido para valoración intermedia y trazabilidad del expediente',
  },
  admin: {
    title: 'Acceso Portal Administrador',
    badge: 'Acceso protegido para CAP y backoffice',
  },
  cepi: {
    title: 'Acceso Portal CEPI (Comité de Evaluación de Producción Intelectual)',
    badge: 'Acceso protegido para control directivo',
  },
  talento_humano: {
    title: 'Acceso Portal Talento Humano',
    badge: 'Acceso protegido para gestión administrativa',
  },
};

const openSpacetimeConnection = (host: string, databaseName: string, timeoutMs = 12000): Promise<DbConnection> =>
  new Promise((resolve, reject) => {
    let settled = false;

    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Tiempo de espera agotado al conectar con SpacetimeDB. Verifica red, WS y configuración del host.'));
    }, timeoutMs);

    const connection = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(databaseName)
      .onConnect(() => {
        if (settled) {
          connection.disconnect();
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        resolve(connection);
      })
      .onConnectError((_ctx: unknown, error: unknown) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error(`No fue posible conectar a SpacetimeDB: ${error instanceof Error ? error.message : String(error)}`));
      })
      .build();
  });

const PortalLoginPage = ({ role, onLogin, compact = false }: Props) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const labels = PORTAL_LABELS[role];

  const handleSubmit = async () => {
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();
    if (!cleanUsername || !cleanPassword) {
      setError('Ingresa usuario y contraseña.');
      return;
    }

    const { host, databaseName } = getSpacetimeConnectionConfig();
    let connection: DbConnection | null = null;

    setSubmitting(true);
    try {
      connection = await openSpacetimeConnection(host, databaseName);

      const reducers = connection.reducers as any;
      const loginReducer = reducers.portalLogin || reducers.portal_login;
      if (typeof loginReducer !== 'function') {
        throw new Error('Reducer portal_login no disponible.');
      }

      await loginReducer({
        role,
        username: cleanUsername,
        password: cleanPassword,
      });

      setError('');
      onLogin({
        role,
        username: cleanUsername,
        loginAt: new Date().toISOString(),
        password: cleanPassword,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenciales inválidas para este portal.');
    } finally {
      if (connection) connection.disconnect();
      setSubmitting(false);
    }
  };

  return (
    <div className={`${compact ? 'mx-auto max-w-none rounded-[28px] bg-white p-6 md:p-8' : 'mx-auto max-w-xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] md:p-12'}`}>
      <div className="space-y-8">
        <div className="space-y-4">
          <AppLogo className="flex items-center" imgClassName="h-12 w-auto md:h-14" />
          <div className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-white">
            {labels.badge}
          </div>
          <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-950 md:text-5xl">
            {labels.title}
          </h2>
          <p className="text-sm font-bold uppercase leading-relaxed text-slate-500">
            Ingresa usuario y contraseña para habilitar el portal correspondiente.
          </p>
        </div>

        <div className="grid gap-5">
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Usuario</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-4 text-sm font-black outline-none transition-colors focus:border-blue-600"
              placeholder="USUARIO"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Contraseña</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 py-4 pl-12 pr-4 text-sm font-bold outline-none transition-colors focus:border-blue-600"
                placeholder="CONTRASEÑA"
              />
            </div>
          </label>
        </div>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-2xl bg-slate-950 px-6 py-5 text-[11px] font-black uppercase tracking-[0.35em] text-white transition-all hover:bg-blue-600"
        >
          {submitting ? 'Validando acceso...' : 'Ingresar al portal'}
        </button>
      </div>
    </div>
  );
};

export default PortalLoginPage;
