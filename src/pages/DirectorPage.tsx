import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BookOpen,
  Building2,
  CheckCircle,
  ClipboardList,
  FileText,
  GraduationCap,
  Layers,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  Users,
  XCircle,
} from 'lucide-react';

import LoadingOverlay from '../components/LoadingOverlay';
import AppLogo from '../components/Common/AppLogo';
import { DbConnection } from '../module_bindings';
import type {
  Application,
  ApplicationAudit,
  ApplicationAuditCriterion,
  ApplicationConvocatoria,
  ApplicationExperience,
  ApplicationLanguage,
  ApplicationPublication,
  ApplicationTitle,
  AuditScoreSnapshot,
  Convocatoria,
} from '../module_bindings/types';
import { clearPortalSession, getPortalCredentialsForRole, getPortalSession } from '../services/portalAuth';
import { getSpacetimeConnectionConfig } from '../services/spacetime';
import type { FormState } from '../types/domain';
import { calculateAdvancedEscalafon, ESCALAFON_CONFIG, getSuggestedCategoryByPoints } from '../utils/calculateEscalafon';

type AuditDocument = {
  name: string;
  meta?: string;
};

type DirectorCriterionStatus = 'Pendiente' | 'Valido' | 'Ausente' | 'Rechazado';

type DirectorCriterionItem = {
  id: string;
  categoria: string;
  criterio: string;
  docs: AuditDocument[];
  cantidad: number;
  unidad: string;
  valor: number;
  puntaje: number;
  estado: DirectorCriterionStatus;
};

type RequestEvidence = {
  titles: ApplicationTitle[];
  languages: ApplicationLanguage[];
  publications: ApplicationPublication[];
  experiences: ApplicationExperience[];
  criteria: ApplicationAuditCriterion[];
};

type DirectorRequest = {
  trackingId: string;
  nombre: string;
  documento: string;
  campus: string;
  programa: string;
  facultad: string;
  status: string;
  outputMessage: string;
  convocatoriaId: string;
  convocatoriaNombre: string;
  convocatoriaCodigo: string;
  auxiliarScore: number;
  auxiliarCategory: string;
  directorScore?: number;
  directorCategory?: string;
  finalScore: number;
  finalCategory: string;
  auditObservations: string;
};

const EMPTY_EVIDENCE: RequestEvidence = {
  titles: [],
  languages: [],
  publications: [],
  experiences: [],
  criteria: [],
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const parseSupportSummary = (summary?: string): AuditDocument[] => {
  if (!summary) return [];
  return summary
    .split(/\n|;|\|/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
};

const mapCriterionStatus = (status?: string): DirectorCriterionStatus => {
  const normalized = (status || '').toUpperCase();
  if (normalized.includes('VALID')) return 'Valido';
  if (normalized.includes('RECHAZ')) return 'Rechazado';
  if (normalized.includes('AUSENTE')) return 'Ausente';
  return 'Pendiente';
};

const normalizeTitleLevel = (level: string): 'Pregrado' | 'Especialización' | 'Maestría' | 'Doctorado' => {
  const normalized = normalizeText(level);
  if (normalized.includes('doctor')) return 'Doctorado';
  if (normalized.includes('maestr') || normalized.includes('magister')) return 'Maestría';
  if (normalized.includes('especial')) return 'Especialización';
  return 'Pregrado';
};

const normalizeLanguageLevel = (level: string): 'A2' | 'B1' | 'B2' | 'C1' => {
  const normalized = level.toUpperCase().trim();
  if (normalized.includes('C1')) return 'C1';
  if (normalized.includes('B2')) return 'B2';
  if (normalized.includes('B1')) return 'B1';
  return 'A2';
};

const normalizeExperienceType = (type: string): 'Profesional' | 'Docencia Universitaria' | 'Investigación' => {
  const normalized = normalizeText(type);
  if (normalized.includes('invest')) return 'Investigación';
  if (normalized.includes('docenc')) return 'Docencia Universitaria';
  return 'Profesional';
};

const getPublicationBaseValue = (publication: ApplicationPublication) => {
  const quartileValue = { Q1: 70, Q2: 50, Q3: 30, Q4: 20 }[publication.quartile as 'Q1' | 'Q2' | 'Q3' | 'Q4'] || 0;
  const type = normalizeText(publication.publicationType || '');
  if (type.includes('patent')) return 300;
  if (type.includes('libro')) return 100;
  if (type.includes('software')) return 70;
  if (type.includes('capitulo')) return 40;
  return quartileValue;
};

const getStageCriteria = (criteria: ApplicationAuditCriterion[], stage: string) =>
  criteria.filter((criterion) => (criterion.valuationStage || '').toUpperCase() === stage.toUpperCase());

const getLatestSnapshot = (snapshots: AuditScoreSnapshot[], trackingId: string, stagePrefix: string) =>
  snapshots
    .filter(
      (snapshot) =>
        snapshot.trackingId === trackingId &&
        (snapshot.valuationStage || '').toUpperCase().startsWith(stagePrefix.toUpperCase()),
    )
    .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())[0];

const formatDate = (value?: string) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-CO');
};

const formatScore = (value?: number) => (typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '0.0');

