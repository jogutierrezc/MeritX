import React from 'react';
import { ServerCog, Settings } from 'lucide-react';

import type { AIConfig, WorkflowActions } from '../../types/config';

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKFLOW_ACTION_LABELS: { key: keyof WorkflowActions; label: string }[] = [
  { key: 'autoScoreOnSubmit', label: 'Calcular puntaje automaticamente al registrar' },
  { key: 'autoNotifyOnReceived', label: 'Notificar recepcion de postulacion' },
  { key: 'autoNotifyOnAuditRequest', label: 'Notificar solicitud de subsanacion' },
  { key: 'autoNotifyOnApproval', label: 'Notificar aprobacion final' },
  { key: 'autoSyncScopus', label: 'Sincronizar SCOPUS automaticamente' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  aiConfig: AIConfig;
  onAiConfigChange: (cfg: AIConfig) => void;
  actions: WorkflowActions;
  onActionsChange: (a: WorkflowActions) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const IAModule = ({ aiConfig, onAiConfigChange, actions, onActionsChange }: Props) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-3xl font-black tracking-tight text-slate-800">Motor de IA y Acciones</h2>
      <p className="font-medium text-slate-500">
        Selecciona el modelo de IA y define automatizaciones de workflow.
      </p>
    </div>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {/* Model config */}
      <div className="space-y-4 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-700">
          <ServerCog size={18} /> Configuracion del modelo
        </h3>

        <div className="space-y-2">
          <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
            Proveedor IA
          </label>
          <select
            value={aiConfig.provider}
            onChange={(e) =>
              onAiConfigChange({ ...aiConfig, provider: e.target.value as AIConfig['provider'] })
            }
            className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
          >
            <option value="gemini">Gemini</option>
            <option value="apifreellm">APIFreeLLM</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Modelo</label>
          <input
            value={aiConfig.model}
            onChange={(e) => onAiConfigChange({ ...aiConfig, model: e.target.value })}
            placeholder="gemini-2.5-flash"
            className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
          />
          <button
            type="button"
            onClick={() =>
              onAiConfigChange({
                ...aiConfig,
                provider: 'openrouter',
                model: 'google/gemma-3-27b-it:free,google/gemma-2-9b-it:free',
              })
            }
            className="mt-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-800 hover:bg-emerald-100"
          >
            Preset OpenRouter Free (Gemma prioritized)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
              Temperature
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={aiConfig.temperature}
              onChange={(e) =>
                onAiConfigChange({ ...aiConfig, temperature: Number(e.target.value) || 0 })
              }
              className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
            />
          </div>
          <div className="space-y-2">
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
              Max Tokens
            </label>
            <input
              type="number"
              min="128"
              max="8192"
              value={aiConfig.maxTokens}
              onChange={(e) =>
                onAiConfigChange({ ...aiConfig, maxTokens: Number(e.target.value) || 0 })
              }
              className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Workflow actions */}
      <div className="space-y-4 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-700">
          <Settings size={18} /> Acciones automaticas
        </h3>
        {WORKFLOW_ACTION_LABELS.map((action) => (
          <label
            key={action.key}
            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-600"
              checked={actions[action.key]}
              onChange={(e) => onActionsChange({ ...actions, [action.key]: e.target.checked })}
            />
            <span className="text-sm font-semibold text-slate-700">{action.label}</span>
          </label>
        ))}
      </div>
    </div>
  </div>
);

export default IAModule;
