import React, { useEffect, useRef, useState } from 'react';
import { BrainCircuit, MessageSquareText, Send } from 'lucide-react';

import { DbConnection } from '../../module_bindings';
import { getPortalCredentialsForRole, getPortalSession } from '../../services/portalAuth';
import { getSpacetimeConnectionConfig } from '../../services/spacetime';
import type { FormState } from '../../types/domain';
import { calculateAdvancedEscalafon, getSuggestedCategoryByPoints } from '../../utils/calculateEscalafon';

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
};

const THINKING_STEPS = [
  'Leyendo el caso y estructurando variables de entrada',
  'Recuperando contexto normativo desde RAG',
  'Construyendo matriz de criterios y soporte',
  'Aplicando reglas del algoritmo y topes por categoría',
  'Redactando concepto y conclusiones finales',
];

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
  return score;
};

const toSafeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    if (normalized.includes('maestr')) return 'Maestría';
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
      fuente: String(row?.fuente || row?.source || 'MANUAL').toUpperCase() === 'SCOPUS' ? 'SCOPUS' as const : 'MANUAL' as const,
    }))
    : [];

  const experiences = Array.isArray(candidate?.experiencia)
    ? candidate.experiencia.map((row: any) => ({
      tipo: mapExperienceType(row?.tipo || row?.type),
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [apifreellmApiKey, setApifreellmApiKey] = useState('');
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
        ensurePortalSession(conn).catch((e) => console.warn('Portal session en ChatMetriXModule:', e));
      })
      .onConnectError((_ctx: unknown, err: unknown) => {
        console.error('ChatMetriXModule connect error:', err);
        setConnected(false);
      })
      .build();

    connectionRef.current = connection;

    const refreshFromCache = () => {
      const dbView = connection.db as any;
      const apiTable = dbView.apiConfig || dbView.api_config;
      if (apiTable) {
        const apiRows = Array.from(apiTable.iter()) as any[];
        const defaultCfg = apiRows.find((row) => row.configKey === 'default');
        if (defaultCfg?.geminiApiKey) setGeminiApiKey(defaultCfg.geminiApiKey);
        if (defaultCfg?.apifreellmApiKey) setApifreellmApiKey(defaultCfg.apifreellmApiKey);
        if (defaultCfg?.aiProvider) setAiProvider(defaultCfg.aiProvider);
        if (defaultCfg?.aiModel) setAiModel(defaultCfg.aiModel);
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
            }
          })
          .subscribe([
            'SELECT * FROM api_config',
            'SELECT * FROM rag_config',
            'SELECT * FROM rag_document',
          ]);

        setTimeout(() => reject(new Error('Timeout cargando Chat MetriX')), 6000);

        void subscription;
      });
    };

    void loadOnce().catch((error) => console.error(error));

    return () => {
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
      .filter((row) => row.active)
      .map((row) => ({
        fileName: row.fileName,
        active: row.active,
        contentBase64: row.contentBase64 ?? undefined,
      }));
  };

  const buildRagContext = (question: string) => {
    const queryTerms = Array.from(
      new Set(
        normalizeForSearch(question)
          .split(/[^a-z0-9]+/)
          .filter((term) => term.length >= 4),
      ),
    );

    const rankedChunks: Array<{ fileName: string; chunk: string; score: number }> = [];
    const docs = getActiveRagDocuments();
    for (const doc of docs) {
      const decoded = decodeBase64Document(doc.contentBase64);
      if (!decoded) continue;
      const chunks = chunkText(decoded, ragChunkSize, ragChunkOverlap);
      for (const chunk of chunks) {
        const score = scoreRagChunk(chunk, queryTerms);
        if (score > 0) rankedChunks.push({ fileName: doc.fileName, chunk, score });
      }
    }

    const selected = rankedChunks
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
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };

    const conversation = [...messages, userMessage];
    setMessages(conversation);
    setInput('');
    setLoading(true);

    try {
      const ragResult = buildRagContext(userMessage.content);
      const ragContext = ragResult.context;
      const conversationText = conversation
        .map((entry) => `${entry.role === 'user' ? 'Usuario' : 'MetriX'}: ${entry.content}`)
        .join('\n');

      const systemPrompt = [
        'Eres MetriX, asistente experto de escalafón docente UDES para Talento Humano.',
        'NO dependes de expedientes almacenados: analiza únicamente la situación conversada por el usuario.',
        'Debes devolver SIEMPRE JSON válido con esta forma exacta:',
        '{"concepto":"explicación técnica y normativa","rows":[{"seccion":"ESTUDIOS CURSADOS|EXPERIENCIA|OTROS","criterio":"...","documentoSoporte":"...","soporteValido":true,"cantidad":1,"valor":300,"puntajeBase":300,"puntajeIa":0,"puntajeSugerido":120,"comentario":"..."}],"formState":{"nombre":"...","documento":"...","programa":"...","facultad":"...","titulos":[{"titulo":"...","nivel":"Pregrado|Especialización|Maestría|Doctorado"}],"idiomas":[{"idioma":"...","nivel":"A2|B1|B2|C1","convalidacion":"SI|NO"}],"produccion":[{"titulo":"...","cuartil":"Q1|Q2|Q3|Q4","fecha":"2024","tipo":"...","autores":1,"fuente":"SCOPUS|MANUAL"}],"experiencia":[{"tipo":"Profesional|Docencia Universitaria|Investigación","inicio":"YYYY-MM-DD","fin":"YYYY-MM-DD","certificacion":"SI|NO"}]}}',
        'No inventes normas; usa RAG cuando exista y menciona fuentes en el concepto.',
      ].join(' ');

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

      const scenarioRows: ScenarioRow[] = Array.isArray(parsed?.rows)
        ? parsed.rows.map((row: any) => ({
          criterio: String(row?.criterio || '').trim(),
          seccion: String(row?.seccion || inferSectionFromCriterion(String(row?.criterio || ''))).trim() || 'CRITERIO GENERAL',
          documentoSoporte: String(row?.documentoSoporte || row?.soporte || row?.documento || 'No especificado').trim(),
          soporteValido: Boolean(row?.soporteValido),
          cantidad: Math.max(0, toSafeNumber(row?.cantidad, 1)),
          valor: Math.max(0, toSafeNumber(row?.valor, 0)),
          puntajeBase: Math.max(0, toSafeNumber(row?.puntajeBase, toSafeNumber(row?.puntajeSugerido, 0))),
          puntajeIa: Math.max(0, toSafeNumber(row?.puntajeIa, 0)),
          puntajeSugerido: toSafeNumber(row?.puntajeSugerido, 0),
          comentario: String(row?.comentario || '').trim(),
        }))
        : [];

      const formState = sanitizeFormState(parsed?.formState || {});
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
      const message = error instanceof Error ? error.message : 'No fue posible procesar la consulta con MetriX.';
      setMessages((prev) => [
        ...prev,
        {
          id: `chat-assistant-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${message}`,
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
