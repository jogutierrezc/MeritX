import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle,
  Clock,
  ClipboardList,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Hash,
  Info,
  Layers,
  Search,
  ShieldCheck,
  Star,
  RotateCcw,
  User,
  Users,
  XCircle,
  Building2,
  MoreVertical,
  Filter,
  Inbox,
  MapPin,
} from 'lucide-react';

import { DbConnection } from '../../module_bindings';
import type {
  Application,
  ApplicationAnalysisVersion,
  ApplicationAuditCriterion,
  ApplicationExperience,
  ApplicationLanguage,
  ApplicationPublication,
  ApplicationTitle,
} from '../../module_bindings/types';
import { getSpacetimeConnectionConfig } from '../../services/spacetime';
import { clearPortalSession, getPortalCredentialsForRole, getPortalSession } from '../../services/portalAuth';
import { calculateAdvancedEscalafon, ESCALAFON_CONFIG, getSuggestedCategoryByPoints } from '../../utils/calculateEscalafon';
import LoadingOverlay from '../../components/LoadingOverlay';

const CAMPUS = ['VALLEDUPAR', 'BUCARAMANGA', 'CUCUTA', 'BOGOTA'] as const;

type Campus = (typeof CAMPUS)[number];

type AuditChecklist = {
  observaciones: string;
};

type AuditDocument = {
  name: string;
  meta?: string;
  style?: 'standard' | 'experience' | 'research';
};

type AuditCriterionItem = {
  id: string;
  cat: string;
  criterio: string;
  docs: AuditDocument[];
  cant: number;
  unitLabel: string;
  valor: number;
  puntaje: number;
  estado: 'Pendiente' | 'Valido' | 'Ausente' | 'Rechazado';
};

type RequestEvidence = {
  titles: ApplicationTitle[];
  languages: ApplicationLanguage[];
  publications: ApplicationPublication[];
  experiences: ApplicationExperience[];
  criteria: ApplicationAuditCriterion[];
  versions: ApplicationAnalysisVersion[];
};

type AnalysisVersionRowView = {
  section: string;
  criterion: string;
  detail: string;
  quantity: number;
  value: number;
  baseScore: number;
  suggestedScore: number;
  hasSupport: boolean;
  supportNote: string;
  comment: string;
};

type AuxiliarRequest = {
  id: string;
  nombre?: string;
  documento?: string;
  trackingId?: string;
  campus?: string;
  facultad?: string;
  status?: string;
  outputMessage?: string;
  finalPts?: number;
  finalCat?: { name?: string; bgColor?: string };
  programa?: string;
};

const defaultChecklist: AuditChecklist = {
  observaciones: '',
};

const emptyEvidence: RequestEvidence = {
  titles: [],
  languages: [],
  publications: [],
  experiences: [],
  criteria: [],
  versions: [],
};

interface BandejaAuditarModuleProps {
  onClose?: () => void;
}