const buildItemsFromPersistedCriteria = (criteria: ApplicationAuditCriterion[]): DirectorCriterionItem[] =>
  criteria
    .slice()
    .sort((a, b) => a.criterionLabel.localeCompare(b.criterionLabel))
    .map((criterion) => ({
      id: criterion.criterionId,
      categoria: (criterion.valuationStage || criterion.criterionKey || 'CRITERIO').toUpperCase().replace(/_/g, ' '),
      criterio: criterion.criterionLabel,
      docs: parseSupportSummary(criterion.supportSummary),
      cantidad: Number(criterion.quantity || 0),
      unidad: criterion.unitLabel || 'Cant.',
      valor: Number(criterion.baseWeight || 0),
      puntaje: Number(criterion.weightedScore || 0),
      estado: mapCriterionStatus(criterion.criterionStatus),
    }));

const buildFallbackItems = (evidence: RequestEvidence, request: DirectorRequest): DirectorCriterionItem[] => {
  const baseForm: FormState = {
    nombre: request.nombre,
    documento: request.documento,
    programa: request.programa,
    facultad: request.facultad,
    scopusProfile: '',
    esIngresoNuevo: true,
    isAccreditedSource: false,
    yearsInCategory: 0,
    hasTrabajoAprobadoCEPI: false,
    titulos: evidence.titles.map((title) => ({
      titulo: title.titleName,
      nivel: normalizeTitleLevel(title.titleLevel),
      supportName: title.supportName || undefined,
      supportPath: title.supportPath || undefined,
    })),
    idiomas: evidence.languages.map((language) => ({
      idioma: language.languageName,
      nivel: normalizeLanguageLevel(language.languageLevel),
      convalidacion: language.convalidation ? 'SI' : 'NO',
    })),
    produccion: evidence.publications.map((publication) => ({
      titulo: publication.publicationTitle,
      cuartil: (publication.quartile as 'Q1' | 'Q2' | 'Q3' | 'Q4') || 'Q4',
      fecha: publication.publicationYear,
      tipo: publication.publicationType,
      autores: Number(publication.authorsCount || 1),
      fuente: (publication.sourceKind as 'SCOPUS' | 'ORCID' | 'MANUAL') || 'MANUAL',
    })),
    experiencia: evidence.experiences.map((experience) => ({
      tipo: normalizeExperienceType(experience.experienceType),
      inicio: experience.startedAt,
      fin: experience.endedAt,
      certificacion: experience.certified ? 'SI' : 'NO',
      supportName: experience.supportName || undefined,
      supportPath: experience.supportPath || undefined,
    })),
    orcid: '',
  };

  const scored = calculateAdvancedEscalafon(baseForm);
  const rows: DirectorCriterionItem[] = [];

  evidence.titles.forEach((title, index) => {
    const level = normalizeTitleLevel(title.titleLevel);
    const value = ESCALAFON_CONFIG.PUNTOS_TITULOS[level] || 0;
    rows.push({
      id: `title-${title.id || index}`,
      categoria: 'ESTUDIOS CURSADOS',
      criterio: `TITULO ${level.toUpperCase()}`,
      docs: [{ name: title.supportName || title.titleName, meta: title.titleName }],
      cantidad: 1,
      unidad: 'Cant.',
      valor: value,
      puntaje: value,
      estado: 'Pendiente',
    });
  });

  evidence.languages.forEach((language, index) => {
    const level = normalizeLanguageLevel(language.languageLevel);
    const value = ESCALAFON_CONFIG.PUNTOS_IDIOMA[level] || 0;
    rows.push({
      id: `language-${language.id || index}`,
      categoria: 'IDIOMA EXTRANJERO',
      criterio: `COMPETENCIA ${level}`,
      docs: [{ name: language.languageName, meta: `Nivel ${level}${language.convalidation ? ' · Convalidado' : ''}` }],
      cantidad: 1,
      unidad: 'Cant.',
      valor: value,
      puntaje: value,
      estado: 'Pendiente',
    });
  });

  evidence.publications.forEach((publication, index) => {
    const base = getPublicationBaseValue(publication);
    const authors = Number(publication.authorsCount || 1);
    let factor = 1;
    if (authors >= 3 && authors <= 4) factor = 0.5;
    if (authors >= 5) factor = 1 / authors;

    rows.push({
      id: `publication-${publication.id || index}`,
      categoria: 'PRODUCCION INTELECTUAL',
      criterio: publication.publicationType ? publication.publicationType.toUpperCase() : `ARTICULO ${publication.quartile}`,
      docs: [{ name: publication.publicationTitle, meta: `${publication.quartile} · ${publication.publicationYear} · ${publication.sourceKind}` }],
      cantidad: 1,
      unidad: 'Cant.',
      valor: base,
      puntaje: Number((base * factor).toFixed(2)),
      estado: 'Pendiente',
    });
  });

  const experienceRaw = evidence.experiences.map((experience) => {
    if (!experience.startedAt) return { experience, years: 0, valuePerYear: 0, rawScore: 0 };
    const years = Math.max(
      0,
      (new Date(experience.endedAt || new Date().toISOString()).getTime() - new Date(experience.startedAt).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
    );
    const normalizedType = normalizeExperienceType(experience.experienceType);
    const valuePerYear = { Profesional: 20, 'Docencia Universitaria': 30, Investigación: 50 }[normalizedType] || 0;
    return { experience, years, valuePerYear, rawScore: years * valuePerYear };
  });

  const rawTotal = experienceRaw.reduce((acc, item) => acc + item.rawScore, 0);
  const topedTotal = Math.min(rawTotal, scored.appliedTope || rawTotal);
  const factor = rawTotal > 0 ? topedTotal / rawTotal : 1;

  experienceRaw.forEach((item, index) => {
    rows.push({
      id: `experience-${item.experience.id || index}`,
      categoria: 'EXPERIENCIA CALIFICADA',
      criterio: item.experience.experienceType.toUpperCase(),
      docs: [{
        name: item.experience.supportName || item.experience.experienceType,
        meta: `${item.experience.startedAt} a ${item.experience.endedAt || 'Presente'} · ${item.years.toFixed(1)} anios`,
      }],
      cantidad: Number(item.years.toFixed(2)),
      unidad: 'Anios',
      valor: item.valuePerYear,
      puntaje: Number((item.rawScore * factor).toFixed(2)),
      estado: 'Pendiente',
    });
  });

  return rows;
};

const getStatusBadgeClass = (status?: string) => {
  if (status === 'APROBADO') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'SUBSANACION') return 'bg-rose-100 text-rose-700 border-rose-200';
  if ((status || '').includes('DIRECTOR')) return 'bg-blue-100 text-blue-700 border-blue-200';
  if (status === 'APTO') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
};

