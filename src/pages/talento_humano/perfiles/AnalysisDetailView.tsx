import React, { useState } from 'react';
import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Download,
  Edit2,
  Eye,
  FileText,
  Hash,
  History,
  Languages,
  Pencil,
  Plus,
  Printer,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { AppLanguage, BarrierDiagnosis, RequestRecord } from '../../../types/domain';
import { normalizeText, toSafeNumber } from './helpers';
import type { AiCriterionRow, AnalysisVersionRecord, ChatMessage, ManualRow, SelectedAnalysis } from './types';
import { openPrintFormatWindow } from './printFormatWindow';

interface Props {
  selectedAnalysisRequest: RequestRecord;
  selectedAnalysis: SelectedAnalysis;
  aiRows: AiCriterionRow[];
  aiLoading: boolean;
  aiNarrative: string;
  aiSuggestedCategory: string | null;
  aiTotalScore: number;
  aiEngine?: string;
  manualMode: boolean;
  manualRows: ManualRow[];
  manualNarrative: string;
  versionRowsForSelected: AnalysisVersionRecord[];
  currentRole: string;
  chatMessages?: ChatMessage[];
  chatInput?: string;
  chatLoading?: boolean;
  showMetriXChat?: boolean;
  onClose: () => void;
  onChatInputChange?: (value: string) => void;
  onSendChatMessage?: () => void;
  onClearChat?: () => void;
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
  meritxNarrative: {
    analisisMatriz: string;
    analisisMotor: string;
    analisisOficial: string;
    analisisNormativo: string;
    conclusionIntermedia: string;
    puntajeIntermedio: number;
  } | null;
  meritxNarrativeLoading: boolean;
  onGenerateMeritxNarrative: () => void;
  ragDebugInfo?: {
    generatedAt: string;
    queryTerms: number;
    activeDocs: number;
    detectedNormatives: number;
    activeNormatives: number;
    docChunks: number;
    normativeChunks: number;
    rankedMatches: number;
    fallbackCandidates: number;
    selectedChunks: number;
    usedFallback: boolean;
    forcedProtocolDetected: boolean;
    forcedProtocolIncluded: boolean;
    sources: string[];
  } | null;
  onSaveProfileEvidence: (payload: {
    titles: Array<{ id: number; titleLevel?: string; supportName: string; supportPath: string; supportFile?: File | null }>;
    experiences: Array<{ id: number; supportName: string; supportPath: string; supportFile?: File | null }>;
    publications: Array<{ id: number; sourceKind: 'SCOPUS' | 'ORCID' | 'MANUAL' }>;
  }) => Promise<void>;
  onAddLanguage?: (trackingId: string, lang: { language_name: string; language_level: string; convalidation: boolean }) => Promise<void>;
  onUpdateLanguage?: (id: number, lang: { language_name: string; language_level: string; convalidation: boolean }) => Promise<void>;
  onDeleteLanguage?: (id: number) => Promise<void>;
  currentLanguages?: AppLanguage[];
}

