import React, { useEffect, useRef, useState } from 'react';

import { DbConnection } from '../module_bindings';
import type { AcademicProgram, Application, ApplicationAnalysisVersion, Faculty } from '../module_bindings/types';
import type { AppExperience, AppLanguage, AppPublication, AppTitle, FormState, RequestRecord } from '../types/domain';
import { CATEGORIES, emptyForm } from '../types/escalafon';
import { calculateAdvancedEscalafon } from '../utils/calculateEscalafon';
import { normativeToRagChunks } from '../utils/ragNormativeParser';
import { importScopusProduccion as importScopusProduccionFromApi } from '../services/scopus';
import { importOrcidProduccion as importOrcidProduccionFromApi } from '../services/orcid';
import { useSpacetime } from '../context/SpacetimeContext';
import { getPortalSession } from '../services/portalAuth';
import LoadingOverlay from '../components/LoadingOverlay';
import ListaView from '../components/ListaView';
import NuevoView from '../components/NuevoView';
import DetalleView from '../components/DetalleView';

interface Props {
}

type StoredRagDocument = {
  documentKey: string;
  fileName: string;
  fileType: string;
  active: boolean;
  contentBase64?: string;
};

type RankedRagChunk = {
  fileName: string;
  chunk: string;
  score: number;
};

type AiVersionSummary = {
  versionId: string;
  totalScore: number;
  suggestedCategory: string;
  versionStatus: string;
};

const normalizeForSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const normalizeAiProvider = (value?: string): 'gemini' | 'apifreellm' | 'openrouter' => {
  const normalized = normalizeForSearch(String(value || ''));
  if (normalized.includes('openrouter') || normalized.includes('router')) return 'openrouter';
  return normalized.includes('free') ? 'apifreellm' : 'gemini';
};

const resolveAiRuntime = (params: {
  provider?: string;
  model?: string;
  geminiKey?: string;
  apifreellmKey?: string;
  openrouterKey?: string;
}) => {
  const configuredProvider = normalizeAiProvider(params.provider);
  const geminiKey = String(params.geminiKey || '').trim();
  const apifreellmKey = String(params.apifreellmKey || '').trim();
  const openrouterKey = String(params.openrouterKey || '').trim();

  let provider: 'gemini' | 'apifreellm' | 'openrouter' = configuredProvider;
  let activeKey = provider === 'gemini' ? geminiKey : provider === 'openrouter' ? openrouterKey : apifreellmKey;

  if (!activeKey) {
    if (openrouterKey) {
      provider = 'openrouter';
      activeKey = openrouterKey;
    } else if (apifreellmKey) {
      provider = 'apifreellm';
      activeKey = apifreellmKey;
    } else if (geminiKey) {
      provider = 'gemini';
      activeKey = geminiKey;
    }
  }

  const requestedModel = String(params.model || '').trim();
  const model = provider === 'gemini'
    ? (requestedModel && !normalizeForSearch(requestedModel).includes('free') ? requestedModel : 'gemini-2.5-flash')
    : provider === 'openrouter'
      ? (requestedModel || 'google/gemma-3-27b-it:free,google/gemma-2-9b-it:free')
      : (requestedModel && normalizeForSearch(requestedModel).includes('free') ? requestedModel : 'apifreellm');

  return { provider, model, activeKey };
};

const requestOpenRouterText = async (model: string, apiKey: string, systemPrompt: string, userPrompt: string) => {
  const candidates = String(model || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const ordered = Array.from(new Set([
    ...candidates,
    'google/gemma-3-27b-it:free',
    'google/gemma-2-9b-it:free',
  ]));

  let lastError: Error | null = null;
  for (const candidate of ordered) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: candidate,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) return content.map((item: any) => String(item?.text || '')).join(' ');
      return '';
    }

    lastError = new Error(await res.text());
  }

  throw lastError || new Error('OpenRouter no respondiÃ³ con contenido vÃ¡lido.');
};

const normalizePublicationSource = (value?: string) => {
  const normalized = normalizeForSearch(String(value || ''));
  if (normalized.includes('scopus')) return 'SCOPUS' as const;
  if (normalized.includes('orcid')) return 'ORCID' as const;
  return 'MANUAL' as const;
};

const isIndexedPublicationSource = (value?: string) => {
  const source = normalizePublicationSource(value);
  return source === 'SCOPUS' || source === 'ORCID';
};

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

