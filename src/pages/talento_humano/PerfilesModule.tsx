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
import { normativeToRagChunks } from '../../utils/ragNormativeParser';
import { importScopusProduccion as importScopusProduccionFromApi } from '../../services/scopus';
import { importOrcidProduccion as importOrcidProduccionFromApi } from '../../services/orcid';
import { getPortalCredentialsForRole, getPortalSession } from '../../services/portalAuth';
import { getSpacetimeConnectionConfig } from '../../services/spacetime';
import { AnalysisDetailView } from './perfiles/AnalysisDetailView';
import { openMeritxReportWindow, renderMeritxReportError, renderMeritxReportWindow } from './perfiles/meritxReportWindow';
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
import type {
  AnalysisVersionRecord,
  AiCriterionRow,
  ArrayKey,
  ChatMessage,
  ManualRow,
  MatrixRow,
  SelectedExperienceDetail,
  SelectedPublicationDetail,
  SelectedTitleDetail,
} from './perfiles/types';

const clamp = (value: number) => (Number.isFinite(value) ? value : 0);

const normalizePublicationSource = (value?: string) => {
  const normalized = normalizeText(value || '');
  if (normalized.includes('scopus')) return 'SCOPUS' as const;
  if (normalized.includes('orcid')) return 'ORCID' as const;
  return 'MANUAL' as const;
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  // Spacetime option values may arrive as tagged tuples: [0, value] | [1, {}]
  if (Array.isArray(value) && value.length >= 2 && typeof value[0] === 'number') {
    if (value[0] === 0 && typeof value[1] === 'string') {
      const trimmed = value[1].trim();
      return trimmed || undefined;
    }
    return undefined;
  }

  return undefined;
};

const isIndexedPublicationSource = (value?: string) => {
  const source = normalizePublicationSource(value);
  return source === 'SCOPUS' || source === 'ORCID';
};

type StoredRagDocument = {
  documentKey: string;
  fileName: string;
  fileType: string;
  active: boolean;
  contentBase64?: string;
  storagePath?: string;
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

const OPENROUTER_DEFAULT_MODELS = ['google/gemma-3-27b-it:free', 'google/gemma-2-9b-it:free'];
const OPENROUTER_BLOCKED_MODELS = ['meta-llama/llama-3.3-8b-instruct:free'];

const sanitizeOpenRouterModelList = (value?: string) => {
  const blocked = OPENROUTER_BLOCKED_MODELS.map((item) => normalizeForSearch(item));
  const cleaned = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !blocked.includes(normalizeForSearch(item)));

  return Array.from(new Set([...cleaned, ...OPENROUTER_DEFAULT_MODELS])).join(',');
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
    } else {
      // Last-resort: always check the env key regardless of configured provider
      const envKey = String(import.meta.env.VITE_GEMINI_API_KEY || '').trim();
      if (envKey) {
        provider = 'gemini';
        activeKey = envKey;
      }
    }
  }

  const requestedModel = String(params.model || '').trim();
  const model = provider === 'gemini'
    ? (requestedModel && !normalizeForSearch(requestedModel).includes('free') ? requestedModel : 'gemini-2.5-flash')
    : provider === 'openrouter'
      ? sanitizeOpenRouterModelList(requestedModel)
      : (requestedModel && normalizeForSearch(requestedModel).includes('free') ? requestedModel : 'apifreellm');

  return { provider, model, activeKey };
};

const compactText = (value: string) =>
  value
    .replace(/[^\x20-\x7E\u00A0-\u024F\n\r\t]/g, ' ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const sanitizeNarrativeText = (value: unknown) =>
  String(value || '')
    .replace(/\*\*/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const extractFirstJsonObject = (text: string) => {
  const source = String(text || '');
  const start = source.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }

  return null;
};

const parseAiJsonObjectLoose = (raw: string) => {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  const extracted = extractFirstJsonObject(cleaned);
  const candidates = [extracted, cleaned]
    .filter((item): item is string => Boolean(item && item.trim().length > 0));

  for (const candidate of candidates) {
    // Attempt 1: direct parse
    try { return JSON.parse(candidate); } catch { /* continue */ }

    // Attempt 2: fix curly quotes and trailing commas
    try {
      const sanitized = candidate
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(sanitized);
    } catch { /* continue */ }

    // Attempt 3: escape unescaped newlines inside string values
    try {
      const fixedNewlines = candidate
        .replace(/([^\\])\n/g, '$1\\n')
        .replace(/([^\\])\r/g, '$1\\r');
      return JSON.parse(fixedNewlines);
    } catch { /* continue */ }
  }

  // Attempt 4: manual field extraction fallback — covers cases where the AI
  // wraps long text with unescaped newlines or double-quotes inside JSON strings
  const fields = ['analisisMatriz', 'analisisMotor', 'analisisOficial', 'analisisNormativo', 'conclusionIntermedia', 'puntajeIntermedio', 'narrativa', 'rows'];
  const result: Record<string, unknown> = {};
  let anyExtracted = false;

  for (const field of fields) {
    // Match "field": "...value..." allowing for newlines inside the value
    const regex = new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"(?=\\s*[,}])`);
    const match = cleaned.match(regex);
    if (match) {
      result[field] = match[1].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
      anyExtracted = true;
    }
    // Also try numeric fields
    const numRegex = new RegExp(`"${field}"\\s*:\\s*([\\d.]+)`);
    const numMatch = cleaned.match(numRegex);
    if (numMatch && !match) {
      result[field] = parseFloat(numMatch[1]);
      anyExtracted = true;
    }
  }

  return anyExtracted ? result : null;
};

const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const waitMs = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const requestGeminiText = async (params: {
  model: string;
  apiKey: string;
  userPrompt: string;
  systemPrompt?: string;
  maxRetries?: number;
}) => {
  const { model, apiKey, userPrompt, systemPrompt, maxRetries = 3 } = params;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    const bodyText = await res.text();
    lastError = new Error(`Gemini HTTP ${res.status}: ${bodyText}`);

    if (RETRYABLE_HTTP_STATUS.has(res.status) && attempt < maxRetries) {
      await waitMs(500 * attempt);
      continue;
    }

    throw lastError;
  }

  throw lastError || new Error('Gemini no respondió con contenido válido.');
};

const requestApifreellmText = async (params: {
  model: string;
  apiKey: string;
  message: string;
}) => {
  const { model, apiKey, message } = params;
  const res = await fetch('/api/apifreellm/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      message,
      model: model || 'apifreellm',
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.response || data.message || data.content || data.text || '';
};

const getOpenRouterAvailableFreeModels = async (apiKey: string) => {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!res.ok) return [] as string[];

    const data = await res.json();
    const allIds = Array.isArray(data?.data)
      ? data.data
        .map((item: any) => String(item?.id || '').trim())
        .filter(Boolean)
      : [];

    const preferredFree = allIds.filter((id: string) => {
      const normalized = normalizeForSearch(id);
      if (!normalized.includes('free')) return false;
      return (
        normalized.includes('gemma') ||
        normalized.includes('llama') ||
        normalized.includes('qwen') ||
        normalized.includes('mistral')
      );
    });

    return preferredFree.slice(0, 8);
  } catch {
    return [] as string[];
  }
};

