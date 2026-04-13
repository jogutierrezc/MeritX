import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle,
  CheckSquare,
  FilePlus,
  FileSearch,
  Filter,
  Inbox,
  MapPin,
  MoreVertical,
  Search,
  Square,
  Users,
} from 'lucide-react';

import { DbConnection } from '../module_bindings';
import type { Application } from '../module_bindings/types';
import { getSpacetimeConnectionConfig } from '../services/spacetime';
import LoadingOverlay from '../components/LoadingOverlay';

const CAMPUS = ['VALLEDUPAR', 'BUCARAMANGA', 'CUCUTA', 'BOGOTA'] as const;

type Campus = (typeof CAMPUS)[number];

type AuditChecklist = {
  tituloValidado: boolean;
  experienciaCertificada: boolean;
  produccionVerificada: boolean;
  idiomaConvalidado: boolean;
  observaciones: string;
};

type AuxiliarRequest = {
  id: string;
  nombre?: string;
  documento?: string;
  trackingId?: string;
  campus?: string;
  status?: string;
  outputMessage?: string;
  finalPts?: number;
  finalCat?: { name?: string; bgColor?: string };
  programa?: string;
};

const defaultChecklist: AuditChecklist = {
  tituloValidado: false,
  experienciaCertificada: false,
  produccionVerificada: false,
  idiomaConvalidado: false,
  observaciones: '',
};

