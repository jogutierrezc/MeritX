import React, { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';

import { DbConnection } from '../module_bindings';
import type { PortalRole, PortalSession } from '../services/portalAuth';
import { authenticatePortal, createFirstAdmin } from '../services/portalAuth';
import { getSpacetimeConnectionConfig } from '../services/spacetime';

interface Props {
  role: PortalRole;
  onLogin: (session: PortalSession) => void;
  compact?: boolean;
}

const PORTAL_LABELS: Record<PortalRole, { title: string; badge: string }> = {
  auxiliar: {
    title: 'Acceso Portal Auxiliares',
    badge: 'Acceso protegido para apoyo operativo',
  },
  admin: {
    title: 'Acceso Portal Administrador',
    badge: 'Acceso protegido para CAP y backoffice',
  },
  director: {
    title: 'Acceso Portal Director',
    badge: 'Acceso protegido para control directivo',
  },
  talento_humano: {
    title: 'Acceso Portal Talento Humano',
    badge: 'Acceso protegido para gestión administrativa',
  },
};

const PortalLoginPage = ({ role, onLogin, compact = false }: Props) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [adminSetupNombre, setAdminSetupNombre] = useState('');
  const [adminSetupCorreo, setAdminSetupCorreo] = useState('');
  const [adminSetupCampus, setAdminSetupCampus] = useState('VALLEDUPAR');
  const [adminSetupPassword, setAdminSetupPassword] = useState('');
  const [adminSetupConfirmPassword, setAdminSetupConfirmPassword] = useState('');
  const [setupMessage, setSetupMessage] = useState('');
  const [isFirstAdminAvailable, setIsFirstAdminAvailable] = useState(true);

  const labels = PORTAL_LABELS[role];

  const handleSubmit = () => {
    const session = authenticatePortal(role, username, password);
    if (!session) {
      setError('Credenciales inválidas para este portal.');
      return;
    }
    setError('');
    onLogin(session);
  };

  const handleCreateFirstAdmin = async () => {
    if (role !== 'admin') return;

    if (!adminSetupNombre.trim() || !adminSetupCorreo.trim() || !adminSetupCampus.trim() || !adminSetupPassword.trim()) {
      setError('Nombre, correo, campus y contraseña son obligatorios para crear el primer admin.');
      return;
    }

    if (adminSetupPassword !== adminSetupConfirmPassword) {
      setError('La confirmación de contraseña no coincide.');
      return;
    }

    const { host, databaseName } = getSpacetimeConnectionConfig();

    let connection: DbConnection | null = null;
    try {
      connection = DbConnection.builder()
        .withUri(host)
        .withDatabaseName(databaseName)
        .build();

      const reducers = connection.reducers as any;

      // Initialize portal roles first
      const initRolesReducer = reducers.initPortalRoles || reducers.init_portal_roles;
      if (typeof initRolesReducer === 'function') {
        await initRolesReducer({});
      }

      const bootstrapReducer = reducers.bootstrapFirstAdmin || reducers.bootstrap_first_admin;

      if (typeof bootstrapReducer !== 'function') {
        throw new Error('Reducer bootstrap_first_admin no disponible.');
      }

      await bootstrapReducer({
        nombre: adminSetupNombre.trim(),
        correo: adminSetupCorreo.trim().toLowerCase(),
        campus: adminSetupCampus.trim().toUpperCase(),
        password: adminSetupPassword,
      });

      createFirstAdmin(adminSetupCorreo.trim().toLowerCase(), adminSetupPassword);

      setIsFirstAdminAvailable(false);
      setError('');
      setSetupMessage('Primer administrador creado en backend. Ya puedes iniciar sesión.');
      setUsername(adminSetupCorreo.trim().toLowerCase());
      setPassword(adminSetupPassword);
      setAdminSetupConfirmPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No fue posible crear el primer administrador.';
      const alreadyExists = /ya fue configurado|ya existe/i.test(message);
      setError(message);
      if (alreadyExists) setIsFirstAdminAvailable(false);
    } finally {
      if (connection) connection.disconnect();
    }
  };

  return (
    <div className={`${compact ? 'mx-auto max-w-none rounded-[28px] bg-white p-6 md:p-8' : 'mx-auto max-w-xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] md:p-12'}`}>
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 rounded-full bg-blue-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-white">
            <ShieldCheck size={16} /> {labels.badge}
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

        {role === 'admin' && isFirstAdminAvailable && (
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-700">Configuración inicial</p>
            <p className="mt-2 text-xs font-semibold text-blue-900">
              Crea el primer usuario administrador. Esta acción solo se permite una única vez.
            </p>
            <div className="mt-4 grid gap-3">
              <input
                value={adminSetupNombre}
                onChange={(e) => setAdminSetupNombre(e.target.value)}
                className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-blue-600"
                placeholder="NOMBRE COMPLETO"
              />
              <input
                type="email"
                value={adminSetupCorreo}
                onChange={(e) => setAdminSetupCorreo(e.target.value)}
                className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-blue-600"
                placeholder="CORREO ADMIN"
              />
              <select
                value={adminSetupCampus}
                onChange={(e) => setAdminSetupCampus(e.target.value)}
                className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-blue-600"
              >
                <option>VALLEDUPAR</option>
                <option>BUCARAMANGA</option>
                <option>CUCUTA</option>
                <option>BOGOTA</option>
              </select>
              <input
                type="password"
                value={adminSetupPassword}
                onChange={(e) => setAdminSetupPassword(e.target.value)}
                className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-blue-600"
                placeholder="CONTRASEÑA ADMIN"
              />
              <input
                type="password"
                value={adminSetupConfirmPassword}
                onChange={(e) => setAdminSetupConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-blue-600"
                placeholder="CONFIRMAR CONTRASEÑA"
              />
              <button
                onClick={handleCreateFirstAdmin}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-blue-700"
              >
                Crear primer admin en backend
              </button>
            </div>
          </section>
        )}

        {setupMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
            {setupMessage}
          </div>
        )}

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}

        <button
          onClick={handleSubmit}
          className="w-full rounded-2xl bg-slate-950 px-6 py-5 text-[11px] font-black uppercase tracking-[0.35em] text-white transition-all hover:bg-blue-600"
        >
          Ingresar al portal
        </button>
      </div>
    </div>
  );
};

export default PortalLoginPage;
