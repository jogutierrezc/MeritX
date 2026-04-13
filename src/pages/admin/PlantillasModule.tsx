import React from 'react';
import { CheckCircle2 } from 'lucide-react';

import type { MailTemplate } from '../../types/config';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLACEHOLDER_SAMPLE: Record<string, string> = {
  tracking_id: 'UDES-7X41ABCD',
  nombre: 'Juan Perez',
  correo: 'juan.perez@udes.edu.co',
  campus: 'VALLEDUPAR',
  rol: 'DECANO',
  estado: 'EN_AUDITORIA',
  fecha_registro: '2026-04-10',
  fecha_revision: '2026-04-12',
  observaciones: 'Adjuntar soporte actualizado del titulo de maestria.',
  categoria_final: 'ASISTENTE',
  puntaje_final: '72.50',
  workflow: 'WORKFLOW_RECEIVED',
};

const TOKENS_BY_WORKFLOW: Record<string, string[]> = {
  WORKFLOW_RECEIVED: ['tracking_id', 'nombre', 'correo', 'campus', 'fecha_registro', 'workflow'],
  WORKFLOW_AUDIT_REQUEST: [
    'tracking_id',
    'nombre',
    'estado',
    'observaciones',
    'fecha_revision',
    'workflow',
  ],
  WORKFLOW_APPROVED: ['tracking_id', 'nombre', 'categoria_final', 'puntaje_final', 'workflow'],
};

const renderTemplate = (html: string, subject?: string): string => {
  const replaceToken = (input: string) =>
    input.replace(
      /{{\s*([a-zA-Z0-9_]+)\s*}}/g,
      (_match, token: string) => PLACEHOLDER_SAMPLE[token] ?? `{{${token}}}`,
    );
  const renderedBody = replaceToken(html);
  const renderedSubject = replaceToken(subject ?? 'Sin asunto');
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;padding:16px;background:#f8fafc;color:#0f172a;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:16px;">
        <p style="margin:0 0 12px;font-size:12px;color:#475569;"><strong>Asunto:</strong> ${renderedSubject}</p>
        <div>${renderedBody}</div>
      </div>
    </div>
  `;
};

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  templates: MailTemplate[];
  onChange: (tpls: MailTemplate[]) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const PlantillasModule = ({ templates, onChange }: Props) => (
  <div className="space-y-6 pb-10">
    <div>
      <h2 className="text-3xl font-black tracking-tight text-slate-800">Plantillas de Correo HTML</h2>
      <p className="font-medium text-slate-500">
        Edita HTML por workflow y previsualiza el resultado con placeholders.
      </p>
    </div>

    <div className="space-y-5">
      {templates.map((tpl, index) => {
        const workflowTokens = TOKENS_BY_WORKFLOW[tpl.key] ?? Object.keys(PLACEHOLDER_SAMPLE);

        return (
          <div
            key={tpl.key}
            className="space-y-4 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-lg"
          >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-2">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-tight text-blue-700">
                {tpl.key}
              </span>
              <label className="flex items-center gap-2 text-xs font-bold text-green-600">
                <input
                  type="checkbox"
                  checked={tpl.enabled}
                  onChange={(e) =>
                    onChange(
                      templates.map((t, i) => (i === index ? { ...t, enabled: e.target.checked } : t)),
                    )
                  }
                />
                <CheckCircle2 size={14} /> Activo
              </label>
            </div>

            {/* Token hints */}
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
                Placeholders disponibles
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {workflowTokens.map((token) => (
                  <span
                    key={token}
                    className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800"
                  >
                    {`{{${token}}}`}
                  </span>
                ))}
              </div>
            </div>

            {/* Subject */}
            <input
              type="text"
              value={tpl.subject}
              onChange={(e) =>
                onChange(
                  templates.map((t, i) => (i === index ? { ...t, subject: e.target.value } : t)),
                )
              }
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none transition-all focus:border-blue-500"
              placeholder="Asunto del correo"
            />

            {/* HTML editor */}
            <textarea
              rows={8}
              value={tpl.html}
              onChange={(e) =>
                onChange(templates.map((t, i) => (i === index ? { ...t, html: e.target.value } : t)))
              }
              className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm outline-none transition-all focus:border-blue-500"
            />

            {/* Preview */}
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Previsualizacion HTML
              </p>
              <iframe
                title={`preview-${tpl.key}`}
                className="h-64 w-full rounded-2xl border border-slate-200 bg-white"
                sandbox=""
                srcDoc={renderTemplate(tpl.html, tpl.subject)}
              />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default PlantillasModule;
