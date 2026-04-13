import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, FilePlus2, FolderKanban } from 'lucide-react';

import { DbConnection } from '../../module_bindings';
import type {
  AcademicProgram,
  Application,
  ApplicationExperience,
  ApplicationLanguage,
  ApplicationPublication,
  ApplicationTitle,
  Faculty,
} from '../../module_bindings/types';
import LoadingOverlay from '../../components/LoadingOverlay';
import NuevoView from '../../components/NuevoView';
import type { FormState, RequestRecord } from '../../types/domain';
import { CATEGORIES, emptyForm } from '../../types/escalafon';
import { calculateAdvancedEscalafon, getSuggestedCategoryByPoints } from '../../utils/calculateEscalafon';
import { importScopusProduccion as importScopusProduccionFromApi } from '../../services/scopus';
import { importOrcidProduccion as importOrcidProduccionFromApi } from '../../services/orcid';
import { getPortalCredentialsForRole, getPortalSession } from '../../services/portalAuth';
import { getSpacetimeConnectionConfig } from '../../services/spacetime';
import { AnalysisDetailView } from './perfiles/AnalysisDetailView';
import { VersionDetailModal } from './perfiles/VersionDetailModal';
import {
  diffYears,
  hasSupport,
  normalizeExperienceType,
  normalizeLanguageLevel,
  normalizeText,
  normalizeTitleLevel,
  parseAiJson,
  toSafeNumber,
} from './perfiles/helpers';
import type { AnalysisVersionRecord, AiCriterionRow, ArrayKey, ChatMessage, ManualRow, MatrixRow } from './perfiles/types';

const clamp = (value: number) => (Number.isFinite(value) ? value : 0);

type StoredRagDocument = {
  documentKey: string;
  fileName: string;
  fileType: string;
  active: boolean;
  contentBase64?: string;
};

const normalizeForSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const compactText = (value: string) =>
  value
    .replace(/[^\x20-\x7E\u00A0-\u024F\n\r\t]/g, ' ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const decodeBase64Document = (contentBase64?: string) => {
  if (!contentBase64) return '';
  try {
    const binary = window.atob(contentBase64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const normalized = compactText(decoded);
    if (normalized.length >= 120) return normalized;

    const fallback = compactText(binary);
    return fallback;
  } catch {
    return '';
  }
};

const chunkText = (content: string, chunkSize: number, overlap: number) => {
  if (!content) return [] as string[];
  if (content.length <= chunkSize) return [content];

  const chunks: string[] = [];
  const safeOverlap = Math.max(0, Math.min(overlap, Math.floor(chunkSize / 2)));
  const step = Math.max(1, chunkSize - safeOverlap);

  for (let index = 0; index < content.length; index += step) {
    const chunk = content.slice(index, index + chunkSize).trim();
    if (chunk.length >= 120) chunks.push(chunk);
  }

  return chunks;
};

const scoreRagChunk = (chunk: string, queryTerms: string[]) => {
  const normalizedChunk = normalizeForSearch(chunk);
  let score = 0;

  for (const term of queryTerms) {
    if (!term) continue;
    if (normalizedChunk.includes(term)) score += term.length > 8 ? 4 : 2;
  }

  const normativeTerms = [
    'reglamento',
    'escalafon',
    'udes',
    'acuerdo',
    'resolucion',
    'articulo',
    'categoria',
    'puntaje',
    'titulo',
    'idioma',
    'publicacion',
    'experiencia',
    'auxiliar',
    'asistente',
    'asociado',
    'titular',
  ];

  for (const term of normativeTerms) {
    if (normalizedChunk.includes(term)) score += 1;
  }

  return score;
};

type PerfilesModuleProps = {
  mode?: 'full' | 'metrix';
};

const PerfilesModule: React.FC<PerfilesModuleProps> = ({ mode = 'full' }) => {
  const connectionRef = useRef<DbConnection | null>(null);
  const reloadRef = useRef<(() => Promise<void>) | null>(null);
  const [view, setView] = useState<'lista' | 'nuevo'>('lista');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [allTitles, setAllTitles] = useState<ApplicationTitle[]>([]);
  const [allLanguages, setAllLanguages] = useState<ApplicationLanguage[]>([]);
  const [allPublications, setAllPublications] = useState<ApplicationPublication[]>([]);
  const [allExperiences, setAllExperiences] = useState<ApplicationExperience[]>([]);
  const [selectedAnalysisRequest, setSelectedAnalysisRequest] = useState<RequestRecord | null>(null);

  const [scopusApiKey, setScopusApiKey] = useState('');
  const [orcidClientId, setOrcidClientId] = useState('');
  const [orcidClientSecret, setOrcidClientSecret] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [apifreellmApiKey, setApifreellmApiKey] = useState('');
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiModel, setAiModel] = useState('gemini-2.5-flash');
  const [ragSystemContext, setRagSystemContext] = useState('');
  const [ragTopK, setRagTopK] = useState(5);
  const [ragChunkSize, setRagChunkSize] = useState(1200);
  const [ragChunkOverlap, setRagChunkOverlap] = useState(150);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiNarrative, setAiNarrative] = useState('');
  const [aiRows, setAiRows] = useState<AiCriterionRow[]>([]);
  const [metriXChat, setMetriXChat] = useState<ChatMessage[]>([]);
  const [metriXInput, setMetriXInput] = useState('');
  const [metriXLoading, setMetriXLoading] = useState(false);

  const [manualMode, setManualMode] = useState(false);
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const [manualNarrative, setManualNarrative] = useState('');
  const [analysisVersions, setAnalysisVersions] = useState<AnalysisVersionRecord[]>([]);
  const [selectedVersionDetail, setSelectedVersionDetail] = useState<AnalysisVersionRecord | null>(null);

  const [facultyOptions, setFacultyOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [programOptions, setProgramOptions] = useState<Array<{ id: string; facultyId: string; name: string; level: string }>>([]);
  const [openConvocatorias, setOpenConvocatorias] = useState<Array<{ id: string; codigo: string; nombre: string; periodo: string }>>([]);
  const [selectedConvocatoriaId, setSelectedConvocatoriaId] = useState('');

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
        setConnected(true);
        ensurePortalSession(conn).catch((e) => console.warn('Portal session en PerfilesModule:', e));
      })
      .onConnectError((_ctx: unknown, err: unknown) => {
        console.error('PerfilesModule connect error:', err);
        setConnected(false);
      })
      .build();

    connectionRef.current = connection;

    const refreshFromCache = () => {
      const dbView = connection.db as any;
      const appTable = dbView.application;
      const appRows = appTable ? (Array.from(appTable.iter()) as Application[]) : [];
      const facultyTable = dbView.faculty;
      const facultyRows = facultyTable ? (Array.from(facultyTable.iter()) as Faculty[]) : [];
      const programTable = dbView.academic_program || dbView.academicProgram;
      const programRows = programTable ? (Array.from(programTable.iter()) as AcademicProgram[]) : [];
      const convocatoriaTable = dbView.convocatoria || dbView.convocatorias;
      const convocatoriaRows = convocatoriaTable ? (Array.from(convocatoriaTable.iter()) as any[]) : [];
      const titleTable = dbView.applicationTitle || dbView.application_title;
      const languageTable = dbView.applicationLanguage || dbView.application_language;
      const publicationTable = dbView.applicationPublication || dbView.application_publication;
      const experienceTable = dbView.applicationExperience || dbView.application_experience;
      const analysisVersionTable = dbView.applicationAnalysisVersion || dbView.application_analysis_version;
      const ragTable = dbView.ragConfig || dbView.rag_config;

      const apiTable = dbView.apiConfig || dbView.api_config;
      if (apiTable) {
        const apiRows = Array.from(apiTable.iter()) as any[];
        const defaultCfg = apiRows.find((r) => r.configKey === 'default');
        if (defaultCfg?.scopusApiKey) setScopusApiKey(defaultCfg.scopusApiKey);
        if (defaultCfg?.orcidClientId) setOrcidClientId(defaultCfg.orcidClientId);
        if (defaultCfg?.orcidClientSecret) setOrcidClientSecret(defaultCfg.orcidClientSecret);
        if (defaultCfg?.geminiApiKey) setGeminiApiKey(defaultCfg.geminiApiKey);
        if (defaultCfg?.apifreellmApiKey) setApifreellmApiKey(defaultCfg.apifreellmApiKey);
        if (defaultCfg?.aiProvider) setAiProvider(defaultCfg.aiProvider);
        if (defaultCfg?.aiModel) setAiModel(defaultCfg.aiModel);
      }

      if (ragTable) {
        const ragRows = Array.from(ragTable.iter()) as any[];
        const defaultRag = ragRows.find((row) => row.configKey === 'default');
        if (defaultRag) {
          setRagSystemContext(defaultRag.systemContext || '');
          setRagTopK(Number(defaultRag.topK || 5));
          setRagChunkSize(Number(defaultRag.chunkSize || 1200));
          setRagChunkOverlap(Number(defaultRag.chunkOverlap || 150));
        }
      }

      const mapped: RequestRecord[] = appRows
        .map((row) => {
          const category = CATEGORIES.find((c) => c.name.toLowerCase() === String(row.finalCategory || '').toLowerCase());
          return {
            id: row.trackingId,
            nombre: row.professorName,
            documento: row.documentNumber,
            facultad: row.facultyName,
            esIngresoNuevo: true,
            finalPts: row.finalPoints,
            finalCat: {
              name: row.finalCategory,
              bgColor: category?.bgColor || 'bg-slate-400',
            },
            outputMessage: row.outputMessage,
            status: row.status || 'RECIBIDO',
          };
        })
        .sort((a, b) => b.id.localeCompare(a.id));

      setRequests(mapped);

      setFacultyOptions(
        facultyRows
          .filter((row) => row.active)
          .map((row) => ({ id: row.facultyId, name: row.facultyName }))
          .sort((left, right) => left.name.localeCompare(right.name)),
      );

      setProgramOptions(
        programRows
          .filter((row) => row.active)
          .map((row) => ({
            id: row.programId,
            facultyId: row.facultyId,
            name: row.programName,
            level: row.formationLevel || 'PREGRADO',
          }))
          .sort((left, right) => left.name.localeCompare(right.name)),
      );

      const normalizedOpenConvocatorias = convocatoriaRows
        .filter((row) => String(row.estado || '').toUpperCase() === 'ABIERTA')
        .map((row) => ({
          id: row.id,
          codigo: row.codigo || row.id,
          nombre: row.nombre || 'Convocatoria',
          periodo: row.periodo || '',
        }));

      setOpenConvocatorias(normalizedOpenConvocatorias);
      if (normalizedOpenConvocatorias.length > 0) {
        setSelectedConvocatoriaId((prev) => prev || normalizedOpenConvocatorias[0].id);
      }

      setAllTitles(titleTable ? (Array.from(titleTable.iter()) as ApplicationTitle[]) : []);
      setAllLanguages(languageTable ? (Array.from(languageTable.iter()) as ApplicationLanguage[]) : []);
      setAllPublications(publicationTable ? (Array.from(publicationTable.iter()) as ApplicationPublication[]) : []);
      setAllExperiences(experienceTable ? (Array.from(experienceTable.iter()) as ApplicationExperience[]) : []);
      setAnalysisVersions(
        analysisVersionTable
          ? (Array.from(analysisVersionTable.iter()) as any[])
            .map((row) => ({
              versionId: row.versionId,
              trackingId: row.trackingId,
              sourceType: row.sourceType,
              versionStatus: row.versionStatus,
              totalScore: Number(row.totalScore || 0),
              suggestedCategory: row.suggestedCategory || 'Sin categoría',
              rowsPayload: row.rowsPayload || '[]',
              narrative: row.narrative || '',
              notes: row.notes || '',
              createdBy: row.createdBy || undefined,
              createdRole: row.createdRole || undefined,
              approvedBy: row.approvedBy || undefined,
              approvedAt: row.approvedAt ? String(row.approvedAt) : undefined,
              createdAt: String(row.createdAt || ''),
            }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          : [],
      );
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
          .subscribe([
            'SELECT * FROM application',
            'SELECT * FROM application_title',
            'SELECT * FROM application_language',
            'SELECT * FROM application_publication',
            'SELECT * FROM application_experience',
            'SELECT * FROM application_analysis_version',
            'SELECT * FROM api_config',
            'SELECT * FROM faculty',
            'SELECT * FROM academic_program',
            'SELECT * FROM convocatoria',
          ]);
      });
    };

    reloadRef.current = loadOnce;
    void loadOnce().catch((ctx) => console.error(ctx));

    return () => {
      reloadRef.current = null;
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

  const handleSave = async () => {
    if (!connected) {
      window.alert('No hay conexión a SpacetimeDB.');
      return;
    }

    if (!formData.nombre.trim() || !formData.documento.trim() || !formData.programa.trim() || !formData.facultad.trim()) {
      window.alert('Completa nombre, documento, programa y facultad antes de registrar.');
      return;
    }

    if (!selectedConvocatoriaId) {
      window.alert('Selecciona una convocatoria abierta para registrar el expediente.');
      return;
    }

    setLoading(true);
    try {
      const trackingId = `UDES-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      const res = calculateAdvancedEscalafon(formData);

      await runReducer('register_professor', {
        trackingId,
        professorName: formData.nombre.trim(),
        documentNumber: formData.documento.trim(),
        campus: 'VALLEDUPAR',
        programName: formData.programa.trim(),
        facultyName: formData.facultad.trim(),
        convocatoriaId: selectedConvocatoriaId,
        scopusProfile: formData.scopusProfile.trim() || undefined,
        finalPoints: res.finalPts,
        finalCategory: res.finalCat.name,
        outputMessage: res.outputMessage,
      });

      for (const t of formData.titulos) {
        await runReducer('add_application_title', {
          trackingId,
          titleName: t.titulo,
          titleLevel: t.nivel,
          supportName: t.supportName || undefined,
          supportPath: t.supportPath || (t.supportName ? `professor-supports/titles/${trackingId}/${t.supportName}` : undefined),
        });
      }

      for (const i of formData.idiomas) {
        await runReducer('add_application_language', {
          trackingId,
          languageName: i.idioma,
          languageLevel: i.nivel,
          convalidation: i.convalidacion === 'SI',
        });
      }

      for (const p of formData.produccion) {
        await runReducer('add_application_publication', {
          trackingId,
          publicationTitle: p.titulo,
          quartile: p.cuartil,
          publicationYear: p.fecha,
          publicationType: p.tipo || 'Artículo',
          authorsCount: Number(p.autores || 1),
          sourceKind: p.fuente || 'MANUAL',
        });
      }

      for (const e of formData.experiencia) {
        await runReducer('add_application_experience', {
          trackingId,
          experienceType: e.tipo,
          startedAt: e.inicio,
          endedAt: e.fin,
          certified: e.certificacion === 'SI',
          supportName: e.supportName || undefined,
          supportPath: e.supportPath || (e.supportName ? `professor-supports/experience/${trackingId}/${e.supportName}` : undefined),
        });
      }

      window.alert('Perfil del profesor registrado correctamente.');
      setFormData(emptyForm);
      setView('lista');
    } catch (e) {
      console.error(e);
      window.alert('No fue posible registrar el perfil del profesor.');
    } finally {
      setLoading(false);
    }
  };

  const addTitulo = () =>
    setFormData((p) => ({ ...p, titulos: [...p.titulos, { titulo: '', nivel: 'Pregrado', supportName: '', supportPath: '' }] }));

  const addIdioma = () =>
    setFormData((p) => ({ ...p, idiomas: [...p.idiomas, { idioma: '', nivel: 'A2', convalidacion: 'NO' }] }));

  const addExperiencia = () =>
    setFormData((p) => ({
      ...p,
      experiencia: [...p.experiencia, { tipo: 'Docencia Universitaria', inicio: '', fin: '', certificacion: 'NO', supportName: '', supportPath: '' }],
    }));

  const addProduccionManual = () =>
    setFormData((p) => ({
      ...p,
      produccion: [
        ...p.produccion,
        { titulo: '', cuartil: 'Q4', fecha: new Date().getFullYear().toString(), tipo: 'Artículo', autores: 1, fuente: 'MANUAL' },
      ],
    }));

  const removeArrayItem = (key: ArrayKey, index: number) =>
    setFormData((p) => ({ ...p, [key]: p[key].filter((_, i) => i !== index) } as FormState));

  const importScopusProduccion = async () => {
    if (!formData.scopusProfile.trim()) {
      window.alert('Ingresa un identificador o URL de perfil SCOPUS.');
      return;
    }
    setLoading(true);
    try {
      const scopusKey = scopusApiKey || import.meta.env.VITE_SCOPUS_API_KEY || '';
      const imported = await importScopusProduccionFromApi(formData.scopusProfile, scopusKey, 20);
      if (imported.length === 0) {
        window.alert('SCOPUS no devolvió publicaciones para ese perfil.');
        return;
      }
      setFormData((p) => ({ ...p, produccion: [...p.produccion, ...imported] }));
    } catch (err) {
      console.error(err);
      window.alert(err instanceof Error ? err.message : 'Error al importar producción desde SCOPUS.');
    } finally {
      setLoading(false);
    }
  };

  const importOrcidProduccion = async () => {
    if (!formData.scopusProfile.trim()) {
      window.alert('Ingresa un ORCID para consultar producción.');
      return;
    }

    setLoading(true);
    try {
      void orcidClientId;
      void orcidClientSecret;
      const imported = await importOrcidProduccionFromApi(formData.scopusProfile, 20);
      if (imported.length === 0) {
        window.alert('ORCID no devolvió publicaciones para ese perfil.');
        return;
      }
      setFormData((p) => ({ ...p, produccion: [...p.produccion, ...imported] }));
    } catch (err) {
      console.error(err);
      window.alert(err instanceof Error ? err.message : 'Error al consultar producción en ORCID.');
    } finally {
      setLoading(false);
    }
  };

  const liveScore = useMemo(() => calculateAdvancedEscalafon(formData), [formData]);

  const selectedAnalysis = useMemo(() => {
    if (!selectedAnalysisRequest) return null;

    const trackingId = selectedAnalysisRequest.id;
    const titles = allTitles.filter((row) => row.trackingId === trackingId);
    const languages = allLanguages.filter((row) => row.trackingId === trackingId);
    const publications = allPublications.filter((row) => row.trackingId === trackingId);
    const experiences = allExperiences.filter((row) => row.trackingId === trackingId);
    const hasDocumentSupports =
      titles.some((row) => hasSupport(row.supportName, row.supportPath)) ||
      experiences.some((row) => hasSupport(row.supportName, row.supportPath));

    const pregrados = titles.filter((row) => normalizeTitleLevel(row.titleLevel) === 'Pregrado');
    const especializaciones = titles.filter((row) => normalizeTitleLevel(row.titleLevel) === 'Especialización');
    const maestrias = titles.filter((row) => normalizeTitleLevel(row.titleLevel) === 'Maestría');
    const doctorados = titles.filter((row) => normalizeTitleLevel(row.titleLevel) === 'Doctorado');

    const studiesRows: MatrixRow[] = [
      {
        section: 'Estudios Cursados',
        criterio: 'TÍTULO PROFESIONAL',
        detalle: pregrados[0]?.supportName || pregrados[0]?.titleName || '-',
        cantidad: pregrados.length > 0 ? 1 : 0,
        valor: 300,
        puntaje: pregrados.length > 0 ? 300 : 0,
        hasSupport: pregrados.length > 0 ? hasSupport(pregrados[0].supportName, pregrados[0].supportPath) : false,
        supportNote: pregrados.length > 0 ? (hasSupport(pregrados[0].supportName, pregrados[0].supportPath) ? 'Soportado' : 'Sin soporte adjunto') : 'Sin dato',
      },
      {
        section: 'Estudios Cursados',
        criterio: 'TÍTULO PROFESIONAL ADICIONAL',
        detalle: pregrados.slice(1).map((row) => row.supportName || row.titleName).join(' | ') || '-',
        cantidad: Math.max(0, pregrados.length - 1),
        valor: 60,
        puntaje: Math.max(0, pregrados.length - 1) * 60,
        hasSupport: pregrados.slice(1).some((row) => hasSupport(row.supportName, row.supportPath)),
        supportNote: pregrados.slice(1).some((row) => hasSupport(row.supportName, row.supportPath)) ? 'Soportado parcialmente' : 'Sin soporte adjunto',
      },
      {
        section: 'Estudios Cursados',
        criterio: 'TÍTULO ESPECIALIZACIÓN',
        detalle: especializaciones[0]?.supportName || especializaciones[0]?.titleName || '-',
        cantidad: especializaciones.length > 0 ? 1 : 0,
        valor: 90,
        puntaje: especializaciones.length > 0 ? 90 : 0,
        hasSupport: especializaciones.length > 0 ? hasSupport(especializaciones[0].supportName, especializaciones[0].supportPath) : false,
        supportNote: especializaciones.length > 0 ? (hasSupport(especializaciones[0].supportName, especializaciones[0].supportPath) ? 'Soportado' : 'Sin soporte adjunto') : 'Sin dato',
      },
      {
        section: 'Estudios Cursados',
        criterio: 'TÍTULO ESPECIALIZACIÓN ADICIONAL',
        detalle: especializaciones.slice(1).map((row) => row.supportName || row.titleName).join(' | ') || '-',
        cantidad: Math.max(0, especializaciones.length - 1),
        valor: 30,
        puntaje: Math.max(0, especializaciones.length - 1) * 30,
        hasSupport: especializaciones.slice(1).some((row) => hasSupport(row.supportName, row.supportPath)),
        supportNote: especializaciones.slice(1).some((row) => hasSupport(row.supportName, row.supportPath)) ? 'Soportado parcialmente' : 'Sin soporte adjunto',
      },
      {
        section: 'Estudios Cursados',
        criterio: 'TÍTULO MAGÍSTER',
        detalle: maestrias[0]?.supportName || maestrias[0]?.titleName || '-',
        cantidad: maestrias.length > 0 ? 1 : 0,
        valor: 200,
        puntaje: maestrias.length > 0 ? 200 : 0,
        hasSupport: maestrias.length > 0 ? hasSupport(maestrias[0].supportName, maestrias[0].supportPath) : false,
        supportNote: maestrias.length > 0 ? (hasSupport(maestrias[0].supportName, maestrias[0].supportPath) ? 'Soportado' : 'Sin soporte adjunto') : 'Sin dato',
      },
      {
        section: 'Estudios Cursados',
        criterio: 'TÍTULO MAGÍSTER ADICIONAL',
        detalle: maestrias.slice(1).map((row) => row.supportName || row.titleName).join(' | ') || '-',
        cantidad: Math.max(0, maestrias.length - 1),
        valor: 90,
        puntaje: Math.max(0, maestrias.length - 1) * 90,
        hasSupport: maestrias.slice(1).some((row) => hasSupport(row.supportName, row.supportPath)),
        supportNote: maestrias.slice(1).some((row) => hasSupport(row.supportName, row.supportPath)) ? 'Soportado parcialmente' : 'Sin soporte adjunto',
      },
      {
        section: 'Estudios Cursados',
        criterio: 'TÍTULO DOCTORADO',
        detalle: doctorados.map((row) => row.supportName || row.titleName).join(' | ') || '-',
        cantidad: doctorados.length,
        valor: 400,
        puntaje: doctorados.length * 400,
        hasSupport: doctorados.some((row) => hasSupport(row.supportName, row.supportPath)),
        supportNote: doctorados.some((row) => hasSupport(row.supportName, row.supportPath)) ? 'Soportado parcialmente' : 'Sin soporte adjunto',
      },
      {
        section: 'Estudios Cursados',
        criterio: 'DIPLOMADOS (40 HS O MÁS)',
        detalle: titles
          .filter((row) => normalizeText(row.titleName).includes('diplom'))
          .map((row) => row.supportName || row.titleName)
          .join(' | ') || '-',
        cantidad: titles.filter((row) => normalizeText(row.titleName).includes('diplom')).length,
        valor: 15,
        puntaje: titles.filter((row) => normalizeText(row.titleName).includes('diplom')).length * 15,
        hasSupport: titles.filter((row) => normalizeText(row.titleName).includes('diplom')).some((row) => hasSupport(row.supportName, row.supportPath)),
        supportNote: titles.filter((row) => normalizeText(row.titleName).includes('diplom')).some((row) => hasSupport(row.supportName, row.supportPath)) ? 'Soportado parcialmente' : 'Sin soporte adjunto',
      },
      {
        section: 'Estudios Cursados',
        criterio: 'CURSOS O SEMINARIOS (40 HS O MÁS)',
        detalle: titles
          .filter((row) => {
            const name = normalizeText(row.titleName);
            return name.includes('curso') || name.includes('seminario');
          })
          .map((row) => row.supportName || row.titleName)
          .join(' | ') || '-',
        cantidad: titles.filter((row) => {
          const name = normalizeText(row.titleName);
          return name.includes('curso') || name.includes('seminario');
        }).length,
        valor: 15,
        puntaje:
          titles.filter((row) => {
            const name = normalizeText(row.titleName);
            return name.includes('curso') || name.includes('seminario');
          }).length * 15,
        hasSupport: titles
          .filter((row) => {
            const name = normalizeText(row.titleName);
            return name.includes('curso') || name.includes('seminario');
          })
          .some((row) => hasSupport(row.supportName, row.supportPath)),
        supportNote: titles
          .filter((row) => {
            const name = normalizeText(row.titleName);
            return name.includes('curso') || name.includes('seminario');
          })
          .some((row) => hasSupport(row.supportName, row.supportPath))
          ? 'Soportado parcialmente'
          : 'Sin soporte adjunto',
      },
      {
        section: 'Estudios Cursados',
        criterio: 'IDIOMA EXTRANJERO',
        detalle: languages.map((row) => `${row.languageName} (${row.languageLevel})`).join(' | ') || '-',
        cantidad: languages.length,
        valor: 30,
        puntaje: languages.length * 30,
        hasSupport: false,
        supportNote: 'Sin soporte documental explícito',
      },
    ];

    const experienceRowsBase: MatrixRow[] = [
      {
        section: 'Experiencia',
        criterio: 'EXPERIENCIA LABORAL PROFESIONAL',
        detalle: experiences
          .filter((row) => normalizeExperienceType(row.experienceType) === 'Profesional')
          .map((row) => row.supportName || `${row.startedAt} - ${row.endedAt || 'Actual'}`)
          .join(' | ') || '-',
        cantidad: clamp(
          experiences
            .filter((row) => normalizeExperienceType(row.experienceType) === 'Profesional')
            .reduce((acc, row) => acc + diffYears(row.startedAt, row.endedAt), 0),
        ),
        valor: 20,
        puntaje: 0,
        hasSupport: experiences
          .filter((row) => normalizeExperienceType(row.experienceType) === 'Profesional')
          .some((row) => hasSupport(row.supportName, row.supportPath)),
        supportNote: experiences
          .filter((row) => normalizeExperienceType(row.experienceType) === 'Profesional')
          .some((row) => hasSupport(row.supportName, row.supportPath))
          ? 'Soportado parcialmente'
          : 'Sin soporte adjunto',
      },
      {
        section: 'Experiencia',
        criterio: 'EXPERIENCIA LABORAL DOCENCIA',
        detalle: experiences
          .filter((row) => normalizeExperienceType(row.experienceType) === 'Docencia Universitaria')
          .map((row) => row.supportName || `${row.startedAt} - ${row.endedAt || 'Actual'}`)
          .join(' | ') || '-',
        cantidad: clamp(
          experiences
            .filter((row) => normalizeExperienceType(row.experienceType) === 'Docencia Universitaria')
            .reduce((acc, row) => acc + diffYears(row.startedAt, row.endedAt), 0),
        ),
        valor: 30,
        puntaje: 0,
        hasSupport: experiences
          .filter((row) => normalizeExperienceType(row.experienceType) === 'Docencia Universitaria')
          .some((row) => hasSupport(row.supportName, row.supportPath)),
        supportNote: experiences
          .filter((row) => normalizeExperienceType(row.experienceType) === 'Docencia Universitaria')
          .some((row) => hasSupport(row.supportName, row.supportPath))
          ? 'Soportado parcialmente'
          : 'Sin soporte adjunto',
      },
      {
        section: 'Experiencia',
        criterio: 'EXPERIENCIA INVESTIGACIÓN',
        detalle: experiences
          .filter((row) => normalizeExperienceType(row.experienceType) === 'Investigación')
          .map((row) => row.supportName || `${row.startedAt} - ${row.endedAt || 'Actual'}`)
          .join(' | ') || '-',
        cantidad: clamp(
          experiences
            .filter((row) => normalizeExperienceType(row.experienceType) === 'Investigación')
            .reduce((acc, row) => acc + diffYears(row.startedAt, row.endedAt), 0),
        ),
        valor: 40,
        puntaje: 0,
        hasSupport: experiences
          .filter((row) => normalizeExperienceType(row.experienceType) === 'Investigación')
          .some((row) => hasSupport(row.supportName, row.supportPath)),
        supportNote: experiences
          .filter((row) => normalizeExperienceType(row.experienceType) === 'Investigación')
          .some((row) => hasSupport(row.supportName, row.supportPath))
          ? 'Soportado parcialmente'
          : 'Sin soporte adjunto',
      },
    ];

    const experienceRows: MatrixRow[] = experienceRowsBase.map((row) => ({
      ...row,
      puntaje: Number((row.cantidad * row.valor).toFixed(1)),
    }));

    const productionScore = publications.reduce((acc, row) => {
      const quartileValue = { q1: 70, q2: 50, q3: 30, q4: 20 }[normalizeText(row.quartile) as 'q1' | 'q2' | 'q3' | 'q4'] || 20;
      const authors = Number(row.authorsCount || 1);
      const factor = authors <= 2 ? 1 : authors <= 4 ? 0.5 : 1 / authors;
      return acc + quartileValue * factor;
    }, 0);

    const otherRows: MatrixRow[] = [
      {
        section: 'Otros',
        criterio: 'PRODUCCIÓN INTELECTUAL',
        detalle: publications
          .map((row) => `${row.publicationTitle} (${row.quartile}, ${row.publicationYear})`)
          .join(' | ') || '-',
        cantidad: publications.length,
        valor: 0,
        puntaje: Number(productionScore.toFixed(1)),
        hasSupport: false,
        supportNote: 'Sin soporte documental explícito',
      },
    ];

    const matrixRows = [...studiesRows, ...experienceRows, ...otherRows].filter(
      (row) => row.cantidad > 0 || row.puntaje > 0,
    );
    const matrixTotal = matrixRows.reduce((acc, row) => acc + row.puntaje, 0);

    const formStateForCalc: FormState = {
      nombre: selectedAnalysisRequest.nombre,
      documento: selectedAnalysisRequest.documento,
      programa: '',
      facultad: selectedAnalysisRequest.facultad,
      scopusProfile: '',
      esIngresoNuevo: true,
      isAccreditedSource: false,
      yearsInCategory: 0,
      hasTrabajoAprobadoCEPI: false,
      titulos: titles.map((row) => ({
        titulo: row.titleName,
        nivel: normalizeTitleLevel(row.titleLevel),
        supportName: row.supportName || undefined,
        supportPath: row.supportPath || undefined,
      })),
      idiomas: languages.map((row) => ({
        idioma: row.languageName,
        nivel: normalizeLanguageLevel(row.languageLevel),
        convalidacion: row.convalidation ? 'SI' : 'NO',
      })),
      produccion: publications.map((row) => ({
        titulo: row.publicationTitle,
        cuartil: (row.quartile.toUpperCase() as 'Q1' | 'Q2' | 'Q3' | 'Q4') || 'Q4',
        fecha: row.publicationYear,
        tipo: row.publicationType,
        autores: Number(row.authorsCount || 1),
        fuente: (row.sourceKind as 'SCOPUS' | 'MANUAL') || 'MANUAL',
      })),
      experiencia: experiences.map((row) => ({
        tipo: normalizeExperienceType(row.experienceType),
        inicio: row.startedAt,
        fin: row.endedAt,
        certificacion: row.certified ? 'SI' : 'NO',
        supportName: row.supportName || undefined,
        supportPath: row.supportPath || undefined,
      })),
      orcid: '',
    };

    const suggested = calculateAdvancedEscalafon(formStateForCalc);

    return {
      rows: matrixRows,
      matrixTotal,
      suggested,
      hasDocumentSupports,
    };
  }, [selectedAnalysisRequest, allExperiences, allLanguages, allPublications, allTitles]);

  useEffect(() => {
    if (!selectedAnalysis) {
      setAiRows([]);
      setAiNarrative('');
      setMetriXChat([]);
      setMetriXInput('');
      setManualRows([]);
      setManualNarrative('');
      setManualMode(false);
      return;
    }

    setAiRows([]);
    setAiNarrative('');
    setMetriXChat([]);
    setMetriXInput('');
    setManualRows(
      selectedAnalysis.rows.map((row, index) => ({
        id: `manual-${index}-${row.criterio}`,
        section: row.section,
        criterio: row.criterio,
        detalle: row.detalle,
        cantidad: row.cantidad,
        valor: row.valor,
        puntaje: row.hasSupport ? row.puntaje : 0,
        soportado: row.hasSupport,
        comentario: row.hasSupport ? 'Puntaje mantenido por soporte presentado.' : 'Sin soporte verificable. Puntaje en 0.',
      })),
    );
    setManualNarrative('Construcción manual desde Talento Humano. Ajusta cada criterio según validación del expediente.');
    setManualMode(false);
  }, [selectedAnalysis]);

  const runAiSuggestion = async () => {
    if (!selectedAnalysisRequest || !selectedAnalysis) return;

    const provider = aiProvider || 'gemini';
    const model = aiModel || 'gemini-2.5-flash';
    const activeKey = provider === 'gemini' ? (geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || '') : apifreellmApiKey;

    if (!activeKey) {
      window.alert(`No se encontró API Key para ${provider === 'gemini' ? 'Gemini' : 'APIFreeLLM'}.`);
      return;
    }

    setAiLoading(true);
    try {
      const baseRows = selectedAnalysis.rows.map((row) => ({
        section: row.section,
        criterio: row.criterio,
        detalle: row.detalle,
        cantidad: row.cantidad,
        valor: row.valor,
        puntajeBase: row.puntaje,
        hasSupport: row.hasSupport,
        supportNote: row.supportNote,
      }));

      const systemPrompt = [
        'Eres una analista de escalafón docente UDES.',
        'Debes evaluar los criterios presentados y devolver JSON válido.',
        'Si no hay soporte documental en un criterio, asigna 0 o puntaje mínimo prudente (max 10% del base) y justifica.',
        'No inventes soportes.',
        'Responde solo JSON con esta forma:',
        '{"rows":[{"criterio":"...","soporteValido":true,"puntajeSugerido":120,"comentario":"..."}],"narrativa":"..."}',
      ].join(' ');

      const userPrompt = [
        `Docente: ${selectedAnalysisRequest.nombre}`,
        `Documento: ${selectedAnalysisRequest.documento}`,
        `Facultad: ${selectedAnalysisRequest.facultad}`,
        `Categoría sugerida motor: ${selectedAnalysis.suggested.finalCat.name}`,
        `Puntaje sugerido motor: ${selectedAnalysis.suggested.finalPts.toFixed(1)}`,
        'Criterios para analizar:',
        JSON.stringify(baseRows),
      ].join('\n');

      let aiText = '';

      if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        const res = await fetch('/api/apifreellm/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeKey}`,
          },
          body: JSON.stringify({
            message: `${systemPrompt}\n\n${userPrompt}`,
            model: model || 'apifreellm',
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        aiText = data.response || data.message || data.content || data.text || '';
      }

      const parsed = parseAiJson(aiText);
      if (!parsed) {
        setAiRows([]);
        setAiNarrative(aiText || 'No se pudo interpretar respuesta estructurada de IA.');
        return;
      }

      const mergedRows = selectedAnalysis.rows.map((base) => {
        const hit = parsed.rows.find((row) => normalizeText(row.criterio) === normalizeText(base.criterio));
        return {
          criterio: base.criterio,
          soporteValido: hit ? hit.soporteValido : base.hasSupport,
          puntajeSugerido: hit ? Math.max(0, toSafeNumber(hit.puntajeSugerido, 0)) : base.hasSupport ? base.puntaje : 0,
          comentario: hit?.comentario || (base.hasSupport ? 'Con soporte documental presentado.' : 'Sin soporte documental; puntaje sugerido en 0.'),
        };
      });

      setAiRows(mergedRows);
      setAiNarrative(parsed.narrativa || 'Análisis IA generado con base en criterios y soportes disponibles.');
    } catch (error) {
      setAiRows([]);
      setAiNarrative(error instanceof Error ? error.message : 'No se pudo generar el análisis de IA.');
    } finally {
      setAiLoading(false);
    }
  };

  const getActiveRagDocuments = (): StoredRagDocument[] => {
    const connection = connectionRef.current;
    if (!connection) return [];

    const dbView = connection.db as any;
    const ragDocumentTable = dbView.ragDocument || dbView.rag_document;
    const ragDocumentRows = ragDocumentTable ? (Array.from(ragDocumentTable.iter()) as any[]) : [];

    return ragDocumentRows
      .filter((row) => row.active)
      .map((row) => ({
        documentKey: row.documentKey,
        fileName: row.fileName,
        fileType: row.fileType,
        active: row.active,
        contentBase64: row.contentBase64 ?? undefined,
      }));
  };

  const buildRagContextForChat = (question: string) => {
    if (!selectedAnalysis || !selectedAnalysisRequest) {
      return 'No hay un expediente seleccionado para construir contexto RAG.';
    }

    const trackingId = selectedAnalysisRequest.id;
    const titles = allTitles.filter((row) => row.trackingId === trackingId);
    const languages = allLanguages.filter((row) => row.trackingId === trackingId);
    const publications = allPublications.filter((row) => row.trackingId === trackingId);
    const experiences = allExperiences.filter((row) => row.trackingId === trackingId);

    const queryTerms = Array.from(
      new Set(
        normalizeForSearch(
          [
            selectedAnalysisRequest.nombre,
            selectedAnalysisRequest.facultad,
            selectedAnalysisRequest.finalCat.name,
            question,
            titles.map((item) => item.titleLevel).join(' '),
            languages.map((item) => item.languageLevel).join(' '),
            publications.map((item) => item.quartile).join(' '),
            experiences.map((item) => item.experienceType).join(' '),
          ].join(' '),
        )
          .split(/[^a-z0-9]+/)
          .filter((term) => term.length >= 4),
      ),
    );

    const rankedChunks: Array<{ fileName: string; chunk: string; score: number }> = [];
    const activeRagDocuments = getActiveRagDocuments();
    for (const document of activeRagDocuments) {
      const decoded = decodeBase64Document(document.contentBase64);
      if (!decoded) continue;
      const chunks = chunkText(decoded, ragChunkSize, ragChunkOverlap);
      for (const chunk of chunks) {
        const score = scoreRagChunk(chunk, queryTerms);
        if (score > 0) rankedChunks.push({ fileName: document.fileName, chunk, score });
      }
    }

    const selectedChunks = rankedChunks
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, ragTopK))
      .map((item, index) => `[Fuente ${index + 1}: ${item.fileName}]\n${item.chunk.slice(0, 1600)}`);

    return selectedChunks.length > 0
      ? selectedChunks.join('\n\n')
      : 'No se recuperaron fragmentos normativos desde RAG para este caso.';
  };

  const sendMetriXMessage = async () => {
    if (!selectedAnalysis || !selectedAnalysisRequest) return;
    if (!metriXInput.trim()) return;

    const provider = aiProvider || 'gemini';
    const model = aiModel || 'gemini-2.5-flash';
    const activeKey = provider === 'gemini'
      ? (geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || '')
      : apifreellmApiKey;

    if (!activeKey) {
      window.alert(`No se encontró API Key para ${provider === 'gemini' ? 'Gemini' : 'APIFreeLLM'}.`);
      return;
    }

    const userMessage: ChatMessage = {
      id: `chat-user-${Date.now()}`,
      role: 'user',
      content: metriXInput.trim(),
      createdAt: new Date().toISOString(),
    };

    const nextConversation = [...metriXChat, userMessage];
    setMetriXChat(nextConversation);
    setMetriXInput('');
    setMetriXLoading(true);

    try {
      const ragContext = buildRagContextForChat(userMessage.content);

      const matrixBase = selectedAnalysis.rows.map((row) => ({
        criterio: row.criterio,
        section: row.section,
        puntajeBase: row.puntaje,
        soporte: row.hasSupport,
        detalle: row.detalle,
      }));

      const workflowContext = [
        `Docente: ${selectedAnalysisRequest.nombre}`,
        `Documento: ${selectedAnalysisRequest.documento}`,
        `Facultad: ${selectedAnalysisRequest.facultad}`,
        `Puntaje oficial del expediente: ${selectedAnalysisRequest.finalPts.toFixed(1)}`,
        `Categoría oficial actual: ${selectedAnalysisRequest.finalCat.name}`,
        `Puntaje motor preliminar: ${selectedAnalysis.suggested.finalPts.toFixed(1)}`,
        `Categoría motor preliminar: ${selectedAnalysis.suggested.finalCat.name}`,
      ].join('\n');

      const conversationText = nextConversation
        .map((entry) => `${entry.role === 'user' ? 'Usuario' : 'MetriX'}: ${entry.content}`)
        .join('\n');

      const systemPrompt = [
        'Eres MetriX, asistente experto de escalafón docente UDES para Talento Humano.',
        'Debes analizar situaciones específicas del caso usando RAG, reglas de escalafón y evidencia del expediente.',
        'Responde SIEMPRE en JSON válido con esta estructura exacta:',
        '{"rows":[{"criterio":"...","soporteValido":true,"puntajeSugerido":120,"comentario":"..."}],"narrativa":"concepto técnico con explicación normativa y trazabilidad de puntaje"}',
        'En narrativa debes explicar por qué se asigna o no puntaje por criterio, y mencionar fuentes RAG cuando apliquen.',
        'No inventes soportes ni normas. Si falta evidencia, indícalo explícitamente.',
      ].join(' ');

      const userPrompt = [
        'CONTEXTO DEL EXPEDIENTE:',
        workflowContext,
        '\nMATRIZ BASE DE CRITERIOS:',
        JSON.stringify(matrixBase),
        '\nCONVERSACIÓN ACUMULADA:',
        conversationText,
        '\nRAG (normativa/documentos):',
        ragContext,
        ragSystemContext ? `\nPOLÍTICA RAG ADICIONAL:\n${ragSystemContext}` : '',
      ].join('\n');

      let aiText = '';
      if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        const res = await fetch('/api/apifreellm/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeKey}`,
          },
          body: JSON.stringify({
            message: `${systemPrompt}\n\n${userPrompt}`,
            model: model || 'apifreellm',
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        aiText = data.response || data.message || data.content || data.text || '';
      }

      const parsed = parseAiJson(aiText);
      if (!parsed) {
        setMetriXChat((prev) => [
          ...prev,
          {
            id: `chat-assistant-${Date.now()}`,
            role: 'assistant',
            content: aiText || 'No pude interpretar la respuesta en formato estructurado.',
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }

      const mergedRows = selectedAnalysis.rows.map((base) => {
        const hit = parsed.rows.find((row) => normalizeText(row.criterio) === normalizeText(base.criterio));
        return {
          criterio: base.criterio,
          soporteValido: hit ? hit.soporteValido : base.hasSupport,
          puntajeSugerido: hit ? Math.max(0, toSafeNumber(hit.puntajeSugerido, 0)) : base.hasSupport ? base.puntaje : 0,
          comentario: hit?.comentario || (base.hasSupport ? 'Con soporte documental presentado.' : 'Sin soporte documental; puntaje sugerido en 0.'),
        };
      });

      setAiRows(mergedRows);
      setAiNarrative(parsed.narrativa || 'MetriX generó concepto técnico con ajuste de puntajes.');
      setMetriXChat((prev) => [
        ...prev,
        {
          id: `chat-assistant-${Date.now()}`,
          role: 'assistant',
          content: parsed.narrativa || 'MetriX actualizó la tabla IA con base en la conversación.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible procesar el chat con MetriX.';
      setMetriXChat((prev) => [
        ...prev,
        {
          id: `chat-assistant-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${message}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setMetriXLoading(false);
    }
  };

  const addManualRow = () => {
    setManualRows((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        section: 'Otros',
        criterio: 'NUEVO CRITERIO',
        detalle: '',
        cantidad: 1,
        valor: 0,
        puntaje: 0,
        soportado: false,
        comentario: '',
      },
    ]);
  };

  const updateManualRow = (id: string, patch: Partial<ManualRow>) => {
    setManualRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeManualRow = (id: string) => {
    setManualRows((prev) => prev.filter((row) => row.id !== id));
  };

  const versionRowsForSelected = useMemo(
    () => analysisVersions.filter((row) => row.trackingId === (selectedAnalysisRequest?.id || '')),
    [analysisVersions, selectedAnalysisRequest],
  );

  const aiTotalScore = useMemo(() => aiRows.reduce((acc, row) => acc + row.puntajeSugerido, 0), [aiRows]);
  const aiSuggestedCategory = useMemo(() => (aiRows.length > 0 ? getSuggestedCategoryByPoints(aiTotalScore) : null), [aiRows, aiTotalScore]);

  const currentRole = (getPortalSession()?.role || '').toLowerCase();

  useEffect(() => {
    if (!selectedAnalysisRequest) return;
    const refreshed = requests.find((row) => row.id === selectedAnalysisRequest.id);
    if (refreshed) setSelectedAnalysisRequest(refreshed);
  }, [requests, selectedAnalysisRequest]);

  const saveVersion = async (
    sourceType: 'MOTOR' | 'IA' | 'MANUAL_TH',
    rowsPayload: Array<Record<string, unknown>>,
    totalScore: number,
    suggestedCategory: string,
    narrative: string,
    notes: string,
  ) => {
    if (!selectedAnalysisRequest) return;

    try {
      setLoading(true);
      await runReducer('save_application_analysis_version', {
        trackingId: selectedAnalysisRequest.id,
        sourceType,
        rowsPayload: JSON.stringify(rowsPayload),
        totalScore,
        suggestedCategory,
        narrative,
        notes,
      });

      if (reloadRef.current) await reloadRef.current();
      window.alert(`Versión ${sourceType} guardada correctamente.`);
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : 'No fue posible guardar la versión.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMotorVersion = async () => {
    if (!selectedAnalysis) return;
    const rows = selectedAnalysis.rows.map((row) => ({
      section: row.section,
      criterion: row.criterio,
      detail: row.detalle,
      quantity: row.cantidad,
      value: row.valor,
      baseScore: row.puntaje,
      suggestedScore: row.puntaje,
      hasSupport: row.hasSupport,
      supportNote: row.supportNote,
      comment: 'Versión generada por motor de escalafón.',
    }));

    await saveVersion(
      'MOTOR',
      rows,
      selectedAnalysis.suggested.finalPts,
      selectedAnalysis.suggested.finalCat.name,
      'Versión base del motor de escalafón.',
      'Generada desde Talento Humano.',
    );
  };

  const handleSaveAiVersion = async () => {
    if (!selectedAnalysis || aiRows.length === 0) {
      window.alert('Genera primero la tabla IA antes de guardarla.');
      return;
    }

    const rows = selectedAnalysis.rows.map((row) => {
      const aiRow = aiRows.find((entry) => normalizeText(entry.criterio) === normalizeText(row.criterio));
      const suggestedScore = aiRow ? aiRow.puntajeSugerido : (row.hasSupport ? row.puntaje : 0);

      return {
        section: row.section,
        criterion: row.criterio,
        detail: row.detalle,
        quantity: row.cantidad,
        value: row.valor,
        baseScore: row.puntaje,
        suggestedScore,
        hasSupport: aiRow ? aiRow.soporteValido : row.hasSupport,
        supportNote: row.supportNote,
        comment: aiRow?.comentario || 'Ajuste IA sin comentario adicional.',
      };
    });

    const total = rows.reduce((acc, row) => acc + toSafeNumber(row.suggestedScore, 0), 0);
    const derivedCategory = getSuggestedCategoryByPoints(total) || selectedAnalysis.suggested.finalCat.name;

    await saveVersion(
      'IA',
      rows,
      total,
      derivedCategory,
      aiNarrative || 'Análisis IA sin narrativa adicional.',
      'Versión analizada por IA.',
    );
  };

  const handleSaveManualVersion = async () => {
    if (!selectedAnalysis || manualRows.length === 0) {
      window.alert('No hay filas manuales para guardar.');
      return;
    }

    const rows = manualRows.map((row) => ({
      section: row.section,
      criterion: row.criterio,
      detail: row.detalle,
      quantity: row.cantidad,
      value: row.valor,
      baseScore: row.puntaje,
      suggestedScore: row.soportado ? row.puntaje : Math.min(row.puntaje, 0),
      hasSupport: row.soportado,
      supportNote: row.soportado ? 'Validado por Talento Humano' : 'Sin soporte validado por Talento Humano',
      comment: row.comentario,
    }));

    const total = rows.reduce((acc, row) => acc + toSafeNumber(row.suggestedScore, 0), 0);

    await saveVersion(
      'MANUAL_TH',
      rows,
      total,
      selectedAnalysis.suggested.finalCat.name,
      manualNarrative,
      'Versión manual construida por Talento Humano.',
    );
  };

  const handleApproveVersion = async (versionId: string) => {
    if (currentRole !== 'cap') {
      window.alert('Solo el rol CAP puede aprobar una versión como oficial.');
      return;
    }

    try {
      setLoading(true);
      await runReducer('approve_application_analysis_version', {
        versionId,
        outputMessage: 'CAP aprobó tabla manual/IA como versión oficial del expediente.',
      });
      if (reloadRef.current) await reloadRef.current();
      window.alert('Versión aprobada como oficial para CAP.');
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : 'No fue posible aprobar la versión.');
    } finally {
      setLoading(false);
    }
  };

  if (view === 'nuevo') {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Puntos Académicos</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{liveScore.ptsAcad.toFixed(1)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Puntos Idioma</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{liveScore.ptsIdioma.toFixed(1)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Puntos Producción</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{liveScore.ptsPI.toFixed(1)}</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">Categoría / Total</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{liveScore.finalPts.toFixed(1)}</p>
            <p className="text-xs font-black uppercase text-blue-700">{liveScore.finalCat.name}</p>
          </div>
        </div>

        <NuevoView
          formData={formData}
          setFormData={setFormData}
          setView={(v) => setView(v as 'lista' | 'nuevo')}
          handleSave={handleSave}
          addTitulo={addTitulo}
          addIdioma={addIdioma}
          addExperiencia={addExperiencia}
          addProduccionManual={addProduccionManual}
          removeArrayItem={removeArrayItem}
          importScopusProduccion={importScopusProduccion}
          importOrcidProduccion={importOrcidProduccion}
          facultyOptions={facultyOptions}
          programOptions={programOptions}
          openConvocatorias={openConvocatorias}
          selectedConvocatoriaId={selectedConvocatoriaId}
          setSelectedConvocatoriaId={setSelectedConvocatoriaId}
        />

        {loading && <LoadingOverlay />}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Talento Humano</p>
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">
            {mode === 'metrix' ? 'Expedientes para Chat MetriX' : 'Perfiles de Profesor'}
          </h2>
        </div>
        {mode !== 'metrix' && (
          <button
            onClick={() => setView('nuevo')}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white hover:bg-indigo-700"
          >
            <FilePlus2 size={16} /> Crear Perfil
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-[0.14em] text-white">
            <tr>
              <th className="px-6 py-4 text-left">Tracking</th>
              <th className="px-6 py-4 text-left">Profesor</th>
              <th className="px-6 py-4 text-left">Facultad</th>
              <th className="px-6 py-4 text-center">Puntaje</th>
              <th className="px-6 py-4 text-center">Categoría</th>
              <th className="px-6 py-4 text-center">Estado</th>
              <th className="px-6 py-4 text-center">Análisis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm font-semibold text-slate-400">
                  No hay perfiles de profesor registrados.
                </td>
              </tr>
            )}
            {requests.map((request) => (
              <tr key={request.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-mono text-xs font-bold text-indigo-700">{request.id}</td>
                <td className="px-6 py-4 font-bold text-slate-900">{request.nombre}</td>
                <td className="px-6 py-4 text-xs font-semibold uppercase text-slate-600">{request.facultad}</td>
                <td className="px-6 py-4 text-center font-black text-slate-900">{request.finalPts.toFixed(1)}</td>
                <td className="px-6 py-4 text-center">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase text-blue-700">
                    {request.finalCat.name}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase text-amber-700">
                    {request.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => setSelectedAnalysisRequest(request)}
                    className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white hover:bg-indigo-700"
                  >
                    <Eye size={14} /> Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedAnalysisRequest && selectedAnalysis && (
        <AnalysisDetailView
          selectedAnalysisRequest={selectedAnalysisRequest}
          selectedAnalysis={selectedAnalysis}
          aiRows={aiRows}
          aiLoading={aiLoading}
          aiNarrative={aiNarrative}
          aiSuggestedCategory={aiSuggestedCategory}
          aiTotalScore={aiTotalScore}
          manualMode={manualMode}
          manualRows={manualRows}
          manualNarrative={manualNarrative}
          versionRowsForSelected={versionRowsForSelected}
          currentRole={currentRole}
          showMetriXChat={false}
          chatMessages={metriXChat}
          chatInput={metriXInput}
          chatLoading={metriXLoading}
          onClose={() => setSelectedAnalysisRequest(null)}
          onChatInputChange={setMetriXInput}
          onSendChatMessage={sendMetriXMessage}
          onClearChat={() => {
            setMetriXChat([]);
            setMetriXInput('');
          }}
          onRunAiSuggestion={runAiSuggestion}
          onSaveMotorVersion={handleSaveMotorVersion}
          onSaveAiVersion={handleSaveAiVersion}
          onToggleManualMode={() => setManualMode((prev) => !prev)}
          onAddManualRow={addManualRow}
          onUpdateManualRow={updateManualRow}
          onRemoveManualRow={removeManualRow}
          onSaveManualVersion={handleSaveManualVersion}
          onSetManualNarrative={setManualNarrative}
          onApproveVersion={handleApproveVersion}
          onViewVersion={setSelectedVersionDetail}
        />
      )}

      {loading && <LoadingOverlay />}

      <div className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-indigo-900">
        <FolderKanban size={16} />
        <p className="text-xs font-bold">
          Desde este módulo puedes crear perfiles de profesor y observar la puntuación de escalafón en tiempo real mientras cargas los datos.
        </p>
      </div>

      </div>

      {selectedVersionDetail ? (
        <VersionDetailModal version={selectedVersionDetail} onClose={() => setSelectedVersionDetail(null)} />
      ) : null}
    </>
  );
};

export default PerfilesModule;
