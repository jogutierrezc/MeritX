import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  ClipboardList,
  Eye,
  FileCheck,
  FileText,
  GraduationCap,
  Hash,
  Info,
  Mic,
  Search,
  ShieldCheck,
  Upload,
  User,
  XCircle,
} from 'lucide-react';

import { DbConnection } from '../../module_bindings';
import AppLogo from '../../components/Common/AppLogo';
import type {
  Application,
  ApplicationExperience,
  ApplicationLanguage,
  ApplicationPublication,
  ApplicationTitle,
} from '../../module_bindings/types';
import LoadingOverlay from '../../components/LoadingOverlay';
import { getPortalSession } from '../../services/portalAuth';
import { useSpacetime } from '../../context/SpacetimeContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type DecanoRequest = {
  trackingId: string;
  professorName: string;
  documentNumber: string;
  campus: string;
  programName: string;
  facultyName: string;
  status: string;
  createdAt: string;
};

type CriterionRow = {
  cat: string;
  criterio: string;
  info: string;
  cant: number | string;
};

// ─── Status badge helper ──────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const label = status.replace(/_/g, ' ');
  const isPending =
    status === 'PENDIENTE_AVAL_FACULTAD' || status === 'PENDIENTE_VERIFICACION';
  return (
    <span
      className={`inline-block rounded-full border px-4 py-1.5 text-[9px] font-black uppercase tracking-tighter ${
        isPending
          ? 'border-amber-100 bg-amber-50 text-amber-600'
          : status.startsWith('AVALADO')
            ? 'border-emerald-100 bg-emerald-50 text-emerald-600'
            : status.startsWith('RECHAZADO')
              ? 'border-rose-100 bg-rose-50 text-rose-600'
              : 'border-slate-100 bg-slate-50 text-slate-500'
      }`}
    >
      {label}
    </span>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const DecanoPage = () => {
  // Navigation
  const [currentView, setCurrentView] = useState<'list' | 'verify'>('list');

  // SpacetimeDB
  const { connection, connected } = useSpacetime();
  const [loading, setLoading] = useState(false);

  // Table data
  const [requests, setRequests] = useState<DecanoRequest[]>([]);
  const [allTitles, setAllTitles] = useState<ApplicationTitle[]>([]);
  const [allExperiences, setAllExperiences] = useState<ApplicationExperience[]>([]);
  const [allPublications, setAllPublications] = useState<ApplicationPublication[]>([]);
  const [allLanguages, setAllLanguages] = useState<ApplicationLanguage[]>([]);
  const [assignedFacultyName, setAssignedFacultyName] = useState('');

  // Selection & form
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DecanoRequest | null>(null);
  const [observations, setObservations] = useState('');
  const [interviewFileName, setInterviewFileName] = useState('');
  const [decisionFileName, setDecisionFileName] = useState('');

  // Hidden file inputs
  const interviewInputRef = useRef<HTMLInputElement>(null);
  const decisionInputRef = useRef<HTMLInputElement>(null);

  // ── SpacetimeDB connection ──────────────────────────────────────────────────

  useEffect(() => {
    if (!connection) return;

    const refreshFromCache = () => {
      const db = connection.db as any;
      const session = getPortalSession();

      const assignmentRows = db.user_faculty_assignment
        ? (Array.from(db.user_faculty_assignment.iter()) as Array<any>)
        : [];
      const activeAssignment = assignmentRows.find(
        (row) =>
          row.active &&
          session?.username &&
          String(row.userEmail || row.user_email || '').toLowerCase() === session.username.toLowerCase(),
      );
      const assignmentFaculty = String(activeAssignment?.facultyName || activeAssignment?.faculty_name || '');
      setAssignedFacultyName(assignmentFaculty);

      // Applications
      const appRows: Application[] = db.application
        ? (Array.from(db.application.iter()) as Application[])
        : [];
      const visibleRows = assignmentFaculty
        ? appRows.filter((row) => row.facultyName === assignmentFaculty)
        : appRows;
      setRequests(
        visibleRows.map((row) => ({
          trackingId: row.trackingId,
          professorName: row.professorName,
          documentNumber: row.documentNumber,
          campus: row.campus,
          programName: row.programName,
          facultyName: row.facultyName,
          status: row.status,
          createdAt: row.createdAt
            ? new Date(Number((row.createdAt as any).__time_ms ?? 0))
                .toISOString()
                .slice(0, 10)
            : '',
        })),
      );

      // Supporting tables
      if (db.application_title)
        setAllTitles(Array.from(db.application_title.iter()) as ApplicationTitle[]);
      if (db.application_experience)
        setAllExperiences(
          Array.from(db.application_experience.iter()) as ApplicationExperience[],
        );
      if (db.application_publication)
        setAllPublications(
          Array.from(db.application_publication.iter()) as ApplicationPublication[],
        );
      if (db.application_language)
        setAllLanguages(
          Array.from(db.application_language.iter()) as ApplicationLanguage[],
        );
    };

    const subscription = connection
      .subscriptionBuilder()
      .onApplied(() => refreshFromCache())
      .onError((ctx: unknown) => console.error(ctx))
      .subscribe([
        'SELECT * FROM application',
        'SELECT * FROM application_title',
        'SELECT * FROM application_experience',
        'SELECT * FROM application_publication',
        'SELECT * FROM application_language',
        'SELECT * FROM user_faculty_assignment',
      ]);

    return () => {
      subscription.unsubscribe();
    };
  }, [connection]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const runReducer = async (reducerName: string, args: object) => {
    if (!connection) throw new Error('Sin conexion a Spacetime.');
    const reducerView = connection.reducers as any;
    const fn =
      reducerView[reducerName] ||
      reducerView[reducerName.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())];
    if (typeof fn !== 'function')
      throw new Error(`Reducer no disponible: ${reducerName}`);
    await fn(args);
  };

  // ── Derived data ─────────────────────────────────────────────────────────────

  const filteredRequests = useMemo(() => {
    const lookup = search.trim().toLowerCase();
    if (!lookup) return requests;
    return requests.filter((row) => {
      const text =
        `${row.trackingId} ${row.professorName} ${row.documentNumber} ${row.facultyName} ${row.programName}`.toLowerCase();
      return text.includes(lookup);
    });
  }, [requests, search]);

  const selectedCriteria = useMemo<CriterionRow[]>(() => {
    if (!selected) return [];
    const tid = selected.trackingId;
    const rows: CriterionRow[] = [];

    // Titles
    allTitles
      .filter((t) => t.trackingId === tid)
      .forEach((t) =>
        rows.push({ cat: 'ESTUDIOS', criterio: t.titleLevel, info: t.titleName, cant: 1 }),
      );

    // Experiences
    allExperiences
      .filter((e) => e.trackingId === tid)
      .forEach((e) => {
        const start = e.startedAt ? e.startedAt.slice(0, 4) : '—';
        const end = e.endedAt ? e.endedAt.slice(0, 4) : 'Presente';
        rows.push({
          cat: 'EXPERIENCIA',
          criterio: e.experienceType,
          info: `${start} – ${end}`,
          cant: 1,
        });
      });

    // Publications
    allPublications
      .filter((p) => p.trackingId === tid)
      .forEach((p) =>
        rows.push({
          cat: 'PRODUCCIÓN INTELECTUAL',
          criterio: p.publicationType,
          info: p.publicationTitle,
          cant: p.authorsCount ?? 1,
        }),
      );

    // Languages
    allLanguages
      .filter((l) => l.trackingId === tid)
      .forEach((l) =>
        rows.push({
          cat: 'IDIOMAS',
          criterio: l.languageName,
          info: l.languageLevel,
          cant: 1,
        }),
      );

    return rows;
  }, [selected, allTitles, allExperiences, allPublications, allLanguages]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleDecision = async (
    status: 'APTO_PARA_CONTINUAR' | 'RECHAZAR_POSTULACION',
  ) => {
    if (!selected) return;
    if (!connected) {
      window.alert('No hay conexion activa con SpacetimeDB.');
      return;
    }
    setLoading(true);
    try {
      await runReducer('record_decano_review', {
        trackingId: selected.trackingId,
        reviewStatus: status,
        observations,
        interviewFileName,
        decisionFileName,
      });
      setSelected(null);
      setObservations('');
      setInterviewFileName('');
      setDecisionFileName('');
      setCurrentView('list');
    } catch (error) {
      console.error(error);
      window.alert('No fue posible registrar la decision del Consejo de Facultad.');
    } finally {
      setLoading(false);
    }
  };

  const selectAndNavigate = (item: DecanoRequest) => {
    setSelected(item);
    setObservations('');
    setInterviewFileName('');
    setDecisionFileName('');
    setCurrentView('verify');
  };

  // ── VIEW: LIST ───────────────────────────────────────────────────────────────

  const ListView = () => (
    <div className="space-y-8">
      {/* Hero panel */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-[#003366] p-12 text-white shadow-2xl">
        <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 -translate-y-1/2 translate-x-1/2 rounded-full bg-blue-400/10 blur-[80px]" />
        <div className="relative z-10 space-y-4">
          <AppLogo className="inline-flex items-center rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-md" imgClassName="h-10 w-auto" />
          <h2 className="text-5xl font-black uppercase leading-none tracking-tighter">
            Verificación de <br />
            <span className="text-blue-300">Credenciales</span>
          </h2>
          <p className="mt-4 border-l-2 border-blue-500/30 pl-6 text-[11px] font-black uppercase tracking-widest text-blue-100/40">
            Validación de requisitos mínimos y cumplimiento institucional
          </p>
          {assignedFacultyName && (
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">
              Facultad asignada: {assignedFacultyName}
            </p>
          )}
        </div>
      </section>

      {/* Table */}
      <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm">
        {/* Table header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/30 p-8">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-blue-600" />
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-800">
              Bandeja de Postulantes
            </h3>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por nombre, radicado o programa…"
              className="w-80 rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-6 text-xs shadow-inner outline-none transition-all focus:border-blue-400"
            />
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-[#1e293b] text-[10px] font-bold uppercase tracking-widest text-white">
            <tr>
              <th className="px-8 py-6 text-left">Postulante / Radicado</th>
              <th className="px-6 py-6 text-left">Facultad / Programa</th>
              <th className="px-6 py-6 text-center">Fecha postulación</th>
              <th className="px-6 py-6 text-center">Estado</th>
              <th className="px-8 py-6 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRequests.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-8 py-12 text-center text-sm font-semibold text-slate-400"
                >
                  {search ? 'Sin resultados para la búsqueda.' : 'No hay postulaciones registradas.'}
                </td>
              </tr>
            ) : (
              filteredRequests.map((a) => (
                <tr key={a.trackingId} className="transition-colors hover:bg-blue-50/30">
                  <td className="px-8 py-6">
                    <p className="font-black uppercase tracking-tight text-slate-800">
                      {a.professorName}
                    </p>
                    <p className="mt-1 font-mono text-[10px] font-bold text-blue-600">
                      {a.trackingId}
                    </p>
                  </td>
                  <td className="px-6 py-6">
                    <p className="text-xs font-bold leading-tight text-slate-700">
                      {a.programName}
                    </p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-tighter text-slate-400">
                      {a.facultyName}
                    </p>
                  </td>
                  <td className="px-6 py-6 text-center text-xs font-bold text-slate-400">
                    {a.createdAt || '—'}
                  </td>
                  <td className="px-6 py-6 text-center">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-8 py-6 text-center">
                    <button
                      onClick={() => selectAndNavigate(a)}
                      className="rounded-xl bg-[#003366] px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-600 active:scale-95"
                    >
                      Validar Perfil
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── VIEW: VERIFY ─────────────────────────────────────────────────────────────

  const VerifyView = () => (
    <div className="space-y-8 pb-20">
      {/* Back button */}
      <button
        onClick={() => setCurrentView('list')}
        className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 shadow-sm transition-all hover:text-blue-600"
      >
        <ArrowLeft className="h-4 w-4" /> Regresar al Listado
      </button>

      {/* Professor profile */}
      <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-10 shadow-sm">
        <div className="pointer-events-none absolute right-0 top-0 p-10 opacity-[0.03]">
          <User className="h-64 w-64" />
        </div>
        <div className="relative z-10 flex flex-col items-center justify-between gap-10 lg:flex-row">
          <div className="grid flex-1 grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Name */}
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <User className="h-5 w-5" />
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Aspirante
                </label>
                <p className="text-sm font-bold uppercase leading-tight text-slate-800">
                  {selected?.professorName}
                </p>
              </div>
            </div>
            {/* ID / Tracking */}
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-slate-50 p-3 text-slate-600">
                <Hash className="h-5 w-5" />
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Identificación / Radicado
                </label>
                <p className="text-sm font-bold leading-tight text-slate-800">
                  {selected?.documentNumber}{' '}
                  <span className="ml-2 font-mono text-blue-600">[{selected?.trackingId}]</span>
                </p>
              </div>
            </div>
            {/* Program */}
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Programa / Facultad
                </label>
                <p className="text-sm font-bold uppercase leading-tight text-slate-800">
                  {selected?.programName}
                </p>
                <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                  {selected?.facultyName}
                </p>
              </div>
            </div>
          </div>

          <div className="min-w-[220px] rounded-3xl border border-slate-100 bg-[#f8fafc] px-8 py-4 text-center">
            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
              Estado Actual
            </p>
            <StatusBadge status={selected?.status ?? ''} />
          </div>
        </div>
      </section>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Criteria table */}
        <div className="space-y-6 lg:col-span-2">
          <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-900 p-6 text-white">
              <FileCheck className="h-5 w-5 text-blue-400" />
              <h4 className="text-sm font-black uppercase tracking-widest">
                Información Suministrada por el Docente
              </h4>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-6 py-4 text-left">Criterio de Evaluación</th>
                  <th className="px-6 py-4 text-left">Detalle / Título</th>
                  <th className="px-4 py-4 text-center">Cant.</th>
                  <th className="px-6 py-4 text-center">Soportes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedCriteria.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-10 text-center text-xs font-semibold text-slate-400"
                    >
                      Sin información cargada para esta postulación.
                    </td>
                  </tr>
                ) : (
                  selectedCriteria.map((d, idx) => (
                    <tr key={idx} className="transition-colors hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="text-[10px] font-black uppercase text-slate-800">
                          {d.criterio}
                        </p>
                        <span className="text-[8px] font-bold uppercase text-slate-400">
                          {d.cat}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">{d.info}</td>
                      <td className="px-4 py-4 text-center font-mono font-bold text-slate-800">
                        {d.cant}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button className="rounded-lg bg-blue-50 p-2 text-blue-600 shadow-sm transition-all hover:bg-blue-600 hover:text-white">
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Decano action panel */}
        <div className="space-y-6">
          <div className="space-y-6 rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
              <ShieldCheck className="h-6 w-6 text-blue-600" />
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-800">
                Acción del Decano
              </h4>
            </div>

            {/* Interview upload */}
            <div className="space-y-2">
              <label className="ml-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                Anexar Soporte Entrevista
              </label>
              <input
                ref={interviewInputRef}
                type="file"
                className="hidden"
                onChange={(e) =>
                  setInterviewFileName(e.target.files?.[0]?.name ?? '')
                }
              />
              <button
                type="button"
                onClick={() => interviewInputRef.current?.click()}
                className="group flex w-full items-center justify-between rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-4 transition-all hover:border-blue-400"
              >
                <div className="flex items-center gap-3">
                  <Mic className="h-5 w-5 text-slate-400 group-hover:text-blue-600" />
                  <span className="text-xs font-bold text-slate-500 truncate max-w-[160px]">
                    {interviewFileName || 'Subir acta de entrevista…'}
                  </span>
                </div>
                <Upload className="h-4 w-4 text-slate-300" />
              </button>
            </div>

            {/* Decision upload */}
            <div className="space-y-2">
              <label className="ml-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                Anexar Decisión del Consejo
              </label>
              <input
                ref={decisionInputRef}
                type="file"
                className="hidden"
                onChange={(e) =>
                  setDecisionFileName(e.target.files?.[0]?.name ?? '')
                }
              />
              <button
                type="button"
                onClick={() => decisionInputRef.current?.click()}
                className="group flex w-full items-center justify-between rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-4 transition-all hover:border-blue-400"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-slate-400 group-hover:text-blue-600" />
                  <span className="text-xs font-bold text-slate-500 truncate max-w-[160px]">
                    {decisionFileName || 'Subir decisión oficial…'}
                  </span>
                </div>
                <Upload className="h-4 w-4 text-slate-300" />
              </button>
            </div>

            {/* Observations */}
            <div className="space-y-2">
              <label className="ml-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                Observaciones Finales
              </label>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Justifique el dictamen para el CAP…"
                className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 text-xs font-medium outline-none transition-all focus:border-blue-400"
              />
            </div>

            {/* Decision buttons */}
            <div className="space-y-3 pt-4">
              <button
                onClick={() => void handleDecision('APTO_PARA_CONTINUAR')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-emerald-500/20 transition-all hover:-translate-y-1 hover:bg-emerald-700"
              >
                <CheckCircle className="h-4 w-4" /> Apto para Continuar
              </button>
              <button
                onClick={() => void handleDecision('RECHAZAR_POSTULACION')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white py-4 text-[10px] font-black uppercase tracking-[0.2em] text-rose-600 transition-all hover:bg-rose-50"
              >
                <XCircle className="h-4 w-4" /> Rechazar Postulación
              </button>
            </div>

            {/* Info note */}
            <div className="flex items-start gap-3 rounded-2xl bg-blue-50 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <p className="text-[9px] font-bold uppercase leading-relaxed text-blue-700">
                Tras la aprobación, el expediente será remitido automáticamente al Comité de
                Asuntos Profesorales (CAP).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-0">
      {loading && <LoadingOverlay label="Guardando decisión del Consejo de Facultad…" />}
      {currentView === 'list' ? <ListView /> : <VerifyView />}
    </div>
  );
};

export default DecanoPage;