const BarrierAlertPanel = ({ bd }: { bd: BarrierDiagnosis }) => {
  const blockers = [
    bd.missingTitle && { label: `Título mínimo requerido: ${bd.requiredTitle}`, icon: '🎓' },
    bd.missingIdioma && { label: `Acreditación de idioma nivel ${bd.requiredIdioma}`, icon: '🌐' },
    bd.missingPts && {
      label: `Puntaje total: requiere ${bd.requiredPts} pts, tiene aprox. ${Math.round(bd.ptsActuales)} (faltan ${Math.round(Math.max(0, bd.requiredPts - bd.ptsActuales))} pts)`,
      icon: '📊',
    },
  ].filter(Boolean) as { label: string; icon: string }[];

  return (
    <div className="rounded-xl border-2 border-orange-400 bg-orange-50 overflow-hidden">
      <div className="bg-orange-500 px-5 py-3 flex items-center gap-3">
        <AlertCircle className="text-white shrink-0" size={18} />
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-100">Análisis de Barreras Normativas</p>
          <p className="text-sm font-black text-white">
            ¿Por qué no se asignó la categoría <span className="underline">{bd.blockedCategory}</span>?
          </p>
        </div>
      </div>
      <div className="p-5 space-y-3">
        {blockers.length === 0 && (
          <p className="text-sm text-slate-500 font-semibold">No se detectaron barreras para la categoría actual.</p>
        )}
        {blockers.map((b, i) => (
          <div key={i} className="flex items-start gap-3 bg-white border-2 border-orange-300 rounded-xl px-4 py-3">
            <span className="text-xl shrink-0">{b.icon}</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-0.5">Requisito no cumplido</p>
              <p className="text-sm font-bold text-slate-800">{b.label}</p>
            </div>
          </div>
        ))}
        {bd.missingIdiomaSolo && (
          <div className="mt-1 px-4 py-3 bg-amber-100 border-2 border-amber-400 rounded-xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">
              ⚠ Caso Especial — Recomendación Condicional de Categoría Superior
            </p>
            <p className="text-sm font-semibold text-amber-900">
              El docente cumple <strong>formación académica y puntaje</strong> para la categoría <strong>{bd.blockedCategory}</strong>. 
              La única barrera es acreditar idioma nivel <strong>{bd.requiredIdioma}</strong>. 
              Esta situación puede ser elevada como recomendación condicional ante el <strong>CAP y el CEPI</strong>, 
              previo concepto de la <strong>Oficina Jurídica</strong>. No constituye un acto administrativo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const SupportPreviewLink = ({ path, name }: { path?: string; name?: string }) => {
  if (!path) return <span className="text-slate-400">Sin soporte</span>;

  const baseUrl = import.meta.env.VITE_R2_PUBLIC_URL || '';
  const fullUrl = path.startsWith('http') ? path : `${baseUrl}/${path}`;

  return (
    <div className="flex items-center gap-2">
      <span className="truncate max-w-[150px] font-medium" title={name || path}>{name || 'Ver archivo'}</span>
      <a
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-600 hover:text-indigo-800 p-1.5 rounded-lg hover:bg-indigo-50 transition-colors border border-indigo-100 bg-white shadow-sm"
        title="Abrir soporte en ventana nueva"
      >
        <Eye size={14} />
      </a>
    </div>
  );
};

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
    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${outline ? 'border-2' : ''
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
  aiEngine,
  manualMode,
  manualRows,
  manualNarrative,
  versionRowsForSelected,
  currentRole,
  chatMessages = [],
  chatInput = '',
  chatLoading = false,
  showMetriXChat = false,
  onClose,
  onChatInputChange,
  onSendChatMessage,
  onClearChat,
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
  meritxNarrative,
  meritxNarrativeLoading,
  onGenerateMeritxNarrative,
  ragDebugInfo = null,
  onSaveProfileEvidence,
  onAddLanguage,
  onUpdateLanguage,
  onDeleteLanguage,
  currentLanguages = [],
}) => {
  const [experienceModalOpen, setExperienceModalOpen] = useState(false);
  const [publicationModalOpen, setPublicationModalOpen] = useState(false);
  const [titleModalOpen, setTitleModalOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [savingProfileEvidence, setSavingProfileEvidence] = useState(false);
  const [editingLangId, setEditingLangId] = useState<number | 'new' | null>(null);
  const [langForm, setLangForm] = useState({ language_name: '', language_level: 'B1', convalidation: false });

  const startAddLang = () => { setEditingLangId('new'); setLangForm({ language_name: '', language_level: 'B1', convalidation: false }); };
  const startEditLang = (l: AppLanguage) => { setEditingLangId(l.id); setLangForm({ language_name: l.languageName || l.language_name || '', language_level: l.languageLevel || l.language_level || 'B1', convalidation: !!l.convalidation }); };
  const cancelLang = () => setEditingLangId(null);
  const saveLang = async () => {
    if (!langForm.language_name.trim()) return;
    if (editingLangId === 'new') { await onAddLanguage?.(selectedAnalysisRequest.id, langForm); }
    else if (editingLangId !== null) { await onUpdateLanguage?.(editingLangId, langForm); }
    setEditingLangId(null);
  };

  const [titleDraft, setTitleDraft] = React.useState(selectedAnalysis.titles);
  const [experienceDraft, setExperienceDraft] = React.useState(selectedAnalysis.experiences);
  const [publicationDraft, setPublicationDraft] = React.useState(selectedAnalysis.publications);

  React.useEffect(() => {
    setTitleDraft(selectedAnalysis.titles);
    setExperienceDraft(selectedAnalysis.experiences);
    setPublicationDraft(selectedAnalysis.publications);
    setExperienceModalOpen(false);
    setPublicationModalOpen(false);
    setTitleModalOpen(false);
    setProfileEditOpen(false);
  }, [selectedAnalysis]);

  const saveProfileEvidence = async () => {
    try {
      setSavingProfileEvidence(true);
      await onSaveProfileEvidence({
        titles: titleDraft.map((row) => ({
          id: row.id,
          titleLevel: row.titleLevel,
          supportName: row.supportName || '',
          supportPath: row.supportPath || '',
          supportFile: row.supportFile || null,
        })),
        experiences: experienceDraft.map((row) => ({
          id: row.id,
          supportName: row.supportName || '',
          supportPath: row.supportPath || '',
          supportFile: row.supportFile || null,
        })),
        publications: publicationDraft.map((row) => ({
          id: row.id,
          sourceKind: row.sourceKind,
        })),
      });
      setProfileEditOpen(false);
    } finally {
      setSavingProfileEvidence(false);
    }
  };

  const buildSupportPath = (scope: 'titles' | 'experience', rowId: number, fileName: string) => {
    const safeName = fileName.replace(/\s+/g, '_');
    return `professor-supports/${scope}/${selectedAnalysisRequest.id}/${rowId}-${Date.now()}-${safeName}`;
  };

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
            <button
              onClick={() => setProfileEditOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm font-medium text-sm"
            >
              <Pencil size={18} /> Editar perfil y soportes
            </button>
            <button 
              onClick={() => {
                openPrintFormatWindow({
                  selectedAnalysisRequest,
                  selectedAnalysis,
                  aiRows,
                  meritxNarrative,
                  generatedAt: null,
                  aiEngine
                });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-100 font-medium text-sm">
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
          <DetailItem icon={<Award className="text-indigo-500" />} label="Programa" value={selectedAnalysisRequest.programa || 'No disponible'} />
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
                  const scoreComment = `Calculo base: ${item.cantidad.toFixed(1)} x ${item.valor.toFixed(1)} = ${item.puntaje.toFixed(1)}.`;
                  const supportComment = item.hasSupport
                    ? `Se considera por soporte verificable (${item.supportNote}).`
                    : `Se limita por falta de soporte verificable (${item.supportNote}).`;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-xs text-slate-500 uppercase">{item.section}</td>
                      <td className="px-6 py-4 font-bold text-slate-700 uppercase">{item.criterio}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {item.section === 'Estudios Cursados' ? (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-slate-700">
                              {selectedAnalysis.titles.length} registro(s) de formación reportados.
                            </p>
                            <button
                              onClick={() => setTitleModalOpen(true)}
                              className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-700 underline hover:no-underline"
                            >
                              Ver más
                            </button>
                          </div>
                        ) : item.section === 'Experiencia' ? (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-slate-700">
                              {selectedAnalysis.experiences.length} registro(s) de experiencia reportados.
                            </p>
                            <button
                              onClick={() => setExperienceModalOpen(true)}
                              className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-700 underline hover:no-underline"
                            >
                              Ver más
                            </button>
                          </div>
                        ) : item.criterio === 'PRODUCCIÓN INTELECTUAL' ? (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-slate-700">
                              {selectedAnalysis.publications.length} producción(es) científica(s) reportadas.
                            </p>
                            <button
                              onClick={() => setPublicationModalOpen(true)}
                              className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-700 underline hover:no-underline"
                            >
                              Ver más
                            </button>
                          </div>
                        ) : (
                          item.detalle || '-'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold border uppercase ${item.hasSupport
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
                      <td className="px-6 py-4 max-w-xs">
                        <p className="text-[11px] font-semibold text-slate-700">{scoreComment}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-600">{supportComment}</p>
                        <p className="mt-1 text-[11px] italic text-slate-500">{aiComment}</p>
                      </td>
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
            <ActionButton
              label={meritxNarrativeLoading ? 'Preparando informe MeritX...' : 'Abrir informe MeritX'}
              color="bg-cyan-600 text-white"
              disabled={meritxNarrativeLoading}
              onClick={onGenerateMeritxNarrative}
            />
            <ActionButton label="Guardar Versión Motor" color="bg-white border-indigo-200 text-indigo-600" outline onClick={onSaveMotorVersion} />
            <ActionButton label="Guardar Versión IA" color="bg-white border-indigo-200 text-indigo-600" outline disabled={aiRows.length === 0} onClick={onSaveAiVersion} />
            <ActionButton label={manualMode ? 'Ocultar Tabla Manual TH' : 'Crear Tabla Manual TH'} color="bg-white border-slate-200 text-slate-600" outline onClick={onToggleManualMode} />
          </div>
        </div>

        {ragDebugInfo && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">Diagnóstico RAG (trazabilidad)</p>
            <div className="mt-2 grid gap-2 md:grid-cols-3 text-[11px] font-semibold text-amber-900">
              <p>Términos de consulta: {ragDebugInfo.queryTerms}</p>
              <p>Documentos activos: {ragDebugInfo.activeDocs}</p>
              <p>Normas detectadas: {ragDebugInfo.detectedNormatives}</p>
              <p>Normas activas: {ragDebugInfo.activeNormatives}</p>
              <p>Chunks documentos: {ragDebugInfo.docChunks}</p>
              <p>Chunks normativos: {ragDebugInfo.normativeChunks}</p>
              <p>Matches por score: {ragDebugInfo.rankedMatches}</p>
              <p>Candidatos fallback: {ragDebugInfo.fallbackCandidates}</p>
              <p>Chunks enviados al prompt: {ragDebugInfo.selectedChunks}</p>
              <p>Protocolo vacío legal detectado: {ragDebugInfo.forcedProtocolDetected ? 'Sí' : 'No'}</p>
              <p>Protocolo vacío legal incluido: {ragDebugInfo.forcedProtocolIncluded ? 'Sí' : 'No'}</p>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-amber-800">
              Modo de selección: {ragDebugInfo.usedFallback ? 'Fallback normativo' : 'Ranking por score'}
            </p>
            {ragDebugInfo.sources.length > 0 && (
              <p className="mt-1 text-[11px] text-amber-800">
                Fuentes: {ragDebugInfo.sources.join(' | ')}
              </p>
            )}
            <p className="mt-1 text-[10px] text-amber-700">
              Última ejecución: {new Date(ragDebugInfo.generatedAt).toLocaleString('es-CO')}
            </p>
          </div>
        )}

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

        {meritxNarrative && (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700">Narrativa de MeritX (IA)</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-cyan-100 bg-white p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-cyan-700">Analisis 1: Matriz</p>
                <p className="mt-1 text-xs text-slate-700 whitespace-pre-wrap">{meritxNarrative.analisisMatriz}</p>
              </div>
              <div className="rounded-lg border border-cyan-100 bg-white p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-cyan-700">Analisis 2: Motor</p>
                <p className="mt-1 text-xs text-slate-700 whitespace-pre-wrap">{meritxNarrative.analisisMotor}</p>
              </div>
              <div className="rounded-lg border border-cyan-100 bg-white p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-cyan-700">Analisis 3: Oficial</p>
                <p className="mt-1 text-xs text-slate-700 whitespace-pre-wrap">{meritxNarrative.analisisOficial}</p>
              </div>
              <div className="rounded-lg border border-cyan-100 bg-white p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-cyan-700">Analisis 4: Normativo</p>
                <p className="mt-1 text-xs text-slate-700 whitespace-pre-wrap">{meritxNarrative.analisisNormativo}</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border-2 border-cyan-300 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-cyan-700">Conclusion integradora</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 whitespace-pre-wrap">{meritxNarrative.conclusionIntermedia}</p>
              <p className="mt-2 text-xs font-black uppercase text-cyan-800">Punto intermedio sugerido: {meritxNarrative.puntajeIntermedio.toFixed(1)} pts</p>
            </div>
          </div>
        )}

        {showMetriXChat && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Asistente Conversacional</p>
                <h3 className="text-lg font-black tracking-tight">Chat con MetriX</h3>
              </div>
              <button
                onClick={onClearChat}
                disabled={chatMessages.length === 0 || chatLoading}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                Limpiar conversación
              </button>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1.2fr_1fr]">
              <div className="border-r border-slate-200">
                <div className="h-[340px] overflow-y-auto p-4 bg-slate-50 space-y-3">
                  {chatMessages.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5">
                      <p className="text-xs font-semibold text-slate-500">
                        Expón aquí casos específicos del escalafón. MetriX responderá con concepto técnico y ajustará la tabla IA con base en RAG, soportes y algoritmo.
                      </p>
                    </div>
                  )}
                  {chatMessages.map((message) => (
                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[90%] rounded-xl px-4 py-3 ${message.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                        <p className={`mt-2 text-[10px] ${message.role === 'user' ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {message.createdAt.replace('T', ' ').slice(0, 19)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-200 bg-white p-4">
                  <textarea
                    value={chatInput}
                    onChange={(event) => onChatInputChange?.(event.target.value)}
                    rows={3}
                    placeholder="Ejemplo: docente con maestría sin soporte y 2 años de docencia certificada, ¿cómo quedaría la categoría y por qué?"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={onSendChatMessage}
                      disabled={chatLoading || !chatInput.trim()}
                      className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-cyan-700 disabled:opacity-50"
                    >
                      {chatLoading ? 'Analizando...' : 'Enviar a MetriX'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-cyan-50 p-4 border-t lg:border-t-0 border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700">Salida esperada de MetriX</p>
                <ul className="mt-3 space-y-2 text-xs text-cyan-900 font-medium">
                  <li>Concepto argumentado del caso según reglamento y evidencia.</li>
                  <li>Explicación de por qué aplica (o no) cada puntaje.</li>
                  <li>Ajuste de la tabla IA en Categorización Sugerida.</li>
                  <li>Categoría sugerida y total calculado según conversación.</li>
                </ul>
                <p className="mt-4 text-[11px] text-cyan-800">
                  Consejo: especifica soportes, tiempos de experiencia, nivel de idioma, tipo de publicación y cualquier excepción normativa.
                </p>
              </div>
            </div>
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
          {/* Categoría Sugerida */}
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

        {/* Barrier Alert Panel */}
        {selectedAnalysis.suggested.barrierDiagnosis && (
          <BarrierAlertPanel bd={selectedAnalysis.suggested.barrierDiagnosis} />
        )}


        {/* Criterios de Categorización Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center gap-3">
            <Award size={20} className="text-indigo-400" />
            <h2 className="font-semibold text-lg">Criterios de Categorización — Escalafón UDES</h2>
            <span className="ml-auto text-[10px] text-slate-400 font-bold uppercase tracking-widest">Acuerdo 003/2013 · 008/2019</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b">
                  <th className="px-5 py-4">Categoría</th>
                  <th className="px-5 py-4 text-center">Puntaje Mín.</th>
                  <th className="px-5 py-4 text-center">Puntaje Máx.</th>
                  <th className="px-5 py-4">Título Mínimo</th>
                  <th className="px-5 py-4 text-center">Idioma Mín.</th>
                  <th className="px-5 py-4 text-center">Tope Exp.</th>
                  <th className="px-5 py-4">Tiempo Vinculación</th>
                  <th className="px-5 py-4 text-center">Estado Docente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {[
                  {
                    id: 'auxiliar',
                    name: 'Auxiliar',
                    min: 340, max: 480, capExp: 160,
                    titulo: 'Pregrado', idioma: 'Ninguno',
                    tiempo: 'Ingreso inicial (nuevo o reingreso)',
                    bg: 'bg-slate-50',
                    badge: 'bg-slate-100 text-slate-700',
                    dot: 'bg-slate-400',
                  },
                  {
                    id: 'asistente',
                    name: 'Asistente',
                    min: 481, max: 750, capExp: 250,
                    titulo: 'Especialización', idioma: 'A2',
                    tiempo: 'Mín. 2 años en categoría anterior o condiciones equivalentes',
                    bg: 'bg-blue-50',
                    badge: 'bg-blue-100 text-blue-800',
                    dot: 'bg-blue-500',
                  },
                  {
                    id: 'asociado',
                    name: 'Asociado',
                    min: 751, max: 980, capExp: 350,
                    titulo: 'Maestría / Magister', idioma: 'B1',
                    tiempo: 'Mín. 3 años en Asistente + requisitos académicos',
                    bg: 'bg-indigo-50',
                    badge: 'bg-indigo-100 text-indigo-800',
                    dot: 'bg-indigo-600',
                  },
                  {
                    id: 'titular',
                    name: 'Titular',
                    min: 981, max: null, capExp: 500,
                    titulo: 'Doctorado (obligatorio)', idioma: 'B2',
                    tiempo: 'Mín. 4 años en Asociado + Doctorado acreditado',
                    bg: 'bg-amber-50',
                    badge: 'bg-amber-100 text-amber-800',
                    dot: 'bg-amber-500',
                  },
                ].map((cat) => {
                  const isCurrentCat = selectedAnalysis.suggested.finalCat.id === cat.id;
                  const isBlockedCat = selectedAnalysis.suggested.barrierDiagnosis?.blockedCategory === cat.name;
                  return (
                    <tr key={cat.id} className={`${cat.bg} ${isCurrentCat ? 'ring-2 ring-inset ring-indigo-400' : ''} transition-colors`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${cat.dot} shrink-0`} />
                          <span className="font-black text-slate-800 uppercase tracking-wide">{cat.name}</span>
                          {isCurrentCat && <span className="ml-2 px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded-full uppercase">Actual</span>}
                          {isBlockedCat && !isCurrentCat && (
                            <span className="ml-2 px-2 py-0.5 bg-orange-500 text-white text-[9px] font-black rounded-full uppercase flex items-center gap-1">
                              <AlertCircle size={9} /> Bloqueada
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-slate-700">{cat.min}</td>
                      <td className="px-5 py-4 text-center font-bold text-slate-700">{cat.max ?? '∞'}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black border ${isBlockedCat && selectedAnalysis.suggested.barrierDiagnosis?.missingTitle ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-white text-slate-600 border-slate-200'}`}>
                          {cat.titulo}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black border ${isBlockedCat && selectedAnalysis.suggested.barrierDiagnosis?.missingIdioma ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-white text-slate-600 border-slate-200'}`}>
                          {cat.idioma === 'Ninguno' ? '—' : cat.idioma}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-slate-600">{cat.capExp} pts</td>
                      <td className="px-5 py-4 text-[11px] text-slate-600 font-medium">{cat.tiempo}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-[9px] font-black ${cat.badge}`}>
                          {isCurrentCat ? 'CATEGORÍA ACTUAL' : isBlockedCat ? 'BLOQUEADA' : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
            <p className="text-[10px] text-slate-500 font-semibold">
              * El tope de experiencia es el máximo de puntos que puede aportar la experiencia para cada categoría. La experiencia excedente no se pierde pero solo se activa al ascender de categoría (Saturación Activa). · Puntaje docente actual en motor: <strong className="text-slate-800">{selectedAnalysis.suggested.finalPts.toFixed(1)} pts</strong>.
            </p>
          </div>
        </div>


        {experienceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Detalle ampliado</p>
                  <h3 className="text-lg font-black text-slate-900">Experiencia reportada</h3>
                </div>
                <button onClick={() => setExperienceModalOpen(false)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto p-5">
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 border-b border-slate-200">
                      <th className="pb-2">Tipo</th>
                      <th className="pb-2">Inicio</th>
                      <th className="pb-2">Fin</th>
                      <th className="pb-2">Certificada</th>
                      <th className="pb-2">Soporte</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedAnalysis.experiences.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2 font-semibold text-slate-700">{row.experienceType}</td>
                        <td className="py-2 text-slate-600">{row.startedAt || '-'}</td>
                        <td className="py-2 text-slate-600">{row.endedAt || 'Actual'}</td>
                        <td className="py-2 text-slate-600">{row.certified ? 'Sí' : 'No'}</td>
                        <td className="py-2 text-slate-600">
                          <SupportPreviewLink path={row.supportPath} name={row.supportName} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {titleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Detalle ampliado</p>
                  <h3 className="text-lg font-black text-slate-900">Formación académica reportada</h3>
                </div>
                <button onClick={() => setTitleModalOpen(false)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto p-5">
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 border-b border-slate-200">
                      <th className="pb-2">Título</th>
                      <th className="pb-2">Nivel</th>
                      <th className="pb-2">Universidad</th>
                      <th className="pb-2 text-center">Convalidado</th>
                      <th className="pb-2">Soporte</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedAnalysis.titles.map((row) => (
                      <tr key={row.id}>
                        <td className="py-3 font-semibold text-slate-700">{row.titleName}</td>
                        <td className="py-3 text-slate-600">{row.titleLevel}</td>
                        <td className="py-3 text-slate-600">{row.originUniversity || '-'}</td>
                        <td className="py-3 text-center">
                          {row.titleConvalidated ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold">SÍ</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded text-[10px] font-bold">NO</span>
                          )}
                        </td>
                        <td className="py-3 text-slate-600">
                          <SupportPreviewLink path={row.supportPath} name={row.supportName} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {publicationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Detalle ampliado</p>
                  <h3 className="text-lg font-black text-slate-900">Producción científica reportada</h3>
                </div>
                <button onClick={() => setPublicationModalOpen(false)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto p-5">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 border-b border-slate-200">
                      <th className="pb-2">Título de investigación</th>
                      <th className="pb-2">Quartil certificado</th>
                      <th className="pb-2">Origen</th>
                      <th className="pb-2">Año</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedAnalysis.publications.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2 text-slate-700 font-semibold">{row.publicationTitle}</td>
                        <td className="py-2 text-slate-600">{row.quartile || 'Q4'}</td>
                        <td className="py-2 text-slate-600">{row.sourceKind}</td>
                        <td className="py-2 text-slate-600">{row.publicationYear || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {profileEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-6xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Edición de expediente</p>
                  <h3 className="text-lg font-black text-slate-900">Agregar soportes faltantes y corregir origen de producción</h3>
                </div>
                <button onClick={() => setProfileEditOpen(false)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-auto p-5 space-y-5">
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Títulos académicos</p>
                  <div className="space-y-2">
                    {titleDraft.map((row, index) => (
                      <div key={row.id} className="grid gap-2 md:grid-cols-[1.6fr_1fr] rounded-lg border border-slate-200 p-3">
                        <div className="flex flex-col gap-1">
                          <p className="text-xs font-bold text-slate-800">{row.titleName}</p>
                          <select
                            value={row.titleLevel}
                            onChange={(event) => {
                              const next = [...titleDraft];
                              next[index] = { ...row, titleLevel: event.target.value };
                              setTitleDraft(next);
                            }}
                            className="w-full max-w-[240px] rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 focus:border-indigo-400 outline-none transition-colors"
                          >
                            <option>Pregrado</option>
                            <option>Especialización</option>
                            <option>Especialización Médico Quirúrgica</option>
                            <option>Maestría</option>
                            <option>Maestría de Profundización</option>
                            <option>Maestría de Investigación</option>
                            <option>Doctorado</option>
                          </select>
                          <div className="mt-1">
                            <SupportPreviewLink path={row.supportPath} name={row.supportName} />
                          </div>
                        </div>
                        <label className="flex items-center justify-center rounded border border-dashed border-slate-300 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                          Cargar soporte
                          <input
                            type="file"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (!file) return;
                              const next = [...titleDraft];
                              next[index] = {
                                ...row,
                                supportName: file.name,
                                supportPath: buildSupportPath('titles', row.id, file.name),
                                supportFile: file,
                              };
                              setTitleDraft(next);
                            }}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Experiencia</p>
                  <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                    <p className="text-[11px] font-semibold text-indigo-800">Carga única de certificado consolidado</p>
                    <p className="mt-1 text-[11px] text-indigo-700">
                      Si tienes un solo documento que certifica todas las experiencias, cárgalo aquí y se aplicará a todos los registros.
                    </p>
                    <label className="mt-2 inline-flex cursor-pointer items-center rounded border border-indigo-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50">
                      Cargar archivo único
                      <input
                        type="file"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          setExperienceDraft((prev) => prev.map((item) => ({
                            ...item,
                            supportName: file.name,
                            supportPath: buildSupportPath('experience', item.id, file.name),
                            supportFile: file,
                          })));
                        }}
                      />
                    </label>
                  </div>
                  <div className="space-y-2">
                    {experienceDraft.map((row, index) => (
                      <div key={row.id} className="grid gap-2 md:grid-cols-[1.3fr_1fr] rounded-lg border border-slate-200 p-3">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{row.experienceType}</p>
                          <p className="text-[11px] text-slate-500">{row.startedAt} - {row.endedAt || 'Actual'}</p>
                          <div className="mt-1">
                            <SupportPreviewLink path={row.supportPath} name={row.supportName} />
                          </div>
                        </div>
                        <label className="flex items-center justify-center rounded border border-dashed border-slate-300 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                          Cargar soporte
                          <input
                            type="file"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (!file) return;
                              const next = [...experienceDraft];
                              next[index] = {
                                ...row,
                                supportName: file.name,
                                supportPath: buildSupportPath('experience', row.id, file.name),
                                supportFile: file,
                              };
                              setExperienceDraft(next);
                            }}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Producción científica</p>
                  <div className="space-y-2">
                    {publicationDraft.map((row, index) => (
                      <div key={row.id} className="grid gap-2 md:grid-cols-[1.8fr_0.8fr_0.8fr] rounded-lg border border-slate-200 p-3">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{row.publicationTitle}</p>
                          <p className="text-[11px] text-slate-500">Quartil: {row.quartile || 'Q4'} · Año: {row.publicationYear || '-'}</p>
                        </div>
                        <select
                          value={row.sourceKind}
                          onChange={(event) => {
                            const next = [...publicationDraft];
                            next[index] = { ...row, sourceKind: event.target.value as 'SCOPUS' | 'ORCID' | 'MANUAL' };
                            setPublicationDraft(next);
                          }}
                          className="rounded border border-slate-200 px-2 py-1 text-xs"
                        >
                          <option value="SCOPUS">SCOPUS</option>
                          <option value="ORCID">ORCID</option>
                          <option value="MANUAL">MANUAL</option>
                        </select>
                        <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 text-center">
                          {row.sourceKind === 'MANUAL' ? 'Sin soporte' : 'Con soporte'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 bg-slate-50">
                <button
                  onClick={() => setProfileEditOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveProfileEvidence}
                  disabled={savingProfileEvidence}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-white disabled:opacity-50"
                >
                  {savingProfileEvidence ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg flex items-center gap-3 text-indigo-700 text-sm">
          <CheckCircle2 size={20} className="shrink-0" />
          <p>Desde este módulo puedes crear perfiles de profesor y observar la puntuación de escalafón en tiempo real mientras cargas los datos.</p>
        </div>
      </div>
    </div>
  );
};