const AuxiliaresPage = () => {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connection, setConnection] = useState<DbConnection | null>(null);
  const [view, setView] = useState<'lista' | 'auditoria'>('lista');
  const [activeCampus, setActiveCampus] = useState<Campus>('VALLEDUPAR');
  const [requests, setRequests] = useState<AuxiliarRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<AuxiliarRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [auditChecklist, setAuditChecklist] = useState<AuditChecklist>(defaultChecklist);

  useEffect(() => {
    const { host, databaseName } = getSpacetimeConnectionConfig();

    const conn = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(databaseName)
      .onConnect(() => setConnected(true))
      .onConnectError((_ctx: unknown, error: unknown) => {
        console.error(error);
        setConnected(false);
      })
      .build();

    setConnection(conn);

    const refreshFromCache = () => {
      const dbView = conn.db as any;
      const appTable = dbView.application;
      const rows = appTable ? (Array.from(appTable.iter()) as Application[]) : [];

      setRequests(
        rows.map((row) => ({
          id: row.trackingId,
          nombre: row.professorName,
          documento: row.documentNumber,
          trackingId: row.trackingId,
          campus: row.campus,
          status: row.status,
          outputMessage: row.outputMessage,
          finalPts: row.finalPoints,
          finalCat: { name: row.finalCategory, bgColor: 'bg-slate-500' },
          programa: row.programName,
        })),
      );
    };

    const subscription = conn
      .subscriptionBuilder()
      .onApplied(() => refreshFromCache())
      .onError((ctx: unknown) => console.error(ctx))
      .subscribe(['SELECT * FROM application']);

    return () => {
      subscription.unsubscribe();
      conn.disconnect();
      setConnection(null);
    };
  }, []);

  const runReducer = async (reducerName: string, args: object) => {
    if (!connection) throw new Error('Sin conexión a Spacetime.');
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

  useEffect(() => {
    if (view !== 'auditoria') setAuditChecklist(defaultChecklist);
  }, [view]);

  const handleStatusUpdate = async (id: string, newStatus: string, message: string) => {
    if (!connected) {
      window.alert('No hay conexión activa con SpacetimeDB.');
      return;
    }

    setLoading(true);
    try {
      await runReducer('record_application_audit', {
        trackingId: id,
        currentStatus: newStatus,
        titleValidated: auditChecklist.tituloValidado,
        experienceCertified: auditChecklist.experienciaCertificada,
        publicationVerified: auditChecklist.produccionVerificada,
        languageValidated: auditChecklist.idiomaConvalidado,
        observations: auditChecklist.observaciones || '',
      });

      await runReducer('update_application_status', {
        trackingId: id,
        status: newStatus,
        outputMessage: message || `Estado actualizado a ${newStatus} por Auditoría.`,
      });
      setSelectedRequest(null);
      setView('lista');
    } catch (error) {
      console.error(error);
      window.alert('No fue posible actualizar el estado del expediente.');
    } finally {
      setLoading(false);
    }
  };

  const campusRequests = useMemo(
    () =>
      requests.filter((request) => {
        const matchesCampus = (request.campus || 'VALLEDUPAR') === activeCampus;
        const lookup = `${request.nombre || ''} ${request.documento || ''} ${request.trackingId || ''}`.toLowerCase();
        const matchesSearch = lookup.includes(searchTerm.toLowerCase());
        return matchesCampus && matchesSearch;
      }),
    [requests, activeCampus, searchTerm],
  );

  const stats = useMemo(() => {
    const campusOnly = requests.filter((request) => (request.campus || 'VALLEDUPAR') === activeCampus);
    const aptos = campusOnly.filter((request) => request.status === 'APTO').length;
    const pendientes = campusOnly.filter((request) => ['RECIBIDO', 'EN_REVISION'].includes(request.status || 'RECIBIDO')).length;
    const subsanar = campusOnly.filter((request) => request.status === 'SUBSANACION').length;
    return {
      total: campusOnly.length,
      validados: aptos,
      pendientes,
      subsanar,
      percent: campusOnly.length ? Math.round((aptos / campusOnly.length) * 100) : 0,
    };
  }, [requests, activeCampus]);

  const getStatusBadgeClass = (status?: string) => {
    if (status === 'APTO') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'SUBSANACION') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (status === 'EN_REVISION') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-amber-100 text-amber-700 border-amber-200';
  };

  return (
    <>
      <div className="space-y-8">
        {view === 'lista' && (
          <>
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-6 py-6 text-white md:px-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-200">Portal operativo</p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
                      Portal de <span className="text-blue-300">Auxiliares</span>
                    </h2>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                      Control de expedientes y auditoria operativa
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 rounded-2xl border border-white/15 bg-white/10 p-2 backdrop-blur">
                    {CAMPUS.map((campus) => (
                      <button
                        key={campus}
                        onClick={() => setActiveCampus(campus)}
                        className={`rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] transition-all ${
                          activeCampus === campus
                            ? 'bg-blue-500 text-white shadow-md shadow-blue-900/40'
                            : 'text-slate-200 hover:bg-white/15 hover:text-white'
                        }`}
                      >
                        {campus}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 md:px-6">
                <button className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700 transition-colors hover:bg-blue-100">
                  <Inbox size={14} /> Bandeja de entrada
                </button>
                <button className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                  <FilePlus size={14} /> Crear convocatoria
                </button>
                <button className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                  <BarChart3 size={14} /> Reportes
                </button>
                <button className="ml-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                  <Calendar size={14} /> Historico
                </button>
              </div>

              <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-4 md:p-6">
                {[
                  {
                    label: 'Total Postulados',
                    value: stats.total,
                    icon: Users,
                    color: 'text-blue-600',
                    bg: 'bg-blue-50',
                  },
                  {
                    label: 'Bandeja Pendiente',
                    value: stats.pendientes,
                    icon: Inbox,
                    color: 'text-amber-600',
                    bg: 'bg-amber-50',
                  },
                  {
                    label: 'Por Subsanar',
                    value: stats.subsanar,
                    icon: AlertCircle,
                    color: 'text-rose-600',
                    bg: 'bg-rose-50',
                  },
                  {
                    label: 'Auditados Aptos',
                    value: `${stats.percent}%`,
                    icon: CheckCircle,
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-50',
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex items-center gap-4">
                      <div className={`${item.bg} ${item.color} rounded-xl p-3`}>
                        <item.icon size={22} />
                      </div>
                      <div>
                        <p className="text-3xl font-black leading-none text-slate-900">{item.value}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.17em] text-slate-400">{item.label}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/80 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-blue-600" />
                  <h3 className="text-lg font-black tracking-tight text-slate-900">
                    Bandeja de entrada <span className="text-blue-600">{activeCampus}</span>
                  </h3>
                </div>

                <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Filtrar por docente o ID"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold outline-none transition-colors focus:border-blue-500"
                    />
                  </div>
                  <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 hover:border-slate-300 hover:text-slate-900">
                    <Filter size={14} /> Filtros
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse">
                  <thead className="bg-slate-800 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                    <tr>
                      <th className="px-6 py-4 text-left">Expediente</th>
                      <th className="px-6 py-4 text-left">Tracking</th>
                      <th className="px-6 py-4 text-left">Estado</th>
                      <th className="px-6 py-4 text-center">Puntaje</th>
                      <th className="px-6 py-4 text-center">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                    {campusRequests.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-10 text-center text-slate-400">
                          No hay expedientes para este campus con el filtro actual.
                        </td>
                      </tr>
                    )}
                    {campusRequests.map((request) => (
                      <tr key={request.id} className="group transition-colors hover:bg-blue-50/40">
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 transition-colors group-hover:text-blue-700">
                              {request.nombre || 'SIN NOMBRE'}
                            </span>
                            <span className="text-xs font-mono text-slate-400">{request.documento || 'SIN DOCUMENTO'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="inline-flex items-center rounded-md border border-blue-100 bg-blue-50 px-2 py-1 font-mono text-xs uppercase text-blue-700">
                            {request.trackingId || request.id}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${getStatusBadgeClass(request.status)}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {(request.status || 'RECIBIDO').replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-center font-black text-slate-900">
                          {typeof request.finalPts === 'number' ? request.finalPts.toFixed(1) : '0.0'}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedRequest(request);
                                setView('auditoria');
                              }}
                              className="rounded-lg bg-slate-900 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.11em] text-white transition-all hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-900/20"
                            >
                              Auditar
                            </button>
                            <button className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-center md:px-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Mostrando {campusRequests.length} resultados para {activeCampus}
                </p>
              </div>
            </section>
          </>
        )}

        {view === 'auditoria' && selectedRequest && (
          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 text-center text-white/20 shadow-sm">
              <FileSearch size={110} />
              <p className="mt-8 text-sm font-black uppercase tracking-[0.35em] text-white/70">Visualizador documental</p>
              <p className="mt-6 max-w-sm text-xs font-bold uppercase tracking-[0.15em] text-white/50">
                Zona reservada para vista de soportes, PDF y validaciones futuras.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <button
                    onClick={() => setView('lista')}
                    className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
                  >
                    <ArrowLeft size={14} /> Volver
                  </button>
                  <h3 className="text-3xl font-black tracking-tight text-slate-900">
                    Auditoria de <span className="text-blue-600">expediente</span>
                  </h3>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {selectedRequest.nombre || 'SIN NOMBRE'} · {selectedRequest.trackingId || selectedRequest.id}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 text-center">
                  <p className="text-5xl font-black tracking-tight text-slate-900">
                    {typeof selectedRequest.finalPts === 'number' ? selectedRequest.finalPts.toFixed(1) : '0.0'}
                  </p>
                  <div className={`mt-3 rounded-md px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-white ${selectedRequest.finalCat?.bgColor || 'bg-slate-500'}`}>
                    {selectedRequest.finalCat?.name || 'SIN CATEGORIA'}
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-3">
                {[
                  { key: 'tituloValidado', label: 'Validacion de titulos' },
                  { key: 'experienciaCertificada', label: 'Experiencia certificada' },
                  { key: 'produccionVerificada', label: 'Produccion verificada' },
                  { key: 'idiomaConvalidado', label: 'Idioma convalidado' },
                ].map((item) => {
                  const field = item.key as keyof Omit<AuditChecklist, 'observaciones'>;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setAuditChecklist((prev) => ({ ...prev, [field]: !prev[field] }))}
                      className={`flex items-center justify-between rounded-xl border p-4 text-left transition-all ${
                        auditChecklist[field]
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-slate-200 bg-white hover:border-blue-300'
                      }`}
                    >
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-900">{item.label}</span>
                      {auditChecklist[field] ? <CheckSquare className="text-emerald-600" /> : <Square className="text-slate-300" />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Observaciones</label>
                <textarea
                  value={auditChecklist.observaciones}
                  onChange={(e) => setAuditChecklist((prev) => ({ ...prev, observaciones: e.target.value }))}
                  className="h-44 w-full rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm font-semibold outline-none transition-colors focus:border-blue-500"
                  placeholder="Detalla documentos faltantes o hallazgos"
                />
              </div>

              <div className="mt-8 flex flex-col gap-4 md:flex-row">
                <button
                  onClick={() => handleStatusUpdate(selectedRequest.id, 'SUBSANACION', auditChecklist.observaciones)}
                  className="flex-1 rounded-xl bg-amber-500 px-6 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-amber-600"
                >
                  Solicitar subsanacion
                </button>
                <button
                  onClick={() => handleStatusUpdate(selectedRequest.id, 'APTO', 'Expediente validado y apto.')}
                  className="flex-1 rounded-xl bg-emerald-600 px-6 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-emerald-700"
                >
                  Marcar como apto
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      {loading && <LoadingOverlay />}
    </>
  );
};

export default AuxiliaresPage;