const ExpedientesPage = (_props: Props) => {
  const { connection, connected, globalDataReady } = useSpacetime();
  const getSubTablesForTrackingRef = useRef<((id: string) => { titles: AppTitle[]; languages: AppLanguage[]; publications: AppPublication[]; experiences: AppExperience[] }) | null>(null);
  const [view, setView] = useState('lista');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RequestRecord | null>(null);
  const [selectedTitles, setSelectedTitles] = useState<AppTitle[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<AppLanguage[]>([]);
  const [selectedPublications, setSelectedPublications] = useState<AppPublication[]>([]);
  const [selectedExperiences, setSelectedExperiences] = useState<AppExperience[]>([]);
  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [apifreellmApiKey, setApifreellmApiKey] = useState('');
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [scopusApiKey, setScopusApiKey] = useState('');
  const [orcidClientId, setOrcidClientId] = useState('');
  const [orcidClientSecret, setOrcidClientSecret] = useState('');
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiModel, setAiModel] = useState('gemini-2.5-flash');
  const [ragSystemContext, setRagSystemContext] = useState('');
  const [ragTopK, setRagTopK] = useState(5);
  const [ragChunkSize, setRagChunkSize] = useState(1200);
  const [ragChunkOverlap, setRagChunkOverlap] = useState(150);
  const [facultyOptions, setFacultyOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [programOptions, setProgramOptions] = useState<Array<{ id: string; facultyId: string; name: string; level: string }>>([]);
  const [openConvocatorias, setOpenConvocatorias] = useState<Array<{ id: string; codigo: string; nombre: string; periodo: string }>>([]);
  const [selectedConvocatoriaId, setSelectedConvocatoriaId] = useState('');
  const [aiVersionsByTracking, setAiVersionsByTracking] = useState<Record<string, AiVersionSummary>>({});
  useEffect(() => {
    if (!connection) return;

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
      const analysisVersionTable = dbView.applicationAnalysisVersion || dbView.application_analysis_version;
      const analysisVersionRows = analysisVersionTable ? (Array.from(analysisVersionTable.iter()) as ApplicationAnalysisVersion[]) : [];

      // Load audit data
      const auditTable = dbView.applicationAudit || dbView.application_audit;
      const auditRows = auditTable ? (Array.from(auditTable.iter()) as any[]) : [];
      const auditMap = new Map(auditRows.map((a) => [a.trackingId, a]));

      // Load API key and AI config
      const settingTable = dbView.systemSetting || dbView.system_setting;
      const openrouterTable = dbView.openrouterConfig || dbView.openrouter_config;
      const apiTable = dbView.apiConfig || dbView.api_config;
      if (apiTable) {
        const apiRows = Array.from(apiTable.iter()) as any[];
        const defaultCfg = apiRows.find((r) => r.configKey === 'default');
        if (defaultCfg?.geminiApiKey) setGeminiApiKey(defaultCfg.geminiApiKey);
        if (defaultCfg?.apifreellmApiKey) setApifreellmApiKey(defaultCfg.apifreellmApiKey);
        if (defaultCfg?.openrouterApiKey) setOpenrouterApiKey(defaultCfg.openrouterApiKey);
        if (defaultCfg?.scopusApiKey) setScopusApiKey(defaultCfg.scopusApiKey);
        if (defaultCfg?.orcidClientId) setOrcidClientId(defaultCfg.orcidClientId);
        if (defaultCfg?.orcidClientSecret) setOrcidClientSecret(defaultCfg.orcidClientSecret);
        if (defaultCfg?.aiProvider) setAiProvider(defaultCfg.aiProvider);
        if (defaultCfg?.aiModel) setAiModel(defaultCfg.aiModel);
      }

      if (settingTable) {
        const settingRows = Array.from(settingTable.iter()) as any[];
        const openrouterRow = settingRows.find((row) => row.key === 'cfg.openrouter.apiKey');
        if (openrouterRow?.value) setOpenrouterApiKey(String(openrouterRow.value));
      }

      if (openrouterTable) {
        const openrouterRows = Array.from(openrouterTable.iter()) as any[];
        const defaultOpenrouter = openrouterRows.find((row) => row.configKey === 'default');
        if (defaultOpenrouter?.apiKey) setOpenrouterApiKey(String(defaultOpenrouter.apiKey));
      }

      // Load RAG config
      const ragTable = dbView.ragConfig || dbView.rag_config;
      if (ragTable) {
        const ragRows = Array.from(ragTable.iter()) as any[];
        const ragCfg = ragRows.find((r) => r.configKey === 'default');
        if (ragCfg?.systemContext) setRagSystemContext(ragCfg.systemContext);
        if (ragCfg?.retrievalTopK) setRagTopK(Number(ragCfg.retrievalTopK));
        if (ragCfg?.chunkSize) setRagChunkSize(Number(ragCfg.chunkSize));
        if (ragCfg?.chunkOverlap !== undefined) setRagChunkOverlap(Number(ragCfg.chunkOverlap));
      } else {
        // Fallback: read RAG config from system_setting
        const settingTable = dbView.systemSetting || dbView.system_setting;
        if (settingTable) {
          const settingRows = Array.from(settingTable.iter()) as any[];
          const ragSetting = settingRows.find((r) => r.key === 'cfg.rag.config');
          if (ragSetting?.value) {
            try {
              const parsed = JSON.parse(ragSetting.value);
              if (parsed.systemContext) setRagSystemContext(parsed.systemContext);
              if (parsed.retrievalTopK) setRagTopK(Number(parsed.retrievalTopK));
              if (parsed.chunkSize) setRagChunkSize(Number(parsed.chunkSize));
              if (parsed.chunkOverlap !== undefined) setRagChunkOverlap(Number(parsed.chunkOverlap));
            } catch { /* ignore parse errors */ }
          }
        }
      }

      // Load user profiles to get campus
      const userProfileTable = dbView.userProfile || dbView.user_profile;
      const currentUser = getPortalSession();
      let currentUserCampus = 'BUCARAMANGA';
      let currentUserRole = '';
      if (userProfileTable && currentUser?.username) {
        const users = Array.from(userProfileTable.iter()) as any[];
        const match = users.find((u) => u.correo === currentUser.username || u.username === currentUser.username);
        if (match?.campus) currentUserCampus = match.campus.toUpperCase();
        if (match?.role) currentUserRole = match.role.toLowerCase();
      }

      let filteredAppRows = appRows;
      const isTalentoHumano = currentUserRole.includes('talento_humano') || currentUserRole.includes('talento humano');
      if (currentUserCampus !== 'BUCARAMANGA' && isTalentoHumano) {
         filteredAppRows = appRows.filter(row => row.campus?.toUpperCase() === currentUserCampus);
      }

      const mapped: RequestRecord[] = filteredAppRows
        .map((row) => {
          const category = CATEGORIES.find((c) => c.name.toLowerCase() === String(row.finalCategory || '').toLowerCase());
          const audit = auditMap.get(row.trackingId);
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
            audit: audit ? {
              currentStatus: audit.currentStatus,
              titleValidated: audit.titleValidated,
              experienceCertified: audit.experienceCertified,
              publicationVerified: audit.publicationVerified,
              languageValidated: audit.languageValidated,
              observations: audit.observations,
              reviewerUsername: audit.reviewerUsername ?? undefined,
            } : undefined,
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

      const latestIaByTracking = new Map<string, AiVersionSummary & { createdAtMs: number }>();
      for (const row of analysisVersionRows) {
        if (String(row.sourceType || '').toUpperCase() !== 'IA') continue;
        const createdAtMs = new Date(String(row.createdAt)).getTime() || 0;
        const prev = latestIaByTracking.get(row.trackingId);
        if (!prev || createdAtMs >= prev.createdAtMs) {
          latestIaByTracking.set(row.trackingId, {
            versionId: row.versionId,
            totalScore: Number(row.totalScore || 0),
            suggestedCategory: row.suggestedCategory || 'Sin categoría',
            versionStatus: row.versionStatus || 'REFERENCIA',
            createdAtMs,
          });
        }
      }

      const normalizedLatestIa = Array.from(latestIaByTracking.entries()).reduce<Record<string, AiVersionSummary>>((acc, [trackingId, item]) => {
        acc[trackingId] = {
          versionId: item.versionId,
          totalScore: item.totalScore,
          suggestedCategory: item.suggestedCategory,
          versionStatus: item.versionStatus,
        };
        return acc;
      }, {});
      setAiVersionsByTracking(normalizedLatestIa);
    };

    const getSubTablesForTracking = (trackingId: string): {
      titles: AppTitle[];
      languages: AppLanguage[];
      publications: AppPublication[];
      experiences: AppExperience[];
    } => {
      const dbView = connection.db as any;

      const tTable = dbView.applicationTitle || dbView.application_title;
      const lTable = dbView.applicationLanguage || dbView.application_language;
      const pTable = dbView.applicationPublication || dbView.application_publication;
      const eTable = dbView.applicationExperience || dbView.application_experience;

      const titleRows: AppTitle[] = tTable
        ? (Array.from(tTable.iter()) as AppTitle[]).filter((r) => r.trackingId === trackingId)
        : [];
      const langRows: AppLanguage[] = lTable
        ? (Array.from(lTable.iter()) as AppLanguage[]).filter((r) => r.trackingId === trackingId)
        : [];
      const pubRows: AppPublication[] = pTable
        ? (Array.from(pTable.iter()) as AppPublication[]).filter((r) => r.trackingId === trackingId)
        : [];
      const expRows: AppExperience[] = eTable
        ? (Array.from(eTable.iter()) as AppExperience[]).filter((r) => r.trackingId === trackingId)
        : [];

      return { titles: titleRows, languages: langRows, publications: pubRows, experiences: expRows };
    };

    getSubTablesForTrackingRef.current = getSubTablesForTracking;

    if (globalDataReady) {
      refreshFromCache();
    }

    return () => {
      // cleanup if needed
    };
  }, [connection, globalDataReady]);

  const runReducer = async (reducerName: string, args: object) => {
    if (!connection) throw new Error('Sin conexiÃ³n a SpacetimeDB.');

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
      window.alert('No hay conexiÃ³n a SpacetimeDB.');
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

    if (formData.titulos.length === 0 || formData.titulos.some((t) => !t.titulo.trim())) {
      window.alert('Agrega al menos un tÃ­tulo vÃ¡lido.');
      return;
    }

    if (formData.idiomas.length === 0 || formData.idiomas.some((i) => !i.idioma.trim())) {
      window.alert('Agrega al menos un idioma vÃ¡lido.');
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
        campus: formData.campus?.toUpperCase() || 'BUCARAMANGA',
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
          publicationType: p.tipo || 'ArtÃ­culo',
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

      window.alert('Expediente registrado correctamente.');
      setFormData(emptyForm);
      setView('lista');
    } catch (e) {
      console.error(e);
      window.alert('No fue posible registrar el expediente. Revisa consola para mÃ¡s detalle.');
    } finally {
      setLoading(false);
    }
  };

  const deleteRecord = async (id: string) => {
    window.alert(`La eliminaciÃ³n no estÃ¡ habilitada en Spacetime para ${id}.`);
  };

  const getActiveRagDocuments = (): StoredRagDocument[] => {
    if (!connection) return [];

    const dbView = connection.db as any;
    const ragDocumentTable = dbView.ragDocument || dbView.rag_document;
    const ragDocumentRows = ragDocumentTable ? (Array.from(ragDocumentTable.iter()) as any[]) : [];

    return ragDocumentRows
      .filter((row) => Boolean(row?.active ?? row?.is_active ?? true))
      .map((row) => ({
        documentKey: String(row.documentKey ?? row.document_key ?? row.fileName ?? row.file_name ?? 'rag-doc'),
        fileName: String(row.fileName ?? row.file_name ?? row.documentKey ?? row.document_key ?? 'documento-rag'),
        fileType: String(row.fileType ?? row.file_type ?? 'text/plain'),
        active: Boolean(row.active ?? row.is_active ?? true),
        contentBase64: typeof row.contentBase64 === 'string'
          ? row.contentBase64
          : typeof row.content_base64 === 'string'
            ? row.content_base64
            : undefined,
      }));
  };

  const buildRagContext = (req: RequestRecord, caseDetail: string) => {
    const queryTerms = Array.from(
      new Set(
        normalizeForSearch(
          [
            req.nombre,
            req.facultad,
            req.finalCat.name,
            caseDetail,
            selectedTitles.map((item) => item.titleLevel).join(' '),
            selectedLanguages.map((item) => item.languageLevel).join(' '),
            selectedPublications.map((item) => item.quartile).join(' '),
            selectedExperiences.map((item) => item.experienceType).join(' '),
          ].join(' '),
        )
          .split(/[^a-z0-9]+/)
          .filter((term) => term.length >= 4),
      ),
    );

    const rankedChunks: RankedRagChunk[] = [];
    const fallbackNormativeChunks: RankedRagChunk[] = [];
    const activeRagDocuments = getActiveRagDocuments();
    for (const document of activeRagDocuments) {
      const decoded = decodeBase64Document(document.contentBase64);
      if (!decoded) continue;
      const chunks = chunkText(decoded, ragChunkSize, ragChunkOverlap);
      for (const chunk of chunks) {
        const score = scoreRagChunk(chunk, queryTerms);
        if (score > 0) {
          rankedChunks.push({ fileName: document.fileName, chunk, score });
        }
      }
    }

    // Read normatives from rag_normative DB table; fall back to system_setting
    try {
      const dbView = connection?.db as any;
      const normTable = dbView?.rag_normative || dbView?.ragNormative;
      if (normTable) {
        const normRows = Array.from(normTable.iter()) as any[];
        for (const row of normRows) {
          if (!row || !(row.active ?? row.is_active ?? true)) continue;
          let jsonStr = '';
          const jsonRaw = row.jsonContent ?? row.json_content ?? row.content ?? row.json;
          if (typeof jsonRaw === 'string') {
            jsonStr = jsonRaw;
          } else if (jsonRaw && typeof jsonRaw === 'object') {
            jsonStr = JSON.stringify(jsonRaw);
          }
          try {
            const maybeString = JSON.parse(jsonStr);
            if (typeof maybeString === 'string') jsonStr = maybeString;
          } catch {
            // keep original string
          }
          const sourceName = String(
            row.title ?? row.normativeKey ?? row.normative_key ?? row.documentId ?? row.document_id ?? 'normativa',
          );
          const parsedNormChunks = normativeToRagChunks(jsonStr).filter(Boolean);
          const normChunks = parsedNormChunks.length > 0
            ? parsedNormChunks
            : chunkText(jsonStr, ragChunkSize, ragChunkOverlap);
          for (const chunk of normChunks) {
            const score = scoreRagChunk(chunk, queryTerms);
            if (score > 0) {
              rankedChunks.push({ fileName: sourceName, chunk, score });
            } else if (fallbackNormativeChunks.length < Math.max(6, ragTopK * 3)) {
              fallbackNormativeChunks.push({ fileName: sourceName, chunk, score: 0.5 });
            }
          }
        }
      } else {
        const settingTable = dbView?.system_setting || dbView?.systemSetting;
        if (settingTable) {
          const settingRows = Array.from(settingTable.iter()) as any[];
          const settingMap = new Map(settingRows.map((r) => [r.key, r.value]));
          const rawNorms = settingMap.get('cfg.rag.normatives');
          if (rawNorms) {
            const parsed = JSON.parse(String(rawNorms));
            if (Array.isArray(parsed)) {
              for (const norm of parsed) {
                if (!norm || !norm.active) continue;
                const text = typeof norm.content === 'string' ? norm.content : JSON.stringify(norm.content);
                const parsedNormChunks = normativeToRagChunks(text).filter(Boolean);
                const normChunks = parsedNormChunks.length > 0
                  ? parsedNormChunks
                  : chunkText(text, ragChunkSize, ragChunkOverlap);
                for (const chunk of normChunks) {
                  const score = scoreRagChunk(chunk, queryTerms);
                  if (score > 0) {
                    rankedChunks.push({ fileName: norm.title || norm.normativeKey || 'normativa', chunk, score });
                  } else if (fallbackNormativeChunks.length < Math.max(6, ragTopK * 3)) {
                    fallbackNormativeChunks.push({ fileName: norm.title || norm.normativeKey || 'normativa', chunk, score: 0.5 });
                  }
                }
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }

    const effectiveChunks = rankedChunks.length > 0 ? rankedChunks : fallbackNormativeChunks;

    const selectedChunks = effectiveChunks
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, ragTopK))
      .map((item, index) => `[Fuente ${index + 1}: ${item.fileName}]\n${item.chunk.slice(0, 1800)}`);

    return selectedChunks.length > 0
      ? selectedChunks.join('\n\n')
      : 'No se recuperaron fragmentos normativos desde RAG para este expediente.';
  };

  const generateAI = async (req: RequestRecord) => {
    const runtime = resolveAiRuntime({
      provider: aiProvider,
      model: aiModel,
      geminiKey: geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || '',
      apifreellmKey: apifreellmApiKey,
      openrouterKey: openrouterApiKey,
    });
    const provider = runtime.provider;
    const model = runtime.model;
    const activeKey = runtime.activeKey;
    if (!activeKey) {
      setAiAnalysis('No se encontrÃ³ API Key activa. ConfigÃºrala en ConfiguraciÃ³n > API (Gemini o APIFreeLLM).');
      return;
    }
    setAiGenerating(true);
    try {
      const titulosTxt = selectedTitles.length > 0
        ? selectedTitles.map((t) => `${t.titleName} (${t.titleLevel})`).join(', ')
        : 'Sin títulos registrados';
      const idiomasTxt = selectedLanguages.length > 0
        ? selectedLanguages.map((l) => `${l.languageName} nivel ${l.languageLevel}${l.convalidation ? ' (convalidado)' : ''}`).join(', ')
        : 'Sin idiomas registrados';
      const pubsTxt = selectedPublications.length > 0
        ? selectedPublications.map((p) => `"${p.publicationTitle}" (${p.quartile}, ${p.publicationType}, ${p.publicationYear}, ${p.authorsCount} autor(es), fuente: ${p.sourceKind})`).join('; ')
        : 'Sin publicaciones registradas';
      const expTxt = selectedExperiences.length > 0
        ? selectedExperiences.map((e) => `${e.experienceType}: ${e.startedAt} a ${e.endedAt || 'Presente'}${e.certified ? ' (certificado)' : ''}`).join('; ')
        : 'Sin experiencia registrada';

      const indexedSelectedPublications = selectedPublications.filter((item) => isIndexedPublicationSource(item.sourceKind));
      const manualSelectedPublications = selectedPublications.filter((item) => !isIndexedPublicationSource(item.sourceKind));

      const provisionalBreakdown = calculateAdvancedEscalafon({
        nombre: req.nombre,
        documento: req.documento,
        programa: '',
        facultad: req.facultad,
        scopusProfile: '',
        esIngresoNuevo: req.esIngresoNuevo,
        isAccreditedSource: false,
        yearsInCategory: 0,
        hasTrabajoAprobadoCEPI: false,
        orcid: '',
        titulos: selectedTitles.map((t) => ({
          titulo: t.titleName,
          nivel: t.titleLevel as 'Pregrado' | 'Especialización' | 'Maestría' | 'Doctorado',
        })),
        idiomas: selectedLanguages.map((l) => ({
          idioma: l.languageName,
          nivel: l.languageLevel as 'A2' | 'B1' | 'B2' | 'C1',
          convalidacion: l.convalidation ? 'SI' as const : 'NO' as const,
        })),
        produccion: indexedSelectedPublications.map((p) => ({
          titulo: p.publicationTitle,
          cuartil: p.quartile as 'Q1' | 'Q2' | 'Q3' | 'Q4',
          fecha: p.publicationYear,
          tipo: p.publicationType,
          autores: p.authorsCount,
          fuente: normalizePublicationSource(p.sourceKind),
        })),
        experiencia: selectedExperiences.map((e) => ({
          tipo: e.experienceType as 'Profesional' | 'Docencia Universitaria' | 'Investigación' | 'Colciencias Senior' | 'Colciencias Junior' as any,
          inicio: e.startedAt,
          fin: e.endedAt,
          certificacion: e.certified ? 'SI' as const : 'NO' as const,
        })),
        campus: (req as any).campus || 'VALLEDUPAR',
      });

      const workflowSummary = [
        `Académico: ${provisionalBreakdown.ptsAcad.toFixed(1)} pts posibles · ${req.audit?.titleValidated ? 'Conforme por auxiliar' : 'Pendiente validación del auxiliar'}`,
        `Idiomas: ${provisionalBreakdown.ptsIdioma.toFixed(1)} pts posibles · ${req.audit?.languageValidated ? 'Conforme por auxiliar' : 'Pendiente validación del auxiliar'}`,
        `Producción: ${provisionalBreakdown.ptsPI.toFixed(1)} pts posibles · ${req.audit?.publicationVerified ? 'Verificada por auxiliar' : 'Pendiente verificación del auxiliar'}`,
        `Experiencia: ${Math.min(provisionalBreakdown.ptsExpBruta, provisionalBreakdown.appliedTope).toFixed(1)} pts posibles · ${req.audit?.experienceCertified ? 'Certificada por auxiliar' : 'Pendiente certificación del auxiliar'}`,
        `Resultado preliminar por soportes: ${provisionalBreakdown.finalPts.toFixed(1)} pts Â· categoría posible ${provisionalBreakdown.finalCat.name}`,
      ].join('\n');

      const caseDetail = [
        `Docente: ${req.nombre}`,
        `Documento: ${req.documento}`,
        `Facultad: ${req.facultad}`,
        `Estado del expediente: ${req.status}`,
        `Puntaje final oficial del expediente: ${req.finalPts.toFixed(1)}`,
        `categoría oficial asignada: ${req.finalCat.name}`,
        `Mensaje oficial del motor: ${req.outputMessage}`,
        `validación de títulos: ${req.audit?.titleValidated ? 'SÃ­' : 'No'}`,
        `validación de idiomas: ${req.audit?.languageValidated ? 'SÃ­' : 'No'}`,
        `validación de publicaciones: ${req.audit?.publicationVerified ? 'SÃ­' : 'No'}`,
        `certificación de experiencia: ${req.audit?.experienceCertified ? 'SÃ­' : 'No'}`,
        `Observaciones de auditorÃ­a: ${req.audit?.observations || 'Sin observaciones registradas'}`,
        `\nLECTURA PRELIMINAR POR SOPORTES Y WORKFLOW:\n${workflowSummary}`,
        `\nTÃTULOS ACADÃ‰MICOS: ${titulosTxt}`,
        `IDIOMAS: ${idiomasTxt}`,
        `PRODUCCIÃ“N INTELECTUAL: ${pubsTxt}`,
        `EXPERIENCIA: ${expTxt}`,
      ].join('\n');

      const ragContext = buildRagContext(req, caseDetail);

      const iaRowsPayload = [
        {
          section: 'Académico',
          criterion: 'Puntaje Académico preliminar',
          suggestedScore: provisionalBreakdown.ptsAcad,
          hasSupport: selectedTitles.length > 0,
          comment: selectedTitles.length > 0 ? 'Derivado de tÃ­tulos cargados.' : 'Sin tÃ­tulos cargados.',
        },
        {
          section: 'Idiomas',
          criterion: 'Puntaje de idiomas preliminar',
          suggestedScore: provisionalBreakdown.ptsIdioma,
          hasSupport: selectedLanguages.length > 0,
          comment: selectedLanguages.length > 0 ? 'Derivado de idiomas cargados.' : 'Sin idiomas cargados.',
        },
        {
          section: 'Producción',
          criterion: 'Puntaje de Producción preliminar',
          suggestedScore: provisionalBreakdown.ptsPI,
          hasSupport: indexedSelectedPublications.length > 0,
          comment:
            indexedSelectedPublications.length === 0
              ? 'Sin soporte: publicaciones manuales o sin fuente indexada.'
              : manualSelectedPublications.length === 0
                ? 'Derivado de publicaciones indexadas (SCOPUS/ORCID).'
                : `Derivado parcialmente de publicaciones indexadas (${indexedSelectedPublications.length}) y manuales (${manualSelectedPublications.length}).`,
        },
        {
          section: 'Experiencia',
          criterion: 'Puntaje de experiencia preliminar',
          suggestedScore: Math.min(provisionalBreakdown.ptsExpBruta, provisionalBreakdown.appliedTope),
          hasSupport: selectedExperiences.length > 0,
          comment: selectedExperiences.length > 0 ? 'Derivado de experiencia cargada.' : 'Sin experiencia cargada.',
        },
      ];

      const baseSystemPrompt = `Eres un auditor jurÃ­dico-Académico senior del ComitÃ© de AsignaciÃ³n de Puntaje (CAP) de la Universidad de Santander (UDES). Debes emitir un informe extenso, formalista, explicativo y profesional, con redAcción narrativa y criterio tÃ©cnico.

ActÃºa simultÃ¡neamente desde cuatro planos:
1. Como abogada de Talento Humano: analiza cumplimiento normativo, suficiencia documental, riesgos jurÃ­dicos y cargas probatorias.
2. Como Coordinadora de Talento Humano: analiza viabilidad administrativa, brechas del expediente, acciones de subsanaciÃ³n y riesgo operativo.
3. Como ComitÃ© de AprobaciÃ³n: analiza mÃ©rito Académico, consistencia del puntaje, pertinencia de la categoría y condiciones para aprobar, devolver o requerir ajustes.
4. Como auditor IA independiente: identifica coincidencias entre las tres perspectivas y emite una recomendaciÃ³n propia, motivada y prudente.

Debes usar prioritariamente el contexto RAG suministrado. Cita expresamente las fuentes normativas recuperadas en el cuerpo del informe usando el formato "Fuente RAG X" o el nombre del documento. No inventes artÃ­culos ni normas. Si una regla no aparece en el contexto RAG, dilo de forma expresa.

El informe debe contener estas secciones, con desarrollo en pÃ¡rrafos completos y no solo listas:

## 1. Resumen ejecutivo del expediente
Presenta el perfil del docente, la categoría resultante, el puntaje observado y la tesis central del informe.

## 2. Perspectiva de la Abogada de Talento Humano
Analiza requisitos, soportes, cumplimiento normativo, riesgos de contradicciÃ³n, vacÃ­os probatorios y consecuencias jurÃ­dicas.

## 3. Perspectiva de la Coordinadora de Talento Humano
Explica la lectura administrativa del caso, suficiencia del expediente para trÃ¡mite, alertas de gestiÃ³n y plan de subsanaciÃ³n o cierre.

## 4. Perspectiva del ComitÃ© de AprobaciÃ³n
Explica por quÃ© el puntaje y la categoría lucen consistentes o inconsistentes con la evidencia aportada, y si procede aprobaciÃ³n, condicionamiento o devoluciÃ³n.

## 5. Coincidencias crÃ­ticas entre las tres perspectivas
Sintetiza los puntos comunes y los desacuerdos relevantes.

## 6. RecomendaciÃ³n propia del auditor IA
Emite una recomendaciÃ³n final autÃ³noma, argumentada y prudente. Debe indicar si recomiendas aprobar, aprobar con condicionamientos, requerir subsanaciÃ³n o no aprobar.

## 7. Trazabilidad razonada del puntaje
Explica de manera narrativa por quÃ© el expediente alcanza o no el puntaje final oficial informado. Debes diferenciar explÃ­citamente entre el puntaje oficial del expediente y la posible calificaciÃ³n preliminar derivada de los soportes cargados y del estado del workflow. Relaciona tÃ­tulos, idiomas, Producción y experiencia con el resultado final, y aclara los lÃ­mites, topes o faltantes cuando corresponda.

## 8. Sustento normativo citado
Lista las normas y fragmentos RAG realmente usados, con citas breves y su relevancia para la decisiÃ³n.

Reglas de salida:
- Responde en espaÃ±ol jurÃ­dico-administrativo claro.
- SÃ© detallado, explicativo y formalista.
- Usa encabezados Markdown.
- Evita respuestas cortas o genÃ©ricas.
- Si la evidencia es insuficiente, dilo y explica quÃ© soporte falta.
- Diferencia siempre entre "puntaje oficial del expediente" y "posible calificaciÃ³n por soportes".
- No trates como definitivo un componente que siga pendiente de validación auxiliar.
- Nunca digas que usaste un RAG si no vas a citar el contexto efectivamente entregado.`;

      const systemPrompt = ragSystemContext
        ? `${ragSystemContext}\n\n${baseSystemPrompt}`
        : baseSystemPrompt;

      const userMessage = `Genera un informe auditor integral del siguiente expediente docente UDES. Debes explicar el porquÃ© del puntaje, la categoría y los riesgos del caso con base en el expediente y en el contexto normativo recuperado.\n\n### Expediente\n${caseDetail}\n\n### Contexto normativo RAG recuperado\n${ragContext}\n\n### InstrucciÃ³n adicional\nSi el contexto RAG no basta para afirmar un requisito, indÃ­calo expresamente. No simplifiques el análisis. Produce un informe profesional, extenso y bien motivado.`;

      let aiText = '';

      if (provider === 'gemini') {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: userMessage }] }],
              systemInstruction: { parts: [{ text: systemPrompt }] },
            }),
          },
        );
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || `Gemini respondiÃ³ ${res.status}`);
        }
        const data = await res.json();
        aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else if (provider === 'openrouter') {
        aiText = await requestOpenRouterText(model, activeKey, systemPrompt, userMessage);
      } else {
        // APIFreeLLM is proxied through Vite in local development to avoid browser CORS issues.
        const res = await fetch('/api/apifreellm/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeKey}`,
          },
          body: JSON.stringify({
            message: `${systemPrompt}\n\n${userMessage}`,
            model: model || 'apifreellm',
          }),
        });
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || `APIFreeLLM respondiÃ³ ${res.status}`);
        }
        const data = await res.json();
        aiText = data.response || data.message || data.content || data.text || '';
      }

      setAiAnalysis(aiText || 'No se pudo generar dictamen.');

      if (aiText) {
        try {
          await runReducer('save_application_analysis_version', {
            trackingId: req.id,
            sourceType: 'IA',
            rowsPayload: JSON.stringify(iaRowsPayload),
            totalScore: provisionalBreakdown.finalPts,
            suggestedCategory: provisionalBreakdown.finalCat.name,
            narrative: aiText,
            notes: 'VersiÃ³n IA generada automáticamente desde Expedientes.',
          });
        } catch (saveError) {
          console.error(saveError);
          window.alert('Se generó el dictamen IA, pero no se pudo registrar la versiÃ³n en la tabla de análisis.');
        }
      }
    } catch (error) {
      setAiAnalysis(error instanceof Error ? `Error en dictamen: ${error.message}` : 'Error en dictamen.');
    } finally {
      setAiGenerating(false);
    }
  };

  const addTitulo = () =>
    setFormData((p) => ({ ...p, titulos: [...p.titulos, { titulo: '', nivel: 'Pregrado', supportName: '', supportPath: '' }] }));

  const addIdioma = () =>
    setFormData((p) => ({ ...p, idiomas: [...p.idiomas, { idioma: '', nivel: 'A2', convalidacion: 'NO', supportName: '', supportPath: '' }] }));

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
        { titulo: '', cuartil: 'Q4', fecha: new Date().getFullYear().toString(), tipo: 'ArtÃ­culo', autores: 1, fuente: 'MANUAL' },
      ],
    }));

  const removeArrayItem = (key: 'titulos' | 'idiomas' | 'produccion' | 'experiencia', index: number) =>
    setFormData((p) => ({ ...p, [key]: p[key].filter((_, i) => i !== index) } as FormState));

  const handleSelectRequest = (req: RequestRecord) => {
    setSelectedRequest(req);
    setAiAnalysis('');
    if (getSubTablesForTrackingRef.current) {
      const { titles, languages, publications, experiences } = getSubTablesForTrackingRef.current(req.id);
      setSelectedTitles(titles);
      setSelectedLanguages(languages);
      setSelectedPublications(publications);
      setSelectedExperiences(experiences);
    }
  };

  const handleWorkflowAction = async (req: RequestRecord, action: 'valorar' | 'calificar' | 'seguimiento' | 'validar') => {
    if (!connected) {
      window.alert('Sin conexiÃ³n a SpacetimeDB.');
      return;
    }
    const session = getPortalSession();
    const statusMap: Record<string, string> = {
      valorar: 'EN_VALORACION',
      calificar: 'EN_CALIFICACION',
      seguimiento: 'EN_SEGUIMIENTO',
      validar: 'EN_VALIDACION',
    };
    try {
      setLoading(true);
      await runReducer('update_application_status', {
        trackingId: req.id,
        status: statusMap[action],
        outputMessage: req.outputMessage || '',
      });
      await runReducer('record_application_audit', {
        trackingId: req.id,
        currentStatus: statusMap[action],
        titleValidated: req.audit?.titleValidated || false,
        experienceCertified: req.audit?.experienceCertified || false,
        publicationVerified: req.audit?.publicationVerified || false,
        languageValidated: req.audit?.languageValidated || false,
        observations: `Acción: ${action} por ${session?.username || 'sistema'}`,
      });
    } catch (e) {
      console.error(e);
      window.alert('Error al actualizar el estado del expediente.');
    } finally {
      setLoading(false);
    }
  };

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
        window.alert('SCOPUS no devolviÃ³ publicaciones para ese perfil.');
        return;
      }

      setFormData((p) => ({ ...p, produccion: [...p.produccion, ...imported] }));
    } catch (err) {
      console.error(err);
      window.alert(err instanceof Error ? err.message : 'Error al importar Producción desde SCOPUS.');
    } finally {
      setLoading(false);
    }
  };

  const importOrcidProduccion = async () => {
    if (!formData.scopusProfile.trim()) {
      window.alert('Ingresa un ORCID para consultar Producción.');
      return;
    }

    setLoading(true);
    try {
      void orcidClientId;
      void orcidClientSecret;
      const imported = await importOrcidProduccionFromApi(formData.scopusProfile, 20);
      if (imported.length === 0) {
        window.alert('ORCID no devolviÃ³ publicaciones para ese perfil.');
        return;
      }
      setFormData((p) => ({ ...p, produccion: [...p.produccion, ...imported] }));
    } catch (err) {
      console.error(err);
      window.alert(err instanceof Error ? err.message : 'Error al consultar Producción en ORCID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-12">
        {view === 'lista' && (
          <ListaView
            requests={requests}
            setView={setView}
            setSelectedRequest={handleSelectRequest}
            deleteRecord={deleteRecord}
            onWorkflowAction={handleWorkflowAction}
          />
        )}
        {view === 'nuevo' && (
          <NuevoView
            formData={formData}
            setFormData={setFormData}
            setView={setView}
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
        )}
        {view === 'detalle' && selectedRequest && (
          <DetalleView
            selectedRequest={selectedRequest}
            titles={selectedTitles}
            languages={selectedLanguages}
            publications={selectedPublications}
            experiences={selectedExperiences}
            setView={setView}
            generateAI={generateAI}
            aiAnalysis={aiAnalysis}
            aiGenerating={aiGenerating}
            latestAiVersion={aiVersionsByTracking[selectedRequest.id]}
          />
        )}
      </div>

      {loading && <LoadingOverlay />}
    </>
  );
};

export default ExpedientesPage;
