import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  FileSearch,
  FileText,
  Info,
  Plus,
  Save,
  Wand2,
} from 'lucide-react';

import type {
  ApiConfig,
  ModelAlternative,
  ModelTestConditions,
  RagConfig,
  RagDocument,
} from '../types/config';
import { getModelAlternatives } from '../services/modelAdvisor';

type Props = {
  ragConfig: RagConfig;
  ragDocuments: RagDocument[];
  apiConfig: ApiConfig;
  onChangeRagConfig: (next: RagConfig) => void;
  onSaveRagConfig: () => Promise<void>;
  onUploadDocument: (file: File) => Promise<void>;
  onDeactivateDocument: (documentKey: string) => Promise<void>;
};

const prettyBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
};

export const RAGConfigSection: React.FC<Props> = ({
  ragConfig,
  ragDocuments,
  apiConfig,
  onChangeRagConfig,
  onSaveRagConfig,
  onUploadDocument,
  onDeactivateDocument,
}) => {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [alternatives, setAlternatives] = useState<ModelAlternative[]>([]);
  const [recommended, setRecommended] = useState<ModelAlternative | null>(null);

  const [conditions, setConditions] = useState<ModelTestConditions>({
    taskType: 'legal',
    maxLatencyMs: 2000,
    maxCostTier: 2,
    minimumQuality: 4,
    ragRequired: true,
    prompt:
      'Analiza el caso de escalafon, cita la norma aplicable y recomienda categoria con justificacion legal y tecnica.',
  });

  const hasApiKeyForSelected = useMemo(() => {
    if (ragConfig.selectedProvider === 'gemini') return !!apiConfig.geminiApiKey.trim();
    return !!apiConfig.apifreellmApiKey.trim();
  }, [ragConfig.selectedProvider, apiConfig.geminiApiKey, apiConfig.apifreellmApiKey]);

  const activeDocuments = ragDocuments.filter((doc) => doc.active);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;

    try {
      setUploading(true);
      await onUploadDocument(selected);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSaveRagConfig();
    } finally {
      setSaving(false);
    }
  };

  const handleTestModels = async () => {
    setTesting(true);
    try {
      const result = getModelAlternatives(conditions);
      setAlternatives(result.alternatives);
      setRecommended(result.recommended);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <div className="space-y-6 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl">
          <div className="flex items-center gap-3">
            <Database className="text-blue-600" size={20} />
            <h3 className="text-lg font-black tracking-tight text-slate-800">RAG y Bucket de Documentos</h3>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <input
              type="checkbox"
              className="h-5 w-5 accent-blue-600"
              checked={ragConfig.enabled}
              onChange={(e) => onChangeRagConfig({ ...ragConfig, enabled: e.target.checked })}
            />
            <span className="text-sm font-bold text-blue-900">Habilitar RAG como fuente adicional del motor IA</span>
          </label>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Bucket lógico</label>
              <input
                value={ragConfig.bucketName}
                onChange={(e) => onChangeRagConfig({ ...ragConfig, bucketName: e.target.value })}
                className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
                placeholder="rag-udes"
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Top-K recuperación</label>
              <input
                type="number"
                min={1}
                max={20}
                value={ragConfig.retrievalTopK}
                onChange={(e) => onChangeRagConfig({ ...ragConfig, retrievalTopK: Number(e.target.value) || 1 })}
                className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Chunk size</label>
              <input
                type="number"
                min={256}
                max={8000}
                value={ragConfig.chunkSize}
                onChange={(e) => onChangeRagConfig({ ...ragConfig, chunkSize: Number(e.target.value) || 256 })}
                className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Chunk overlap</label>
              <input
                type="number"
                min={0}
                max={2000}
                value={ragConfig.chunkOverlap}
                onChange={(e) => onChangeRagConfig({ ...ragConfig, chunkOverlap: Number(e.target.value) || 0 })}
                className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Proveedor principal</label>
              <select
                value={ragConfig.selectedProvider}
                onChange={(e) => onChangeRagConfig({ ...ragConfig, selectedProvider: e.target.value as RagConfig['selectedProvider'] })}
                className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
              >
                <option value="gemini">Gemini</option>
                <option value="apifreellm">APIFreeLLM</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Modelo principal</label>
              <input
                value={ragConfig.selectedModel}
                onChange={(e) => onChangeRagConfig({ ...ragConfig, selectedModel: e.target.value })}
                className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
                placeholder="gemini-2.5-flash"
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Proveedor fallback</label>
              <select
                value={ragConfig.fallbackProvider}
                onChange={(e) => onChangeRagConfig({ ...ragConfig, fallbackProvider: e.target.value as RagConfig['fallbackProvider'] })}
                className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
              >
                <option value="gemini">Gemini</option>
                <option value="apifreellm">APIFreeLLM</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Modelo fallback</label>
              <input
                value={ragConfig.fallbackModel}
                onChange={(e) => onChangeRagConfig({ ...ragConfig, fallbackModel: e.target.value })}
                className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
                placeholder="gpt-4o-mini"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Contexto de sistema (RAG)</label>
              <textarea
                rows={4}
                value={ragConfig.systemContext}
                onChange={(e) => onChangeRagConfig({ ...ragConfig, systemContext: e.target.value })}
                className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-medium outline-none transition-all focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 disabled:opacity-60"
          >
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar configuración RAG'}
          </button>
        </div>

        <div className="space-y-6 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSearch className="text-indigo-600" size={20} />
              <h3 className="text-lg font-black tracking-tight text-slate-800">Documentos de Conocimiento</h3>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white">
              <Plus size={14} />
              {uploading ? 'Subiendo...' : 'Cargar'}
              <input type="file" className="hidden" onChange={handleUpload} />
            </label>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">
            El bucket lógico actual es <strong>{ragConfig.bucketName}</strong>. Se almacenan metadatos + contenido base64 en Spacetime.
          </div>

          <div className="space-y-3">
            {activeDocuments.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
                No hay documentos activos en RAG.
              </p>
            )}

            {activeDocuments.map((doc) => (
              <div key={doc.documentKey} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-800">{doc.fileName}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    {doc.fileType} · {prettyBytes(doc.fileSizeBytes)}
                  </p>
                </div>
                <button
                  onClick={() => onDeactivateDocument(doc.documentKey)}
                  className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100"
                >
                  Desactivar
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-800">
              <Cpu size={18} className="text-emerald-600" /> Probador de modelos IA
            </h3>
            <p className="text-sm font-medium text-slate-500">
              Evalúa alternativas por condiciones específicas y recibe recomendación automática.
            </p>
          </div>
          <button
            onClick={handleTestModels}
            disabled={testing}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 disabled:opacity-60"
          >
            <Wand2 size={16} /> {testing ? 'Evaluando...' : 'Probar condiciones'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Tipo de tarea</label>
            <select
              value={conditions.taskType}
              onChange={(e) => setConditions((prev) => ({ ...prev, taskType: e.target.value as ModelTestConditions['taskType'] }))}
              className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-emerald-500 focus:bg-white"
            >
              <option value="legal">Legal/Doctrinal</option>
              <option value="scoring">Scoring matemático</option>
              <option value="classification">Clasificación de casos</option>
              <option value="email">Redacción de comunicaciones</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Latencia máxima (ms)</label>
            <input
              type="number"
              value={conditions.maxLatencyMs}
              onChange={(e) => setConditions((prev) => ({ ...prev, maxLatencyMs: Number(e.target.value) || 1000 }))}
              className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-emerald-500 focus:bg-white"
            />
          </div>
          <div className="space-y-2">
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Costo máximo (1-3)</label>
            <input
              type="number"
              min={1}
              max={3}
              value={conditions.maxCostTier}
              onChange={(e) => setConditions((prev) => ({ ...prev, maxCostTier: Math.min(3, Math.max(1, Number(e.target.value) || 1)) as 1 | 2 | 3 }))}
              className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-emerald-500 focus:bg-white"
            />
          </div>
          <div className="space-y-2">
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Calidad mínima (1-5)</label>
            <input
              type="number"
              min={1}
              max={5}
              value={conditions.minimumQuality}
              onChange={(e) => setConditions((prev) => ({ ...prev, minimumQuality: Math.min(5, Math.max(1, Number(e.target.value) || 1)) as 1 | 2 | 3 | 4 | 5 }))}
              className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-emerald-500 focus:bg-white"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Prompt de prueba</label>
            <input
              value={conditions.prompt}
              onChange={(e) => setConditions((prev) => ({ ...prev, prompt: e.target.value }))}
              className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-medium outline-none transition-all focus:border-emerald-500 focus:bg-white"
            />
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <input
              type="checkbox"
              checked={conditions.ragRequired}
              onChange={(e) => setConditions((prev) => ({ ...prev, ragRequired: e.target.checked }))}
              className="h-5 w-5 accent-emerald-600"
            />
            <span className="text-sm font-bold text-emerald-900">RAG obligatorio</span>
          </label>
        </div>

        {!hasApiKeyForSelected && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
            <AlertTriangle size={14} />
            El proveedor principal seleccionado no tiene API key cargada en la sección de API.
          </div>
        )}

        {recommended && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-700">Opción recomendada</p>
            <h4 className="mt-1 text-lg font-black text-emerald-900">
              {recommended.provider.toUpperCase()} · {recommended.model}
            </h4>
            <p className="mt-2 text-sm font-semibold text-emerald-800">{recommended.reason}</p>
            <p className="mt-2 text-xs font-bold text-emerald-700">Score final: {recommended.finalScore}</p>
          </div>
        )}

        <div className="space-y-3">
          {alternatives.length === 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
              <Info size={14} /> Ejecuta la prueba para ver alternativas y recomendación.
            </div>
          )}

          {alternatives.map((alt) => (
            <div key={`${alt.provider}-${alt.model}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-800">{alt.provider.toUpperCase()} · {alt.model}</p>
                  <p className="text-xs font-semibold text-slate-500">{alt.reason}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Score</p>
                  <p className="text-lg font-black text-blue-700">{alt.finalScore}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-600">
        <div className="flex items-start gap-2">
          <CheckCircle2 size={14} className="mt-0.5 text-emerald-600" />
          <p>
            El bucket RAG en esta versión se implementa sobre Spacetime como almacenamiento lógico (metadatos + contenido codificado),
            listo para evolucionar a storage externo sin cambiar el modelo funcional.
          </p>
        </div>
      </div>
    </div>
  );
};
