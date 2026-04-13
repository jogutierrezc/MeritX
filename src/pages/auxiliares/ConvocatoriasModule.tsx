import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Inbox,
  AlertCircle,
  CheckCircle,
  Search,
  FilePlus,
  BarChart3,
  Calendar,
  Clock,
  Info,
  History,
  ArrowLeft,
  Eye,
  MoreVertical,
  Filter,
  ListFilter,
  X,
  Save,
  Hash,
} from 'lucide-react';

import { DbConnection } from '../../module_bindings';
import { getSpacetimeConnectionConfig } from '../../services/spacetime';
import { getPortalCredentialsForRole, getPortalSession } from '../../services/portalAuth';

type ConvocatoriaData = {
  id: string;
  codigo: string;
  nombre: string;
  periodo: 'Primer Semestre' | 'Segundo Semestre';
  año: number;
  fecha_apertura: string;
  fecha_cierre: string;
  descripcion: string;
  estado: 'ABIERTA' | 'CERRADA' | 'CANCELADA';
  postulaciones_count?: number;
};

type PostulanteData = {
  expediente: string;
  id: string;
  programa: string;
  facultad: string;
  estado: string;
  puntajeRec: string;
  puntajeFin: string;
  categoria: string;
};

interface ConvocatoriasModuleProps {
  onClose?: () => void;
}

