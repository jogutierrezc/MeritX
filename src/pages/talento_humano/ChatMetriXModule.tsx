import React, { useEffect, useRef, useState } from 'react';
import { BrainCircuit, MessageSquareText, Send } from 'lucide-react';

import { DbConnection } from '../../module_bindings';
import { getPortalCredentialsForRole, getPortalSession } from '../../services/portalAuth';
import { getSpacetimeConnectionConfig } from '../../services/spacetime';
import type { FormState } from '../../types/domain';
import { calculateAdvancedEscalafon, getSuggestedCategoryByPoints } from '../../utils/calculateEscalafon';
import { normativeToRagChunks } from '../../utils/ragNormativeParser';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

type ScenarioRow = {
  seccion: string;
  criterio: string;
  documentoSoporte: string;
  soporteValido: boolean;
  cantidad: number;
  valor: number;
  puntajeBase: number;
  puntajeIa: number;
  puntajeSugerido: number;
  comentario: string;
};

type StoredRagDocument = {
  fileName: string;
  active: boolean;
  contentBase64?: string;
  storagePath?: string;
};

const THINKING_STEPS = [
  'Leyendo el caso y estructurando variables de entrada',
  'Recuperando contexto normativo desde RAG',
  'Construyendo matriz de criterios y soporte',
  'Aplicando reglas del algoritmo y topes por categoría',
  'Redactando concepto y conclusiones finales',
];

const OPENROUTER_DEFAULT_MODELS = ['google/gemma-3-27b-it:free', 'google/gemma-2-9b-it:free'];
const OPENROUTER_BLOCKED_MODELS = ['meta-llama/llama-3.3-8b-instruct:free'];
const OPENROUTER_PRESET_METRIX = {
  temperature: 0.15,
  topP: 0.9,
  maxTokens: 2400,
  // @preset/merit-x2 is the custom OpenRouter preset tuned for MetriX escalafón analysis.
  // Falls back to default free models if the preset is unavailable.
  modelPriority: ['@preset/merit-x2', ...OPENROUTER_DEFAULT_MODELS],
  systemDirective:
    'Relaciona cada criterio del caso con la matriz del sistema MeritX y conserva coherencia con la reglamentación universitaria aplicable. ' +
    'IMPORTANTE: Trata "Magister" y "Maestría" como sinónimos exactos.',
};

const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const waitMs = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const isModelOverloadError = (value: unknown) => {
  const text = normalizeForSearch(String(value || ''));
  return (
    text.includes('overload') ||
    text.includes('overloaded') ||
    text.includes('capacity') ||
    text.includes('rate limit') ||
    text.includes('too many requests') ||
    text.includes('temporarily unavailable') ||
    text.includes('503') ||
    text.includes('429')
  );
};

const toUserFriendlyAiError = (error: unknown) => {
  if (isModelOverloadError(error)) {
    return 'MetriX está temporalmente ocupado. Reintenté con modelos alternos automáticamente, pero ninguno respondió a tiempo. Intenta de nuevo en unos segundos.';
  }
  return 'No fue posible procesar la consulta con MetriX en este momento. Intenta nuevamente.';
};

const normalizeForSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const decodeBase64Document = (contentBase64?: string) => {
  if (!contentBase64) return '';
  try {
    const binary = window.atob(contentBase64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return decoded.replace(/\s+/g, ' ').trim();
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
    if (chunk.length >= 100) chunks.push(chunk);
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

const toSafeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeAiProvider = (value?: string): 'gemini' | 'apifreellm' | 'openrouter' => {
  const normalized = normalizeForSearch(String(value || ''));
  if (normalized.includes('openrouter') || normalized.includes('router')) return 'openrouter';
  return normalized.includes('free') ? 'apifreellm' : 'gemini';
};

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

const requestOpenRouterText = async (
  model: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  preset = OPENROUTER_PRESET_METRIX,
) => {
  const getOpenRouterAvailableFreeModels = async () => {
    try {
      const modelsRes = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      if (!modelsRes.ok) return [] as string[];

      const modelsData = await modelsRes.json();
      const allIds = Array.isArray(modelsData?.data)
        ? modelsData.data
          .map((item: any) => String(item?.id || '').trim())
          .filter(Boolean)
        : [];

      return allIds
        .filter((id: string) => normalizeForSearch(id).includes('free'))
        .filter((id: string) => !OPENROUTER_BLOCKED_MODELS.map((m) => normalizeForSearch(m)).includes(normalizeForSearch(id)))
        .slice(0, 10);
    } catch {
      return [] as string[];
    }
  };

  const candidates = String(model || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const orderedInitial = Array.from(new Set([
    ...candidates,
    ...preset.modelPriority,
  ]));

  const tryCandidates = async (ordered: string[]) => {
    let lastError: Error | null = null;

    for (const candidate of ordered) {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: candidate,
            temperature: preset.temperature,
            top_p: preset.topP,
            max_tokens: preset.maxTokens,
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

        const bodyText = await res.text();
        lastError = new Error(`OpenRouter(${candidate}) HTTP ${res.status}: ${bodyText}`);

        if (RETRYABLE_HTTP_STATUS.has(res.status) && attempt < 2) {
          await waitMs(350 * attempt);
          continue;
        }

        break;
      }
    }

    throw lastError || new Error('OpenRouter no respondió con contenido válido.');
  };

  try {
    return await tryCandidates(orderedInitial);
  } catch (error) {
    const discovered = await getOpenRouterAvailableFreeModels();
    const extraCandidates = discovered.filter((candidate: string) => !orderedInitial.includes(candidate));
    if (extraCandidates.length === 0) throw error;
    return tryCandidates(extraCandidates);
  }
};

const normalizePublicationSource = (value: unknown): 'SCOPUS' | 'ORCID' | 'MANUAL' => {
  const normalized = normalizeForSearch(String(value || ''));
  if (normalized.includes('scopus')) return 'SCOPUS';
  if (normalized.includes('orcid')) return 'ORCID';
  return 'MANUAL';
};

const inferSectionFromCriterion = (criterion: string) => {
  const normalized = normalizeForSearch(criterion);
  if (normalized.includes('titulo') || normalized.includes('idioma')) return 'ESTUDIOS CURSADOS';
  if (normalized.includes('experiencia') || normalized.includes('docencia') || normalized.includes('investig')) return 'EXPERIENCIA';
  if (normalized.includes('produccion') || normalized.includes('articulo') || normalized.includes('publicacion') || normalized.includes('patente')) return 'OTROS';
  return 'CRITERIO GENERAL';
};

const calculateYears = (start: string, end?: string) => {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  const diffMs = Math.max(0, endDate.getTime() - startDate.getTime());
  return diffMs / (1000 * 60 * 60 * 24 * 365.25);
};

const parseJsonFromText = (text: string): any | null => {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

const sanitizeFormState = (candidate: any): FormState => {
  const mapTitleLevel = (value: string): 'Pregrado' | 'Especialización' | 'Maestría' | 'Doctorado' => {
    const normalized = normalizeForSearch(String(value || ''));
    if (normalized.includes('doctor')) return 'Doctorado';
    if (normalized.includes('maestr') || normalized.includes('magister')) return 'Maestría';
    if (normalized.includes('especial')) return 'Especialización';
    return 'Pregrado';
  };

  const mapLanguageLevel = (value: string): 'A2' | 'B1' | 'B2' | 'C1' => {
    const normalized = String(value || '').toUpperCase();
    if (normalized.includes('C1')) return 'C1';
    if (normalized.includes('B2')) return 'B2';
    if (normalized.includes('B1')) return 'B1';
    return 'A2';
  };

  const mapExperienceType = (value: string): 'Profesional' | 'Docencia Universitaria' | 'Investigación' => {
    const normalized = normalizeForSearch(String(value || ''));
    if (normalized.includes('docenc')) return 'Docencia Universitaria';
    if (normalized.includes('invest')) return 'Investigación';
    return 'Profesional';
  };

  const titles = Array.isArray(candidate?.titulos)
    ? candidate.titulos.map((row: any) => ({
      titulo: String(row?.titulo || row?.title || 'Sin título').trim(),
      nivel: mapTitleLevel(row?.nivel || row?.level),
    }))
    : [];

  const languages = Array.isArray(candidate?.idiomas)
    ? candidate.idiomas.map((row: any) => ({
      idioma: String(row?.idioma || row?.language || 'Idioma').trim(),
      nivel: mapLanguageLevel(row?.nivel || row?.level),
      convalidacion: String(row?.convalidacion || row?.convalidation || 'NO').toUpperCase() === 'SI' ? 'SI' as const : 'NO' as const,
    }))
    : [];

  const publications = Array.isArray(candidate?.produccion)
    ? candidate.produccion.map((row: any) => ({
      titulo: String(row?.titulo || row?.title || 'Producción').trim(),
      cuartil: (String(row?.cuartil || row?.quartile || 'Q4').toUpperCase() as 'Q1' | 'Q2' | 'Q3' | 'Q4'),
      fecha: String(row?.fecha || row?.year || new Date().getFullYear()),
      tipo: String(row?.tipo || row?.type || 'Artículo'),
      autores: toSafeNumber(row?.autores ?? row?.authors, 1),
      fuente: normalizePublicationSource(row?.fuente || row?.source),
    }))
    : [];

  const experiences = Array.isArray(candidate?.experiencia)
    ? candidate.experiencia.map((row: any) => ({
      tipo: mapExperienceType(row?.tipo || row?.type) as any,
      inicio: String(row?.inicio || row?.start || '2020-01-01'),
      fin: String(row?.fin || row?.end || ''),
      certificacion: String(row?.certificacion || row?.certified || 'NO').toUpperCase() === 'SI' ? 'SI' as const : 'NO' as const,
    }))
    : [];

  return {
    nombre: String(candidate?.nombre || 'Escenario Conversacional MetriX'),
    documento: String(candidate?.documento || 'S/N'),
    programa: String(candidate?.programa || 'No especificado'),
    facultad: String(candidate?.facultad || 'No especificada'),
    campus: 'VALLEDUPAR',
    scopusProfile: '',
    esIngresoNuevo: true,
    isAccreditedSource: false,
    yearsInCategory: toSafeNumber(candidate?.yearsInCategory, 0),
    hasTrabajoAprobadoCEPI: false,
    titulos: titles,
    idiomas: languages,
    produccion: publications,
    experiencia: experiences,
    orcid: '',
  };
};

const ChatMetriXModule = () => {
  const connectionRef = useRef<DbConnection | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionWarning, setConnectionWarning] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [apifreellmApiKey, setApifreellmApiKey] = useState('');
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiModel, setAiModel] = useState('gemini-2.5-flash');
  const [ragSystemContext, setRagSystemContext] = useState('');
  const [ragTopK, setRagTopK] = useState(5);
  const [ragChunkSize, setRagChunkSize] = useState(1200);
  const [ragChunkOverlap, setRagChunkOverlap] = useState(150);

  const [lastConcept, setLastConcept] = useState('');
  const [lastRows, setLastRows] = useState<ScenarioRow[]>([]);
  const [lastCalc, setLastCalc] = useState<ReturnType<typeof calculateAdvancedEscalafon> | null>(null);
  const [lastFormState, setLastFormState] = useState<FormState | null>(null);
  const [lastRagSources, setLastRagSources] = useState<string[]>([]);
  const [thinkingStepIndex, setThinkingStepIndex] = useState(0);

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

    const connection = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(databaseName)
      .onConnect((conn: DbConnection) => {
        
        ensurePortalSession(conn).catch((e) => console.warn('Portal session en ChatMetriXModule:', e));
      })
      .onConnectError((_ctx: unknown, err: unknown) => {
        console.error('ChatMetriXModule connect error:', err);
        
      })
      .build();

    connectionRef.current = connection;

    const refreshFromCache = () => {
      const dbView = connection.db as any;
      const settingTable = dbView.systemSetting || dbView.system_setting;
      const openrouterTable = dbView.openrouterConfig || dbView.openrouter_config;
      const apiTable = dbView.apiConfig || dbView.api_config;
      if (apiTable) {
        const apiRows = Array.from(apiTable.iter()) as any[];
        const defaultCfg = apiRows.find((row) => row.configKey === 'default');
        if (typeof defaultCfg?.geminiApiKey === 'string') setGeminiApiKey(defaultCfg.geminiApiKey.trim());
        if (typeof defaultCfg?.apifreellmApiKey === 'string') setApifreellmApiKey(defaultCfg.apifreellmApiKey.trim());
        if (typeof defaultCfg?.openrouterApiKey === 'string') setOpenrouterApiKey(defaultCfg.openrouterApiKey.trim());
        if (defaultCfg?.aiProvider) setAiProvider(normalizeAiProvider(defaultCfg.aiProvider));
        if (defaultCfg?.aiModel) {
          const provider = normalizeAiProvider(defaultCfg?.aiProvider);
          const model = String(defaultCfg.aiModel || '').trim();
          setAiModel(provider === 'openrouter' ? sanitizeOpenRouterModelList(model) : model);
        }
      }

      if (settingTable) {
        const settingRows = Array.from(settingTable.iter()) as any[];
        const openrouterRow = settingRows.find((row) => row.key === 'cfg.openrouter.apiKey');
        if (openrouterRow?.value) setOpenrouterApiKey(String(openrouterRow.value).trim());
      }

      if (openrouterTable) {
        const openrouterRows = Array.from(openrouterTable.iter()) as any[];
        const defaultOpenrouter = openrouterRows.find((row) => row.configKey === 'default');
        if (defaultOpenrouter?.apiKey) setOpenrouterApiKey(String(defaultOpenrouter.apiKey).trim());
      }

      const ragTable = dbView.ragConfig || dbView.rag_config;
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
    };

    let liveSubscription: { unsubscribe: () => void } | null = null;

    const QUERY_SETS = {
      full: [
        'SELECT * FROM api_config',
        'SELECT * FROM rag_config',
        'SELECT * FROM rag_document',
        'SELECT * FROM rag_normative',
        'SELECT * FROM system_setting',
        'SELECT * FROM openrouter_config',
      ],
      compatible: [
        'SELECT * FROM api_config',
        'SELECT * FROM rag_config',
        'SELECT * FROM rag_document',
        'SELECT * FROM system_setting',
      ],
      minimal: [
        'SELECT * FROM api_config',
        'SELECT * FROM system_setting',
      ],
    };

    const subscribeWithQueries = async (queries: string[]) => {
      await new Promise<void>((resolve, reject) => {
        let settled = false;

        if (liveSubscription) {
          liveSubscription.unsubscribe();
          liveSubscription = null;
        }

        const timeout = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error('Timeout cargando Chat MetriX'));
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

    const loadOnce = async () => {
      try {
        await subscribeWithQueries(QUERY_SETS.full);
        setConnectionWarning('');
      } catch (fullError) {
        console.warn('ChatMetriX subscription fallback(full->compatible):', fullError);
        try {
          await subscribeWithQueries(QUERY_SETS.compatible);
          setConnectionWarning('MetriX cargado en modo compatibilidad. Algunas fuentes RAG avanzadas no estan disponibles.');
        } catch (compatibleError) {
          console.warn('ChatMetriX subscription fallback(compatible->minimal):', compatibleError);
          await subscribeWithQueries(QUERY_SETS.minimal);
          setConnectionWarning('MetriX cargado en modo minimo. Se usaran llaves/configuracion basica.');
        }
      }
    };

    void loadOnce().catch((error) => console.error(error));

    return () => {
      if (liveSubscription) {
        liveSubscription.unsubscribe();
        liveSubscription = null;
      }
      connection.disconnect();
      connectionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setThinkingStepIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setThinkingStepIndex((prev) => (prev + 1) % THINKING_STEPS.length);
    }, 1300);

    return () => window.clearInterval(interval);
  }, [loading]);

  const getActiveRagDocuments = (): StoredRagDocument[] => {
    const connection = connectionRef.current;
    if (!connection) return [];

    const dbView = connection.db as any;
    const ragDocumentTable = dbView.ragDocument || dbView.rag_document;
    const ragRows = ragDocumentTable ? (Array.from(ragDocumentTable.iter()) as any[]) : [];

    return ragRows
      .filter((row) => Boolean(row?.active ?? row?.is_active ?? true))
      .map((row) => ({
        fileName: String(row.fileName ?? row.file_name ?? row.documentKey ?? row.document_key ?? 'documento-rag'),
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

  const buildRagContext = async (question: string) => {
    const queryTerms = Array.from(
      new Set(
        normalizeForSearch(question)
          .split(/[^a-z0-9]+/)
          .filter((term) => term.length >= 4),
      ),
    );

    const rankedChunks: Array<{ fileName: string; chunk: string; score: number }> = [];
    const fallbackNormativeChunks: Array<{ fileName: string; chunk: string; score: number }> = [];
    const docs = getActiveRagDocuments();
    for (const doc of docs) {
      let decoded = '';
      const r2Url = doc.storagePath && import.meta.env.VITE_R2_PUBLIC_URL
        ? `${import.meta.env.VITE_R2_PUBLIC_URL}/${doc.storagePath}`
        : null;

      if (r2Url) {
        try {
          const res = await fetch(r2Url);
          if (res.ok) decoded = await res.text();
        } catch (error) {
          console.error('[buildRagContext] fetch R2 error:', error);
        }
      } else if (doc.contentBase64) {
        decoded = decodeBase64Document(doc.contentBase64) || '';
      }
      if (!decoded) continue;
      const chunks = chunkText(decoded, ragChunkSize, ragChunkOverlap);
      for (const chunk of chunks) {
        const score = scoreRagChunk(chunk, queryTerms);
        if (score > 0) rankedChunks.push({ fileName: doc.fileName, chunk, score });
      }
    }

    // Read normatives from rag_normative DB table; fall back to system_setting
    try {
      const dbView = connectionRef.current?.db as any;
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
          const parsedNormChunks = jsonStr
            ? normativeToRagChunks(jsonStr).filter(Boolean)
            : [];
          const chunks = parsedNormChunks.length > 0
            ? parsedNormChunks
            : chunkText(jsonStr, ragChunkSize, ragChunkOverlap);
          for (const chunk of chunks) {
            const score = scoreRagChunk(chunk, queryTerms);
            if (score > 0) {
              rankedChunks.push({ fileName: sourceName, chunk, score });
            } else if (fallbackNormativeChunks.length < Math.max(6, ragTopK * 3)) {
              fallbackNormativeChunks.push({ fileName: sourceName, chunk, score: 0.5 });
            }
          }
        }
      } else {
        // fallback: system_setting legacy storage
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
      // ignore errors reading normatives
    }

    const effectiveChunks = rankedChunks.length > 0 ? rankedChunks : fallbackNormativeChunks;

    const selected = effectiveChunks
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, ragTopK));

    const references = Array.from(new Set(selected.map((item) => item.fileName))).slice(0, 6);
    const contextBlocks = selected.map((item, index) => `[Fuente ${index + 1}: ${item.fileName}]\n${item.chunk.slice(0, 1800)}`);

    return {
      context: contextBlocks.length > 0
        ? contextBlocks.join('\n\n')
        : 'No se recuperaron fragmentos normativos desde RAG para esta consulta.',
      references,
    };
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

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
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };

    const conversation = [...messages, userMessage];
    setMessages(conversation);
    setInput('');
    setLoading(true);

    try {
      const ragResult = await buildRagContext(userMessage.content);
      const ragContext = ragResult.context;
      const conversationText = conversation
        .map((entry) => `${entry.role === 'user' ? 'Usuario' : 'MetriX'}: ${entry.content}`)
        .join('\n');

      const baseSystemPrompt = [
        'Eres MetriX, consultor experto en escalafón docente de la Universidad de Santander (UDES) asignado a la Unidad de Talento Humano.',
        'Tu rol combina el conocimiento técnico de un abogado laboral especializado en educación superior, la precisión analítica de un coordinador de escalafón y la capacidad narrativa de un dictaminador institucional.',
        'Cuando respondas, construye un análisis narrativo coherente: explica el razonamiento jurídico-normativo antes de llegar a cifras, cita los artículos o acuerdos relevantes recuperados del RAG si están disponibles, y justifica cada puntaje asignado con base en los criterios reglamentarios.',
        'Si el usuario plantea un caso sin soporte claro, señala explícitamente qué documentación regiría el reconocimiento y cuál sería el impacto en puntos.',
        'NO dependes de expedientes almacenados: analiza únicamente la situación conversada.',
        'Debes devolver SIEMPRE JSON válido con esta forma exacta:',
        '{"concepto":"análisis narrativo y normativo detallado del caso","rows":[{"seccion":"ESTUDIOS CURSADOS|EXPERIENCIA|OTROS","criterio":"...","documentoSoporte":"...","soporteValido":true,"cantidad":1,"valor":300,"puntajeBase":300,"puntajeIa":0,"puntajeSugerido":120,"comentario":"justificación normativa del puntaje"}],"formState":{"nombre":"...","documento":"...","programa":"...","facultad":"...","titulos":[{"titulo":"...","nivel":"Pregrado|Especialización|Maestría|Doctorado"}],"idiomas":[{"idioma":"...","nivel":"A2|B1|B2|C1","convalidacion":"SI|NO"}],"produccion":[{"titulo":"...","cuartil":"Q1|Q2|Q3|Q4","fecha":"2024","tipo":"...","autores":1,"fuente":"SCOPUS|ORCID|MANUAL"}],"experiencia":[{"tipo":"Profesional|Docencia Universitaria|Investigación","inicio":"YYYY-MM-DD","fin":"YYYY-MM-DD","certificacion":"SI|NO"}]}}',
        'En el campo "concepto" desarrolla un dictamen narrativo completo: contexto normativo, análisis de cada bloque de criterios, conclusión sobre categoría proyectada y consideraciones de riesgo o documentos faltantes.',
        'No inventes normas; cuando no hay RAG disponible, razona con los criterios generales del régimen de escalafón colombiano.',
        'RESTRICCIÓN NORMATIVA CRÍTICA: SOLO cita artículos, acuerdos, resoluciones o normativas que estén EXPLÍCITAMENTE transcritos en el CONTEXTO RAG que se te proporciona. Si una norma no aparece en el RAG, NO la menciones ni la cites; indica que el punto requiere verificación documental adicional.',
      ].join(' ');

      const systemPrompt = provider === 'openrouter'
        ? `${baseSystemPrompt} ${OPENROUTER_PRESET_METRIX.systemDirective}`
        : baseSystemPrompt;

      const userPrompt = [
        'SITUACIÓN PLANTEADA EN CHAT:',
        conversationText,
        '\nCONTEXTO RAG:',
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
      } else if (provider === 'openrouter') {
        try {
          aiText = await requestOpenRouterText(model, activeKey, systemPrompt, userPrompt, OPENROUTER_PRESET_METRIX);
        } catch (orError) {
          console.warn('[ChatMetriX] OpenRouter falló, reintentando con Gemini:', orError);
          const fallbackKey = geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
          if (!fallbackKey) throw orError;
          const fallbackRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${fallbackKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: userPrompt }] }],
              systemInstruction: { parts: [{ text: baseSystemPrompt }] },
            }),
          });
          if (!fallbackRes.ok) throw new Error(await fallbackRes.text());
          const fallbackData = await fallbackRes.json();
          aiText = fallbackData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
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

      const parsed = parseJsonFromText(aiText);
      if (!parsed) {
        setMessages((prev) => [
          ...prev,
          {
            id: `chat-assistant-${Date.now()}`,
            role: 'assistant',
            content: aiText || 'No se pudo interpretar la respuesta de MetriX.',
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }

      const formState = sanitizeFormState(parsed?.formState || {});
      const hasIndexedProductionSupport = formState.produccion.some((pub) => pub.fuente === 'SCOPUS' || pub.fuente === 'ORCID');

      const scenarioRows: ScenarioRow[] = Array.isArray(parsed?.rows)
        ? parsed.rows.map((row: any) => {
          const criterionText = normalizeForSearch(String(row?.criterio || row?.seccion || ''));
          const isResearchCriterion =
            criterionText.includes('produccion') ||
            criterionText.includes('publicacion') ||
            criterionText.includes('articulo') ||
            criterionText.includes('investig');
          const providedSupportFlag = Boolean(row?.soporteValido);
          return {
          criterio: String(row?.criterio || '').trim(),
          seccion: String(row?.seccion || inferSectionFromCriterion(String(row?.criterio || ''))).trim() || 'CRITERIO GENERAL',
          documentoSoporte: String(row?.documentoSoporte || row?.soporte || row?.documento || 'No especificado').trim(),
          soporteValido: isResearchCriterion ? hasIndexedProductionSupport : providedSupportFlag,
          cantidad: Math.max(0, toSafeNumber(row?.cantidad, 1)),
          valor: Math.max(0, toSafeNumber(row?.valor, 0)),
          puntajeBase: Math.max(0, toSafeNumber(row?.puntajeBase, toSafeNumber(row?.puntajeSugerido, 0))),
          puntajeIa: Math.max(0, toSafeNumber(row?.puntajeIa, 0)),
          puntajeSugerido: toSafeNumber(row?.puntajeSugerido, 0),
          comentario: String(row?.comentario || '').trim(),
          };
        })
        : [];

      const calc = calculateAdvancedEscalafon(formState);
      const concept = String(parsed?.concepto || parsed?.narrativa || '').trim() || 'MetriX no devolvió concepto textual.';

      setLastRows(scenarioRows);
      setLastCalc(calc);
      setLastFormState(formState);
      setLastRagSources(ragResult.references);
      setLastConcept(concept);

      const chatSummary = [
        concept,
        '',
        `Resultado del algoritmo: ${calc.finalPts.toFixed(1)} pts · categoría ${calc.finalCat.name}`,
      ].join('\n');

      setMessages((prev) => [
        ...prev,
        {
          id: `chat-assistant-${Date.now()}`,
          role: 'assistant',
          content: chatSummary,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      const message = toUserFriendlyAiError(error);
      setMessages((prev) => [
        ...prev,
        {
          id: `chat-assistant-${Date.now()}`,
          role: 'assistant',
          content: message,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const scenarioScore = lastRows.reduce((acc, row) => acc + row.puntajeSugerido, 0);
  const scenarioCategory = getSuggestedCategoryByPoints(scenarioScore);
  const scenarioCategoryDisplay = scenarioCategory === 'SIN CATEGORIA' && lastCalc
    ? lastCalc.finalCat.name.toUpperCase()
    : scenarioCategory;

  const decisionNarrative = (() => {
    if (!lastCalc || !lastFormState) return '';

    const titleLevels = lastFormState.titulos.map((row) => row.nivel);
    const highestTitle = titleLevels.includes('Doctorado')
      ? 'Doctorado'
      : titleLevels.includes('Maestría')
        ? 'Maestría'
        : titleLevels.includes('Especialización')
          ? 'Especialización'
          : titleLevels.includes('Pregrado')
            ? 'Pregrado'
            : 'Ninguno';

    const languageOrder = ['A2', 'B1', 'B2', 'C1'];
    const highestLanguage = lastFormState.idiomas.reduce<'A2' | 'B1' | 'B2' | 'C1' | 'Sin idioma'>((current, row) => {
      if (current === 'Sin idioma') return row.nivel;
      return languageOrder.indexOf(row.nivel) > languageOrder.indexOf(current) ? row.nivel : current;
    }, 'Sin idioma');

    const expDocYears = lastFormState.experiencia
      .filter((row) => row.tipo === 'Docencia Universitaria')
      .reduce((acc, row) => acc + calculateYears(row.inicio, row.fin), 0);
    const expInvYears = lastFormState.experiencia
      .filter((row) => row.tipo === 'Investigación')
      .reduce((acc, row) => acc + calculateYears(row.inicio, row.fin), 0);
    const expProYears = lastFormState.experiencia
      .filter((row) => row.tipo === 'Profesional')
      .reduce((acc, row) => acc + calculateYears(row.inicio, row.fin), 0);

    const supportRows = lastRows.filter((row) => row.soporteValido).length;
    const noSupportRows = Math.max(0, lastRows.length - supportRows);
    const diffTableVsAlgo = lastCalc.finalPts - scenarioScore;

    return [
      `A partir del relato conversacional, la decisión se consolidó con una lectura integral de formación, idioma, producción intelectual, experiencia y trazabilidad de soportes. En ese proceso, el motor de escalafón integró la evidencia en un puntaje final de ${lastCalc.finalPts.toFixed(1)} puntos, lo que ubica el caso en la categoría ${lastCalc.finalCat.name}.`,
      `En la dimensión académica se reconoció como hito principal el nivel ${highestTitle}, con una contribución de ${lastCalc.ptsAcad.toFixed(1)} puntos; de manera complementaria, el componente de competencia lingüística se valoró con base en el nivel más alto reportado (${highestLanguage}), aportando ${lastCalc.ptsIdioma.toFixed(1)} puntos según los criterios reglamentarios vigentes.`,
      `Para experiencia, se depuraron periodos por tipología y solapamiento temporal, evitando doble contabilización: docencia universitaria ${expDocYears.toFixed(1)} años, investigación ${expInvYears.toFixed(1)} años y experiencia profesional ${expProYears.toFixed(1)} años. Este bloque generó ${lastCalc.ptsExpBruta.toFixed(1)} puntos brutos y luego se ajustó al tope técnico aplicable de ${lastCalc.appliedTope.toFixed(1)} puntos, preservando coherencia con la categoría objetivo.`,
      `En producción intelectual se examinaron ${lastFormState.produccion.length} productos, considerando cuartil, naturaleza de producto, vigencia y coautoría, con resultado de ${lastCalc.ptsPI.toFixed(1)} puntos. Paralelamente, la matriz conversacional consolidó ${lastRows.length} criterios observables, de los cuales ${supportRows} quedaron con soporte verificable y ${noSupportRows} sin soporte explícito; ese contraste permitió construir un subtotal analítico de ${scenarioScore.toFixed(1)} puntos y una categoría de referencia ${scenarioCategoryDisplay}.`,
      diffTableVsAlgo !== 0
        ? `La brecha de ${diffTableVsAlgo.toFixed(1)} puntos entre matriz y resultado final no implica inconsistencia, sino diferencia metodológica: la tabla refleja valoración criterio a criterio en lenguaje conversacional, mientras el algoritmo ejecuta reglas de consolidación global, restricciones normativas y topes de categoría para asegurar una decisión final técnicamente defendible.`
        : 'La coincidencia exacta entre subtotal de matriz y resultado final confirma alineación plena entre interpretación conversacional y aplicación algorítmica de la norma.',
      lastRagSources.length > 0
        ? `Como sustento de trazabilidad normativa, se consultaron las siguientes fuentes RAG durante el análisis: ${lastRagSources.join(', ')}.`
        : 'En esta ejecución no se recuperaron fuentes adicionales desde RAG, por lo que la decisión se soportó en las reglas generales del motor de escalafón y en los hechos descritos en la conversación.',
      'Con base en lo anterior, la recomendación final prioriza la consistencia documental y la suficiencia de soporte por criterio, de manera que cualquier ajuste posterior de categoría o puntaje deberá sustentarse en nueva evidencia verificable y no solo en ampliaciones narrativas del caso.',
    ].join('\n\n');
  })();

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-cyan-200 bg-gradient-to-r from-cyan-900 via-blue-900 to-indigo-900 p-6 text-white shadow-xl">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white/20 p-2.5">
            <MessageSquareText size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Módulo Conversacional Independiente</p>
            <h3 className="mt-1 text-2xl font-black uppercase tracking-tight">Chat con MetriX</h3>
            <p className="mt-2 text-sm font-semibold text-cyan-100">
              Describe una situación libremente. MetriX analizará el caso sin depender de expedientes cargados,
              usando RAG normativo y el algoritmo de escalafón para emitir concepto y tabla de puntaje.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Conversación</p>
              <span className={`text-[10px] font-black uppercase ${connected ? 'text-emerald-600' : 'text-amber-600'}`}>
                {connected ? 'Conectado' : 'Sin conexión'}
              </span>
            </div>

            {connectionWarning && (
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-semibold text-amber-800">
                {connectionWarning}
              </div>
            )}

            <div className="h-[420px] overflow-y-auto bg-slate-50 p-4 space-y-3">
              {messages.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5">
                  <p className="text-sm font-medium text-slate-600">
                    Ejemplo: "Tengo una situación donde el docente reporta maestría y 3 años de docencia, pero no presenta soporte de idioma. ¿Qué categoría procedería y por qué?"
                  </p>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] rounded-xl px-4 py-3 ${message.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-justify">{message.content}</p>
                    <p className={`mt-2 text-[10px] ${message.role === 'user' ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {message.createdAt.replace('T', ' ').slice(0, 19)}
                    </p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[94%] w-full rounded-2xl border border-cyan-100 bg-gradient-to-r from-white via-cyan-50 to-indigo-50 px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
                      <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse [animation-delay:180ms]" />
                      <span className="inline-flex h-2 w-2 rounded-full bg-sky-400 animate-pulse [animation-delay:320ms]" />
                      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-700">MetriX está analizando</p>
                    </div>

                    <div className="mt-3 space-y-2">
                      {THINKING_STEPS.map((step, index) => {
                        const isDone = index < thinkingStepIndex;
                        const isActive = index === thinkingStepIndex;
                        return (
                          <div key={step} className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${isDone ? 'bg-emerald-500' : isActive ? 'bg-cyan-500 animate-pulse' : 'bg-slate-300'}`} />
                            <p className={`text-[11px] ${isDone ? 'text-emerald-700 font-semibold' : isActive ? 'text-cyan-700 font-semibold' : 'text-slate-500'}`}>
                              {step}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-white p-4">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={3}
                placeholder="Expón la situación específica que quieres evaluar..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="mt-3 flex justify-end">
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-cyan-700 disabled:opacity-50"
                >
                  <Send size={14} /> {loading ? 'Analizando...' : 'Enviar a MetriX'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700">Concepto MetriX</p>
              <p className="mt-2 whitespace-pre-wrap text-xs font-medium text-cyan-900 text-justify">
                {lastConcept || 'Aquí aparecerá el concepto técnico emitido por MetriX.'}
              </p>
            </div>

            {loading && (
              <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-700">Pensamiento en curso</p>
                <div className="mt-2 rounded-lg bg-white/80 p-3 shadow-inner">
                  <p className="text-xs font-semibold text-slate-700">{THINKING_STEPS[thinkingStepIndex]}</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-cyan-500 animate-pulse"
                      style={{ width: `${((thinkingStepIndex + 1) / THINKING_STEPS.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-700">Resultado algoritmo escalafón</p>
              {lastCalc ? (
                <>
                  <p className="mt-2 text-2xl font-black text-indigo-900">{lastCalc.finalPts.toFixed(1)} pts</p>
                  <p className="text-sm font-black uppercase text-indigo-800">{lastCalc.finalCat.name}</p>
                </>
              ) : (
                <p className="mt-2 text-xs font-medium text-indigo-800">Sin cálculo aún.</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Tabla de puntaje conversacional</p>
              {lastRows.length === 0 ? (
                <p className="mt-2 text-xs font-medium text-slate-500">Sin tabla generada todavía.</p>
              ) : (
                <>
                  <div className="mt-2 max-h-[220px] overflow-auto space-y-2">
                    {lastRows.map((row, index) => (
                      <div key={`${row.criterio}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">{row.seccion}</p>
                        <p className="text-xs font-black uppercase text-slate-700">{row.criterio}</p>
                        <p className="mt-1 text-[11px] text-slate-600 text-justify">{row.comentario || 'Sin comentario'}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className={`text-[10px] font-black uppercase ${row.soporteValido ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {row.soporteValido ? 'Con soporte' : 'Sin soporte'}
                          </span>
                          <span className="text-sm font-black text-slate-900">{row.puntajeSugerido.toFixed(1)} pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-black uppercase text-slate-500">Total tabla</p>
                    <p className="text-lg font-black text-slate-900">{scenarioScore.toFixed(1)} pts</p>
                    <p className="text-xs font-black uppercase text-slate-700">Categoría sugerida por tabla: {scenarioCategoryDisplay}</p>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <BrainCircuit size={16} className="text-slate-700" />
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">Modo</p>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-700">
                Chat independiente sin vínculo a expedientes. Solo se usa la situación descrita en conversación, RAG normativo y algoritmo de escalafón.
              </p>
            </div>
          </div>
        </div>
      </section>

      {(lastRows.length > 0 || lastCalc) && (
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Matriz de categorización conversacional</p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Construida automáticamente a partir de la consulta en chat, contexto RAG y validaciones del motor de escalafón.
            </p>
          </div>

          {lastRows.length > 0 ? (
            <div className="overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-[980px] w-full text-left">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">Sección</th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">Criterio</th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">Documento / soporte</th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">Estado soporte</th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">Cant.</th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">Valor</th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">Puntaje</th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">Puntaje IA</th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">Comentario IA</th>
                  </tr>
                </thead>
                <tbody>
                  {lastRows.map((row, index) => (
                    <tr key={`${row.criterio}-${index}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-xs font-semibold text-slate-700">{row.seccion}</td>
                      <td className="px-3 py-2 text-xs font-black uppercase text-slate-800">{row.criterio}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">{row.documentoSoporte || 'Sin dato'}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-black uppercase ${row.soporteValido ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {row.soporteValido ? 'Con soporte' : 'Sin soporte'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold text-slate-700">{row.cantidad.toFixed(1)}</td>
                      <td className="px-3 py-2 text-xs font-semibold text-slate-700">{row.valor.toFixed(1)}</td>
                      <td className="px-3 py-2 text-xs font-black text-indigo-700">{row.puntajeBase.toFixed(1)}</td>
                      <td className="px-3 py-2 text-xs font-black text-orange-600">{row.puntajeIa.toFixed(1)}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 text-justify">{row.comentario || 'Sin comentario IA'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td colSpan={6} className="px-3 py-3 text-right text-xs font-black uppercase tracking-[0.08em] text-slate-700">
                      Puntaje total sugerido por matriz
                    </td>
                    <td className="px-3 py-3 text-sm font-black text-indigo-800">{scenarioScore.toFixed(1)}</td>
                    <td className="px-3 py-3 text-sm font-black text-orange-700">{lastRows.reduce((acc, row) => acc + row.puntajeIa, 0).toFixed(1)}</td>
                    <td className="px-3 py-3 text-xs font-black uppercase text-slate-700">{scenarioCategoryDisplay}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-500">Sin filas para construir la matriz conversacional.</p>
          )}

          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700">Conclusiones de decisión</p>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed font-medium text-cyan-900 text-justify">
              {decisionNarrative || 'Las conclusiones narrativas aparecerán cuando MetriX procese la consulta y construya la matriz.'}
            </p>
          </div>
        </section>
      )}
    </div>
  );
};

export default ChatMetriXModule;
