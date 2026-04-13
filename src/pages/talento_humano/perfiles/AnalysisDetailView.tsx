import React from 'react';
import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Hash,
  History,
  Printer,
  User,
} from 'lucide-react';
import type { RequestRecord } from '../../../types/domain';
import { normalizeText, toSafeNumber } from './helpers';
import type { AiCriterionRow, AnalysisVersionRecord, ManualRow, SelectedAnalysis } from './types';

interface Props {
  selectedAnalysisRequest: RequestRecord;
  selectedAnalysis: SelectedAnalysis;
  aiRows: AiCriterionRow[];
  aiLoading: boolean;
  aiNarrative: string;
  aiSuggestedCategory: string | null;
  aiTotalScore: number;
  manualMode: boolean;
  manualRows: ManualRow[];
  manualNarrative: string;
  versionRowsForSelected: AnalysisVersionRecord[];
  currentRole: string;
  onClose: () => void;
  onRunAiSuggestion: () => void;
  onSaveMotorVersion: () => void;
  onSaveAiVersion: () => void;
  onToggleManualMode: () => void;
  onAddManualRow: () => void;
  onUpdateManualRow: (id: string, patch: Partial<ManualRow>) => void;
  onRemoveManualRow: (id: string) => void;
  onSaveManualVersion: () => void;
  onSetManualNarrative: (value: string) => void;
  onApproveVersion: (versionId: string) => void;
  onViewVersion: (version: AnalysisVersionRecord) => void;
}

const DetailItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <div className="p-2 bg-indigo-50 rounded-lg shrink-0">{icon}</div>
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-semibold text-slate-700 leading-tight">{value}</p>
    </div>
  </div>
);

