import React, { useEffect, useRef, useState } from 'react';
import { CalendarPlus2, ListChecks } from 'lucide-react';

import { DbConnection } from '../../module_bindings';
import LoadingOverlay from '../../components/LoadingOverlay';
import { getPortalCredentialsForRole, getPortalSession } from '../../services/portalAuth';
import { getSpacetimeConnectionConfig } from '../../services/spacetime';

type ConvocatoriaRow = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  periodo: string;
  año: number;
  fechaApertura?: string;
  fechaCierre?: string;
  fecha_apertura?: string;
  fecha_cierre?: string;
  estado: string;
  postulacionesCount?: number;
  postulaciones_count?: number;
};

const ConvocatoriasModule = () => {
  const connectionRef = useRef<DbConnection | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [convocatorias, setConvocatorias] = useState<ConvocatoriaRow[]>([]);

  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    periodo: 'Primer Semestre',
    anio: new Date().getFullYear(),
    fechaApertura: '',
    fechaCierre: '',
    estado: 'ABIERTA',
  });

  useEffect(() => {
    const { host, databaseName } = getSpacetimeConnectionConfig();

    const ensurePortalSession = async (conn: DbConnection) => {
      const session = getPortalSession();
      if (!session) return;
      const credentials = getPortalCredentialsForRole(session.role);
      if (!credentials) return;
      const reducers = conn.reducers as any;
      const loginFn = reducers.portalLogin || reducers.portal_login;
      if (typeof loginFn === 'function') {
        await loginFn({ role: session.role, username: credentials.username, password: credentials.password });
      }
    };

    const connection = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(databaseName)
      .onConnect((conn: DbConnection) => {
        
        ensurePortalSession(conn).catch((e) => console.warn('Portal session en Convocatorias TH:', e));
      })
      .onConnectError((_ctx: unknown, err: unknown) => {
        console.error('Convocatorias TH connect error:', err);
        
      })
      .build();

    connectionRef.current = connection;

    const refreshFromCache = () => {
      const dbView = connection.db as any;
      const convTable = dbView.convocatoria || dbView.convocatorias;
      const rows = convTable ? (Array.from(convTable.iter()) as ConvocatoriaRow[]) : [];
      setConvocatorias(rows.sort((a, b) => b.id.localeCompare(a.id)));
    };

    const loadOnce = async () => {
      await new Promise<void>((resolve, reject) => {
        const subscription = connection
          .subscriptionBuilder()
          .onApplied(() => {
            try {
              refreshFromCache();
              resolve();
            } catch (error) {
              reject(error);
            } finally {
              subscription.unsubscribe();
            }
          })
          .onError((ctx: unknown) => {
            subscription.unsubscribe();
            reject(ctx);
          })
          .subscribe(['SELECT * FROM convocatoria']);
      });
    };

    void loadOnce().catch((ctx) => console.error(ctx));

    return () => {
      connection.disconnect();
      connectionRef.current = null;
    };
  }, []);

  const runReducer = async (reducerName: string, args: object) => {
    const connection = connectionRef.current;
    if (!connection) throw new Error('Sin conexión a SpacetimeDB.');

    const reducerView = connection.reducers as any;
    const candidates = [
      reducerName,
      reducerName.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
    ];

    let fn: ((payload: object) => Promise<void>) | null = null;
    for (const key of candidates) {
      if (typeof reducerView[key] === 'function') {
        fn = reducerView[key] as (payload: object) => Promise<void>;
        break;
      }
    }

    if (!fn) throw new Error(`Reducer no disponible: ${reducerName}`);
    await fn(args);
  };

  const createConvocatoria = async () => {
    if (!connected) {
      window.alert('No hay conexión a SpacetimeDB.');
      return;
    }

    if (!form.codigo.trim() || !form.nombre.trim() || !form.fechaApertura || !form.fechaCierre) {
      window.alert('Completa código, nombre y fechas para crear la convocatoria.');
      return;
    }

    setLoading(true);
    try {
      await runReducer('create_convocatoria', {
        codigo: form.codigo.trim().toUpperCase(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        periodo: form.periodo,
        ['año']: Number(form.anio),
        fechaApertura: form.fechaApertura,
        fechaCierre: form.fechaCierre,
        estado: form.estado,
      });

      setForm({
        codigo: '',
        nombre: '',
        descripcion: '',
        periodo: 'Primer Semestre',
        anio: new Date().getFullYear(),
        fechaApertura: '',
        fechaCierre: '',
        estado: 'ABIERTA',
      });

      window.alert('Convocatoria creada correctamente.');
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : 'No fue posible crear la convocatoria.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Talento Humano</p>
            <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-slate-900">Crear Convocatoria</h2>
          </div>

          <input
            value={form.codigo}
            onChange={(e) => setForm((prev) => ({ ...prev, codigo: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400"
            placeholder="CODIGO"
          />
          <input
            value={form.nombre}
            onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400"
            placeholder="NOMBRE"
          />
          <textarea
            value={form.descripcion}
            onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
            className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-indigo-400"
            placeholder="DESCRIPCION"
          />

          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.periodo}
              onChange={(e) => setForm((prev) => ({ ...prev, periodo: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase outline-none focus:border-indigo-400"
            >
              <option>Primer Semestre</option>
              <option>Segundo Semestre</option>
            </select>
            <input
              type="number"
              value={form.anio}
              onChange={(e) => setForm((prev) => ({ ...prev, anio: Number(e.target.value) || new Date().getFullYear() }))}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase outline-none focus:border-indigo-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={form.fechaApertura}
              onChange={(e) => setForm((prev) => ({ ...prev, fechaApertura: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase outline-none focus:border-indigo-400"
            />
            <input
              type="date"
              value={form.fechaCierre}
              onChange={(e) => setForm((prev) => ({ ...prev, fechaCierre: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase outline-none focus:border-indigo-400"
            />
          </div>

          <button
            onClick={() => void createConvocatoria()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white hover:bg-indigo-700"
          >
            <CalendarPlus2 size={16} /> Crear
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:col-span-3">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-4">
            <ListChecks size={16} className="text-indigo-700" />
            <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-800">Convocatorias registradas</p>
          </div>
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-[0.12em] text-white">
              <tr>
                <th className="px-4 py-3 text-left">Codigo</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-center">Periodo</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Postulaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {convocatorias.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-slate-400">
                    No hay convocatorias registradas.
                  </td>
                </tr>
              )}
              {convocatorias.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-700">{row.codigo}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{row.nombre}</td>
                  <td className="px-4 py-3 text-center text-xs font-semibold text-slate-700">{row.periodo} / {row.año}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase text-blue-700">{row.estado}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-black text-slate-900">{row.postulacionesCount ?? row.postulaciones_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {loading && <LoadingOverlay />}
    </div>
  );
};

export default ConvocatoriasModule;
