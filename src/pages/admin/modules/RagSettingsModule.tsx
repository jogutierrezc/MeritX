import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Info,
  Save,
  Wand2,
} from 'lucide-react';

import type {
  ApiConfig,
  ModelAlternative,
  ModelTestConditions,
  RagConfig,
} from '../../../types/config';
import { getModelAlternatives } from '../../../services/modelAdvisor';

type Props = {
  ragConfig: RagConfig;
  apiConfig: ApiConfig;
  onChangeRagConfig: (next: RagConfig) => void;
  onSaveRagConfig: () => Promise<void>;
  onStatus: (msg: string) => void;
};

export const RagSettingsModule: React.FC<Props> = ({
  ragConfig,
  apiConfig,
  onChangeRagConfig,
  onSaveRagConfig,
  onStatus,
}) => {
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
    if (ragConfig.selectedProvider === 'openrouter') return !!apiConfig.openrouterApiKey.trim();
    return !!apiConfig.apifreellmApiKey.trim();
  }, [ragConfig.selectedProvider, apiConfig.geminiApiKey, apiConfig.apifreellmApiKey, apiConfig.openrouterApiKey]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSaveRagConfig();
      onStatus('Configuración RAG guardada correctamente.');
    } catch {
      onStatus('No fue posible guardar la configuración RAG.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestModels = () => {
    setTesting(true);
    try {
      const result = getModelAlternatives(conditions);
      setAlternatives(result.alternatives);
      setRecommended(result.recommended);
    } finally {
      setTesting(false);
    }
  };

  const field = (label: string, node: React.ReactNode) => (
    <div className="space-y-2">
      <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">{label}</label>
      {node}
    </div>
  );

  const inputCls =
    'w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white';

  return (
    <div className="space-y-6">
      {/* Config card */}
      <div className="space-y-6 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl">
        <div className="flex items-center gap-3">
          <Database className="text-blue-600" size={20} />
          <h3 className="text-lg font-black tracking-tight text-slate-800">RAG — Configuración del motor</h3>
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
          {field(
            'Bucket lógico',
            <input
              value={ragConfig.bucketName}
              onChange={(e) => onChangeRagConfig({ ...ragConfig, bucketName: e.target.value })}
              className={`${inputCls} md:col-span-2`}
              placeholder="rag-udes"
            />,
          )}
          {field(
            'Top-K recuperación',
            <input
              type="number" min={1} max={20}
              value={ragConfig.retrievalTopK}
              onChange={(e) => onChangeRagConfig({ ...ragConfig, retrievalTopK: Number(e.target.value) || 1 })}
              className={inputCls}
            />,
          )}
          {field(
            'Chunk size',
            <input
              type="number" min={256} max={8000}
              value={ragConfig.chunkSize}
              onChange={(e) => onChangeRagConfig({ ...ragConfig, chunkSize: Number(e.target.value) || 256 })}
              className={inputCls}
            />,
          )}
          {field(
            'Chunk overlap',
            <input
              type="number" min={0} max={2000}
              value={ragConfig.chunkOverlap}
              onChange={(e) => onChangeRagConfig({ ...ragConfig, chunkOverlap: Number(e.target.value) || 0 })}
              className={inputCls}
            />,
          )}
          {field(
            'Proveedor principal',
            <select
              value={ragConfig.selectedProvider}
              onChange={(e) =>
                onChangeRagConfig({ ...ragConfig, selectedProvider: e.target.value as RagConfig['selectedProvider'] })
              }
              className={inputCls}
            >
              <option value="gemini">Gemini</option>
              <option value="apifreellm">APIFreeLLM</option>
              <option value="openrouter">OpenRouter</option>
            </select>,
          )}
          {field(
            'Modelo principal',
            <input
              value={ragConfig.selectedModel}
              onChange={(e) => onChangeRagConfig({ ...ragConfig, selectedModel: e.target.value })}
              className={inputCls}
              placeholder="gemini-2.5-flash"
            />,
          )}
          {field(
            'Proveedor fallback',
            <select
              value={ragConfig.fallbackProvider}
              onChange={(e) =>
                onChangeRagConfig({ ...ragConfig, fallbackProvider: e.target.value as RagConfig['fallbackProvider'] })
              }
              className={inputCls}
            >
              <option value="gemini">Gemini</option>
              <option value="apifreellm">APIFreeLLM</option>
              <option value="openrouter">OpenRouter</option>
            </select>,
          )}
          {field(
            'Modelo fallback',
            <input
              value={ragConfig.fallbackModel}
              onChange={(e) => onChangeRagConfig({ ...ragConfig, fallbackModel: e.target.value })}
              className={inputCls}
              placeholder="gpt-4o-mini"
            />,
          )}
          <div className="space-y-2 md:col-span-2">
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
              Contexto de sistema (RAG)
            </label>
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

      {/* Model tester card */}
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
              onChange={(e) =>
                setConditions((prev) => ({ ...prev, taskType: e.target.value as ModelTestConditions['taskType'] }))
              }
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
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Costo máximo (1–3)</label>
            <input
              type="number" min={1} max={3}
              value={conditions.maxCostTier}
              onChange={(e) =>
                setConditions((prev) => ({
                  ...prev,
                  maxCostTier: Math.min(3, Math.max(1, Number(e.target.value) || 1)) as 1 | 2 | 3,
                }))
              }
              className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-emerald-500 focus:bg-white"
            />
          </div>
          <div className="space-y-2">
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Calidad mínima (1–5)</label>
            <input
              type="number" min={1} max={5}
              value={conditions.minimumQuality}
              onChange={(e) =>
                setConditions((prev) => ({
                  ...prev,
                  minimumQuality: Math.min(5, Math.max(1, Number(e.target.value) || 1)) as 1 | 2 | 3 | 4 | 5,
                }))
              }
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
            El proveedor principal seleccionado no tiene API key configurada en la sección de API.
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
          {alternatives.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
              <Info size={14} /> Ejecuta la prueba para ver alternativas y recomendación.
            </div>
          ) : (
            alternatives.map((alt) => (
              <div key={`${alt.provider}-${alt.model}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-slate-800">
                      {alt.provider.toUpperCase()} · {alt.model}
                    </p>
                    <p className="text-xs font-semibold text-slate-500">{alt.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {alt.provider === recommended?.provider && alt.model === recommended?.model ? (
                      <CheckCircle2 size={16} className="text-emerald-600" />
                    ) : null}
                    <span className="text-xs font-black text-slate-700">Score: {alt.finalScore}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
