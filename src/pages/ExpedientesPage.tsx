import React, { useEffect, useRef, useState } from 'react';

import { DbConnection } from '../module_bindings';
import type { Application } from '../module_bindings/types';
import type { AppExperience, AppLanguage, AppPublication, AppTitle, FormState, RequestRecord } from '../types/domain';
import { CATEGORIES, emptyForm } from '../types/escalafon';
import { calculateAdvancedEscalafon } from '../utils/calculateEscalafon';
import { importScopusProduccion as importScopusProduccionFromApi } from '../services/scopus';
import { getSpacetimeConnectionConfig } from '../services/spacetime';
import { getPortalSession, getPortalCredentialsForRole } from '../services/portalAuth';
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

const ExpedientesPage = (_props: Props) => {
  const connectionRef = useRef<DbConnection | null>(null);
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
  const [connected, setConnected] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [apifreellmApiKey, setApifreellmApiKey] = useState('');
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiModel, setAiModel] = useState('gemini-2.5-flash');
  const [ragSystemContext, setRagSystemContext] = useState('');
  const [ragTopK, setRagTopK] = useState(5);
  const [ragChunkSize, setRagChunkSize] = useState(1200);
  const [ragChunkOverlap, setRagChunkOverlap] = useState(150);
  const [ragDocuments, setRagDocuments] = useState<StoredRagDocument[]>([]);

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
      .onConnect((conn) => {
        setConnected(true);
        ensurePortalSession(conn).catch((e) => console.warn('Portal session en ExpedientesPage:', e));
      })
      .onConnectError((_ctx, err) => {
        console.error('ExpedientesPage connect error:', err);
        setConnected(false);
      })
      .build();

    connectionRef.current = connection;

    const refreshFromCache = () => {
      const dbView = connection.db as any;
      const appTable = dbView.application;
      const appRows = appTable ? (Array.from(appTable.iter()) as Application[]) : [];

      // Load audit data
      const auditTable = dbView.applicationAudit || dbView.application_audit;
      const auditRows = auditTable ? (Array.from(auditTable.iter()) as any[]) : [];
      const auditMap = new Map(auditRows.map((a) => [a.trackingId, a]));

      // Load API key and AI config
      const apiTable = dbView.apiConfig || dbView.api_config;
      if (apiTable) {
        const apiRows = Array.from(apiTable.iter()) as any[];
        const defaultCfg = apiRows.find((r) => r.configKey === 'default');
        if (defaultCfg?.geminiApiKey) setGeminiApiKey(defaultCfg.geminiApiKey);
        if (defaultCfg?.apifreellmApiKey) setApifreellmApiKey(defaultCfg.apifreellmApiKey);
        if (defaultCfg?.aiProvider) setAiProvider(defaultCfg.aiProvider);
        if (defaultCfg?.aiModel) setAiModel(defaultCfg.aiModel);
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

      const ragDocumentTable = dbView.ragDocument || dbView.rag_document;
      const ragDocumentRows = ragDocumentTable ? (Array.from(ragDocumentTable.iter()) as any[]) : [];
      setRagDocuments(
        ragDocumentRows
          .filter((row) => row.active)
          .map((row) => ({
            documentKey: row.documentKey,
            fileName: row.fileName,
            fileType: row.fileType,
            active: row.active,
            contentBase64: row.contentBase64 ?? undefined,
          })),
      );

      const mapped: RequestRecord[] = appRows
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

    const subscription = connection
      .subscriptionBuilder()
      .onApplied(() => {
        refreshFromCache();
      })
      .onError((ctx) => {
        console.error(ctx);
      })
      .subscribe([
        'SELECT * FROM application',
        'SELECT * FROM application_title',
        'SELECT * FROM application_language',
        'SELECT * FROM application_publication',
        'SELECT * FROM application_experience',
        'SELECT * FROM application_audit',
        'SELECT * FROM api_config',
        'SELECT * FROM rag_config',
        'SELECT * FROM rag_document',
        'SELECT * FROM system_setting',
      ]);

    return () => {
      subscription.unsubscribe();
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

    if (formData.titulos.length === 0 || formData.titulos.some((t) => !t.titulo.trim())) {
      window.alert('Agrega al menos un título válido.');
      return;
    }

    if (formData.idiomas.length === 0 || formData.idiomas.some((i) => !i.idioma.trim())) {
      window.alert('Agrega al menos un idioma válido.');
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
        });
      }

      window.alert('Expediente registrado correctamente.');
      setFormData(emptyForm);
      setView('lista');
    } catch (e) {
      console.error(e);
      window.alert('No fue posible registrar el expediente. Revisa consola para más detalle.');
    } finally {
      setLoading(false);
    }
  };

  const deleteRecord = async (id: string) => {
    window.alert(`La eliminación no está habilitada en Spacetime para ${id}.`);
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
    for (const document of ragDocuments) {
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

    const selectedChunks = rankedChunks
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, ragTopK))
      .map((item, index) => `[Fuente ${index + 1}: ${item.fileName}]\n${item.chunk.slice(0, 1800)}`);

    return selectedChunks.length > 0
      ? selectedChunks.join('\n\n')
      : 'No se recuperaron fragmentos normativos desde RAG para este expediente.';
  };

  const generateAI = async (req: RequestRecord) => {
    const provider = aiProvider || 'gemini';
    const model = aiModel || 'gemini-2.5-flash';
    const geminiKey = geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
    const freellmKey = apifreellmApiKey || '';

    const activeKey = provider === 'gemini' ? geminiKey : freellmKey;
    if (!activeKey) {
      setAiAnalysis(`No se encontró API Key para ${provider === 'gemini' ? 'Gemini' : 'APIFreeLLM'}. Configúrala en el módulo de Configuración > API.`);
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
        produccion: selectedPublications.map((p) => ({
          titulo: p.publicationTitle,
          cuartil: p.quartile as 'Q1' | 'Q2' | 'Q3' | 'Q4',
          fecha: p.publicationYear,
          tipo: p.publicationType,
          autores: p.authorsCount,
          fuente: p.sourceKind as 'SCOPUS' | 'MANUAL',
        })),
        experiencia: selectedExperiences.map((e) => ({
          tipo: e.experienceType as 'Profesional' | 'Docencia Universitaria' | 'Investigación',
          inicio: e.startedAt,
          fin: e.endedAt,
          certificacion: e.certified ? 'SI' as const : 'NO' as const,
        })),
      });

      const workflowSummary = [
        `Académico: ${provisionalBreakdown.ptsAcad.toFixed(1)} pts posibles · ${req.audit?.titleValidated ? 'Conforme por auxiliar' : 'Pendiente validación del auxiliar'}`,
        `Idiomas: ${provisionalBreakdown.ptsIdioma.toFixed(1)} pts posibles · ${req.audit?.languageValidated ? 'Conforme por auxiliar' : 'Pendiente validación del auxiliar'}`,
        `Producción: ${provisionalBreakdown.ptsPI.toFixed(1)} pts posibles · ${req.audit?.publicationVerified ? 'Verificada por auxiliar' : 'Pendiente verificación del auxiliar'}`,
        `Experiencia: ${Math.min(provisionalBreakdown.ptsExpBruta, provisionalBreakdown.appliedTope).toFixed(1)} pts posibles · ${req.audit?.experienceCertified ? 'Certificada por auxiliar' : 'Pendiente certificación del auxiliar'}`,
        `Resultado preliminar por soportes: ${provisionalBreakdown.finalPts.toFixed(1)} pts · categoría posible ${provisionalBreakdown.finalCat.name}`,
      ].join('\n');

      const caseDetail = [
        `Docente: ${req.nombre}`,
        `Documento: ${req.documento}`,
        `Facultad: ${req.facultad}`,
        `Estado del expediente: ${req.status}`,
        `Puntaje final oficial del expediente: ${req.finalPts.toFixed(1)}`,
        `Categoría oficial asignada: ${req.finalCat.name}`,
        `Mensaje oficial del motor: ${req.outputMessage}`,
        `Validación de títulos: ${req.audit?.titleValidated ? 'Sí' : 'No'}`,
        `Validación de idiomas: ${req.audit?.languageValidated ? 'Sí' : 'No'}`,
        `Validación de publicaciones: ${req.audit?.publicationVerified ? 'Sí' : 'No'}`,
        `Certificación de experiencia: ${req.audit?.experienceCertified ? 'Sí' : 'No'}`,
        `Observaciones de auditoría: ${req.audit?.observations || 'Sin observaciones registradas'}`,
        `\nLECTURA PRELIMINAR POR SOPORTES Y WORKFLOW:\n${workflowSummary}`,
        `\nTÍTULOS ACADÉMICOS: ${titulosTxt}`,
        `IDIOMAS: ${idiomasTxt}`,
        `PRODUCCIÓN INTELECTUAL: ${pubsTxt}`,
        `EXPERIENCIA: ${expTxt}`,
      ].join('\n');

      const ragContext = buildRagContext(req, caseDetail);

      const baseSystemPrompt = `Eres un auditor jurídico-académico senior del Comité de Asignación de Puntaje (CAP) de la Universidad de Santander (UDES). Debes emitir un informe extenso, formalista, explicativo y profesional, con redacción narrativa y criterio técnico.

Actúa simultáneamente desde cuatro planos:
1. Como abogada de Talento Humano: analiza cumplimiento normativo, suficiencia documental, riesgos jurídicos y cargas probatorias.
2. Como Coordinadora de Talento Humano: analiza viabilidad administrativa, brechas del expediente, acciones de subsanación y riesgo operativo.
3. Como Comité de Aprobación: analiza mérito académico, consistencia del puntaje, pertinencia de la categoría y condiciones para aprobar, devolver o requerir ajustes.
4. Como auditor IA independiente: identifica coincidencias entre las tres perspectivas y emite una recomendación propia, motivada y prudente.

Debes usar prioritariamente el contexto RAG suministrado. Cita expresamente las fuentes normativas recuperadas en el cuerpo del informe usando el formato "Fuente RAG X" o el nombre del documento. No inventes artículos ni normas. Si una regla no aparece en el contexto RAG, dilo de forma expresa.

El informe debe contener estas secciones, con desarrollo en párrafos completos y no solo listas:

## 1. Resumen ejecutivo del expediente
Presenta el perfil del docente, la categoría resultante, el puntaje observado y la tesis central del informe.

## 2. Perspectiva de la Abogada de Talento Humano
Analiza requisitos, soportes, cumplimiento normativo, riesgos de contradicción, vacíos probatorios y consecuencias jurídicas.

## 3. Perspectiva de la Coordinadora de Talento Humano
Explica la lectura administrativa del caso, suficiencia del expediente para trámite, alertas de gestión y plan de subsanación o cierre.

## 4. Perspectiva del Comité de Aprobación
Explica por qué el puntaje y la categoría lucen consistentes o inconsistentes con la evidencia aportada, y si procede aprobación, condicionamiento o devolución.

## 5. Coincidencias críticas entre las tres perspectivas
Sintetiza los puntos comunes y los desacuerdos relevantes.

## 6. Recomendación propia del auditor IA
Emite una recomendación final autónoma, argumentada y prudente. Debe indicar si recomiendas aprobar, aprobar con condicionamientos, requerir subsanación o no aprobar.

## 7. Trazabilidad razonada del puntaje
Explica de manera narrativa por qué el expediente alcanza o no el puntaje final oficial informado. Debes diferenciar explícitamente entre el puntaje oficial del expediente y la posible calificación preliminar derivada de los soportes cargados y del estado del workflow. Relaciona títulos, idiomas, producción y experiencia con el resultado final, y aclara los límites, topes o faltantes cuando corresponda.

## 8. Sustento normativo citado
Lista las normas y fragmentos RAG realmente usados, con citas breves y su relevancia para la decisión.

Reglas de salida:
- Responde en español jurídico-administrativo claro.
- Sé detallado, explicativo y formalista.
- Usa encabezados Markdown.
- Evita respuestas cortas o genéricas.
- Si la evidencia es insuficiente, dilo y explica qué soporte falta.
- Diferencia siempre entre "puntaje oficial del expediente" y "posible calificación por soportes".
- No trates como definitivo un componente que siga pendiente de validación auxiliar.
- Nunca digas que usaste un RAG si no vas a citar el contexto efectivamente entregado.`;

      const systemPrompt = ragSystemContext
        ? `${ragSystemContext}\n\n${baseSystemPrompt}`
        : baseSystemPrompt;

      const userMessage = `Genera un informe auditor integral del siguiente expediente docente UDES. Debes explicar el porqué del puntaje, la categoría y los riesgos del caso con base en el expediente y en el contexto normativo recuperado.\n\n### Expediente\n${caseDetail}\n\n### Contexto normativo RAG recuperado\n${ragContext}\n\n### Instrucción adicional\nSi el contexto RAG no basta para afirmar un requisito, indícalo expresamente. No simplifiques el análisis. Produce un informe profesional, extenso y bien motivado.`;

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
          throw new Error(errorText || `Gemini respondió ${res.status}`);
        }
        const data = await res.json();
        aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        // APIFreeLLM is proxied through Vite in local development to avoid browser CORS issues.
        const res = await fetch('/api/apifreellm/api/v1/chat', {
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
          throw new Error(errorText || `APIFreeLLM respondió ${res.status}`);
        }
        const data = await res.json();
        aiText = data.response || data.message || data.content || data.text || '';
      }

      setAiAnalysis(aiText || 'No se pudo generar dictamen.');
    } catch (error) {
      setAiAnalysis(error instanceof Error ? `Error en dictamen: ${error.message}` : 'Error en dictamen.');
    } finally {
      setAiGenerating(false);
    }
  };

  const addTitulo = () =>
    setFormData((p) => ({ ...p, titulos: [...p.titulos, { titulo: '', nivel: 'Pregrado' }] }));

  const addIdioma = () =>
    setFormData((p) => ({ ...p, idiomas: [...p.idiomas, { idioma: '', nivel: 'A2', convalidacion: 'NO' }] }));

  const addExperiencia = () =>
    setFormData((p) => ({
      ...p,
      experiencia: [...p.experiencia, { tipo: 'Docencia Universitaria', inicio: '', fin: '', certificacion: 'NO' }],
    }));

  const addProduccionManual = () =>
    setFormData((p) => ({
      ...p,
      produccion: [
        ...p.produccion,
        { titulo: '', cuartil: 'Q4', fecha: new Date().getFullYear().toString(), tipo: 'Artículo', autores: 1, fuente: 'MANUAL' },
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
      window.alert('Sin conexión a SpacetimeDB.');
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
      const scopusKey = import.meta.env.VITE_SCOPUS_API_KEY || '';
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
          />
        )}
      </div>

      {loading && <LoadingOverlay />}
    </>
  );
};

export default ExpedientesPage;
