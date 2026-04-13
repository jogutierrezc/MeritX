import React from 'react';

import type { ResendConfig } from '../../types/config';

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  config: ResendConfig;
  onChange: (cfg: ResendConfig) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const EmailModule = ({ config, onChange }: Props) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-3xl font-black tracking-tight text-slate-800">Configuracion de Email</h2>
      <p className="font-medium text-slate-500">
        Parametros de envio para notificaciones automaticas con Resend.
      </p>
    </div>

    <div className="space-y-6 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl">
      <div className="space-y-2">
        <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
          Resend API Key
        </label>
        <input
          type="password"
          value={config.apiKey}
          onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
          placeholder="re_sk_..."
          className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-6 py-4 outline-none transition-all focus:border-blue-500 focus:bg-white"
        />
      </div>

      <div className="space-y-2">
        <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
          From Email (Remitente)
        </label>
        <input
          value={config.fromEmail}
          onChange={(e) => onChange({ ...config, fromEmail: e.target.value })}
          placeholder="escalafon@udes.edu.co"
          className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-6 py-4 font-bold outline-none transition-all focus:border-blue-500 focus:bg-white"
        />
      </div>

      <div className="space-y-2">
        <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
          From Name
        </label>
        <input
          value={config.fromName}
          onChange={(e) => onChange({ ...config, fromName: e.target.value })}
          placeholder="Escalafon UDES"
          className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-6 py-4 font-bold outline-none transition-all focus:border-blue-500 focus:bg-white"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <input
          type="checkbox"
          className="h-5 w-5 cursor-pointer accent-blue-600"
          checked={config.enabled}
          onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
        />
        <span className="text-sm font-bold text-blue-900">
          Habilitar envio de correos con Resend
        </span>
      </label>
    </div>
  </div>
);

export default EmailModule;