const DirectorPage = () => {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connection, setConnection] = useState<DbConnection | null>(null);
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationAudits, setApplicationAudits] = useState<ApplicationAudit[]>([]);
  const [applicationConvocatorias, setApplicationConvocatorias] = useState<ApplicationConvocatoria[]>([]);
  const [titles, setTitles] = useState<ApplicationTitle[]>([]);
  const [languages, setLanguages] = useState<ApplicationLanguage[]>([]);
  const [publications, setPublications] = useState<ApplicationPublication[]>([]);
  const [experiences, setExperiences] = useState<ApplicationExperience[]>([]);
  const [criteria, setCriteria] = useState<ApplicationAuditCriterion[]>([]);
  const [snapshots, setSnapshots] = useState<AuditScoreSnapshot[]>([]);
  const [selectedConvocatoriaId, setSelectedConvocatoriaId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<DirectorRequest | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<RequestEvidence>(EMPTY_EVIDENCE);
  const [auditItems, setAuditItems] = useState<DirectorCriterionItem[]>([]);
  const [directorNotes, setDirectorNotes] = useState('');

  const readFromCache = (conn: DbConnection) => {
    const dbView = conn.db as any;
    const convocatoriaTable = dbView.convocatoria || dbView.convocatorias;
    const applicationTable = dbView.application;
    const auditTable = dbView.applicationAudit || dbView.application_audit;
    const linkTable = dbView.applicationConvocatoria || dbView.application_convocatoria;
    const titleTable = dbView.applicationTitle || dbView.application_title;
    const languageTable = dbView.applicationLanguage || dbView.application_language;
    const publicationTable = dbView.applicationPublication || dbView.application_publication;
    const experienceTable = dbView.applicationExperience || dbView.application_experience;
    const criterionTable = dbView.applicationAuditCriterion || dbView.application_audit_criterion;
    const snapshotTable = dbView.auditScoreSnapshot || dbView.audit_score_snapshot;

    setConvocatorias(convocatoriaTable ? (Array.from(convocatoriaTable.iter()) as Convocatoria[]) : []);
    setApplications(applicationTable ? (Array.from(applicationTable.iter()) as Application[]) : []);
    setApplicationAudits(auditTable ? (Array.from(auditTable.iter()) as ApplicationAudit[]) : []);
    setApplicationConvocatorias(linkTable ? (Array.from(linkTable.iter()) as ApplicationConvocatoria[]) : []);
    setTitles(titleTable ? (Array.from(titleTable.iter()) as ApplicationTitle[]) : []);
    setLanguages(languageTable ? (Array.from(languageTable.iter()) as ApplicationLanguage[]) : []);
    setPublications(publicationTable ? (Array.from(publicationTable.iter()) as ApplicationPublication[]) : []);
    setExperiences(experienceTable ? (Array.from(experienceTable.iter()) as ApplicationExperience[]) : []);
    setCriteria(criterionTable ? (Array.from(criterionTable.iter()) as ApplicationAuditCriterion[]) : []);
    setSnapshots(snapshotTable ? (Array.from(snapshotTable.iter()) as AuditScoreSnapshot[]) : []);
  };

  const loadDataOnce = async (conn: DbConnection) => {
    await new Promise<void>((resolve, reject) => {
      const subscription = conn
        .subscriptionBuilder()
        .onApplied(() => {
          readFromCache(conn);
          subscription.unsubscribe();
          resolve();
        })
        .onError((ctx: unknown) => {
          subscription.unsubscribe();
          reject(ctx);
        })
        .subscribe([
          'SELECT * FROM convocatoria',
          'SELECT * FROM application',
          'SELECT * FROM application_audit',
          'SELECT * FROM application_convocatoria',
          'SELECT * FROM application_title',
          'SELECT * FROM application_language',
          'SELECT * FROM application_publication',
          'SELECT * FROM application_experience',
          'SELECT * FROM application_audit_criterion',
          'SELECT * FROM audit_score_snapshot',
        ]);
    });
  };

  const enforceSessionOrLogout = async (conn: DbConnection) => {
    const session = getPortalSession();
    if (!session) throw new Error('No hay una sesión activa para este portal.');
    const credentials = getPortalCredentialsForRole(session.role, session.username);
    if (!credentials) throw new Error('No se encontraron credenciales para la sesión activa.');

    const reducers = conn.reducers as any;
    const loginFn = reducers.portalLogin || reducers.portal_login;
    if (typeof loginFn !== 'function') throw new Error('Reducer portal_login no disponible.');

    await loginFn({ role: session.role, username: credentials.username, password: credentials.password });
  };

  const runReducer = async (reducerName: string, args: object) => {
    if (!connection) throw new Error('Sin conexión a SpacetimeDB.');
    const reducerView = connection.reducers as any;
    const candidates = [reducerName, reducerName.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())];

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
    const { host, databaseName } = getSpacetimeConnectionConfig();

    const conn = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(databaseName)
      .onConnect((liveConn: DbConnection) => {
        setConnected(true);
        enforceSessionOrLogout(liveConn).catch((error) => {
          console.warn('DirectorPage portal session warning:', error);
        });
      })
      .onConnectError((_ctx: unknown, error: unknown) => {
        console.error(error);
        setConnected(false);
      })
      .build();

    setConnection(conn);
    void loadDataOnce(conn).catch((error) => console.error(error));

    return () => {
      conn.disconnect();
      setConnection(null);
    };
  }, []);

  useEffect(() => {
    if (convocatorias.length === 0 || selectedConvocatoriaId) return;
    const preferred = convocatorias.find((item) => item.estado === 'ABIERTA') || convocatorias[0];
    if (preferred) setSelectedConvocatoriaId(preferred.id);
  }, [convocatorias, selectedConvocatoriaId]);

  const requests = useMemo(() => {
    const convocatoriaMap = new Map(convocatorias.map((convocatoria) => [convocatoria.id, convocatoria]));
    const auditMap = new Map(applicationAudits.map((audit) => [audit.trackingId, audit]));

    const mapped: DirectorRequest[] = [];

    applicationConvocatorias.forEach((link) => {
      const application = applications.find((item) => item.trackingId === link.trackingId);
      const convocatoria = convocatoriaMap.get(link.convocatoriaId);
      if (!application || !convocatoria) return;

      const auxiliarSnapshot = getLatestSnapshot(snapshots, application.trackingId, 'AUXILIAR');
      const directorSnapshot = getLatestSnapshot(snapshots, application.trackingId, 'DIRECTOR');
      const audit = auditMap.get(application.trackingId);

      mapped.push({
          trackingId: application.trackingId,
          nombre: application.professorName,
          documento: application.documentNumber,
          campus: application.campus,
          programa: application.programName,
          facultad: application.facultyName,
          status: application.status || 'RECIBIDO',
          outputMessage: application.outputMessage || '',
          convocatoriaId: convocatoria.id,
          convocatoriaNombre: convocatoria.nombre,
          convocatoriaCodigo: convocatoria.codigo,
          auxiliarScore: Number(auxiliarSnapshot?.currentWeightedScore ?? auxiliarSnapshot?.suggestedScore ?? 0),
          auxiliarCategory: auxiliarSnapshot?.finalCategory || application.finalCategory || 'SIN CATEGORIA',
          directorScore: directorSnapshot?.finalWeightedScore ?? directorSnapshot?.currentWeightedScore ?? undefined,
          directorCategory: directorSnapshot?.finalCategory ?? undefined,
          finalScore: application.finalPoints,
          finalCategory: application.finalCategory,
          auditObservations: audit?.observations || directorSnapshot?.notes || auxiliarSnapshot?.notes || '',
      });
    });

    return mapped.sort((a, b) => b.trackingId.localeCompare(a.trackingId));
  }, [applicationAudits, applicationConvocatorias, applications, convocatorias, snapshots]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const matchesConvocatoria = !selectedConvocatoriaId || request.convocatoriaId === selectedConvocatoriaId;
      const haystack = `${request.nombre} ${request.documento} ${request.trackingId} ${request.programa}`.toLowerCase();
      return matchesConvocatoria && haystack.includes(searchTerm.toLowerCase());
    });
  }, [requests, searchTerm, selectedConvocatoriaId]);

  const stats = useMemo(() => {
    const scope = requests.filter((request) => !selectedConvocatoriaId || request.convocatoriaId === selectedConvocatoriaId);
    const aprobados = scope.filter((request) => request.status === 'APROBADO').length;
    const pendientes = scope.filter((request) => ['RECIBIDO', 'APTO', 'EN_REVISION_DIRECTOR'].includes(request.status)).length;
    const subsanar = scope.filter((request) => request.status === 'SUBSANACION').length;
    const promedioAuxiliar = scope.length
      ? scope.reduce((acc, request) => acc + request.auxiliarScore, 0) / scope.length
      : 0;

    return {
      total: scope.length,
      aprobados,
      pendientes,
      subsanar,
      promedioAuxiliar,
    };
  }, [requests, selectedConvocatoriaId]);

  const totalDirectorScore = useMemo(
    () => auditItems.reduce((acc, item) => acc + (Number(item.puntaje) || 0), 0),
    [auditItems],
  );

  const getRequestEvidence = (trackingId: string): RequestEvidence => ({
    titles: titles.filter((row) => row.trackingId === trackingId),
    languages: languages.filter((row) => row.trackingId === trackingId),
    publications: publications.filter((row) => row.trackingId === trackingId),
    experiences: experiences.filter((row) => row.trackingId === trackingId),
    criteria: criteria.filter((row) => row.trackingId === trackingId),
  });

  const openDetail = async (request: DirectorRequest) => {
    setLoading(true);
    try {
      if (connection) {
        await loadDataOnce(connection);
      }
      const evidence = getRequestEvidence(request.trackingId);
      const directorCriteria = [
        ...getStageCriteria(evidence.criteria, 'DIRECTOR_REVIEW'),
        ...getStageCriteria(evidence.criteria, 'DIRECTOR_FINAL_REVIEW'),
      ];
      const auxiliarCriteria = getStageCriteria(evidence.criteria, 'AUXILIAR_REVIEW');

      setSelectedRequest(request);
      setSelectedEvidence(evidence);
      setAuditItems(
        directorCriteria.length > 0
          ? buildItemsFromPersistedCriteria(directorCriteria)
          : auxiliarCriteria.length > 0
            ? buildItemsFromPersistedCriteria(auxiliarCriteria)
            : buildFallbackItems(evidence, request),
      );
      setDirectorNotes(getLatestSnapshot(snapshots, request.trackingId, 'DIRECTOR')?.notes || request.auditObservations || '');
    } catch (error) {
      console.error(error);
      window.alert('No fue posible cargar el expediente del postulante.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (id: string, estado: DirectorCriterionStatus) => {
    setAuditItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const suggestedScore = estado === 'Valido' ? Number((item.cantidad * item.valor).toFixed(2)) : 0;
        return { ...item, estado, puntaje: suggestedScore };
      }),
    );
  };

  const handleScoreChange = (id: string, value: string) => {
    const parsed = Number(value);
    setAuditItems((prev) => prev.map((item) => (item.id === id ? { ...item, puntaje: Number.isFinite(parsed) ? parsed : 0 } : item)));
  };

  const buildCriteriaPayload = () => {
    return auditItems.map((item, index) => ({
      criterionKey:
        `${item.categoria}-${item.criterio}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '') || `director_criterion_${index + 1}`,
      criterionLabel: item.criterio,
      criterionStatus:
        item.estado === 'Valido'
          ? 'VALIDADO'
          : item.estado === 'Rechazado'
            ? 'RECHAZADO'
            : item.estado === 'Ausente'
              ? 'AUSENTE'
              : 'PENDIENTE',
      quantity: Number(item.cantidad || 0),
      unitLabel: item.unidad || 'Cant.',
      baseWeight: Number(item.valor || 0),
      recommendedScore: Number((item.cantidad || 0) * (item.valor || 0)),
      weightedScore: Number(item.puntaje || 0),
      supportSummary: item.docs.map((doc) => doc.name).join('\n'),
      notes: directorNotes || '',
    }));
  };

  const handleDecision = async (status: 'EN_REVISION_DIRECTOR' | 'SUBSANACION' | 'APROBADO') => {
    if (!selectedRequest) return;
    if (!connected || !connection) {
      window.alert('No hay conexión activa con SpacetimeDB.');
      return;
    }

    setLoading(true);
    try {
      await enforceSessionOrLogout(connection);

      const finalCategory = getSuggestedCategoryByPoints(totalDirectorScore);
      const valuationStage = status === 'APROBADO' ? 'DIRECTOR_FINAL_REVIEW' : 'DIRECTOR_REVIEW';
      const criteriaPayload = JSON.stringify(buildCriteriaPayload());

      await runReducer('record_application_audit', {
        trackingId: selectedRequest.trackingId,
        currentStatus: status,
        titleValidated: auditItems.some((item) => /titulo|estudio/i.test(`${item.criterio} ${item.categoria}`) && item.estado === 'Valido'),
        experienceCertified: auditItems.some((item) => /experiencia/i.test(`${item.criterio} ${item.categoria}`) && item.estado === 'Valido'),
        publicationVerified: auditItems.some((item) => /produccion|publicacion|investig/i.test(`${item.criterio} ${item.categoria}`) && item.estado === 'Valido'),
        languageValidated: auditItems.some((item) => /idioma|lengua/i.test(`${item.criterio} ${item.categoria}`) && item.estado === 'Valido'),
        observations: directorNotes || `Revisión directiva ${status.toLowerCase()}.`,
        suggestedScore: selectedRequest.auxiliarScore,
        currentWeightedScore: totalDirectorScore,
        finalWeightedScore: status === 'APROBADO' ? totalDirectorScore : undefined,
        valuationStage,
        finalCategory,
        criteriaPayload,
      });

      await runReducer('update_application_status', {
        trackingId: selectedRequest.trackingId,
        status,
        outputMessage:
          status === 'APROBADO'
            ? 'Decisión final aprobada por Dirección.'
            : status === 'SUBSANACION'
              ? 'Dirección solicita subsanación del expediente.'
              : 'Dirección guardó recalificación en progreso.',
      });

      await loadDataOnce(connection);
      const refreshedAuxiliarSnapshot = getLatestSnapshot(snapshots, selectedRequest.trackingId, 'AUXILIAR');
      const refreshedDirectorSnapshot = getLatestSnapshot(snapshots, selectedRequest.trackingId, 'DIRECTOR');
      const refreshedRequest: DirectorRequest = {
        ...selectedRequest,
        auxiliarScore: Number(refreshedAuxiliarSnapshot?.currentWeightedScore ?? refreshedAuxiliarSnapshot?.suggestedScore ?? selectedRequest.auxiliarScore),
        auxiliarCategory: refreshedAuxiliarSnapshot?.finalCategory || selectedRequest.auxiliarCategory,
        directorScore: refreshedDirectorSnapshot?.finalWeightedScore ?? refreshedDirectorSnapshot?.currentWeightedScore ?? totalDirectorScore,
        directorCategory: refreshedDirectorSnapshot?.finalCategory || getSuggestedCategoryByPoints(totalDirectorScore),
        status,
        finalScore: status === 'APROBADO' ? totalDirectorScore : selectedRequest.finalScore,
        finalCategory: status === 'APROBADO' ? finalCategory : selectedRequest.finalCategory,
        auditObservations: directorNotes || selectedRequest.auditObservations,
      };
      const refreshedEvidence = getRequestEvidence(selectedRequest.trackingId);
      const directorCriteria = [
        ...getStageCriteria(refreshedEvidence.criteria, 'DIRECTOR_REVIEW'),
        ...getStageCriteria(refreshedEvidence.criteria, 'DIRECTOR_FINAL_REVIEW'),
      ];

      setSelectedRequest(refreshedRequest);
      setSelectedEvidence(refreshedEvidence);
      if (directorCriteria.length > 0) {
        setAuditItems(buildItemsFromPersistedCriteria(directorCriteria));
      }
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('no hay una sesión activa para este portal') || message.includes('no tienes permisos')) {
        clearPortalSession();
        window.alert('La sesión del director expiró o no tiene permisos vigentes. Debes iniciar sesión nuevamente.');
        window.location.reload();
        return;
      }
      window.alert(error instanceof Error ? error.message : 'No fue posible guardar la decisión del director.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-8">
        {!selectedRequest && (
          <>
            <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-700 px-6 py-6 text-white md:px-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <AppLogo className="inline-flex items-center rounded-2xl bg-white/10 px-4 py-3 backdrop-blur" imgClassName="h-10 w-auto" />
                    <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
                      Revision final por <span className="text-emerald-300">convocatoria</span>
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm font-semibold text-emerald-50/90">
                      Consolida la puntuación recomendada por auxiliares, revisa el expediente completo y emite la decisión final del proceso.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-100">Convocatorias</p>
                    <div className="mt-3 flex max-w-2xl flex-wrap gap-2">
                      {convocatorias.map((convocatoria) => (
                        <button
                          key={convocatoria.id}
                          onClick={() => setSelectedConvocatoriaId(convocatoria.id)}
                          className={`rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-[0.1em] transition-all ${
                            selectedConvocatoriaId === convocatoria.id
                              ? 'bg-white text-emerald-800 shadow-sm'
                              : 'bg-white/10 text-white hover:bg-white/20'
                          }`}
                        >
                          {convocatoria.codigo}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-4 md:p-6">
                {[
                  { label: 'Postulaciones', value: stats.total, icon: Users, tone: 'bg-emerald-50 text-emerald-700' },
                  { label: 'Pendientes', value: stats.pendientes, icon: ClipboardList, tone: 'bg-amber-50 text-amber-700' },
                  { label: 'Subsanación', value: stats.subsanar, icon: AlertCircle, tone: 'bg-rose-50 text-rose-700' },
                  { label: 'Promedio auxiliar', value: formatScore(stats.promedioAuxiliar), icon: Star, tone: 'bg-blue-50 text-blue-700' },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className={`rounded-xl p-3 ${item.tone}`}>
                        <item.icon size={20} />
                      </div>
                      <div>
                        <p className="text-3xl font-black leading-none text-slate-900">{item.value}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/80 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-emerald-600" />
                  <h3 className="text-lg font-black tracking-tight text-slate-900">
                    Expedientes de{' '}
                    <span className="text-emerald-600">
                      {convocatorias.find((item) => item.id === selectedConvocatoriaId)?.nombre || 'todas las convocatorias'}
                    </span>
                  </h3>
                </div>

                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar por docente, documento o tracking"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold outline-none transition-colors focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] border-collapse">
                  <thead className="bg-slate-900 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                    <tr>
                      <th className="px-6 py-4 text-left">Expediente</th>
                      <th className="px-6 py-4 text-left">Convocatoria</th>
                      <th className="px-6 py-4 text-left">Estado</th>
                      <th className="px-6 py-4 text-center">Auxiliar</th>
                      <th className="px-6 py-4 text-center">Director</th>
                      <th className="px-6 py-4 text-center">Final</th>
                      <th className="px-6 py-4 text-center">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                    {filteredRequests.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-10 text-center text-slate-400">
                          No hay expedientes relacionados con la convocatoria y filtro actual.
                        </td>
                      </tr>
                    )}
                    {filteredRequests.map((request) => (
                      <tr key={request.trackingId} className="group transition-colors hover:bg-emerald-50/40">
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 group-hover:text-emerald-700">{request.nombre}</span>
                            <span className="text-xs text-slate-500">{request.documento} · {request.programa}</span>
                            <span className="text-[11px] text-slate-400">{request.trackingId}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{request.convocatoriaCodigo}</span>
                            <span className="text-xs text-slate-500">{request.convocatoriaNombre}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${getStatusBadgeClass(request.status)}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {request.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <p className="font-black text-slate-900">{formatScore(request.auxiliarScore)}</p>
                          <p className="text-[11px] text-slate-400">{request.auxiliarCategory || 'SIN CATEGORIA'}</p>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <p className="font-black text-slate-900">{formatScore(request.directorScore)}</p>
                          <p className="text-[11px] text-slate-400">{request.directorCategory || 'Sin decisión'}</p>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <p className="font-black text-slate-900">{formatScore(request.finalScore)}</p>
                          <p className="text-[11px] text-slate-400">{request.finalCategory || 'Sin cierre'}</p>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <button
                            onClick={() => {
                              void openDetail(request);
                            }}
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-emerald-700"
                          >
                            Ver expediente
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

        {selectedRequest && (
          <section className="space-y-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 md:flex-row md:items-start md:justify-between">
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
                >
                  <ArrowLeft size={14} /> Volver al listado
                </button>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">Expediente directivo</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{selectedRequest.nombre}</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    {selectedRequest.documento} · {selectedRequest.programa} · {selectedRequest.facultad}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {selectedRequest.convocatoriaCodigo} · {selectedRequest.convocatoriaNombre}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Recomendación auxiliar', value: formatScore(selectedRequest.auxiliarScore), meta: selectedRequest.auxiliarCategory || 'SIN CATEGORIA', icon: Star, tone: 'bg-blue-50 text-blue-700' },
                  { label: 'Recalificación director', value: formatScore(totalDirectorScore), meta: getSuggestedCategoryByPoints(totalDirectorScore), icon: Award, tone: 'bg-emerald-50 text-emerald-700' },
                  { label: 'Estado actual', value: selectedRequest.status.replace(/_/g, ' '), meta: selectedRequest.finalCategory || 'SIN CIERRE', icon: Layers, tone: 'bg-slate-100 text-slate-700' },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-200 p-4">
                    <div className={`inline-flex rounded-xl p-3 ${item.tone}`}>
                      <item.icon size={18} />
                    </div>
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                    <p className="mt-1 text-2xl font-black text-slate-950">{item.value}</p>
                    <p className="text-xs font-semibold text-slate-500">{item.meta}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.3fr,0.7fr]">
              <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex items-center gap-3">
                    <ClipboardList size={18} className="text-emerald-600" />
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-slate-950">Matriz de evaluación directiva</h3>
                      <p className="text-sm font-semibold text-slate-500">Revisa la puntuación sugerida del auxiliar y ajusta criterio por criterio.</p>
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[980px] border-collapse">
                      <thead className="bg-slate-900 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                        <tr>
                          <th className="px-4 py-4 text-left">Criterio</th>
                          <th className="px-4 py-4 text-left">Soportes</th>
                          <th className="px-4 py-4 text-center">Cant.</th>
                          <th className="px-4 py-4 text-center">Valor</th>
                          <th className="px-4 py-4 text-center">Puntaje</th>
                          <th className="px-4 py-4 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                        {auditItems.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-4 align-top">
                              <p className="font-black text-slate-900">{item.criterio}</p>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{item.categoria}</p>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="space-y-2">
                                {item.docs.length === 0 && <p className="text-xs text-slate-400">Sin soporte registrado.</p>}
                                {item.docs.map((doc, index) => (
                                  <div key={`${item.id}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                    <p className="text-xs font-bold text-slate-700">{doc.name}</p>
                                    {doc.meta && <p className="text-[11px] text-slate-500">{doc.meta}</p>}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">{item.cantidad.toFixed(2)}</td>
                            <td className="px-4 py-4 text-center">{item.valor.toFixed(1)}</td>
                            <td className="px-4 py-4 text-center">
                              <input
                                value={item.puntaje}
                                onChange={(event) => handleScoreChange(item.id, event.target.value)}
                                className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm font-black text-slate-900 outline-none focus:border-emerald-500"
                              />
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap justify-center gap-2">
                                {(['Valido', 'Ausente', 'Rechazado'] as DirectorCriterionStatus[]).map((estado) => (
                                  <button
                                    key={estado}
                                    onClick={() => handleStatusChange(item.id, estado)}
                                    className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] transition ${
                                      item.estado === estado
                                        ? estado === 'Valido'
                                          ? 'bg-emerald-600 text-white'
                                          : estado === 'Ausente'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-rose-600 text-white'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    {estado}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-3">
                      <GraduationCap size={18} className="text-emerald-600" />
                      <h3 className="text-base font-black tracking-tight text-slate-950">Titulos e idiomas</h3>
                    </div>
                    <div className="mt-4 space-y-3">
                      {selectedEvidence.titles.map((title) => (
                        <div key={`title-${title.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="font-bold text-slate-900">{title.titleName}</p>
                          <p className="text-xs text-slate-500">{title.titleLevel} · {title.supportName || 'Sin soporte cargado'}</p>
                        </div>
                      ))}
                      {selectedEvidence.languages.map((language) => (
                        <div key={`language-${language.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="font-bold text-slate-900">{language.languageName}</p>
                          <p className="text-xs text-slate-500">Nivel {language.languageLevel} {language.convalidation ? '· Convalidado' : ''}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-3">
                      <BookOpen size={18} className="text-emerald-600" />
                      <h3 className="text-base font-black tracking-tight text-slate-950">Producción y experiencia</h3>
                    </div>
                    <div className="mt-4 space-y-3">
                      {selectedEvidence.publications.map((publication) => (
                        <div key={`publication-${publication.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="font-bold text-slate-900">{publication.publicationTitle}</p>
                          <p className="text-xs text-slate-500">
                            {publication.publicationType} · {publication.quartile} · {publication.publicationYear} · {publication.sourceKind}
                          </p>
                        </div>
                      ))}
                      {selectedEvidence.experiences.map((experience) => (
                        <div key={`experience-${experience.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="font-bold text-slate-900">{experience.experienceType}</p>
                          <p className="text-xs text-slate-500">
                            {formatDate(experience.startedAt)} a {formatDate(experience.endedAt)} · {experience.supportName || 'Sin soporte cargado'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-3">
                    <Star size={18} className="text-blue-600" />
                    <div>
                      <h3 className="text-base font-black tracking-tight text-slate-950">Resumen auxiliar</h3>
                      <p className="text-sm font-semibold text-slate-500">Recomendación ya emitida para contraste directivo.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">Puntaje recomendado</p>
                      <p className="mt-1 text-3xl font-black text-slate-950">{formatScore(selectedRequest.auxiliarScore)}</p>
                      <p className="text-xs font-semibold text-slate-500">{selectedRequest.auxiliarCategory || 'SIN CATEGORIA'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Observaciones registradas</p>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                        {selectedRequest.auditObservations || 'Sin observaciones capturadas por auxiliar.'}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-emerald-600" />
                    <div>
                      <h3 className="text-base font-black tracking-tight text-slate-950">Concepto del director</h3>
                      <p className="text-sm font-semibold text-slate-500">Argumenta la recalificación o decisión final.</p>
                    </div>
                  </div>
                  <textarea
                    value={directorNotes}
                    onChange={(event) => setDirectorNotes(event.target.value)}
                    rows={8}
                    className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500"
                    placeholder="Registra el resumen ejecutivo, hallazgos y justificación de la decisión final."
                  />
                </section>

                <section className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white">
                  <div className="flex items-center gap-3">
                    <Building2 size={18} className="text-emerald-300" />
                    <div>
                      <h3 className="text-base font-black tracking-tight">Decisión final</h3>
                      <p className="text-sm font-semibold text-slate-300">Persistencia del concepto directivo y cierre del expediente.</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">Total director</p>
                    <p className="mt-1 text-3xl font-black">{formatScore(totalDirectorScore)}</p>
                    <p className="text-xs font-semibold text-slate-300">Categoría sugerida: {getSuggestedCategoryByPoints(totalDirectorScore)}</p>
                  </div>
                  <div className="mt-5 grid gap-3">
                    <button
                      onClick={() => {
                        void handleDecision('EN_REVISION_DIRECTOR');
                      }}
                      className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-white/20"
                    >
                      Guardar recalificación
                    </button>
                    <button
                      onClick={() => {
                        void handleDecision('SUBSANACION');
                      }}
                      className="rounded-2xl bg-rose-600 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-rose-700"
                    >
                      Solicitar subsanación
                    </button>
                    <button
                      onClick={() => {
                        void handleDecision('APROBADO');
                      }}
                      className="rounded-2xl bg-emerald-500 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-950 transition hover:bg-emerald-400"
                    >
                      Aprobar decisión final
                    </button>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-3">
                    <Layers size={18} className="text-slate-700" />
                    <h3 className="text-base font-black tracking-tight text-slate-950">Ficha del expediente</h3>
                  </div>
                  <div className="mt-4 space-y-3 text-sm font-semibold text-slate-600">
                    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <Users size={16} className="mt-0.5 text-emerald-600" />
                      <div>
                        <p className="font-black text-slate-900">{selectedRequest.nombre}</p>
                        <p>{selectedRequest.documento}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <Building2 size={16} className="mt-0.5 text-emerald-600" />
                      <div>
                        <p className="font-black text-slate-900">{selectedRequest.facultad}</p>
                        <p>{selectedRequest.programa}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <MapPin size={16} className="mt-0.5 text-emerald-600" />
                      <div>
                        <p className="font-black text-slate-900">Campus</p>
                        <p>{selectedRequest.campus}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <CheckCircle size={16} className="mt-0.5 text-emerald-600" />
                      <div>
                        <p className="font-black text-slate-900">Estado</p>
                        <p>{selectedRequest.status.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <XCircle size={16} className="mt-0.5 text-emerald-600" />
                      <div>
                        <p className="font-black text-slate-900">Mensaje actual</p>
                        <p>{selectedRequest.outputMessage || 'Sin novedad registrada.'}</p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </section>
        )}
      </div>

      {loading && <LoadingOverlay />}
    </>
  );
};

export default DirectorPage;
