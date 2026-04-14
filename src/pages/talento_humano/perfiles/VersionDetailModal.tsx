import React from 'react';
import { X } from 'lucide-react';
import type { AnalysisVersionRecord } from './types';

interface Props {
  version: AnalysisVersionRecord;
  onClose: () => void;
}

const SOURCE_CONFIG = {
  MOTOR: { label: 'Motor Escalafón', headerBg: 'bg-blue-600' },
  IA: { label: 'Análisis IA', headerBg: 'bg-indigo-600' },
  MANUAL_TH: { label: 'Manual TH', headerBg: 'bg-emerald-600' },
} as const;

export const VersionDetailModal: React.FC<Props> = ({ version, onClose }) => {
  let payloadRows: Array<Record<string, unknown>> = [];
  try {
    payloadRows = JSON.parse(version.rowsPayload || '[]');
  } catch {
    payloadRows = [];
  }

  const cfg = SOURCE_CONFIG[version.sourceType] ?? SOURCE_CONFIG.MOTOR;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 pt-8">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-5 text-white ${cfg.headerBg}`}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-75">
              Detalle de versión · {cfg.label}
            </p>
            <p className="mt-0.5 text-xl font-black">
              {version.totalScore.toFixed(1)} pts · {version.suggestedCategory}
            </p>
            <p className="text-xs opacity-75 mt-0.5">
              Generada {version.createdAt.replace('T', ' ').slice(0, 19)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Estado', value: version.versionStatus },
              { label: 'Creado por', value: version.createdBy || '-' },
              { label: 'Fecha creación', value: version.createdAt.replace('T', ' ').slice(0, 19) },
              { label: 'Aprobado por', value: version.approvedBy || 'Sin aprobación CAP' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
                <p className="mt-1 text-xs font-bold text-slate-800">{value}</p>
              </div>
            ))}
          </div>

          {/* Narrative */}
          {version.narrative && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="mb-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Narrativa</p>
              <p className="whitespace-pre-wrap text-xs text-slate-700">{version.narrative}</p>
            </div>
          )}

          {/* Rows table */}
          {payloadRows.length > 0 && (
            <div className="overflow-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[700px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="px-4 py-3 text-left">Sección</th>
                    <th className="px-4 py-3 text-left">Criterio</th>
                    <th className="px-4 py-3 text-left">Detalle</th>
                    <th className="px-4 py-3 text-center">Soporte</th>
                    <th className="px-4 py-3 text-center">Cant.</th>
                    <th className="px-4 py-3 text-center">Valor</th>
                    <th className="px-4 py-3 text-right">Puntaje base</th>
                    <th className="px-4 py-3 text-right">Puntaje sugerido</th>
                    <th className="px-4 py-3 text-left">Comentario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payloadRows.map((row, idx) => {
                    const hasPayloadSupport = Boolean(row.hasSupport);
                    const suggested = Number(row.suggestedScore ?? row.baseScore ?? 0);
                    const base = Number(row.baseScore ?? 0);
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-xs font-semibold text-slate-500">{String(row.section ?? '-')}</td>
                        <td className="px-4 py-3 font-bold text-slate-700">{String(row.criterion ?? '-')}</td>
                        <td className="px-4 py-3 text-slate-500">{String(row.detail ?? '-')}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase border ${
                            hasPayloadSupport
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              : 'bg-orange-50 text-orange-600 border-orange-100'
                          }`}>
                            {hasPayloadSupport ? 'Con soporte' : 'Sin soporte'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-medium">{Number(row.quantity ?? 0).toFixed(1)}</td>
                        <td className="px-4 py-3 text-center font-medium">{Number(row.value ?? 0).toFixed(1)}</td>
                        <td className="px-4 py-3 text-right font-bold text-indigo-600">{base.toFixed(1)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${suggested >= base ? 'text-indigo-600' : 'text-orange-600'}`}>
                          {suggested.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 italic max-w-xs">{String(row.comment ?? '-')}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-indigo-50/30 font-bold text-indigo-900 border-t-2 border-indigo-100">
                    <td colSpan={7} className="px-4 py-3 text-right text-xs uppercase">Total puntaje sugerido</td>
                    <td className="px-4 py-3 text-right text-lg">
                      {payloadRows.reduce((acc, r) => acc + Number(r.suggestedScore ?? r.baseScore ?? 0), 0).toFixed(1)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Notes */}
          {version.notes && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="mb-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Notas</p>
              <p className="text-xs text-slate-700">{version.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 font-medium text-sm transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
