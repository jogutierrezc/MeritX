import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckSquare, FileSearch, LayoutDashboard, Search, Square, Users } from 'lucide-react';

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

  return (
    <>
      <div className="space-y-10">
        {view === 'lista' && (
          <>
            <section className="border-[8px] border-slate-950 bg-white p-8 shadow-2xl">
              <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">Portal operativo</p>
                  <h2 className="mt-3 text-4xl font-black uppercase tracking-tighter text-slate-950 md:text-5xl">
                    Portal de <span className="text-blue-600">Auxiliares</span>
                  </h2>
                </div>
                <div className="grid gap-3 md:grid-cols-4 xl:min-w-[640px]">
                  {CAMPUS.map((campus) => (
                    <button
                      key={campus}
                      onClick={() => setActiveCampus(campus)}
                      className={`border-4 px-4 py-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all ${
                        activeCampus === campus
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-950 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {campus}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-0 overflow-hidden border-x-8 border-b-8 border-slate-950 shadow-2xl md:grid-cols-4">
              {[
                { label: 'Total Postulados', value: stats.total, icon: Users, color: 'text-slate-950' },
                { label: 'Bandeja Pendiente', value: stats.pendientes, icon: LayoutDashboard, color: 'text-blue-600' },
                { label: 'Por Subsanar', value: stats.subsanar, icon: AlertCircle, color: 'text-amber-600' },
                { label: 'Auditados Aptos', value: `${stats.percent}%`, icon: CheckSquare, color: 'text-emerald-600' },
              ].map((item) => (
                <div key={item.label} className="bg-white p-10 text-center border-r border-slate-100">
                  <item.icon size={24} className={`mx-auto mb-4 ${item.color}`} />
                  <p className="text-5xl font-black leading-none text-slate-950">{item.value}</p>
                  <p className="mt-4 text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">{item.label}</p>
                </div>
              ))}
            </section>

            <section className="overflow-hidden border-8 border-slate-950 bg-white shadow-2xl">
              <div className="flex flex-col gap-6 border-b-4 border-slate-100 bg-slate-50 p-8 lg:flex-row lg:items-center lg:justify-between">
                <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-950">
                  Bandeja de entrada <span className="text-blue-600">{activeCampus}</span>
                </h3>
                <div className="relative w-full lg:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="FILTRAR POR DOCENTE O ID"
                    className="w-full border-4 border-slate-950 bg-white py-4 pl-11 pr-4 text-[11px] font-black uppercase outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-950 text-[9px] font-black uppercase tracking-[0.3em] text-white">
                    <tr>
                      <th className="p-5 text-left">Expediente</th>
                      <th className="p-5 text-left">Tracking</th>
                      <th className="p-5 text-left">Estado</th>
                      <th className="p-5 text-left">Puntaje</th>
                      <th className="p-5 text-right">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] font-bold uppercase">
                    {campusRequests.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-10 text-center text-slate-400">
                          No hay expedientes para este campus con el filtro actual.
                        </td>
                      </tr>
                    )}
                    {campusRequests.map((request) => (
                      <tr key={request.id} className="border-b border-slate-100 hover:bg-blue-50/50">
                        <td className="p-5">
                          <p className="font-black tracking-tight text-slate-950">{request.nombre || 'SIN NOMBRE'}</p>
                          <p className="mt-1 text-[9px] font-normal text-slate-400">{request.documento || 'SIN DOCUMENTO'}</p>
                        </td>
                        <td className="p-5 font-mono text-blue-600">{request.trackingId || request.id}</td>
                        <td className="p-5">
                          <span className="font-black tracking-[0.2em] text-slate-700">{request.status || 'RECIBIDO'}</span>
                        </td>
                        <td className="p-5 font-black text-slate-950">{typeof request.finalPts === 'number' ? request.finalPts.toFixed(1) : '0.0'}</td>
                        <td className="p-5 text-right">
                          <button
                            onClick={() => {
                              setSelectedRequest(request);
                              setView('auditoria');
                            }}
                            className="bg-slate-950 px-5 py-3 text-[9px] font-black uppercase tracking-[0.25em] text-white transition-all hover:bg-blue-600"
                          >
                            Auditar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {view === 'auditoria' && selectedRequest && (
          <section className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="border-4 border-slate-950 bg-slate-900 p-12 text-center text-white/20 shadow-2xl min-h-[520px] flex flex-col items-center justify-center">
              <FileSearch size={120} />
              <p className="mt-8 text-sm font-black uppercase tracking-[0.45em]">Visualizador documental</p>
              <p className="mt-6 max-w-sm text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                Zona reservada para vista de soportes, PDF y validaciones futuras.
              </p>
            </div>

            <div className="border-4 border-slate-950 bg-white p-8 shadow-2xl md:p-12">
              <div className="flex flex-col gap-5 border-b-4 border-blue-600 pb-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <button
                    onClick={() => setView('lista')}
                    className="mb-4 inline-flex items-center gap-2 border-2 border-slate-950 bg-slate-100 px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-950"
                  >
                    <ArrowLeft size={14} /> Volver
                  </button>
                  <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-950">
                    Auditoria de <span className="text-blue-600">Expediente</span>
                  </h3>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    {selectedRequest.nombre || 'SIN NOMBRE'} · {selectedRequest.trackingId || selectedRequest.id}
                  </p>
                </div>
                <div className="border-4 border-slate-950 bg-slate-50 px-6 py-5 text-center">
                  <p className="text-5xl font-black tracking-tighter text-slate-950">
                    {typeof selectedRequest.finalPts === 'number' ? selectedRequest.finalPts.toFixed(1) : '0.0'}
                  </p>
                  <div className={`mt-3 px-3 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-white ${selectedRequest.finalCat?.bgColor || 'bg-slate-500'}`}>
                    {selectedRequest.finalCat?.name || 'SIN CATEGORIA'}
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-4">
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
                      className={`flex items-center justify-between border-4 p-5 text-left transition-all ${
                        auditChecklist[field]
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 bg-white hover:border-blue-600'
                      }`}
                    >
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">{item.label}</span>
                      {auditChecklist[field] ? <CheckSquare className="text-emerald-600" /> : <Square className="text-slate-300" />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Observaciones</label>
                <textarea
                  value={auditChecklist.observaciones}
                  onChange={(e) => setAuditChecklist((prev) => ({ ...prev, observaciones: e.target.value }))}
                  className="h-44 w-full border-4 border-slate-950 bg-slate-50 p-5 text-sm font-bold uppercase outline-none"
                  placeholder="DETALLA DOCUMENTOS FALTANTES O HALLAZGOS"
                />
              </div>

              <div className="mt-8 flex flex-col gap-4 md:flex-row">
                <button
                  onClick={() => handleStatusUpdate(selectedRequest.id, 'SUBSANACION', auditChecklist.observaciones)}
                  className="flex-1 bg-amber-500 px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-white transition-all hover:bg-amber-600"
                >
                  Solicitar subsanacion
                </button>
                <button
                  onClick={() => handleStatusUpdate(selectedRequest.id, 'APTO', 'Expediente validado y apto.')}
                  className="flex-1 bg-emerald-600 px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-white transition-all hover:bg-emerald-700"
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