const BandejaAuditarModule: React.FC<BandejaAuditarModuleProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connection, setConnection] = useState<DbConnection | null>(null);
  const [view, setView] = useState<'lista' | 'auditoria'>('lista');
  const [activeCampus, setActiveCampus] = useState<Campus>('VALLEDUPAR');
  const [requests, setRequests] = useState<AuxiliarRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<AuxiliarRequest | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<RequestEvidence>(emptyEvidence);
  const [auditItems, setAuditItems] = useState<AuditCriterionItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [auditChecklist, setAuditChecklist] = useState<AuditChecklist>(defaultChecklist);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const parseVersionRowsPayload = (payload: string): AnalysisVersionRowView[] => {
    if (!payload?.trim()) return [];
    try {
      const parsed = JSON.parse(payload);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item, index) => ({
        section: String(item?.section || 'Otros'),
        criterion: String(item?.criterion || item?.criterio || `CRITERIO_${index + 1}`),
        detail: String(item?.detail || item?.detalle || '-'),
        quantity: Number(item?.quantity ?? item?.cantidad ?? 0) || 0,
        value: Number(item?.value ?? item?.valor ?? 0) || 0,
        baseScore: Number(item?.baseScore ?? item?.puntajeBase ?? item?.puntaje ?? 0) || 0,
        suggestedScore: Number(item?.suggestedScore ?? item?.puntajeSugerido ?? item?.puntaje ?? 0) || 0,
        hasSupport: Boolean(item?.hasSupport ?? item?.soportado),
        supportNote: String(item?.supportNote || item?.support_note || ''),
        comment: String(item?.comment || item?.comentario || ''),
      }));
    } catch {
      return [];
    }
  };

  const parseSupportSummary = (summary?: string): AuditDocument[] => {
    if (!summary) return [];
    return summary
      .split(/\n|;|\|/g)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((name) => ({ name, style: 'standard' as const }));
  };

  const mapCriterionStatus = (status?: string): AuditCriterionItem['estado'] => {
    const normalized = (status || '').toUpperCase();
    if (normalized.includes('VALID')) return 'Valido';
    if (normalized.includes('RECHAZ')) return 'Rechazado';
    if (normalized.includes('AUSENTE') || normalized.includes('PENDIENTE')) return 'Ausente';
    return 'Pendiente';
  };

  const normalizeText = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

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

  const getCriteriaForStage = (evidence: RequestEvidence, stage: string) =>
    evidence.criteria.filter((criterion) => (criterion.valuationStage || '').toUpperCase() === stage.toUpperCase());

  const resolvePersistedStatus = (evidence: RequestEvidence, needle: string): AuditCriterionItem['estado'] => {
    const normalizedNeedle = normalizeText(needle);
    const stageCriteria = getCriteriaForStage(evidence, 'AUXILIAR_REVIEW');
    const existing = stageCriteria.find((criterion) => {
      const source = normalizeText(`${criterion.criterionLabel} ${criterion.criterionKey} ${criterion.valuationStage}`);
      return source.includes(normalizedNeedle);
    });
    return mapCriterionStatus(existing?.criterionStatus);
  };

  const buildAuditItemsFromEvidence = (evidence: RequestEvidence, request: AuxiliarRequest): AuditCriterionItem[] => {
    const formData = {
      nombre: request.nombre || '',
      documento: request.documento || '',
      programa: request.programa || '',
      facultad: request.facultad || '',
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
        convalidacion: language.convalidation ? ('SI' as const) : ('NO' as const),
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
        certificacion: experience.certified ? ('SI' as const) : ('NO' as const),
        supportName: experience.supportName || undefined,
        supportPath: experience.supportPath || undefined,
      })),
      orcid: '',
    };

    const scored = calculateAdvancedEscalafon(formData);
    const rows: AuditCriterionItem[] = [];

    evidence.titles.forEach((title, index) => {
      const level = normalizeTitleLevel(title.titleLevel);
      const value = ESCALAFON_CONFIG.PUNTOS_TITULOS[level] || 0;
      rows.push({
        id: `title-${title.id || index}`,
        cat: 'ESTUDIOS CURSADOS',
        criterio: `TITULO ${level.toUpperCase()}`,
        docs: [{ name: title.supportName || title.titleName, meta: title.titleName, style: 'standard' }],
        cant: 1,
        unitLabel: 'Cant.',
        valor: value,
        puntaje: value,
        estado: resolvePersistedStatus(evidence, 'titulo'),
      });
    });

    evidence.languages.forEach((language, index) => {
      const level = normalizeLanguageLevel(language.languageLevel);
      const value = ESCALAFON_CONFIG.PUNTOS_IDIOMA[level] || 0;
      rows.push({
        id: `language-${language.id || index}`,
        cat: 'IDIOMA EXTRANJERO',
        criterio: `COMPETENCIA ${level}`,
        docs: [{ name: language.languageName, meta: `Nivel ${level}${language.convalidation ? ' · Convalidado' : ''}`, style: 'standard' }],
        cant: 1,
        unitLabel: 'Cant.',
        valor: value,
        puntaje: value,
        estado: resolvePersistedStatus(evidence, 'idioma'),
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
        cat: 'PRODUCCION INTELECTUAL',
        criterio: publication.publicationType ? publication.publicationType.toUpperCase() : `ARTICULO ${publication.quartile}`,
        docs: [{ name: publication.publicationTitle, meta: `${publication.quartile} · ${publication.publicationYear} · ${publication.sourceKind}`, style: 'research' }],
        cant: 1,
        unitLabel: 'Cant.',
        valor: base,
        puntaje: base * factor,
        estado: resolvePersistedStatus(evidence, 'produccion'),
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
        cat: 'EXPERIENCIA CALIFICADA',
        criterio: item.experience.experienceType.toUpperCase(),
        docs: [{
          name: item.experience.supportName || item.experience.experienceType,
          meta: `${item.experience.startedAt} a ${item.experience.endedAt || 'Presente'} · ${item.years.toFixed(1)} anios`,
          style: 'experience',
        }],
        cant: Number(item.years.toFixed(2)),
        unitLabel: 'Anios',
        valor: item.valuePerYear,
        puntaje: Number((item.rawScore * factor).toFixed(2)),
        estado: resolvePersistedStatus(evidence, 'experiencia'),
      });
    });

    if (rows.length > 0) return rows;

    return getCriteriaForStage(evidence, 'AUXILIAR_REVIEW')
      .slice()
      .sort((a, b) => a.criterionLabel.localeCompare(b.criterionLabel))
      .map((criterion) => ({
        id: criterion.criterionId,
        cat: (criterion.valuationStage || criterion.criterionKey || 'CRITERIO').toUpperCase().replace(/_/g, ' '),
        criterio: criterion.criterionLabel,
        docs: parseSupportSummary(criterion.supportSummary),
        cant: Number(criterion.quantity || 0),
        unitLabel: criterion.unitLabel || 'Cant.',
        valor: Number(criterion.baseWeight || 0),
        puntaje: Number(criterion.weightedScore || 0),
        estado: mapCriterionStatus(criterion.criterionStatus),
      }));
  };

  const getRequestEvidence = (conn: DbConnection, trackingId: string): RequestEvidence => {
    const dbView = conn.db as any;

    const titleTable = dbView.applicationTitle || dbView.application_title;
    const languageTable = dbView.applicationLanguage || dbView.application_language;
    const publicationTable = dbView.applicationPublication || dbView.application_publication;
    const experienceTable = dbView.applicationExperience || dbView.application_experience;
    const criterionTable = dbView.applicationAuditCriterion || dbView.application_audit_criterion;
    const versionTable = dbView.applicationAnalysisVersion || dbView.application_analysis_version;

    const titles = titleTable ? (Array.from(titleTable.iter()) as ApplicationTitle[]).filter((row) => row.trackingId === trackingId) : [];
    const languages = languageTable ? (Array.from(languageTable.iter()) as ApplicationLanguage[]).filter((row) => row.trackingId === trackingId) : [];
    const publications = publicationTable
      ? (Array.from(publicationTable.iter()) as ApplicationPublication[]).filter((row) => row.trackingId === trackingId)
      : [];
    const experiences = experienceTable
      ? (Array.from(experienceTable.iter()) as ApplicationExperience[]).filter((row) => row.trackingId === trackingId)
      : [];
    const criteria = criterionTable
      ? (Array.from(criterionTable.iter()) as ApplicationAuditCriterion[]).filter((row) => row.trackingId === trackingId)
      : [];
    const versions = versionTable
      ? (Array.from(versionTable.iter()) as ApplicationAnalysisVersion[]).filter((row) => row.trackingId === trackingId)
      : [];

    return { titles, languages, publications, experiences, criteria, versions };
  };

  const deriveChecklistFlags = (items: AuditCriterionItem[]) => {
    const hasValid = (match: (item: AuditCriterionItem) => boolean) =>
      items.some((item) => match(item) && item.estado === 'Valido');

    return {
      titleValidated: hasValid((item) => /titulo|estudio/i.test(`${item.criterio} ${item.cat}`)),
      experienceCertified: hasValid((item) => /experiencia/i.test(`${item.criterio} ${item.cat}`)),
      publicationVerified: hasValid((item) => /produccion|publicacion|investig/i.test(`${item.criterio} ${item.cat}`)),
      languageValidated: hasValid((item) => /idioma|lengua/i.test(`${item.criterio} ${item.cat}`)),
    };
  };

  const mapAuditStatusToCriterionStatus = (status: AuditCriterionItem['estado']) => {
    if (status === 'Valido') return 'VALIDADO';
    if (status === 'Rechazado') return 'RECHAZADO';
    if (status === 'Ausente') return 'AUSENTE';
    return 'PENDIENTE';
  };

  const buildCriteriaPayload = (trackingId: string, items: AuditCriterionItem[]) => {
    return items.map((item, index) => ({
      criterionKey: `${item.cat}-${item.criterio}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || `criterion_${index + 1}`,
      criterionLabel: item.criterio,
      criterionStatus: mapAuditStatusToCriterionStatus(item.estado),
      quantity: Number(item.cant || 0),
      unitLabel: item.unitLabel || 'Cant.',
      baseWeight: Number(item.valor || 0),
      recommendedScore: Number((item.cant || 0) * (item.valor || 0)),
      weightedScore: Number(item.puntaje || 0),
      supportSummary: item.docs.map((doc) => doc.name).join('\n'),
      notes: `Registro de auditoria para ${trackingId}`,
    }));
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

  const readRequestsFromCache = (conn: DbConnection) => {
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
        facultad: row.facultyName,
      })),
    );
  };

  const loadRequestsOnce = async (conn: DbConnection) => {
    await new Promise<void>((resolve, reject) => {
      const subscription = conn
        .subscriptionBuilder()
        .onApplied(() => {
          readRequestsFromCache(conn);
          subscription.unsubscribe();
          resolve();
        })
        .onError((ctx: unknown) => {
          subscription.unsubscribe();
          reject(ctx);
        })
        .subscribe([
          'SELECT * FROM application',
          'SELECT * FROM application_title',
          'SELECT * FROM application_language',
          'SELECT * FROM application_publication',
          'SELECT * FROM application_experience',
          'SELECT * FROM application_audit_criterion',
          'SELECT * FROM application_analysis_version',
        ]);
    });
  };

  useEffect(() => {
    const { host, databaseName } = getSpacetimeConnectionConfig();

    const conn = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(databaseName)
      .onConnect((liveConn: DbConnection) => {
        setConnected(true);
        enforceSessionOrLogout(liveConn).catch((error) => {
          console.warn('BandejaAuditarModule portal session warning:', error);
        });
      })
      .onConnectError((_ctx: unknown, error: unknown) => {
        console.error(error);
        setConnected(false);
      })
      .build();

    setConnection(conn);
    void loadRequestsOnce(conn).catch((error) => console.error(error));

    return () => {
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
    if (view !== 'auditoria') {
      setAuditChecklist(defaultChecklist);
      setSelectedEvidence(emptyEvidence);
      setAuditItems([]);
      setSelectedVersionId(null);
    }
  }, [view]);

  const totalAudit = useMemo(
    () => auditItems.reduce((acc, curr) => acc + (Number(curr.puntaje) || 0), 0),
    [auditItems],
  );

  const handleStatusChange = (id: string, newStatus: AuditCriterionItem['estado']) => {
    setAuditItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const suggestedScore = newStatus === 'Valido' ? item.cant * item.valor : 0;
        return { ...item, estado: newStatus, puntaje: suggestedScore };
      }),
    );
  };

  const handleManualScore = (id: string, value: string) => {
    const parsed = Number(value);
    setAuditItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, puntaje: Number.isFinite(parsed) ? parsed : 0 } : item)),
    );
  };

  const openAuditView = async (request: AuxiliarRequest) => {
    setLoading(true);
    try {
      if (connection) {
        await loadRequestsOnce(connection);
        const evidence = getRequestEvidence(connection, request.id);
        setSelectedEvidence(evidence);
        setAuditItems(buildAuditItemsFromEvidence(evidence, request));
        const latestVersion = evidence.versions
          .slice()
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
        setSelectedVersionId(latestVersion?.versionId || null);
      }
      setSelectedRequest(request);
      setView('auditoria');
    } catch (error) {
      console.error(error);
      window.alert('No fue posible cargar los documentos del postulante para auditoria.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string, message: string) => {
    if (!connected) {
      window.alert('No hay conexión activa con SpacetimeDB.');
      return;
    }

    setLoading(true);
    try {
      if (!connection) throw new Error('Sin conexión a SpacetimeDB.');
      await enforceSessionOrLogout(connection);

      const criteriaPayload = JSON.stringify(buildCriteriaPayload(id, auditItems));
      const finalCategory = getSuggestedCategoryByPoints(totalAudit);

      await runReducer('record_application_audit', {
        trackingId: id,
        currentStatus: newStatus,
        ...deriveChecklistFlags(auditItems),
        observations: auditChecklist.observaciones || '',
        suggestedScore: totalAudit,
        currentWeightedScore: totalAudit,
        finalWeightedScore: newStatus === 'APTO' ? totalAudit : undefined,
        valuationStage: 'AUXILIAR_REVIEW',
        finalCategory,
        criteriaPayload,
      });

      await runReducer('update_application_status', {
        trackingId: id,
        status: newStatus,
        outputMessage: message || `Estado actualizado a ${newStatus} por Auditoría.`,
      });

      if (connection) {
        await loadRequestsOnce(connection);
      }

      setSelectedRequest(null);
      setView('lista');
    } catch (error) {
      console.error(error);
      const messageText = error instanceof Error ? error.message.toLowerCase() : '';
      if (messageText.includes('no hay una sesión activa para este portal')) {
        clearPortalSession();
        window.alert('Tu sesión expiró y fue cerrada por seguridad. Debes iniciar sesión nuevamente.');
        window.location.reload();
        return;
      }
      window.alert(error instanceof Error ? error.message : 'No fue posible actualizar el estado del expediente.');
    } finally {
      setLoading(false);
    }
  };

  const sortedVersions = useMemo(
    () => selectedEvidence.versions.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    [selectedEvidence.versions],
  );

  const selectedVersion = useMemo(
    () => sortedVersions.find((row) => row.versionId === selectedVersionId) || null,
    [sortedVersions, selectedVersionId],
  );

  const selectedVersionRows = useMemo(
    () => (selectedVersion ? parseVersionRowsPayload(selectedVersion.rowsPayload) : []),
    [selectedVersion],
  );

  const approveHistoricalVersion = async (versionId: string) => {
    if (!selectedRequest) return;

    setLoading(true);
    try {
      if (!connection) throw new Error('Sin conexión a SpacetimeDB.');
      await enforceSessionOrLogout(connection);

      await runReducer('approve_application_analysis_version', {
        versionId,
        outputMessage: 'Versión histórica aprobada como oficial desde Portal CAP.',
      });

      await loadRequestsOnce(connection);
      const refreshedEvidence = getRequestEvidence(connection, selectedRequest.id);
      setSelectedEvidence(refreshedEvidence);
      setSelectedVersionId(versionId);
      window.alert('Versión aprobada como oficial correctamente.');
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : 'No fue posible aprobar la versión.');
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
                      Bandeja de <span className="text-blue-300">Entrada</span>
                    </h2>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                      Auditoría y validación de expedientes
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

              <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-4 md:p-6">
                {[
                  { label: 'Total Postulados', value: stats.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Bandeja Pendiente', value: stats.pendientes, icon: Inbox, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Por Subsanar', value: stats.subsanar, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                  { label: 'Auditados Aptos', value: `${stats.percent}%`, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
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
                                void openAuditView(request);
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
          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setView('lista')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                <ArrowLeft size={14} /> Volver
              </button>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4 border-l-4 border-blue-600 pl-6">
                <h2 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900">
                  Auditoria de <span className="text-blue-600">expediente</span>
                </h2>
              </div>

              <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-10 shadow-sm">
                <div className="pointer-events-none absolute right-0 top-0 p-10 opacity-[0.03]">
                  <ClipboardList className="h-64 w-64" />
                </div>

                <div className="relative z-10 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-blue-50 p-3 text-blue-600"><User className="h-5 w-5" /></div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre del profesor</label>
                      <p className="text-sm font-bold leading-tight text-slate-800">{selectedRequest.nombre || 'SIN NOMBRE'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-slate-50 p-3 text-slate-600"><Hash className="h-5 w-5" /></div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Documento / Radicado</label>
                      <p className="text-sm font-bold leading-tight text-slate-800">
                        {selectedRequest.documento || 'SIN DOCUMENTO'}
                        <span className="ml-2 font-mono text-blue-600">[{selectedRequest.trackingId || selectedRequest.id}]</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600"><GraduationCap className="h-5 w-5" /></div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Programa academico</label>
                      <p className="text-sm font-bold leading-tight text-slate-800">{selectedRequest.programa || 'NO REGISTRADO'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-amber-50 p-3 text-amber-600"><Building2 className="h-5 w-5" /></div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Facultad</label>
                      <p className="text-sm font-bold leading-tight text-slate-800">{selectedRequest.facultad || 'NO REGISTRADA'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-rose-50 p-3 text-rose-600"><MapPin className="h-5 w-5" /></div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Campus</label>
                      <p className="text-sm font-bold leading-tight text-slate-800">{selectedRequest.campus || 'VALLEDUPAR'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center px-4 lg:justify-end">
                    <div className="rounded-[1.8rem] bg-[#003366] px-10 py-4 text-center text-white shadow-2xl shadow-blue-900/20">
                      <p className="text-4xl font-black leading-none">{totalAudit.toFixed(1)}</p>
                      <p className="mt-2 text-[9px] font-black uppercase tracking-[0.2em] opacity-60">Puntaje total auditado</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#1e293b] text-[10px] font-bold uppercase tracking-[0.15em] text-white">
                    <th className="w-1/4 px-8 py-6">1. Criterios de evaluacion</th>
                    <th className="w-1/4 px-8 py-6">2. Documentos presentados</th>
                    <th className="px-4 py-6 text-center">3. Cant.</th>
                    <th className="px-4 py-6 text-center">4. Valor criterio</th>
                    <th className="w-36 px-6 py-6 text-center">5. Puntaje sugerido</th>
                    <th className="px-8 py-6 text-center">Acciones de validacion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm font-semibold text-slate-400">
                        Este postulante no tiene criterios ni documentos cargados para auditar.
                      </td>
                    </tr>
                  )}
                  {auditItems.map((item) => (
                    <tr key={item.id} className={`group transition-all ${item.estado === 'Valido' ? 'bg-emerald-50/20' : item.estado === 'Rechazado' ? 'bg-rose-50/20' : 'hover:bg-slate-50'}`}>
                      <td className="px-8 py-8 align-top">
                        <div className="flex items-start gap-3">
                          <div className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.estado === 'Valido' ? 'bg-emerald-500 shadow-lg shadow-emerald-400/50' : 'bg-slate-200'}`} />
                          <div>
                            <span className="block text-sm font-black uppercase tracking-tight text-slate-800">{item.criterio}</span>
                            <span className="mt-1 block text-[10px] font-bold uppercase text-slate-400">{item.cat}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-8 py-8 align-top">
                        <div className="space-y-2">
                          {item.docs.length === 0 && <p className="text-xs font-semibold text-slate-400">Sin soporte registrado.</p>}
                          {item.docs.map((doc, idx) => {
                            if (doc.style === 'experience') {
                              return (
                                <div key={`${item.id}-doc-${idx}`} className="group/doc flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                                  <div className="flex items-center gap-3">
                                    <Clock className="h-4 w-4 text-blue-500" />
                                    <div>
                                      <p className="max-w-[220px] truncate text-[11px] font-bold text-slate-700">{doc.name}</p>
                                      <p className="text-[9px] font-black italic text-blue-600">{doc.meta || 'Soporte de experiencia'}</p>
                                    </div>
                                  </div>
                                  <button className="rounded-lg bg-white p-1.5 opacity-0 shadow-sm transition-opacity group-hover/doc:opacity-100">
                                    <Download className="h-3 w-3 text-slate-400" />
                                  </button>
                                </div>
                              );
                            }

                            if (doc.style === 'research') {
                              return (
                                <div key={`${item.id}-doc-${idx}`} className="flex flex-col gap-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
                                  <div className="flex items-center gap-2">
                                    <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                                    <span className="truncate text-[11px] font-bold text-slate-700">{doc.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 text-[8px] font-black text-white">
                                      <Star className="h-2 w-2 fill-amber-400 text-amber-400" />
                                      {doc.meta || 'Indice de impacto'}
                                    </span>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={`${item.id}-doc-${idx}`} className="flex items-center justify-between rounded-xl border border-transparent p-2 transition-all hover:border-slate-100 hover:bg-white">
                                <div className="flex items-center gap-3">
                                  <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><FileText className="h-4 w-4" /></div>
                                  <div>
                                    <span className="block max-w-[220px] truncate text-xs font-bold text-slate-600">{doc.name}</span>
                                    {doc.meta && <span className="text-[9px] font-semibold text-slate-400">{doc.meta}</span>}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button className="text-slate-300 transition-colors hover:text-blue-600"><Eye className="h-4 w-4" /></button>
                                  <button className="text-slate-300 transition-colors hover:text-slate-800"><Download className="h-4 w-4" /></button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      <td className="px-4 py-8 text-center align-top">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-black leading-none text-slate-800">{item.cant}</span>
                          <span className="mt-1 text-[9px] font-bold uppercase tracking-tighter text-slate-400">{item.unitLabel || 'Cant.'}</span>
                        </div>
                      </td>

                      <td className="px-4 py-8 text-center align-top">
                        <div className="flex flex-col items-center">
                          <span className="font-mono text-xs font-bold text-slate-400">{item.valor > 0 ? item.valor : '--'}</span>
                        </div>
                      </td>

                      <td className="px-6 py-8 text-center align-top">
                        <div className="group/input relative">
                          <input
                            type="number"
                            value={item.puntaje}
                            onChange={(e) => handleManualScore(item.id, e.target.value)}
                            className={`w-full rounded-2xl border-2 bg-white py-2.5 text-center text-sm font-black outline-none transition-all ${
                              item.estado === 'Valido'
                                ? 'border-emerald-100 text-emerald-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5'
                                : 'border-slate-100 text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5'
                            }`}
                          />
                          <div className="absolute -right-2 -top-2 rounded-lg bg-slate-900 p-1 text-white opacity-0 transition-opacity group-hover/input:opacity-100">
                            <Layers className="h-2.5 w-2.5" />
                          </div>
                        </div>
                      </td>

                      <td className="px-8 py-8 align-top">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleStatusChange(item.id, 'Valido')}
                            className={`group relative rounded-2xl p-3 transition-all ${item.estado === 'Valido' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/20' : 'bg-slate-50 text-slate-300 hover:bg-emerald-50 hover:text-emerald-600'}`}
                            title="Valido"
                          >
                            <ShieldCheck className="h-6 w-6" />
                          </button>

                          <button
                            onClick={() => handleStatusChange(item.id, 'Ausente')}
                            className={`group relative rounded-2xl p-3 transition-all ${item.estado === 'Ausente' ? 'bg-amber-500 text-white shadow-xl shadow-amber-500/20' : 'bg-slate-50 text-slate-300 hover:bg-amber-50 hover:text-amber-600'}`}
                            title="Ausente"
                          >
                            <RotateCcw className="h-6 w-6" />
                          </button>

                          <button
                            onClick={() => handleStatusChange(item.id, 'Rechazado')}
                            className={`group relative rounded-2xl p-3 transition-all ${item.estado === 'Rechazado' ? 'bg-rose-600 text-white shadow-xl shadow-rose-500/20' : 'bg-slate-50 text-slate-300 hover:bg-rose-50 hover:text-rose-600'}`}
                            title="Rechazado"
                          >
                            <XCircle className="h-6 w-6" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-slate-100 bg-slate-50 p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Fin del expediente tecnico digital</p>
              </div>
            </div>

            <section className="space-y-4 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-700">Historial de versiones CAP</h3>
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Motor / IA / Manual TH
                </span>
              </div>

              <div className="overflow-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[980px] border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700">
                      <th className="px-3 py-3 text-left">Fecha</th>
                      <th className="px-3 py-3 text-left">Fuente</th>
                      <th className="px-3 py-3 text-left">Estado</th>
                      <th className="px-3 py-3 text-center">Puntaje</th>
                      <th className="px-3 py-3 text-left">Categoría</th>
                      <th className="px-3 py-3 text-left">Creado por</th>
                      <th className="px-3 py-3 text-left">Aprobado por</th>
                      <th className="px-3 py-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedVersions.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                          No hay versiones históricas registradas para este expediente.
                        </td>
                      </tr>
                    )}
                    {sortedVersions.map((version) => (
                      <tr key={version.versionId} className={selectedVersionId === version.versionId ? 'bg-blue-50/40' : ''}>
                        <td className="px-3 py-3 text-slate-600">{String(version.createdAt).replace('T', ' ').slice(0, 19)}</td>
                        <td className="px-3 py-3 font-black text-slate-900">{version.sourceType}</td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-700">
                            {version.versionStatus}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center font-black text-slate-900">{Number(version.totalScore).toFixed(1)}</td>
                        <td className="px-3 py-3 font-semibold text-slate-700">{version.suggestedCategory}</td>
                        <td className="px-3 py-3 text-slate-600">{version.createdBy || '-'}</td>
                        <td className="px-3 py-3 text-slate-600">{version.approvedBy || '-'}</td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setSelectedVersionId(version.versionId)}
                              className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-700 hover:bg-slate-50"
                            >
                              Ver detalle
                            </button>
                            <button
                              onClick={() => {
                                void approveHistoricalVersion(version.versionId);
                              }}
                              disabled={version.versionStatus === 'OFICIAL'}
                              className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-black uppercase text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Aprobar oficial
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedVersion && (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-2 md:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Fuente</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{selectedVersion.sourceType}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Estado</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{selectedVersion.versionStatus}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Puntaje</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{Number(selectedVersion.totalScore).toFixed(1)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Categoría</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{selectedVersion.suggestedCategory}</p>
                    </div>
                  </div>

                  <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[1050px] border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700">
                          <th className="px-2 py-2 text-left">Sección</th>
                          <th className="px-2 py-2 text-left">Criterio</th>
                          <th className="px-2 py-2 text-left">Detalle</th>
                          <th className="px-2 py-2 text-center">Cantidad</th>
                          <th className="px-2 py-2 text-center">Valor</th>
                          <th className="px-2 py-2 text-center">Base</th>
                          <th className="px-2 py-2 text-center">Sugerido</th>
                          <th className="px-2 py-2 text-center">Soporte</th>
                          <th className="px-2 py-2 text-left">Comentario</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedVersionRows.length === 0 && (
                          <tr>
                            <td colSpan={9} className="px-2 py-4 text-center text-slate-400">
                              Esta versión no contiene filas legibles en rowsPayload.
                            </td>
                          </tr>
                        )}
                        {selectedVersionRows.map((row, idx) => (
                          <tr key={`${row.criterion}-${idx}`}>
                            <td className="px-2 py-2 font-bold text-slate-700">{row.section}</td>
                            <td className="px-2 py-2 font-semibold text-slate-800">{row.criterion}</td>
                            <td className="px-2 py-2 text-slate-600">{row.detail || '-'}</td>
                            <td className="px-2 py-2 text-center font-bold text-slate-700">{row.quantity.toFixed(1)}</td>
                            <td className="px-2 py-2 text-center font-bold text-slate-700">{row.value.toFixed(1)}</td>
                            <td className="px-2 py-2 text-center font-black text-blue-700">{row.baseScore.toFixed(1)}</td>
                            <td className="px-2 py-2 text-center font-black text-indigo-700">{row.suggestedScore.toFixed(1)}</td>
                            <td className="px-2 py-2 text-center">
                              <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${row.hasSupport ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                {row.hasSupport ? 'Soportado' : 'Sin soporte'}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-slate-600">{row.comment || row.supportNote || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {(selectedVersion.narrative || selectedVersion.notes) && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Narrativa</p>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{selectedVersion.narrative || '-'}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Notas</p>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{selectedVersion.notes || '-'}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <div className="flex items-center gap-2 pl-2">
                  <Info className="h-5 w-5 text-blue-600" />
                  <label className="text-xs font-black uppercase tracking-widest text-slate-700">Observaciones de auditoria</label>
                </div>
                <textarea
                  value={auditChecklist.observaciones}
                  onChange={(e) => setAuditChecklist((prev) => ({ ...prev, observaciones: e.target.value }))}
                  placeholder="Escriba hallazgos, inconsistencias o justificacion de rechazos..."
                  className="min-h-[180px] w-full rounded-[2.5rem] border border-slate-200 bg-white p-8 text-sm shadow-sm transition-all focus:border-blue-300 focus:outline-none focus:ring-8 focus:ring-blue-500/5"
                />
              </div>

              <div className="flex flex-col justify-between gap-6 rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm">
                <div className="space-y-4">
                  <div className="rounded-3xl border border-slate-100 bg-slate-50 p-6 text-center">
                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Resultado de calificacion</p>
                    <div className="inline-block rounded-full bg-blue-100 px-6 py-2 text-[11px] font-black uppercase tracking-tighter text-[#003366]">
                      Categoria sugerida: {getSuggestedCategoryByPoints(totalAudit)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Puntaje final:</span>
                    <span className="text-3xl font-black text-[#003366]">{totalAudit.toFixed(1)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => handleStatusUpdate(selectedRequest.id, 'APTO', 'Expediente validado y apto.')}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-emerald-500/20 transition-all hover:-translate-y-1 hover:bg-emerald-700"
                  >
                    <CheckCircle className="h-4 w-4" /> Aprobar escalafon
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleStatusUpdate(selectedRequest.id, 'SUBSANACION', auditChecklist.observaciones)}
                      className="rounded-2xl border border-amber-200 bg-white py-3.5 text-[10px] font-black uppercase text-amber-600 transition-all hover:bg-amber-50"
                    >
                      <RotateCcw className="mr-2 inline h-4 w-4" /> Subsanacion
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedRequest.id, 'RECHAZADO', auditChecklist.observaciones || 'Expediente rechazado en auditoria.')}
                      className="rounded-2xl border border-rose-200 bg-white py-3.5 text-[10px] font-black uppercase text-rose-600 transition-all hover:bg-rose-50"
                    >
                      <XCircle className="mr-2 inline h-4 w-4" /> Rechazar
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </section>
        )}
      </div>

      {loading && <LoadingOverlay />}
    </>
  );
};

export default BandejaAuditarModule;