const ActionButton = ({
  label,
  color,
  outline = false,
  disabled = false,
  onClick,
}: {
  label: string;
  color: string;
  outline?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${
      outline ? 'border-2' : ''
    } ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:-translate-y-0.5 hover:shadow-md'} ${color}`}
  >
    {label}
  </button>
);

export const AnalysisDetailView: React.FC<Props> = ({
  selectedAnalysisRequest,
  selectedAnalysis,
  aiRows,
  aiLoading,
  aiNarrative,
  aiSuggestedCategory,
  aiTotalScore,
  manualMode,
  manualRows,
  manualNarrative,
  versionRowsForSelected,
  currentRole,
  onClose,
  onRunAiSuggestion,
  onSaveMotorVersion,
  onSaveAiVersion,
  onToggleManualMode,
  onAddManualRow,
  onUpdateManualRow,
  onRemoveManualRow,
  onSaveManualVersion,
  onSetManualNarrative,
  onApproveVersion,
  onViewVersion,
}) => {
  const latestByType = (['MOTOR', 'IA', 'MANUAL_TH'] as const).map((type) => {
    const rows = versionRowsForSelected.filter((v) => v.sourceType === type);
    if (rows.length === 0) return null;
    return rows.reduce((latest, v) => (v.createdAt > latest.createdAt ? v : latest));
  });

  const typeConfig = {
    MOTOR: { label: 'Motor Escalafón', color: 'border-blue-300 bg-blue-50', textColor: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
    IA: { label: 'Análisis IA', color: 'border-indigo-300 bg-indigo-50', textColor: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-800' },
    MANUAL_TH: { label: 'Manual TH', color: 'border-emerald-300 bg-emerald-50', textColor: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  } as const;

  const aiMatrixTotal = selectedAnalysis.rows.reduce((acc, row) => {
    const aiRow = aiRows.find((entry) => normalizeText(entry.criterio) === normalizeText(row.criterio));
    return acc + (aiRow ? aiRow.puntajeSugerido : row.hasSupport ? row.puntaje : 0);
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800 rounded-3xl border border-slate-200">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-lg text-white">
              <User size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{selectedAnalysisRequest.nombre}</h1>
              <p className="text-slate-500 flex items-center gap-2 text-sm">
                <Hash size={14} /> {selectedAnalysisRequest.documento} • {selectedAnalysisRequest.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium text-sm">
              <Printer size={18} /> Imprimir
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm font-medium text-sm">
              <Download size={18} /> Descargar PDF
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 font-medium text-sm"
            >
              Cerrar análisis
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <DetailItem icon={<BookOpen className="text-indigo-500" />} label="Facultad" value={selectedAnalysisRequest.facultad} />
          <DetailItem icon={<Award className="text-indigo-500" />} label="Programa" value="No disponible" />
          <DetailItem icon={<Calendar className="text-indigo-500" />} label="Fecha Postulación" value="No disponible" />
          <DetailItem icon={<Hash className="text-indigo-500" />} label="No. Registro / Radicado" value={selectedAnalysisRequest.id} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center gap-3 flex-wrap">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <FileText size={20} className="text-indigo-400" />
              Categorización Sugerida
            </h2>
            <button
              onClick={onClose}
              className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded transition-colors border border-slate-700"
            >
              Cerrar Análisis
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1080px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-bold">
                  <th className="px-6 py-4 border-b">Sección</th>
                  <th className="px-6 py-4 border-b">Criterio</th>
                  <th className="px-6 py-4 border-b">Documento / Soporte</th>
                  <th className="px-6 py-4 border-b">Estado Soporte</th>
                  <th className="px-6 py-4 border-b text-center">Cant.</th>
                  <th className="px-6 py-4 border-b text-right">Valor</th>
                  <th className="px-6 py-4 border-b text-right">Puntaje</th>
                  <th className="px-6 py-4 border-b text-center">Puntaje IA</th>
                  <th className="px-6 py-4 border-b">Comentario IA</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {selectedAnalysis.rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-sm font-semibold text-slate-400">
                      El profesor no presentó información evaluable para la matriz sugerida.
                    </td>
                  </tr>
                )}
                {selectedAnalysis.rows.map((item, idx) => {
                  const aiRow = aiRows.find((entry) => normalizeText(entry.criterio) === normalizeText(item.criterio));
                  const aiScore = aiRow ? aiRow.puntajeSugerido : item.hasSupport ? item.puntaje : 0;
                  const aiComment = aiRow
                    ? aiRow.comentario
                    : item.hasSupport
                      ? 'Sin ajuste IA. Se mantiene el puntaje base por soporte.'
                      : 'Sin soporte documental. Puntaje sugerido en 0.';

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-xs text-slate-500 uppercase">{item.section}</td>
                      <td className="px-6 py-4 font-bold text-slate-700 uppercase">{item.criterio}</td>
                      <td className="px-6 py-4 text-slate-500">{item.detalle || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold border uppercase ${
                          item.hasSupport
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : 'bg-orange-50 text-orange-600 border-orange-100'
                        }`}>
                          {item.hasSupport ? 'CON SOPORTE' : 'SIN SOPORTE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-medium">{item.cantidad.toFixed(1)}</td>
                      <td className="px-6 py-4 text-right font-medium">{item.valor.toFixed(1)}</td>
                      <td className="px-6 py-4 text-right font-bold text-indigo-600">{item.puntaje.toFixed(1)}</td>
                      <td className="px-6 py-4 text-center font-bold text-orange-600">{aiScore.toFixed(1)}</td>
                      <td className="px-6 py-4 text-xs text-slate-400 italic max-w-xs">{aiComment}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50/30 font-bold text-indigo-900 border-t-2 border-indigo-100">
                  <td colSpan={6} className="px-6 py-4 text-right">PUNTAJE TOTAL SUGERIDO POR MATRIZ</td>
                  <td className="px-6 py-4 text-right text-lg">{selectedAnalysis.matrixTotal.toFixed(1)}</td>
                  <td className="px-6 py-4 text-center text-lg text-orange-600">{aiMatrixTotal.toFixed(1)}</td>
                  <td className="px-6 py-4 text-xs uppercase">{aiRows.length > 0 ? 'Con ajuste IA' : 'Sin Ajuste IA'}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="p-6 bg-slate-50 flex flex-wrap gap-3 border-t border-slate-200">
            <ActionButton label={aiLoading ? 'Analizando con IA...' : 'Generar Tabla IA'} color="bg-indigo-600 text-white" disabled={aiLoading} onClick={onRunAiSuggestion} />
            <ActionButton label="Guardar Versión Motor" color="bg-white border-indigo-200 text-indigo-600" outline onClick={onSaveMotorVersion} />
            <ActionButton label="Guardar Versión IA" color="bg-white border-indigo-200 text-indigo-600" outline disabled={aiRows.length === 0} onClick={onSaveAiVersion} />
            <ActionButton label={manualMode ? 'Ocultar Tabla Manual TH' : 'Crear Tabla Manual TH'} color="bg-white border-slate-200 text-slate-600" outline onClick={onToggleManualMode} />
          </div>
        </div>

        {(aiNarrative || aiRows.length > 0) && (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-700">Narrativa IA</p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-indigo-900">
                {aiNarrative || 'La IA aplicó criterios de soporte para ajustar puntajes sugeridos.'}
              </p>
            </div>
            {aiSuggestedCategory && (
              <div className="rounded-xl border-2 border-indigo-200 bg-white p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-700">Categoría sugerida por IA</p>
                <p className="mt-2 text-3xl font-black text-slate-900 uppercase">{aiSuggestedCategory}</p>
                <p className="mt-1 text-sm font-semibold text-indigo-700">Puntaje IA: {aiTotalScore.toFixed(1)} pts</p>
                {aiSuggestedCategory !== selectedAnalysis.suggested.finalCat.name && (
                  <p className="mt-3 text-xs text-amber-700 font-semibold">
                    La IA difiere del motor base por el ajuste de soportes documentales.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {manualMode && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-700">Tabla manual Talento Humano</p>
              <div className="flex gap-2">
                <button
                  onClick={onAddManualRow}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white hover:bg-slate-700"
                >
                  Agregar fila
                </button>
                <button
                  onClick={onSaveManualVersion}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 hover:bg-emerald-100"
                >
                  Guardar versión manual TH
                </button>
              </div>
            </div>

            <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[980px] border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700">
                    <th className="px-2 py-2 text-left">Sección</th>
                    <th className="px-2 py-2 text-left">Criterio</th>
                    <th className="px-2 py-2 text-left">Detalle</th>
                    <th className="px-2 py-2 text-center">Cant.</th>
                    <th className="px-2 py-2 text-center">Valor</th>
                    <th className="px-2 py-2 text-center">Puntaje</th>
                    <th className="px-2 py-2 text-center">Soporte</th>
                    <th className="px-2 py-2 text-left">Comentario</th>
                    <th className="px-2 py-2 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {manualRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-2 py-2">
                        <select
                          value={row.section}
                          onChange={(event) => onUpdateManualRow(row.id, { section: event.target.value as ManualRow['section'] })}
                          className="w-full rounded border border-slate-200 px-2 py-1"
                        >
                          <option value="Estudios Cursados">Estudios</option>
                          <option value="Experiencia">Experiencia</option>
                          <option value="Otros">Otros</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input value={row.criterio} onChange={(event) => onUpdateManualRow(row.id, { criterio: event.target.value })} className="w-full rounded border border-slate-200 px-2 py-1" />
                      </td>
                      <td className="px-2 py-2">
                        <input value={row.detalle} onChange={(event) => onUpdateManualRow(row.id, { detalle: event.target.value })} className="w-full rounded border border-slate-200 px-2 py-1" />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" value={row.cantidad} onChange={(event) => onUpdateManualRow(row.id, { cantidad: toSafeNumber(event.target.value, 0) })} className="w-full rounded border border-slate-200 px-2 py-1 text-right" />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" value={row.valor} onChange={(event) => onUpdateManualRow(row.id, { valor: toSafeNumber(event.target.value, 0) })} className="w-full rounded border border-slate-200 px-2 py-1 text-right" />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" value={row.puntaje} onChange={(event) => onUpdateManualRow(row.id, { puntaje: toSafeNumber(event.target.value, 0) })} className="w-full rounded border border-slate-200 px-2 py-1 text-right" />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input type="checkbox" checked={row.soportado} onChange={(event) => onUpdateManualRow(row.id, { soportado: event.target.checked })} />
                      </td>
                      <td className="px-2 py-2">
                        <input value={row.comentario} onChange={(event) => onUpdateManualRow(row.id, { comentario: event.target.value })} className="w-full rounded border border-slate-200 px-2 py-1" />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => onRemoveManualRow(row.id)} className="rounded border border-red-200 px-2 py-1 text-[10px] font-black uppercase text-red-700">
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Total tabla manual</p>
                <p className="mt-1 text-xl font-black text-slate-900">{manualRows.reduce((acc, row) => acc + toSafeNumber(row.puntaje, 0), 0).toFixed(1)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Filas sin soporte</p>
                <p className="mt-1 text-xl font-black text-amber-700">{manualRows.filter((row) => !row.soportado).length}</p>
              </div>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Narrativa manual Talento Humano</p>
              <textarea value={manualNarrative} onChange={(event) => onSetManualNarrative(event.target.value)} rows={4} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" />
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <History size={20} className="text-indigo-500" />
            <h2 className="font-bold text-slate-800">Historial de Versiones</h2>
            <span className="ml-auto text-xs text-slate-400">TIPOS: MOTOR, IA, MANUAL TH</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[920px]">
              <thead>
                <tr className="text-xs text-slate-400 font-bold border-b border-slate-100 uppercase tracking-tighter">
                  <th className="pb-4">Fecha</th>
                  <th className="pb-4">Fuente</th>
                  <th className="pb-4">Estado</th>
                  <th className="pb-4 text-right">Puntaje</th>
                  <th className="pb-4">Categoría</th>
                  <th className="pb-4">Creado Por</th>
                  <th className="pb-4">Aprobación CAP</th>
                  <th className="pb-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {versionRowsForSelected.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-sm font-semibold text-slate-400">No hay versiones guardadas para este tracking.</td>
                  </tr>
                )}
                {versionRowsForSelected.map((row) => (
                  <tr key={row.versionId} className="group hover:bg-slate-50 transition-colors">
                    <td className="py-4 text-sm text-slate-500">{row.createdAt.replace('T', ' ').slice(0, 19)}</td>
                    <td className="py-4"><span className="font-bold text-slate-700 text-xs">{row.sourceType}</span></td>
                    <td className="py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.versionStatus === 'REFERENCIA' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                        {row.versionStatus}
                      </span>
                    </td>
                    <td className="py-4 text-right font-bold text-slate-800">{row.totalScore.toFixed(1)}</td>
                    <td className="py-4 text-sm text-slate-500">{row.suggestedCategory}</td>
                    <td className="py-4 text-sm text-slate-400 underline decoration-slate-200">{row.createdBy || '-'}</td>
                    <td className="py-4 text-sm text-slate-400">{row.approvedBy ? `${row.approvedBy}${row.approvedAt ? ` (${row.approvedAt.replace('T', ' ').slice(0, 19)})` : ''}` : '-'}</td>
                    <td className="py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => onViewVersion(row)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold border border-indigo-100">
                          <Eye size={14} /> Previsualizar
                        </button>
                        <button
                          onClick={() => onApproveVersion(row.versionId)}
                          disabled={currentRole !== 'cap' || row.versionStatus === 'OFICIAL'}
                          className="px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded text-[10px] font-bold uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Aprobar Oficial
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {versionRowsForSelected.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">Resumen comparativo de versiones</p>
            <div className="grid gap-3 md:grid-cols-3">
              {(['MOTOR', 'IA', 'MANUAL_TH'] as const).map((type, idx) => {
                const version = latestByType[idx];
                const cfg = typeConfig[type];
                if (!version) {
                  return (
                    <div key={type} className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{cfg.label}</p>
                      <p className="mt-2 text-[11px] font-semibold text-slate-400">Sin versión guardada</p>
                    </div>
                  );
                }
                return (
                  <div key={type} className={`rounded-xl border-2 p-4 ${cfg.color}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-[10px] font-black uppercase tracking-[0.14em] ${cfg.textColor}`}>{cfg.label}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${cfg.badge}`}>{version.versionStatus}</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900">{version.totalScore.toFixed(1)}</p>
                    <p className="text-[11px] font-black uppercase text-slate-700 mt-0.5">{version.suggestedCategory}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-[10px] text-slate-500">{version.createdAt.slice(0, 10)}</p>
                      <button onClick={() => onViewVersion(version)} className={`text-[10px] font-black uppercase underline ${cfg.textColor} hover:no-underline`}>
                        Ver detalle
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl flex flex-col justify-between">
            <div>
              <p className="text-amber-800 font-bold text-xs uppercase tracking-widest mb-1">Categoría Sugerida</p>
              <h3 className="text-3xl font-black text-amber-900">{selectedAnalysis.suggested.finalCat.name.toUpperCase()}</h3>
            </div>
            {!selectedAnalysis.hasDocumentSupports && (
              <p className="text-amber-600 text-xs font-medium flex items-center gap-1 mt-4">
                <AlertCircle size={14} /> SIN SOPORTES DOCUMENTALES CARGADOS
              </p>
            )}
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">Puntaje Motor Escalafón</p>
            <h3 className="text-3xl font-black text-slate-800">{selectedAnalysis.suggested.finalPts.toFixed(1)}</h3>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">Puntaje Oficial Expediente</p>
            <h3 className="text-3xl font-black text-slate-800">{selectedAnalysisRequest.finalPts.toFixed(1)}</h3>
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg flex items-center gap-3 text-indigo-700 text-sm">
          <CheckCircle2 size={20} className="shrink-0" />
          <p>Desde este módulo puedes crear perfiles de profesor y observar la puntuación de escalafón en tiempo real mientras cargas los datos.</p>
        </div>
      </div>
    </div>
  );
};