const requestOpenRouterText = async (params: {
  model: string;
  apiKey: string;
  userPrompt: string;
  systemPrompt?: string;
}) => {
  const { model, apiKey, userPrompt, systemPrompt } = params;
  const modelCandidates = String(model || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const defaultCandidates = ['google/gemma-3-27b-it:free', 'google/gemma-2-9b-it:free'];
  const orderedModels = Array.from(new Set([
    ...modelCandidates,
    ...defaultCandidates,
  ]));

  const tryCandidate = async (candidate: string) => {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: candidate,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        return content.map((item: any) => String(item?.text || '')).join(' ').trim();
      }
      return '';
    }

    const bodyText = await res.text();
    throw new Error(`OpenRouter HTTP ${res.status}: ${bodyText}`);
  };

  let lastError: Error | null = null;
  for (const candidate of orderedModels) {
    try {
      return await tryCandidate(candidate);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  const discoveredCandidates = await getOpenRouterAvailableFreeModels(apiKey);
  const retryCandidates = discoveredCandidates.filter((candidate: string) => !orderedModels.includes(candidate));
  for (const candidate of retryCandidates) {
    try {
      return await tryCandidate(candidate);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('OpenRouter no respondió con contenido válido.');
};

const requestAiTextWithFallback = async (params: {
  runtime: { provider: 'gemini' | 'apifreellm' | 'openrouter'; model: string; activeKey: string };
  userPrompt: string;
  systemPrompt?: string;
  fallbackApifreellmKey?: string;
  fallbackGeminiKey?: string;
}) => {
  const { runtime, userPrompt, systemPrompt, fallbackApifreellmKey, fallbackGeminiKey } = params;

  if (runtime.provider === 'openrouter') {
    try {
      return await requestOpenRouterText({
        model: runtime.model,
        apiKey: runtime.activeKey,
        userPrompt,
        systemPrompt,
      });
    } catch (openrouterError) {
      const fallbackKey = String(fallbackApifreellmKey || '').trim();
      if (!fallbackKey) throw openrouterError;

      console.warn('[AI][Perfiles] OpenRouter no disponible, usando fallback APIFreeLLM.', openrouterError);
      return requestApifreellmText({
        model: 'apifreellm',
        apiKey: fallbackKey,
        message: systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt,
      });
    }
  }

  if (runtime.provider === 'gemini') {
    try {
      return await requestGeminiText({
        model: runtime.model,
        apiKey: runtime.activeKey,
        userPrompt,
        systemPrompt,
        maxRetries: 3,
      });
    } catch (geminiError) {
      const fallbackKey = String(fallbackApifreellmKey || '').trim();
      if (!fallbackKey) throw geminiError;

      console.warn('[AI][Perfiles] Gemini no disponible, usando fallback APIFreeLLM.', geminiError);
      return requestApifreellmText({
        model: 'apifreellm',
        apiKey: fallbackKey,
        message: systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt,
      });
    }
  }

  try {
    return await requestApifreellmText({
      model: runtime.model || 'apifreellm',
      apiKey: runtime.activeKey,
      message: systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt,
    });
  } catch (apifreeError) {
    const fallbackGemini = String(fallbackGeminiKey || '').trim();
    if (!fallbackGemini) throw apifreeError;
    console.warn('[AI][Perfiles] APIFreeLLM no disponible, usando fallback Gemini.', apifreeError);
    return requestGeminiText({
      model: 'gemini-2.5-flash',
      apiKey: fallbackGemini,
      userPrompt,
      systemPrompt,
      maxRetries: 2,
    });
  }
};

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
  const [connectionWarning, setConnectionWarning] = useState('');

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
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiModel, setAiModel] = useState('gemini-2.5-flash');
  const [ragSystemContext, setRagSystemContext] = useState('');
  const [ragTopK, setRagTopK] = useState(5);
  const [ragChunkSize, setRagChunkSize] = useState(1200);
  const [ragChunkOverlap, setRagChunkOverlap] = useState(150);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiNarrative, setAiNarrative] = useState('');
  const [aiRows, setAiRows] = useState<AiCriterionRow[]>([]);
  const [meritxNarrativeLoading, setMeritxNarrativeLoading] = useState(false);
  const [ragDiagnostics, setRagDiagnostics] = useState<{
    generatedAt: string;
    queryTerms: number;
    activeDocs: number;
    detectedNormatives: number;
    activeNormatives: number;
    docChunks: number;
    normativeChunks: number;
    rankedMatches: number;
    fallbackCandidates: number;
    selectedChunks: number;
    usedFallback: boolean;
    forcedProtocolDetected: boolean;
    forcedProtocolIncluded: boolean;
    sources: string[];
  } | null>(null);
  const [meritxNarrative, setMeritxNarrative] = useState<{
    analisisMatriz: string;
    analisisMotor: string;
    analisisOficial: string;
    analisisNormativo: string;
    conclusionIntermedia: string;
    puntajeIntermedio: number;
  } | null>(null);
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
    setConnectionWarning('');

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

    let onReadyResolve: (() => void) | null = null;
    let onReadyReject: ((error: unknown) => void) | null = null;
    const connectionReady = new Promise<void>((resolve, reject) => {
      onReadyResolve = resolve;
      onReadyReject = reject;
    });

    const connection = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(databaseName)
      .onConnect((conn: DbConnection) => {
        
        ensurePortalSession(conn)
          .catch((e) => {
            console.warn('Portal session en PerfilesModule:', e);
          })
          .finally(() => {
            onReadyResolve?.();
          });
      })
      .onConnectError((_ctx: unknown, err: unknown) => {
        console.error('PerfilesModule connect error:', err);
        
        onReadyReject?.(err);
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
      const settingTable = dbView.systemSetting || dbView.system_setting;
      const openrouterTable = dbView.openrouterConfig || dbView.openrouter_config;

      const apiTable = dbView.apiConfig || dbView.api_config;
      if (apiTable) {
        const apiRows = Array.from(apiTable.iter()) as any[];
        const defaultCfg = apiRows.find((r) => r.configKey === 'default');
        if (defaultCfg?.scopusApiKey) setScopusApiKey(defaultCfg.scopusApiKey);
        if (defaultCfg?.orcidClientId) setOrcidClientId(defaultCfg.orcidClientId);
        if (defaultCfg?.orcidClientSecret) setOrcidClientSecret(defaultCfg.orcidClientSecret);
        if (defaultCfg?.geminiApiKey) setGeminiApiKey(defaultCfg.geminiApiKey);
        if (defaultCfg?.apifreellmApiKey) setApifreellmApiKey(defaultCfg.apifreellmApiKey);
        if (defaultCfg?.openrouterApiKey) setOpenrouterApiKey(defaultCfg.openrouterApiKey);
        const cfgProvider = normalizeAiProvider(defaultCfg?.aiProvider);
        const cfgModel = String(defaultCfg?.aiModel || '').trim();
        setAiProvider(cfgProvider);
        if (cfgProvider === 'openrouter') {
          setAiModel(sanitizeOpenRouterModelList(cfgModel));
        } else if (cfgModel) {
          setAiModel(cfgModel);
        }
      }

      if (settingTable) {
        const settingRows = Array.from(settingTable.iter()) as any[];
        const openrouterRow = settingRows.find((r) => r.key === 'cfg.openrouter.apiKey');
        if (openrouterRow?.value) setOpenrouterApiKey(String(openrouterRow.value));
      }

      if (openrouterTable) {
        const openrouterRows = Array.from(openrouterTable.iter()) as any[];
        const defaultOpenrouter = openrouterRows.find((r) => r.configKey === 'default');
        if (defaultOpenrouter?.apiKey) setOpenrouterApiKey(String(defaultOpenrouter.apiKey));
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
            programa: row.programName || '',
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

    let liveSubscription: { unsubscribe: () => void } | null = null;
    let ragSubscription: { unsubscribe: () => void } | null = null;

    // Core tables: always exist, profiles + categorization data
    const CORE_QUERIES = [
      'SELECT * FROM application',
      'SELECT * FROM application_title',
      'SELECT * FROM application_language',
      'SELECT * FROM application_publication',
      'SELECT * FROM application_experience',
      'SELECT * FROM application_analysis_version',
      'SELECT * FROM faculty',
      'SELECT * FROM academic_program',
      'SELECT * FROM convocatoria',
      'SELECT * FROM api_config',
    ];

    // RAG/config tables: loaded separately so they never block profile rendering
    const RAG_QUERIES = [
      'SELECT * FROM rag_config',
      'SELECT * FROM rag_document',
      'SELECT * FROM rag_normative',
      'SELECT * FROM system_setting',
      'SELECT * FROM openrouter_config',
    ];

    const subscribeWithQueries = async (queries: string[], softTimeout = false) => {
      await new Promise<void>((resolve, reject) => {
        let settled = false;

        if (liveSubscription) {
          liveSubscription.unsubscribe();
          liveSubscription = null;
        }

        const timeout = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          if (softTimeout) {
            try {
              refreshFromCache();
            } catch {
              // ignore cache refresh errors on soft timeout
            }
            resolve();
            return;
          }
          reject(new Error('Timeout cargando perfiles de Talento Humano.'));
        }, 12000);

        liveSubscription = connection
          .subscriptionBuilder()
          .onApplied(() => {
            try {
              refreshFromCache();
              if (!settled) {
                settled = true;
                window.clearTimeout(timeout);
                resolve();
              }
            } catch (error) {
              if (!settled) {
                settled = true;
                window.clearTimeout(timeout);
                reject(error);
              }
            }
          })
          .onError((ctx: unknown) => {
            if (!settled) {
              settled = true;
              window.clearTimeout(timeout);
              reject(ctx);
            }
          })
          .subscribe(queries);
      });
    };

    const subscribeRagAsync = () => {
      // Fire-and-forget: loads RAG/config tables without blocking profile rendering.
      // If any table is missing from the deployed schema, onApplied may never fire —
      // that's acceptable here since RAG is not required to show the profiles list.
      try {
        if (ragSubscription) {
          ragSubscription.unsubscribe();
          ragSubscription = null;
        }
        ragSubscription = connection
          .subscriptionBuilder()
          .onApplied(() => {
            try { refreshFromCache(); } catch { /* ignore */ }
          })
          .onError(() => { /* RAG tables may not exist in all environments */ })
          .subscribe(RAG_QUERIES);
      } catch {
        // RAG subscription not available — AI analysis will use cached keys only
      }
    };

    const loadOnce = async () => {
      await connectionReady;

      try {
        await subscribeWithQueries(CORE_QUERIES, true);
        setConnectionWarning('');
      } catch (error) {
        console.error('PerfilesModule core load failed:', error);
        setConnectionWarning('No fue posible sincronizar la lista de perfiles en este momento.');
      }

      // Start RAG subscription independently after core load (non-blocking)
      subscribeRagAsync();
    };

    reloadRef.current = loadOnce;
    void loadOnce().catch((ctx) => console.error(ctx));

    return () => {
      reloadRef.current = null;
      if (liveSubscription) {
        liveSubscription.unsubscribe();
        liveSubscription = null;
      }
      if (ragSubscription) {
        ragSubscription.unsubscribe();
        ragSubscription = null;
      }
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

  const handleAddLanguageToTracking = async (trackingId: string, langData: { language_name: string; language_level: string; convalidation: boolean }) => {
    try {
      setLoading(true);
      await runReducer('add_application_language', {
        tracking_id: trackingId,
        language_name: langData.language_name,
        language_level: langData.language_level,
        convalidation: langData.convalidation,
      });
    } catch (e) {
      console.error(e);
      window.alert('Error al agregar el idioma.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLanguage = async (id: number, langData: { language_name: string; language_level: string; convalidation: boolean }) => {
    try {
      setLoading(true);
      await runReducer('update_application_language', {
        id,
        language_name: langData.language_name,
        language_level: langData.language_level,
        convalidation: langData.convalidation,
      });
    } catch (e) {
      console.error(e);
      window.alert('Error al actualizar el idioma.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLanguage = async (id: number) => {
    if (!window.confirm('¿Eliminar este idioma del expediente?')) return;
    try {
      setLoading(true);
      await runReducer('delete_application_language', { id });
    } catch (e) {
      console.error(e);
      window.alert('Error al eliminar el idioma.');
    } finally {
      setLoading(false);
    }
  };


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
      experiences.some((row) => hasSupport(row.supportName, row.supportPath)) ||
      publications.some((row) => isIndexedPublicationSource(row.sourceKind));

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

    const otherRows: MatrixRow[] = publications.map((row, index) => {
      const source = normalizePublicationSource(row.sourceKind);
      const isIndexed = source === 'SCOPUS' || source === 'ORCID';
      const quartileValue = { q1: 70, q2: 50, q3: 30, q4: 20 }[normalizeText(row.quartile) as 'q1' | 'q2' | 'q3' | 'q4'] || 20;
      const authors = Number(row.authorsCount || 1);
      const factor = authors <= 2 ? 1 : authors <= 4 ? 0.5 : 1 / Math.max(1, authors);
      const valorUnitario = Number((quartileValue * factor).toFixed(1));
      const puntajeFinal = isIndexed ? valorUnitario : 0;

      return {
        section: 'Otros',
        criterio: `PRODUCCIÓN INTELECTUAL ${index + 1}`,
        detalle: `${row.publicationTitle} (${String(row.quartile || 'Q4').toUpperCase()}, ${row.publicationYear}, ${source})`,
        cantidad: 1,
        valor: valorUnitario,
        puntaje: puntajeFinal,
        hasSupport: isIndexed,
        supportNote: isIndexed
          ? `Validado por fuente indexada (${source})`
          : 'Registro manual sin soporte indexado (no puntúa)',
      };
    });

    const matrixRows = [...studiesRows, ...experienceRows, ...otherRows].filter(
      (row) => row.cantidad > 0 || row.puntaje > 0,
    );
    const matrixTotal = matrixRows.reduce((acc, row) => acc + row.puntaje, 0);

    const formStateForCalc: FormState = {
      nombre: selectedAnalysisRequest.nombre,
      documento: selectedAnalysisRequest.documento,
      programa: selectedAnalysisRequest.programa || '',
      facultad: selectedAnalysisRequest.facultad,
      campus: 'VALLEDUPAR',
      scopusProfile: '',
      esIngresoNuevo: true,
      isAccreditedSource: false,
      yearsInCategory: 0,
      hasTrabajoAprobadoCEPI: false,
      titulos: titles.map((row) => ({
        titulo: row.titleName,
        nivel: normalizeTitleLevel(row.titleLevel),
        supportName: normalizeOptionalString(row.supportName),
        supportPath: normalizeOptionalString(row.supportPath),
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
        fuente: normalizePublicationSource(row.sourceKind),
      })),
      experiencia: experiences.map((row) => ({
        tipo: normalizeExperienceType(row.experienceType) as any,
        inicio: row.startedAt,
        fin: row.endedAt,
        certificacion: row.certified ? 'SI' : 'NO',
        supportName: normalizeOptionalString(row.supportName),
        supportPath: normalizeOptionalString(row.supportPath),
      })),
      orcid: '',
    };

    const suggested = calculateAdvancedEscalafon(formStateForCalc);

    const titleDetails: SelectedTitleDetail[] = titles.map((row) => ({
      id: Number(row.id),
      titleName: row.titleName,
      titleLevel: row.titleLevel,
      supportName: normalizeOptionalString(row.supportName),
      supportPath: normalizeOptionalString(row.supportPath),
    }));

    const experienceDetails: SelectedExperienceDetail[] = experiences.map((row) => ({
      id: Number(row.id),
      experienceType: row.experienceType,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      certified: Boolean(row.certified),
      supportName: normalizeOptionalString(row.supportName),
      supportPath: normalizeOptionalString(row.supportPath),
    }));

    const publicationDetails: SelectedPublicationDetail[] = publications.map((row) => ({
      id: Number(row.id),
      publicationTitle: row.publicationTitle,
      quartile: row.quartile,
      publicationYear: row.publicationYear,
      sourceKind: normalizePublicationSource(row.sourceKind),
    }));

    return {
      rows: matrixRows,
      matrixTotal,
      suggested,
      hasDocumentSupports,
      titles: titleDetails,
      experiences: experienceDetails,
      publications: publicationDetails,
    };
  }, [selectedAnalysisRequest, allExperiences, allLanguages, allPublications, allTitles]);

  const handleSaveProfileEvidence = async (
    payload: {
      titles: Array<{ id: number; supportName: string; supportPath: string }>;
      experiences: Array<{ id: number; supportName: string; supportPath: string }>;
      publications: Array<{ id: number; sourceKind: 'SCOPUS' | 'ORCID' | 'MANUAL' }>;
    },
  ) => {
    if (!selectedAnalysisRequest) return;

    try {
      setLoading(true);

      for (const row of payload.titles) {
        const supportName = normalizeOptionalString(row.supportName);
        const supportPath = normalizeOptionalString(row.supportPath);
        await runReducer('update_application_title_support', {
          id: row.id,
          supportName,
          supportPath,
        });
      }

      for (const row of payload.experiences) {
        const supportName = normalizeOptionalString(row.supportName);
        const supportPath = normalizeOptionalString(row.supportPath);
        await runReducer('update_application_experience_support', {
          id: row.id,
          supportName,
          supportPath,
        });
      }

      for (const row of payload.publications) {
        await runReducer('update_application_publication_source_kind', {
          id: row.id,
          sourceKind: row.sourceKind,
        });
      }

      if (reloadRef.current) await reloadRef.current();
      window.alert('Perfil actualizado. Se guardaron soportes y fuentes de producción.');
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : 'No fue posible actualizar los soportes del perfil.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedAnalysis) {
      setAiRows([]);
      setAiNarrative('');
      setMeritxNarrative(null);
      setMetriXChat([]);
      setMetriXInput('');
      setManualRows([]);
      setManualNarrative('');
      setManualMode(false);
      return;
    }

    setAiRows([]);
    setAiNarrative('');
    setMeritxNarrative(null);
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
      window.alert('No se encontró API Key activa. Configura Gemini o APIFreeLLM en Configuración > API.');
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

      const barrierDiag = selectedAnalysis.suggested.barrierDiagnosis;
      const systemPrompt = [
        'Eres un especialista en escalafón docente de la Universidad de Santander (UDES), experto en derecho laboral académico y administración de educación superior.',
        'Tu función es revisar criterios de un expediente docente e interpretar los datos con criterio profesional para emitir un dictamen técnico.',
        'REGLAS OBLIGATORIAS:',
        '1. Lee primero el DIAGNÓSTICO DE BARRERAS que se incluye en el prompt del usuario. Es el insumo principal.',
        '2. Si el docente NO cumple múltiples requisitos para una categoría superior, explica cada barrera con precisión (qué falta, cuánto falta, qué norma lo exige) y NO recomiendas subir de categoría.',
        '3. Si el ÚNICO requisito faltante para la categoría superior es el IDIOMA (nivel B1, B2 o C1 según corresponda), y el docente cumple título y puntaje, DEBES emitir una RECOMENDACIÓN CONDICIONAL de categoría superior. Indica que el perfil académico sería suficiente, pero que la recomendación está sujeta a validación por Jurídica, el CAP y el CEPI, y no es un acto administrativo.',
        '4. Si falta PRODUCCIÓN INTELECTUAL, recomienda incrementar artículos en revistas indexadas (Q1-Q4), libros de investigación y proyectos de investigación. No recomiendas categoría superior.',
        '5. Si falta FORMACIÓN (título académico), indica exactamente qué título se requiere (Especialización, Maestría, Doctorado) y que debe acreditarlo ante la institución.',
        '6. Si falta EXPERIENCIA, recomienda completar años de docencia universitaria o investigación o acreditar nuevas certificaciones.',
        '7. Si el puntaje es cercano a Titular (>900 pts) pero falta el Doctorado, explica categóricamente que la norma es restrictiva en ese requisito y no admite excepción.',
        '8. Los términos "Magister" y "Maestría" son sinónimos exactos en el sistema UDES. Tratalos idénticamente.',
        '9. Para cada criterio en la tabla: evalúa si la documentación es suficiente. Sin soporte = 0 pts o máximo 10% prudente.',
        '10. Formato de respuesta: SOLO JSON con la forma exacta siguiente (sin texto adicional fuera del JSON):',
        '{"rows":[{"criterio":"...","soporteValido":true,"puntajeSugerido":120,"comentario":"razón normativa"}],"narrativa":"dictamen técnico amplio: interpreta formación, experiencia, producción e idioma; nombra cada barrera; concluye con categoría recomendada; si aplica emite recomendación condicional por idioma con advertencia legal."}',
      ].join(' ');

      const barrierLines = barrierDiag
        ? [
            `DIAGNÓSTICO DE BARRERAS (motor de escalafón):`,
            `  Categoría bloqueada: ${barrierDiag.blockedCategory}`,
            `  Falta título: ${barrierDiag.missingTitle ? `SÍ (requiere ${barrierDiag.requiredTitle})` : 'NO'}`,
            `  Falta idioma: ${barrierDiag.missingIdioma ? `SÍ (requiere nivel ${barrierDiag.requiredIdioma})` : 'NO'}`,
            `  Falta puntaje: ${barrierDiag.missingPts ? `SÍ (requiere ${barrierDiag.requiredPts} pts, tiene ${Math.round(barrierDiag.ptsActuales)})` : 'NO'}`,
            barrierDiag.missingIdiomaSolo
              ? `  *** SOLO FALTA IDIOMA nivel ${barrierDiag.requiredIdioma} — Aplica regla 3: emitir recomendación condicional de categoría ${barrierDiag.blockedCategory} ***`
              : '',
          ].filter(Boolean).join('\n')
        : '';

      const userPrompt = [
        `Docente: ${selectedAnalysisRequest.nombre}`,
        `Documento: ${selectedAnalysisRequest.documento}`,
        `Facultad: ${selectedAnalysisRequest.facultad}`,
        `Categoría sugerida motor: ${selectedAnalysis.suggested.finalCat.name}`,
        `Puntaje sugerido motor: ${selectedAnalysis.suggested.finalPts.toFixed(1)}`,
        barrierLines,
        'Criterios para analizar:',
        JSON.stringify(baseRows),
      ].filter(Boolean).join('\n');

      const aiText = await requestAiTextWithFallback({
        runtime: { provider, model, activeKey },
        userPrompt,
        systemPrompt,
        fallbackApifreellmKey: apifreellmApiKey,
        fallbackGeminiKey: geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || '',
      });

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
    const ragDocumentTable =
      dbView.ragDocument || dbView.rag_document || dbView.ragDocumentTable || dbView.rag_document_table;
    const ragDocumentRows = ragDocumentTable ? (Array.from(ragDocumentTable.iter()) as any[]) : [];

    // Dev logs to diagnose why RAG tables may appear empty at runtime
    try {
      console.groupCollapsed('[RAG][Perfiles] dbView and rag_document info');
      console.log('dbView keys (sample):', dbView ? Object.keys(dbView).slice(0, 80) : []);
      console.log('ragDocumentTable present:', !!ragDocumentTable);
      console.log('ragDocumentRows length:', ragDocumentRows.length);
      if (ragDocumentRows.length > 0) {
        console.log(
          'ragDocumentRows sample',
          ragDocumentRows.slice(0, 5).map((r) => ({ fileName: r.fileName ?? r.file_name, documentKey: r.documentKey ?? r.document_key, active: r.active ?? r.is_active })),
        );
      }
      console.groupEnd();
    } catch (err) {
      // ignore logging errors
    }

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
        storagePath: typeof row.storagePath === 'string'
          ? row.storagePath
          : typeof row.storage_path === 'string'
            ? row.storage_path
            : undefined,
      }));
  };

  const buildRagContextForChat = async (question: string) => {
    if (!selectedAnalysis || !selectedAnalysisRequest) {
      return 'No hay un expediente seleccionado para construir contexto RAG.';
    }

    const trackingId = selectedAnalysisRequest.id;
    const titles = allTitles.filter((row) => row.trackingId === trackingId);
    const languages = allLanguages.filter((row) => row.trackingId === trackingId);
    const publications = allPublications.filter((row) => row.trackingId === trackingId);
    const experiences = allExperiences.filter((row) => row.trackingId === trackingId);

    // Build a richer retrieval query using matrix criteria and scoring factors
    // (cantidad, valor, tipo de criterio), so normative matching reflects algorithmic calculation.
    const criteriaSignals = selectedAnalysis.rows
      .map((row) => {
        const cantidad = Number.isFinite(row.cantidad) ? row.cantidad.toFixed(1) : String(row.cantidad || '0');
        const valor = Number.isFinite(row.valor) ? row.valor.toFixed(1) : String(row.valor || '0');
        const puntaje = Number.isFinite(row.puntaje) ? row.puntaje.toFixed(1) : String(row.puntaje || '0');
        return [
          row.section,
          row.criterio,
          row.detalle,
          row.supportNote,
          `cantidad ${cantidad}`,
          `valor ${valor}`,
          `puntaje ${puntaje}`,
          row.hasSupport ? 'con soporte' : 'sin soporte',
        ]
          .filter(Boolean)
          .join(' ');
      })
      .join(' ');

    const profileSignals = [
      titles.map((item) => `${item.titleLevel} ${item.titleName}`).join(' '),
      languages.map((item) => `${item.languageName} ${item.languageLevel}`).join(' '),
      publications.map((item) => `${item.publicationType} ${item.quartile} ${item.sourceKind}`).join(' '),
      experiences.map((item) => item.experienceType).join(' '),
    ].join(' ');

    const algorithmSignals = [
      'algoritmo escalafon',
      'asignacion de puntos por criterio',
      'reglas de cantidad por valor',
      'tope saturacion experiencia',
      'reglas de investigacion y produccion',
      'reglas de estudios e idiomas',
      'categoria auxiliar asistente asociado titular',
      'articulo acuerdo resolucion reglamento',
    ].join(' ');

    const retrievalQuery = [
      selectedAnalysisRequest.nombre,
      selectedAnalysisRequest.facultad,
      selectedAnalysisRequest.finalCat.name,
      question,
      criteriaSignals,
      profileSignals,
      algorithmSignals,
    ]
      .filter(Boolean)
      .join(' ');

    const queryTerms = Array.from(
      new Set(
        normalizeForSearch(retrievalQuery)
          .split(/[^a-z0-9]+/)
          .filter((term) => term.length >= 2),
      ),
    );

    const effectiveTopK = Math.max(10, ragTopK);

    const rankedChunks: Array<{ fileName: string; chunk: string; score: number }> = [];
    const fallbackNormativeChunks: Array<{ fileName: string; chunk: string; score: number }> = [];
    const forcedProtocolChunks: Array<{ fileName: string; chunk: string; score: number }> = [];
    let detectedNormatives = 0;
    let activeNormatives = 0;
    let docChunksCount = 0;
    let normativeChunksCount = 0;
    let forcedProtocolDetected = false;
    const forcedProtocolAliases = [
      'protocolo de integracion normativa por vacio legal',
      'protocolo integracion normativa por vacio legal',
      'protocolo de integracion normativa por vacios legal',
      'protocolo integracion normativa por vacios legal',
    ];
    const isForcedProtocolSource = (value: string) => {
      const normalized = normalizeForSearch(String(value || ''));
      return forcedProtocolAliases.some((alias) => normalized.includes(alias));
    };
    const activeRagDocuments = getActiveRagDocuments();
    for (const document of activeRagDocuments) {
      let decoded = '';
      const r2Url = document.storagePath && import.meta.env.VITE_R2_PUBLIC_URL
        ? `${import.meta.env.VITE_R2_PUBLIC_URL}/${document.storagePath}`
        : null;

      if (r2Url) {
        try {
          const res = await fetch(r2Url);
          if (res.ok) decoded = await res.text();
        } catch (error) {
          console.error('[buildRagContextForChat] fetch R2 error:', error);
        }
      } else if (document.contentBase64) {
        decoded = decodeBase64Document(document.contentBase64) || '';
      }
      if (!decoded) continue;
      const chunks = chunkText(decoded, ragChunkSize, ragChunkOverlap);
      docChunksCount += chunks.length;
      for (const chunk of chunks) {
        const score = scoreRagChunk(chunk, queryTerms);
        if (score > 0) rankedChunks.push({ fileName: document.fileName, chunk, score });
      }
    }

    // Read normatives from rag_normative DB table; fall back to system_setting
    try {
      const dbView = connectionRef.current?.db as any;
      const normTable = dbView?.rag_normative || dbView?.ragNormative || dbView?.ragNormativeTable || dbView?.rag_normative_table;
      let shouldUseLegacyNormatives = !normTable;
      if (normTable) {
        const normRows = Array.from(normTable.iter()) as any[];
        detectedNormatives = normRows.length;
        try {
          console.groupCollapsed('[RAG][Perfiles] rag_normative debug');
          console.log('dbView keys (sample):', dbView ? Object.keys(dbView).slice(0, 80) : []);
          console.log('normTable present:', !!normTable);
          console.log('normRows length:', normRows.length);
          if (normRows.length > 0) console.log('normRows sample titles:', normRows.slice(0, 6).map((r) => r.title ?? r.tituloOficial ?? r.normativeKey ?? r.normative_key ?? r.documentId ?? r.document_id));
          console.groupEnd();
        } catch (err) {
          // ignore logging errors
        }
        for (const row of normRows) {
          const activeFlag = row?.active ?? row?.is_active ?? row?.isActive ?? true;
          const isActive = !(activeFlag === false || Number(activeFlag) === 0 || String(activeFlag).toLowerCase() === 'false');
          if (!row || !isActive) continue;
          activeNormatives += 1;
          let jsonStr = '';
          const jsonRaw = row.jsonContent ?? row.json_content ?? row.content ?? row.json;
          if (typeof jsonRaw === 'string') {
            jsonStr = jsonRaw;
          } else if (jsonRaw && typeof jsonRaw === 'object') {
            jsonStr = JSON.stringify(jsonRaw);
          }
          // Some storages keep JSON double-encoded as a stringified string.
          try {
            const maybeString = JSON.parse(jsonStr);
            if (typeof maybeString === 'string') jsonStr = maybeString;
          } catch {
            // keep original string
          }
          const sourceProbe = [
            row.title,
            row.normativeKey,
            row.normative_key,
            row.documentId,
            row.document_id,
            row.tituloOficial,
            row.titulo_oficial,
            row.documentName,
            row.document_name,
          ]
            .filter(Boolean)
            .join(' ');
          const sourceName = String(
            row.title ??
            row.tituloOficial ??
            row.titulo_oficial ??
            row.normativeKey ??
            row.normative_key ??
            row.documentName ??
            row.document_name ??
            row.documentId ??
            row.document_id ??
            'normativa',
          );
          const isForcedProtocol = isForcedProtocolSource(`${sourceName} ${sourceProbe}`);
          if (isForcedProtocol) forcedProtocolDetected = true;
          const parsedNormChunks = normativeToRagChunks(jsonStr).filter(Boolean);
          const chunks = parsedNormChunks.length > 0
            ? parsedNormChunks
            : chunkText(jsonStr, ragChunkSize, ragChunkOverlap);
          normativeChunksCount += chunks.length;
          for (const chunk of chunks) {
            const score = scoreRagChunk(chunk, queryTerms);
            if (score > 0) {
              rankedChunks.push({ fileName: sourceName, chunk, score });
              if (isForcedProtocol && forcedProtocolChunks.length < Math.max(2, effectiveTopK)) {
                forcedProtocolChunks.push({ fileName: sourceName, chunk, score: score + 500 });
              }
            } else if (fallbackNormativeChunks.length < Math.max(6, effectiveTopK * 3)) {
              fallbackNormativeChunks.push({ fileName: sourceName, chunk, score: 0.5 });
              if (isForcedProtocol && forcedProtocolChunks.length < Math.max(2, effectiveTopK)) {
                forcedProtocolChunks.push({ fileName: sourceName, chunk, score: 500 });
              }
            }
          }
        }
        shouldUseLegacyNormatives = detectedNormatives === 0 || activeNormatives === 0 || normativeChunksCount === 0;
      }

      if (shouldUseLegacyNormatives) {
        // fallback: system_setting legacy storage
        const settingTable = dbView?.system_setting || dbView?.systemSetting || dbView?.systemSettings;
        try {
          console.groupCollapsed('[RAG][Perfiles] system_setting debug');
          console.log('settingTable present:', !!settingTable);
          if (settingTable) {
            const tempRows = Array.from(settingTable.iter()) as any[];
            console.log('settingTable rows length:', tempRows.length);
            console.log('setting keys sample:', tempRows.slice(0, 6).map((r) => r.key));
          }
          console.groupEnd();
        } catch (err) {
          // ignore
        }
        const settingTableFinal = settingTable;
        if (settingTableFinal) {
          const settingRows = Array.from(settingTableFinal.iter()) as any[];
          const settingMap = new Map(settingRows.map((r) => [r.key, r.value]));
          const rawNorms = settingMap.get('cfg.rag.normatives');
          if (rawNorms) {
            const parsed = JSON.parse(String(rawNorms));
            if (Array.isArray(parsed)) {
              detectedNormatives = Math.max(detectedNormatives, parsed.length);
              for (const norm of parsed) {
                const activeFlag = norm?.active ?? norm?.is_active ?? norm?.isActive ?? true;
                const isActive = !(activeFlag === false || Number(activeFlag) === 0 || String(activeFlag).toLowerCase() === 'false');
                if (!norm || !isActive) continue;
                activeNormatives += 1;
                const text = typeof norm.content === 'string' ? norm.content : JSON.stringify(norm.content);
                const parsedNormChunks = normativeToRagChunks(text).filter(Boolean);
                const normChunks = parsedNormChunks.length > 0
                  ? parsedNormChunks
                  : chunkText(text, ragChunkSize, ragChunkOverlap);
                const sourceName = String(
                  norm.title || norm.tituloOficial || norm.titulo_oficial || norm.normativeKey || norm.normative_key || 'normativa',
                );
                const sourceProbe = [
                  norm.title,
                  norm.tituloOficial,
                  norm.titulo_oficial,
                  norm.normativeKey,
                  norm.normative_key,
                  norm.documentName,
                  norm.document_name,
                ]
                  .filter(Boolean)
                  .join(' ');
                const isForcedProtocol = isForcedProtocolSource(`${sourceName} ${sourceProbe}`);
                if (isForcedProtocol) forcedProtocolDetected = true;
                normativeChunksCount += normChunks.length;
                for (const chunk of normChunks) {
                  const score = scoreRagChunk(chunk, queryTerms);
                  if (score > 0) {
                    rankedChunks.push({ fileName: sourceName, chunk, score });
                    if (isForcedProtocol && forcedProtocolChunks.length < Math.max(2, effectiveTopK)) {
                      forcedProtocolChunks.push({ fileName: sourceName, chunk, score: score + 500 });
                    }
                  } else if (fallbackNormativeChunks.length < Math.max(6, effectiveTopK * 3)) {
                    fallbackNormativeChunks.push({ fileName: sourceName, chunk, score: 0.5 });
                    if (isForcedProtocol && forcedProtocolChunks.length < Math.max(2, effectiveTopK)) {
                      forcedProtocolChunks.push({ fileName: sourceName, chunk, score: 500 });
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch {
      // ignore errors reading normatives
    }

    const effectiveChunks = rankedChunks.length > 0 ? rankedChunks : fallbackNormativeChunks;

    let selectedChunkItems = effectiveChunks
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, effectiveTopK));

    if (forcedProtocolChunks.length > 0) {
      const merged = [...forcedProtocolChunks.sort((a, b) => b.score - a.score), ...selectedChunkItems];
      const deduped: Array<{ fileName: string; chunk: string; score: number }> = [];
      const seen = new Set<string>();
      for (const item of merged) {
        const dedupeKey = `${item.fileName}::${item.chunk.slice(0, 220)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        deduped.push(item);
        if (deduped.length >= Math.max(1, effectiveTopK)) break;
      }
      selectedChunkItems = deduped;
    }

    const forcedProtocolIncluded = selectedChunkItems.some((item) =>
      forcedProtocolChunks.some((forced) => forced.fileName === item.fileName && forced.chunk === item.chunk),
    );

    const selectedChunks = selectedChunkItems
      .map((item, index) => `[Fuente ${index + 1}: ${item.fileName}]\n${item.chunk.slice(0, 1600)}`);

    const diagnostics = {
      generatedAt: new Date().toISOString(),
      queryTerms: queryTerms.length,
      activeDocs: activeRagDocuments.length,
      detectedNormatives,
      activeNormatives,
      docChunks: docChunksCount,
      normativeChunks: normativeChunksCount,
      rankedMatches: rankedChunks.length,
      fallbackCandidates: fallbackNormativeChunks.length,
      selectedChunks: selectedChunkItems.length,
      usedFallback: rankedChunks.length === 0 && fallbackNormativeChunks.length > 0,
      forcedProtocolDetected,
      forcedProtocolIncluded,
      sources: Array.from(new Set(selectedChunkItems.map((item) => item.fileName))).slice(0, 8),
    };

    setRagDiagnostics(diagnostics);

    console.groupCollapsed('[RAG][Perfiles] Diagnostico de recuperacion');
    console.log('Pregunta:', question);
    console.log('Terminos de consulta:', queryTerms);
    console.table(diagnostics);
    console.groupEnd();

    return selectedChunks.length > 0
      ? selectedChunks.join('\n\n')
      : 'No se recuperaron fragmentos normativos desde RAG para este caso.';
  };

  const sendMetriXMessage = async () => {
    if (!selectedAnalysis || !selectedAnalysisRequest) return;
    if (!metriXInput.trim()) return;

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
      window.alert('No se encontró API Key activa. Configura Gemini o APIFreeLLM en Configuración > API.');
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
      const ragContext = await buildRagContextForChat(userMessage.content);

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
        'Eres MetriX, consultor experto en escalafón docente de la Universidad de Santander (UDES), integrado al módulo de Perfiles de Talento Humano.',
        'Tu rol es el de un abogado-analista especializado en régimen docente: combinas la exactitud normativa con una narrativa clara que orienta a coordinadores y funcionarios en la toma de decisiones.',
        'Tienes acceso al expediente del docente y a la conversación acumulada. Usa esa información para dar respuestas contextualizadas, no genéricas.',
        'Cuando el usuario pregunte por criterios, explica en detalle qué normativa aplica, cómo se computa el puntaje, qué documentos sustentan o impiden el reconocimiento y cuál sería el impacto en la categoría final.',
        'Construye respuestas narrativas antes de presentar datos estructurados: primero el análisis cualitativo, luego las cifras.',
        'Responde SIEMPRE en JSON válido con esta estructura exacta:',
        '{"rows":[{"criterio":"...","soporteValido":true,"puntajeSugerido":120,"comentario":"justificación normativa del puntaje"}],"narrativa":"dictamen narrativo: contexto del caso, interpretación normativa aplicable, análisis de cada criterio discutido, conclusión técnica con categoría y puntaje proyectado"}',
        'En narrativa integra las fuentes RAG cuando estén disponibles y señala explícitamente el artículo o acuerdo citado.',
        'No inventes soportes ni normas. Si falta evidencia, indícalo con precisión jurídica.',
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

      const aiText = await requestAiTextWithFallback({
        runtime: { provider, model, activeKey },
        userPrompt,
        systemPrompt,
        fallbackApifreellmKey: apifreellmApiKey,
        fallbackGeminiKey: geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || '',
      });

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

  const generateMeritxNarrative = async () => {
    if (!selectedAnalysis || !selectedAnalysisRequest) return;

    const runtime = resolveAiRuntime({
      provider: aiProvider,
      model: aiModel,
      geminiKey: geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || '',
      apifreellmKey: apifreellmApiKey,
      openrouterKey: openrouterApiKey,
    });

    if (!runtime.activeKey) {
      window.alert('No se encontró API Key activa para generar Narrativa de MeritX (IA).');
      return;
    }

    const popup = openMeritxReportWindow(selectedAnalysisRequest.nombre);
    setMeritxNarrativeLoading(true);
    try {
      const supportCount = selectedAnalysis.rows.filter((row) => row.hasSupport).length;
      const noSupportCount = selectedAnalysis.rows.length - supportCount;
      const matrixAnalysis = [
        `La matriz consolidó ${selectedAnalysis.rows.length} criterios con ${supportCount} soportados y ${noSupportCount} sin soporte verificable.`,
        `El subtotal por matriz fue ${selectedAnalysis.matrixTotal.toFixed(1)} puntos, construido con base en cantidad x valor por criterio y depuración de soportes.`,
      ].join(' ');

      const motorAnalysis = [
        `El motor de escalafón proyectó ${selectedAnalysis.suggested.finalPts.toFixed(1)} puntos y categoría ${selectedAnalysis.suggested.finalCat.name}.`,
        selectedAnalysis.suggested.outputMessage || '',
      ].join(' ').trim();

      const officialAnalysis = [
        `El expediente oficial registra ${selectedAnalysisRequest.finalPts.toFixed(1)} puntos y categoría ${selectedAnalysisRequest.finalCat.name}.`,
        selectedAnalysisRequest.outputMessage || '',
      ].join(' ').trim();

      const publicationEvidenceSummary = selectedAnalysis.publications.length > 0
        ? selectedAnalysis.publications
          .map((item, index) => {
            const source = String(item.sourceKind || 'MANUAL').toUpperCase();
            const quartile = String(item.quartile || 'SIN CUARTIL');
            return `${index + 1}. ${item.publicationTitle} | fuente: ${source} | cuartil: ${quartile} | año: ${item.publicationYear}`;
          })
          .join('\n')
        : 'No hay producción científica registrada para este caso.';

      const structuredRagQuestion = [
        'Interpretar normativamente el cálculo del algoritmo de escalafón y la asignación de puntos por criterio.',
        'Debes relacionar criterios, cantidad, valor y tipo de criterio (experiencia, investigación/producción, estudios e idiomas).',
        'Criterios del caso:',
        ...selectedAnalysis.rows.map((row) => {
          const cantidad = Number.isFinite(row.cantidad) ? row.cantidad.toFixed(1) : String(row.cantidad || '0');
          const valor = Number.isFinite(row.valor) ? row.valor.toFixed(1) : String(row.valor || '0');
          const puntaje = Number.isFinite(row.puntaje) ? row.puntaje.toFixed(1) : String(row.puntaje || '0');
          return `- ${row.section} | ${row.criterio} | cantidad: ${cantidad} | valor: ${valor} | puntaje: ${puntaje}`;
        }),
      ].join('\n');

      const ragContext = await buildRagContextForChat(structuredRagQuestion);
      const aiCurrentScore = aiRows.reduce((acc, row) => acc + row.puntajeSugerido, 0);

      const barrierDiag = selectedAnalysis.suggested.barrierDiagnosis;
      const barrierLines = barrierDiag
        ? [
            `DIAGNÓSTICO DE BARRERAS (motor escalafón):`,
            `  Categoría superior bloqueada: ${barrierDiag.blockedCategory}`,
            `  Falta título: ${barrierDiag.missingTitle ? `SÍ (requiere ${barrierDiag.requiredTitle})` : 'NO'}`,
            `  Falta idioma: ${barrierDiag.missingIdioma ? `SÍ (requiere nivel ${barrierDiag.requiredIdioma})` : 'NO'}`,
            `  Falta puntaje: ${barrierDiag.missingPts ? `SÍ (requiere ${barrierDiag.requiredPts} pts, tiene ${Math.round(barrierDiag.ptsActuales)})` : 'NO'}`,
            barrierDiag.missingIdiomaSolo
              ? `  *** SOLO FALTA IDIOMA nivel ${barrierDiag.requiredIdioma} \u2014 incluir RECOMENDACIÓN CONDICIONAL de categoría ${barrierDiag.blockedCategory} en conclusionIntermedia ***`
              : '',
          ].filter(Boolean).join('\n')
        : 'Sin barreras adicionales detectadas.';

      const prompt = [
        'Eres MetriX, dictaminador experto en escalafón docente UDES. Produce un informe narrativo consolidado, técnico-jurídico y profundamente argumentado del caso docente.',
        '',
        'REGLA CRÍTICA DE FORMATO: Responde ÚNICAMENTE con un objeto JSON válido. Sin texto antes ni después del JSON. Sin markdown. Los saltos de línea dentro de los valores de string deben estar codificados como \\n (barra-n escapada), nunca como salto de línea real.',
        'REGLA DE LONGITUD: Cada campo narrativo DEBE contener mínimo 3 párrafos completos (separados por \\n\\n) de al menos 100 palabras cada uno. Redacta en prosa técnica, sin viñetas ni asteriscos.',
        '',
        'REQUERIMIENTO OBLIGATORIO PARA conclusionIntermedia (debe incluir los 4 puntos):',
        '  1. BARRERAS NORMATIVAS: Explica de forma precisa por qué NO se asignó la categoría superior. Nombra cada requisito faltante con su valor exacto.',
        '  2. CRITERIOS DE CATEGORIZACIÓN: Lista los requisitos de cada categoría (Auxiliar 340-480 pts/Pregrado/Sin idioma, Asistente 481-750/Especialización/A2, Asociado 751-980/Maestría/B1, Titular 981+/Doctorado/B2). Explica dónde está el docente en esa escala.',
        '  3. RECOMENDACIÓN CONDICIONAL (solo si missingIdiomaSolo=true): El docente cumple título y puntaje para la categoría superior. Emitir recomendación condicional indicando que está sujeta a revisión de Jurídica, CAP y CEPI.',
        '  4. PROYECCIÓN HIPOTÉTICA: Qué categoría y puntaje tendría el docente si superara las barreras identificadas.',
        '',
        'Estructura JSON EXACTA (sin cambiar nombres de llaves):',
        '{"analisisMatriz":"...","analisisMotor":"...","analisisOficial":"...","analisisNormativo":"...","conclusionIntermedia":"...","puntajeIntermedio":0}',
        '',
        `DATOS DEL CASO:`,
        `Puntaje matriz: ${selectedAnalysis.matrixTotal.toFixed(1)} pts.`,
        `Puntaje motor: ${selectedAnalysis.suggested.finalPts.toFixed(1)} pts — Categoría: ${selectedAnalysis.suggested.finalCat.name}.`,
        `Puntaje oficial expediente: ${selectedAnalysisRequest.finalPts.toFixed(1)} pts — Categoría: ${selectedAnalysisRequest.finalCat?.name || 'No definida'}.`,
        aiRows.length > 0 ? `Referencia tabla IA vigente: ${aiCurrentScore.toFixed(1)} pts.` : 'Sin tabla IA previa.',
        barrierLines,
        `Análisis base de la matriz: ${matrixAnalysis}`,
        `Análisis base del motor: ${motorAnalysis}`,
        `Análisis base del expediente oficial: ${officialAnalysis}`,
        'Producción científica registrada (analiza cada una individualmente con cuartil y fuente):',
        publicationEvidenceSummary,
        'Contexto normativo RAG (cita explícitamente norma y artículo cuando esté disponible):',
        ragContext,
      ].join('\n');

      const aiText = await requestAiTextWithFallback({
        runtime,
        userPrompt: prompt,
        fallbackApifreellmKey: apifreellmApiKey,
        fallbackGeminiKey: geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || '',
      });

      const parsed = parseAiJsonObjectLoose(aiText);

      // Graceful degradation: if JSON parsing fails completely, use raw AI text as conclusionIntermedia
      const safeNarrative = (parsed && typeof parsed === 'object') ? parsed : {
        analisisMatriz: matrixAnalysis,
        analisisMotor: motorAnalysis,
        analisisOficial: officialAnalysis,
        analisisNormativo: ragContext ? ragContext.slice(0, 800) : 'Sin contexto normativo RAG disponible.',
        conclusionIntermedia: aiText.length > 80 ? aiText : `Motor asignó categoría ${selectedAnalysis.suggested.finalCat.name} con ${selectedAnalysis.suggested.finalPts.toFixed(1)} pts. ${barrierLines}`,
        puntajeIntermedio: (selectedAnalysis.matrixTotal + selectedAnalysis.suggested.finalPts + selectedAnalysisRequest.finalPts) / 3,
      };
      const parsed2 = safeNarrative;

      const minScore = Math.min(selectedAnalysis.matrixTotal, selectedAnalysis.suggested.finalPts, selectedAnalysisRequest.finalPts);
      const maxScore = Math.max(selectedAnalysis.matrixTotal, selectedAnalysis.suggested.finalPts, selectedAnalysisRequest.finalPts);
      const defaultMid = (selectedAnalysis.matrixTotal + selectedAnalysis.suggested.finalPts + selectedAnalysisRequest.finalPts) / 3;
      const rawMid = Number(parsed2?.puntajeIntermedio);
      const boundedMid = Number.isFinite(rawMid) ? Math.max(minScore, Math.min(maxScore, rawMid)) : defaultMid;

      const nextNarrative = {
        analisisMatriz: sanitizeNarrativeText(parsed2?.analisisMatriz || matrixAnalysis),
        analisisMotor: sanitizeNarrativeText(parsed2?.analisisMotor || motorAnalysis),
        analisisOficial: sanitizeNarrativeText(parsed2?.analisisOficial || officialAnalysis),
        analisisNormativo: sanitizeNarrativeText(
          parsed2?.analisisNormativo || parsed2?.analisisRag || 'No se pudo consolidar análisis normativo específico.',
        ),
        conclusionIntermedia: sanitizeNarrativeText(parsed2?.conclusionIntermedia || 'No se pudo generar conclusión integradora.'),
        puntajeIntermedio: boundedMid,
      };


      setMeritxNarrative(nextNarrative);
      renderMeritxReportWindow(popup, {
        selectedAnalysisRequest,
        selectedAnalysis,
        aiRows,
        meritxNarrative: nextNarrative,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      renderMeritxReportError(
        popup,
        error instanceof Error ? error.message : 'No fue posible generar la Narrativa de MeritX (IA).',
      );
      window.alert(error instanceof Error ? error.message : 'No fue posible generar la Narrativa de MeritX (IA).');
    } finally {
      setMeritxNarrativeLoading(false);
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
        {connectionWarning && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-xs font-semibold text-amber-800">
            {connectionWarning}
          </div>
        )}
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
          meritxNarrative={meritxNarrative}
          meritxNarrativeLoading={meritxNarrativeLoading}
          onGenerateMeritxNarrative={generateMeritxNarrative}
          ragDebugInfo={ragDiagnostics}
          onSaveProfileEvidence={handleSaveProfileEvidence}
          onAddLanguage={handleAddLanguageToTracking}
          onUpdateLanguage={handleUpdateLanguage}
          onDeleteLanguage={handleDeleteLanguage}
          currentLanguages={allLanguages.filter((l) => l.trackingId === selectedAnalysisRequest.id)}
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