const ConvocatoriasModule: React.FC<ConvocatoriasModuleProps> = ({ onClose }) => {
  const [currentView, setCurrentView] = useState<'lista' | 'detalle'>('lista');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connection, setConnection] = useState<DbConnection | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedConvocatoria, setSelectedConvocatoria] = useState<ConvocatoriaData | null>(null);
  const [convocatorias, setConvocatorias] = useState<ConvocatoriaData[]>([]);

  const ensurePortalSession = async (conn: DbConnection) => {
    const session = getPortalSession();
    if (!session) {
      throw new Error('No hay una sesión activa para este portal.');
    }

    const credentials = getPortalCredentialsForRole(session.role);
    if (!credentials) {
      throw new Error('No se encontraron credenciales para la sesión activa.');
    }

    const reducers = conn.reducers as any;
    const loginFn = reducers.portalLogin || reducers.portal_login;
    if (typeof loginFn !== 'function') {
      throw new Error('Reducer portal_login no disponible.');
    }

    await loginFn({ role: session.role, username: credentials.username, password: credentials.password });
  };

  const readConvocatoriasFromCache = (conn: DbConnection) => {
    const dbView = conn.db as any;
    const convTable = dbView.convocatoria || dbView.convocatorias;
    if (!convTable) {
      setConvocatorias([]);
      return;
    }

    const rows = Array.from(convTable.iter()) as ConvocatoriaData[];
    setConvocatorias(rows);
  };

  const loadConvocatoriasOnce = async (conn: DbConnection) => {
    await new Promise<void>((resolve, reject) => {
      const subscription = conn
        .subscriptionBuilder()
        .onApplied(() => {
          readConvocatoriasFromCache(conn);
          subscription.unsubscribe();
          resolve();
        })
        .onError((ctx: unknown) => {
          subscription.unsubscribe();
          reject(ctx);
        })
        .subscribe(['SELECT * FROM convocatoria']);
    });
  };

  const [convocatoriaForm, setConvocatoriaForm] = useState({
    codigo: '',
    nombre: '',
    semestre: 'Primer Semestre' as const,
    año: new Date().getFullYear().toString(),
    inicio: '',
    cierre: '',
    descripcion: '',
  });

  // Generar código automático al abrir modal
  useEffect(() => {
    if (showModal && !convocatoriaForm.codigo) {
      const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      const year = new Date().getFullYear();
      setConvocatoriaForm((prev) => ({
        ...prev,
        codigo: `UDES-${year}-${randomPart}`,
      }));
    }
  }, [showModal]);

  // Inicializar conexión con SpacetimeDB
  useEffect(() => {
    const { host, databaseName } = getSpacetimeConnectionConfig();

    const conn = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(databaseName)
      .onConnect((liveConn: DbConnection) => {
        setConnected(true);
        ensurePortalSession(liveConn).catch((error) => {
          console.warn('ConvocatoriasModule portal session warning:', error);
        });
      })
      .onConnectError((_ctx: unknown, error: unknown) => {
        console.error('ConvocatoriasModule connect error:', error);
        setConnected(false);
      })
      .build();

    setConnection(conn);
    void loadConvocatoriasOnce(conn).catch((error) => console.error(error));

    return () => {
      conn.disconnect();
      setConnection(null);
    };
  }, []);

  const getDaysLeft = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConvocatoriaForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateConvocatoria = async () => {
    if (!connected || !connection) {
      window.alert('No hay conexión activa con SpacetimeDB.');
      return;
    }

    if (!convocatoriaForm.nombre || !convocatoriaForm.inicio || !convocatoriaForm.cierre) {
      window.alert('Por favor completa todos los campos requeridos.');
      return;
    }

    setLoading(true);
    try {
      await ensurePortalSession(connection);

      const reducers = connection.reducers as any;
      const candidates = [
        'createConvocatoria',
        'create_convocatoria',
      ];

      let createFn: ((payload: object) => Promise<void>) | null = null;
      for (const key of candidates) {
        if (typeof reducers[key] === 'function') {
          createFn = reducers[key] as (payload: object) => Promise<void>;
          break;
        }
      }

      if (!createFn) {
        throw new Error(
          'Reducer create_convocatoria no disponible en el cliente. Regenera bindings y publica el módulo SpacetimeDB.',
        );
      }

      await createFn({
        codigo: convocatoriaForm.codigo,
        nombre: convocatoriaForm.nombre,
        periodo: convocatoriaForm.semestre,
        año: parseInt(convocatoriaForm.año),
        fecha_apertura: convocatoriaForm.inicio,
        fecha_cierre: convocatoriaForm.cierre,
        descripcion: convocatoriaForm.descripcion,
        estado: 'ABIERTA',
      });

      setShowModal(false);
      setConvocatoriaForm({
        codigo: '',
        nombre: '',
        semestre: 'Primer Semestre',
        año: new Date().getFullYear().toString(),
        inicio: '',
        cierre: '',
        descripcion: '',
      });
      await loadConvocatoriasOnce(connection);
    } catch (error) {
      console.error('Error creating convocatoria:', error);
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('no such reducer')) {
        window.alert(
          'El backend publicado no tiene create_convocatoria. Debes publicar el módulo actualizado de SpacetimeDB y luego reintentar.',
        );
      } else if (message.includes('no hay una sesión activa para este portal')) {
        window.alert('Tu sesión del portal expiró o no está disponible. Inicia sesión nuevamente y vuelve a intentar.');
      } else {
        window.alert(error instanceof Error ? error.message : 'No fue posible crear la convocatoria.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Mock data de postulantes para demostración
  const postulantesData: PostulanteData[] = [
    {
      expediente: 'GUTIERREZ CONTRERAS JOSE ALFREDO',
      id: '1065822939',
      programa: 'INGENIERÍA DE SISTEMAS',
      facultad: 'INGENIERÍAS',
      estado: 'EN CALIFICACIÓN',
      puntajeRec: '240.0',
      puntajeFin: '235.5',
      categoria: 'ASOCIADO',
    },
    {
      expediente: 'MARTINEZ RUIZ ELENA',
      id: '1098233445',
      programa: 'MEDICINA',
      facultad: 'CIENCIAS DE LA SALUD',
      estado: 'AUDITADO',
      puntajeRec: '210.0',
      puntajeFin: '210.0',
      categoria: 'ASISTENTE',
    },
  ];

  // Vista de lista de convocatorias
  const ConvocatoriasList = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <ListFilter className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">Control de Convocatorias</h3>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-blue-700 shadow-lg shadow-slate-900/20 transition-all active:scale-95"
        >
          <FilePlus className="w-4 h-4" /> Crear Convocatoria
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white text-[10px] uppercase font-bold tracking-widest">
            <tr>
              <th className="py-4 px-6 text-left">Nombre de la Convocatoria</th>
              <th className="py-4 px-6 text-center">Periodo</th>
              <th className="py-4 px-6 text-center">Vigencia</th>
              <th className="py-4 px-6 text-center">Días Restantes</th>
              <th className="py-4 px-6 text-center">Postulaciones</th>
              <th className="py-4 px-6 text-center">Estado</th>
              <th className="py-4 px-6 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {convocatorias.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                <td className="py-5 px-6">
                  <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{c.nombre}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{c.codigo}</p>
                </td>
                <td className="py-5 px-6 text-center">
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded uppercase tracking-tighter">
                    {c.periodo}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1 font-bold">{c.año}</p>
                </td>
                <td className="py-5 px-6 text-center">
                  <div className="flex flex-col items-center gap-0.5 text-[11px] font-medium text-slate-500">
                    <span>{c.fecha_apertura}</span>
                    <div className="w-3 h-[1px] bg-slate-200"></div>
                    <span className="text-blue-600 font-bold">{c.fecha_cierre}</span>
                  </div>
                </td>
                <td className="py-5 px-6 text-center">
                  <div className="inline-flex flex-col items-center px-3 py-1 bg-rose-50 rounded-lg border border-rose-100">
                    <span className="text-sm font-black text-rose-600 leading-none">{getDaysLeft(c.fecha_cierre)}</span>
                    <span className="text-[8px] font-bold text-rose-400 uppercase mt-0.5">Días</span>
                  </div>
                </td>
                <td className="py-5 px-6 text-center">
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 rounded-full border border-blue-100">
                    <Users className="w-3 h-3 text-blue-600" />
                    <span className="text-xs font-bold text-blue-700">{c.postulaciones_count || 0}</span>
                  </div>
                </td>
                <td className="py-5 px-6 text-center">
                  <span
                    className={`px-2.5 py-1 text-[9px] font-black rounded-full uppercase border inline-block ${
                      c.estado === 'ABIERTA'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : c.estado === 'CERRADA'
                          ? 'bg-amber-50 text-amber-600 border-amber-100'
                          : 'bg-rose-50 text-rose-600 border-rose-100'
                    }`}
                  >
                    {c.estado}
                  </span>
                </td>
                <td className="py-5 px-6 text-center">
                  <button
                    onClick={() => {
                      setSelectedConvocatoria(c);
                      setCurrentView('detalle');
                    }}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Vista de detalle de convocatoria
  const DetalleView = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <button
        onClick={() => setCurrentView('lista')}
        className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-blue-600 transition-all uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4" /> Regresar al listado
      </button>

      <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between gap-8">
          <div className="space-y-4 flex-1">
            <div className="space-y-1">
              <span className="px-3 py-1 bg-blue-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest">
                {selectedConvocatoria?.codigo}
              </span>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">{selectedConvocatoria?.nombre}</h2>
            </div>
            <p className="text-slate-500 text-sm font-medium">{selectedConvocatoria?.descripcion}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {[
                {
                  label: 'Periodo',
                  value: `${selectedConvocatoria?.periodo} - ${selectedConvocatoria?.año}`,
                  icon: Calendar,
                },
                { label: 'Inicio', value: selectedConvocatoria?.fecha_apertura, icon: Clock },
                { label: 'Cierre', value: selectedConvocatoria?.fecha_cierre, icon: AlertCircle },
                { label: 'Postulados', value: `${selectedConvocatoria?.postulaciones_count || 0}`, icon: Users },
              ].map((item, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <item.icon className="w-2.5 h-2.5" /> {item.label}
                  </p>
                  <p className="text-xs font-bold text-slate-800 mt-1">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center p-8 bg-slate-800 text-white rounded-3xl min-w-[200px] shadow-lg">
            <span className="text-5xl font-black leading-none">{getDaysLeft(selectedConvocatoria?.fecha_cierre || '')}</span>
            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-2">Días para el cierre</p>
          </div>
        </div>
      </section>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div className="flex items-center gap-2">
            <Users className="text-blue-600 w-5 h-5" />
            <h3 className="font-bold text-slate-800">Postulantes Inscritos</h3>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white text-[9px] uppercase font-bold tracking-widest">
            <tr>
              <th className="py-4 px-6 text-left">Expediente</th>
              <th className="py-4 px-6 text-left">Programa / Facultad</th>
              <th className="py-4 px-6 text-center">Estado</th>
              <th className="py-4 px-6 text-center">Rec.</th>
              <th className="py-4 px-6 text-center">Final</th>
              <th className="py-4 px-6 text-center">Categoría</th>
              <th className="py-4 px-6 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {postulantesData.map((p, i) => (
              <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                <td className="py-4 px-6">
                  <p className="font-bold text-slate-800">{p.expediente}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{p.id}</p>
                </td>
                <td className="py-4 px-6">
                  <p className="text-[11px] font-bold text-slate-600">{p.programa}</p>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">{p.facultad}</p>
                </td>
                <td className="py-4 px-6 text-center">
                  <span
                    className={`px-2.5 py-1 text-[9px] font-black rounded-full border uppercase ${
                      p.estado === 'AUDITADO'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : 'bg-amber-50 text-amber-600 border-amber-100'
                    }`}
                  >
                    {p.estado}
                  </span>
                </td>
                <td className="py-4 px-6 text-center font-bold text-slate-300 text-xs">{p.puntajeRec}</td>
                <td className="py-4 px-6 text-center font-black text-blue-600">{p.puntajeFin}</td>
                <td className="py-4 px-6 text-center">
                  <span className="px-2 py-1 bg-slate-900 text-white text-[8px] font-black rounded uppercase">{p.categoria}</span>
                </td>
                <td className="py-4 px-6 text-center">
                  <button className="text-slate-300 hover:text-slate-800 transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {currentView === 'lista' && <ConvocatoriasList />}
      {currentView === 'detalle' && selectedConvocatoria && <DetalleView />}

      {/* --- MODAL: CREAR CONVOCATORIA --- */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setShowModal(false)}
          ></div>

          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
            <div className="bg-slate-50 p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
                  <FilePlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 leading-tight">Nueva Convocatoria</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Info className="w-3 h-3 text-blue-500" /> Registro de proceso institucional
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-400 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateConvocatoria();
              }}
              className="p-8 space-y-5"
            >
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Hash className="w-3 h-3 text-blue-600" /> Código Generado (Automático)
                </label>
                <div className="px-5 py-3.5 bg-blue-50/50 border border-blue-100 rounded-xl text-sm font-mono font-black text-blue-700 select-none">
                  {convocatoriaForm.codigo}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la Convocatoria</label>
                <input
                  type="text"
                  name="nombre"
                  placeholder="Ej. Docente Planta 2024 - Ingeniería"
                  value={convocatoriaForm.nombre}
                  onChange={handleInputChange}
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 outline-none transition-all placeholder:text-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Periodo / Semestre</label>
                  <select
                    name="semestre"
                    value={convocatoriaForm.semestre}
                    onChange={handleInputChange}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none cursor-pointer"
                  >
                    <option>Primer Semestre</option>
                    <option>Segundo Semestre</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Año de Apertura</label>
                  <input
                    type="number"
                    name="año"
                    value={convocatoriaForm.año}
                    onChange={handleInputChange}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-blue-500" /> Fecha Apertura
                  </label>
                  <input
                    type="date"
                    name="inicio"
                    value={convocatoriaForm.inicio}
                    onChange={handleInputChange}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-blue-500" /> Fecha Cierre
                  </label>
                  <input
                    type="date"
                    name="cierre"
                    value={convocatoriaForm.cierre}
                    onChange={handleInputChange}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción General</label>
                <textarea
                  name="descripcion"
                  placeholder="Detalles sobre requisitos mínimos, facultades asociadas..."
                  value={convocatoriaForm.descripcion}
                  onChange={handleInputChange}
                  className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium min-h-[100px] outline-none transition-all placeholder:text-slate-300"
                ></textarea>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-4 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" /> {loading ? 'Registrando...' : 'Registrar Proceso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConvocatoriasModule;
