import React, { useMemo, useState } from 'react';
import { ArrowLeft, Award, BookOpen, BrainCircuit, Briefcase, Check, Edit2, GraduationCap, Languages, Plus, Trash2, User, X } from 'lucide-react';
import type { AppExperience, AppLanguage, AppPublication, AppTitle, RequestRecord } from '../types/domain';
import { calculateAdvancedEscalafon } from '../utils/calculateEscalafon';
import AIDictamenModal from './AIDictamenModal';

type AiVersionSummary = {
  versionId: string;
  totalScore: number;
  suggestedCategory: string;
  versionStatus: string;
};

type Props = {
  selectedRequest: RequestRecord;
  titles: AppTitle[];
  languages: AppLanguage[];
  publications: AppPublication[];
  experiences: AppExperience[];
  setView: (v: string) => void;
  generateAI: (req: RequestRecord) => Promise<void>;
  aiAnalysis: string;
  aiGenerating: boolean;
  latestAiVersion?: AiVersionSummary;
  onAddLanguage: (trackingId: string, lang: any) => Promise<void>;
  onUpdateLanguage: (id: number, lang: any) => Promise<void>;
  onDeleteLanguage: (id: number) => Promise<void>;
  onAddTitle: (trackingId: string, title: any) => Promise<void>;
  onAddPublication: (trackingId: string, publication: any) => Promise<void>;
  onAddExperience: (trackingId: string, experience: any) => Promise<void>;
};

const levelBadge = (level: string) => (
  <span className="inline-block bg-blue-100 text-blue-800 text-[9px] font-black uppercase tracking-widest px-3 py-1 border border-blue-300">
    {level}
  </span>
);

const quartileBadge = (q: string) => {
  const colors: Record<string, string> = {
    Q1: 'bg-green-100 text-green-800 border-green-300',
    Q2: 'bg-teal-100 text-teal-800 border-teal-300',
    Q3: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    Q4: 'bg-orange-100 text-orange-800 border-orange-300',
  };
  return (
    <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-3 py-1 border ${colors[q] || 'bg-slate-100 text-slate-800 border-slate-300'}`}>
      {q}
    </span>
  );
};

const calcYears = (start: string, end: string): number => {
  try {
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    return Math.max(0, (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  } catch {
    return 0;
  }
};

const DetalleView: React.FC<Props> = ({
  selectedRequest,
  titles,
  languages,
  publications,
  experiences,
  setView,
  generateAI,
  aiAnalysis,
  aiGenerating,
  latestAiVersion,
  onAddLanguage,
  onUpdateLanguage,
  onDeleteLanguage,
  onAddTitle,
  onAddPublication,
  onAddExperience,
}) => {
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [editingLangId, setEditingLangId] = useState<number | 'new' | null>(null);
  const [langForm, setLangForm] = useState({ language_name: '', language_level: 'A2', convalidation: false });
  const [addingTitle, setAddingTitle] = useState(false);
  const [addingPublication, setAddingPublication] = useState(false);
  const [addingExperience, setAddingExperience] = useState(false);
  const [titleForm, setTitleForm] = useState({
    title_name: '',
    title_level: 'Pregrado',
    graduation_date: '',
    origin_university: '',
    university_type: 'NACIONAL',
    title_convalidated: false,
    support_file: null as File | null,
    convalidation_support_file: null as File | null,
  });
  const [publicationForm, setPublicationForm] = useState({
    publication_title: '',
    quartile: 'Q4',
    publication_year: String(new Date().getFullYear()),
    publication_type: 'Artículo',
    authors_count: 1,
    source_kind: 'MANUAL',
  });
  const [experienceForm, setExperienceForm] = useState({
    experience_type: 'Docencia Universitaria',
    company_name: '',
    started_at: '',
    ended_at: '',
    certified: false,
    support_file: null as File | null,
  });

  const startEditLang = (l: AppLanguage) => {
    setEditingLangId(l.id || null);
    setLangForm({
      language_name: l.language_name ?? l.languageName ?? '',
      language_level: (l.language_level ?? l.languageLevel) as string,
      convalidation: !!l.convalidation,
    });
  };

  const startAddLang = () => {
    setEditingLangId('new');
    setLangForm({ language_name: '', language_level: 'A2', convalidation: false });
  };

  const cancelLangEdit = () => {
    setEditingLangId(null);
  };

  const saveLang = async () => {
    if (!langForm.language_name.trim()) return;
    if (editingLangId === 'new') {
      await onAddLanguage(selectedRequest.id, langForm);
    } else if (editingLangId !== null) {
      await onUpdateLanguage(editingLangId, langForm);
    }
    setEditingLangId(null);
  };

  const saveTitle = async () => {
    if (!titleForm.title_name.trim()) return;
    await onAddTitle(selectedRequest.id, titleForm);
    setAddingTitle(false);
    setTitleForm({
      title_name: '',
      title_level: 'Pregrado',
      graduation_date: '',
      origin_university: '',
      university_type: 'NACIONAL',
      title_convalidated: false,
      support_file: null,
      convalidation_support_file: null,
    });
  };

  const savePublication = async () => {
    if (!publicationForm.publication_title.trim()) return;
    await onAddPublication(selectedRequest.id, publicationForm);
    setAddingPublication(false);
    setPublicationForm({
      publication_title: '',
      quartile: 'Q4',
      publication_year: String(new Date().getFullYear()),
      publication_type: 'Artículo',
      authors_count: 1,
      source_kind: 'MANUAL',
    });
  };

  const saveExperience = async () => {
    if (!experienceForm.started_at || !experienceForm.ended_at) return;
    await onAddExperience(selectedRequest.id, experienceForm);
    setAddingExperience(false);
    setExperienceForm({
      experience_type: 'Docencia Universitaria',
      company_name: '',
      started_at: '',
      ended_at: '',
      certified: false,
      support_file: null,
    });
  };

  const scoreBreakdown = useMemo(() => {
    try {
      return calculateAdvancedEscalafon({
        nombre: selectedRequest.nombre,
        documento: selectedRequest.documento,
        programa: '',
        facultad: selectedRequest.facultad,
        scopusProfile: '',
        esIngresoNuevo: selectedRequest.esIngresoNuevo,
        isAccreditedSource: false,
        yearsInCategory: 0,
        hasTrabajoAprobadoCEPI: false,
        orcid: '',
        campus: (selectedRequest as any).campus || 'VALLEDUPAR',
        titulos: titles.map((t) => ({
          titulo: t.titleName,
          nivel: t.titleLevel as 'Pregrado' | 'Especialización' | 'Maestría' | 'Doctorado',
        })),
        idiomas: languages.map((l) => ({
          idioma: l.languageName,
          nivel: l.languageLevel as 'A2' | 'B1' | 'B2' | 'C1',
          convalidacion: l.convalidation ? 'SI' as const : 'NO' as const,
        })),
        produccion: publications.map((p) => ({
          titulo: p.publicationTitle,
          cuartil: p.quartile as 'Q1' | 'Q2' | 'Q3' | 'Q4',
          fecha: p.publicationYear,
          tipo: p.publicationType,
          autores: p.authorsCount,
          fuente: p.sourceKind as 'SCOPUS' | 'ORCID' | 'MANUAL',
        })),
        experiencia: experiences.map((e) => ({
          tipo: e.experienceType as 'Profesional' | 'Docencia Universitaria' | 'Investigación',
          inicio: e.startedAt,
          fin: e.endedAt,
          certificacion: e.certified ? 'SI' as const : 'NO' as const,
        })),
      });
    } catch {
      return null;
    }
  }, [selectedRequest, titles, languages, publications, experiences]);

  const workflowBreakdown = scoreBreakdown
    ? [
      {
        label: 'Académico',
        value: scoreBreakdown.ptsAcad,
        color: 'border-blue-600 bg-blue-50',
        state: selectedRequest.audit?.titleValidated ? 'Conforme por auxiliar' : 'Pendiente validación del auxiliar',
        hint: titles.length > 0 ? `${titles.length} soporte(s) académicos cargados` : 'Sin soportes académicos cargados',
      },
      {
        label: 'Idiomas',
        value: scoreBreakdown.ptsIdioma,
        color: 'border-purple-600 bg-purple-50',
        state: selectedRequest.audit?.languageValidated ? 'Conforme por auxiliar' : 'Pendiente validación del auxiliar',
        hint: languages.length > 0 ? `${languages.length} soporte(s) de idioma cargados` : 'Sin soportes de idioma cargados',
      },
      {
        label: 'Producción',
        value: scoreBreakdown.ptsPI,
        color: 'border-teal-600 bg-teal-50',
        state: selectedRequest.audit?.publicationVerified ? 'Verificada por auxiliar' : 'Pendiente verificación del auxiliar',
        hint: publications.length > 0 ? `${publications.length} evidencia(s) de producción cargadas` : 'Sin evidencia de producción cargada',
      },
      {
        label: 'Experiencia',
        value: Math.min(scoreBreakdown.ptsExpBruta, scoreBreakdown.appliedTope),
        color: 'border-orange-500 bg-orange-50',
        state: selectedRequest.audit?.experienceCertified ? 'Certificada por auxiliar' : 'Pendiente certificación del auxiliar',
        hint: experiences.length > 0 ? `${experiences.length} soporte(s) de experiencia cargados` : 'Sin soportes de experiencia cargados',
      },
    ]
    : [];

  const openAIDictamen = async () => {
    setAiModalOpen(true);
    await generateAI(selectedRequest);
  };

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-10 animate-in zoom-in-95 duration-500 pb-20 print:hidden">
        {/* Top bar: back + AI button */}
        <div className="bg-white border-2 border-slate-950 p-8 flex justify-between items-center shadow-2xl">
          <button
            onClick={() => setView('lista')}
            className="flex items-center gap-4 text-slate-950 hover:bg-slate-100 px-8 py-4 font-black text-[11px] tracking-widest border-4 border-slate-950 transition-all"
          >
            <ArrowLeft size={20} /> RETORNAR
          </button>
          <button
            onClick={openAIDictamen}
            className="bg-slate-950 text-white px-10 py-5 font-black text-[12px] tracking-[0.3em] flex items-center gap-4 hover:bg-blue-600 transition-all"
          >
            <BrainCircuit size={24} className="text-blue-400" /> DICTAMEN IA
          </button>
        </div>

        {/* Professor identity */}
        <section className="bg-white border-2 border-slate-200 p-10 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-slate-950 p-3"><User className="text-white w-6 h-6" /></div>
            <h3 className="font-black text-xl uppercase tracking-[0.2em] text-slate-900">Datos del Docente</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Nombre Completo</p>
              <p className="font-bold text-slate-900 text-lg">{selectedRequest.nombre}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Documento</p>
              <p className="font-bold text-slate-900 text-lg">{selectedRequest.documento}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Facultad</p>
              <p className="font-bold text-slate-900 text-lg">{selectedRequest.facultad}</p>
            </div>
          </div>
        </section>

        {/* Titles */}
        <section className="bg-white border-2 border-slate-200 p-10 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-blue-600 p-3"><GraduationCap className="text-white w-6 h-6" /></div>
            <h3 className="font-black text-xl uppercase tracking-[0.2em] text-slate-900">Títulos Académicos</h3>
            <span className="ml-auto bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1 tracking-widest">{titles.length} registrado(s)</span>
            <button
              onClick={() => setAddingTitle((prev) => !prev)}
              className="ml-4 p-2 bg-slate-900 text-white rounded-full hover:bg-blue-600 transition-colors"
              title="Agregar Título"
            >
              <Plus size={20} />
            </button>
          </div>
          {addingTitle && (
            <div className="mb-6 p-6 border-4 border-slate-900 bg-blue-50 space-y-4 animate-in fade-in slide-in-from-top-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Nuevo título y soporte</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  value={titleForm.title_name}
                  onChange={(e) => setTitleForm({ ...titleForm, title_name: e.target.value })}
                  placeholder="Nombre del título"
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                />
                <select
                  value={titleForm.title_level}
                  onChange={(e) => setTitleForm({ ...titleForm, title_level: e.target.value })}
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                >
                  {['Pregrado', 'Especialización', 'Maestría', 'Doctorado'].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <input
                  type="date"
                  value={titleForm.graduation_date}
                  onChange={(e) => setTitleForm({ ...titleForm, graduation_date: e.target.value })}
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                />
                <input
                  value={titleForm.origin_university}
                  onChange={(e) => setTitleForm({ ...titleForm, origin_university: e.target.value })}
                  placeholder="Universidad origen"
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                />
                <select
                  value={titleForm.university_type}
                  onChange={(e) => setTitleForm({ ...titleForm, university_type: e.target.value })}
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                >
                  <option value="NACIONAL">Nacional</option>
                  <option value="EXTRANJERA">Extranjera</option>
                </select>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={titleForm.title_convalidated}
                    onChange={(e) => setTitleForm({ ...titleForm, title_convalidated: e.target.checked })}
                    className="w-5 h-5 accent-blue-600 border-2 border-slate-900"
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Convalidado</span>
                </label>
                <label className="border-2 border-dashed border-slate-400 px-4 py-2 text-[10px] font-black uppercase text-slate-700 cursor-pointer flex items-center justify-center">
                  {titleForm.support_file?.name || 'Adjuntar soporte título'}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setTitleForm({ ...titleForm, support_file: e.target.files?.[0] || null })}
                  />
                </label>
                <label className="border-2 border-dashed border-amber-400 px-4 py-2 text-[10px] font-black uppercase text-amber-700 cursor-pointer flex items-center justify-center">
                  {titleForm.convalidation_support_file?.name || 'Adjuntar resolución de convalidación'}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setTitleForm({ ...titleForm, convalidation_support_file: e.target.files?.[0] || null })}
                  />
                </label>
              </div>
              <div className="flex gap-4 pt-2">
                <button onClick={saveTitle} className="bg-slate-900 text-white px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-green-600 transition-colors flex items-center gap-2"><Check size={16} /> Guardar</button>
                <button onClick={() => setAddingTitle(false)} className="border-2 border-slate-900 px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-100 transition-colors flex items-center gap-2"><X size={16} /> Cancelar</button>
              </div>
            </div>
          )}
          {titles.length === 0 ? (
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Sin títulos registrados</p>
          ) : (
            <div className="space-y-3">
              {titles.map((t) => (
                <div key={t.id} className="flex items-center justify-between border border-slate-100 bg-slate-50 px-6 py-4">
                  <div>
                    <p className="font-bold text-slate-800">{t.titleName}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{(t as any).supportName || (t as any).support_name || 'Sin soporte cargado'}</p>
                  </div>
                  {levelBadge(t.titleLevel)}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Languages */}
        <section className="bg-white border-2 border-slate-200 p-10 shadow-sm relative">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-purple-600 p-3"><Languages className="text-white w-6 h-6" /></div>
            <h3 className="font-black text-xl uppercase tracking-[0.2em] text-slate-900">Idiomas</h3>
            <span className="ml-auto bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1 tracking-widest">{languages.length} registrado(s)</span>
            <button
              onClick={startAddLang}
              className="ml-4 p-2 bg-slate-900 text-white rounded-full hover:bg-purple-600 transition-colors"
              title="Agregar Idioma"
            >
              <Plus size={20} />
            </button>
          </div>

          {editingLangId === 'new' && (
            <div className="mb-6 p-6 border-4 border-slate-900 bg-purple-50 space-y-4 animate-in fade-in slide-in-from-top-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-purple-700 mb-2">Nuevo Idioma</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  value={langForm.language_name}
                  onChange={e => setLangForm({ ...langForm, language_name: e.target.value })}
                  placeholder="Nombre del idioma (ej. Inglés)"
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                />
                <select
                  value={langForm.language_level}
                  onChange={e => setLangForm({ ...langForm, language_level: e.target.value })}
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                >
                  {['A2', 'B1', 'B2', 'C1'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={langForm.convalidation}
                    onChange={e => setLangForm({ ...langForm, convalidation: e.target.checked })}
                    className="w-5 h-5 accent-purple-600 border-2 border-slate-900"
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Convalidación</span>
                </label>
              </div>
              <div className="flex gap-4 pt-2">
                <button
                  onClick={saveLang}
                  className="bg-slate-900 text-white px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-green-600 transition-colors flex items-center gap-2"
                >
                  <Check size={16} /> Guardar
                </button>
                <button
                  onClick={cancelLangEdit}
                  className="border-2 border-slate-900 px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-100 transition-colors flex items-center gap-2"
                >
                  <X size={16} /> Cancelar
                </button>
              </div>
            </div>
          )}

          {languages.length === 0 && editingLangId !== 'new' ? (
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Sin idiomas registrados</p>
          ) : (
            <div className="space-y-3">
              {languages.map((l) => (
                <div key={l.id} className="group relative">
                  {editingLangId === l.id ? (
                    <div className="p-6 border-4 border-slate-900 bg-white space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                          value={langForm.language_name}
                          onChange={e => setLangForm({ ...langForm, language_name: e.target.value })}
                          className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                        />
                        <select
                          value={langForm.language_level}
                          onChange={e => setLangForm({ ...langForm, language_level: e.target.value })}
                          className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                        >
                          {['A2', 'B1', 'B2', 'C1'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={langForm.convalidation}
                            onChange={e => setLangForm({ ...langForm, convalidation: e.target.checked })}
                            className="w-5 h-5 accent-purple-600"
                          />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Convalidación</span>
                        </label>
                      </div>
                      <div className="flex gap-4">
                        <button onClick={saveLang} className="bg-slate-900 text-white px-4 py-2 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-green-600"><Check size={14} /> Aplicar</button>
                        <button onClick={cancelLangEdit} className="border-2 border-slate-900 px-4 py-2 text-[9px] font-black uppercase tracking-widest flex items-center gap-2"><X size={14} /> Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between border border-slate-100 bg-slate-50 px-6 py-4 hover:border-purple-300 transition-colors group">
                      <p className="font-bold text-slate-800">{l.language_name || l.languageName}</p>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          {levelBadge(l.language_level || l.languageLevel)}
                          {(l.convalidation) && (
                            <span className="inline-block bg-green-100 text-green-800 text-[9px] font-black uppercase tracking-widest px-3 py-1 border border-green-300">Convalidado</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEditLang(l)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Editar"><Edit2 size={16} /></button>
                          <button onClick={() => onDeleteLanguage(l.id!)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Eliminar"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Publications */}
        <section className="bg-white border-2 border-slate-200 p-10 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-teal-600 p-3"><BookOpen className="text-white w-6 h-6" /></div>
            <h3 className="font-black text-xl uppercase tracking-[0.2em] text-slate-900">Producción Intelectual</h3>
            <span className="ml-auto bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1 tracking-widest">{publications.length} registrada(s)</span>
            <button
              onClick={() => setAddingPublication((prev) => !prev)}
              className="ml-4 p-2 bg-slate-900 text-white rounded-full hover:bg-teal-600 transition-colors"
              title="Agregar Investigación"
            >
              <Plus size={20} />
            </button>
          </div>
          {addingPublication && (
            <div className="mb-6 p-6 border-4 border-slate-900 bg-teal-50 space-y-4 animate-in fade-in slide-in-from-top-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-teal-700">Nueva investigación</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  value={publicationForm.publication_title}
                  onChange={(e) => setPublicationForm({ ...publicationForm, publication_title: e.target.value })}
                  placeholder="Título"
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                />
                <select
                  value={publicationForm.quartile}
                  onChange={(e) => setPublicationForm({ ...publicationForm, quartile: e.target.value })}
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                >
                  {['Q1', 'Q2', 'Q3', 'Q4'].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <input
                  type="number"
                  value={publicationForm.publication_year}
                  onChange={(e) => setPublicationForm({ ...publicationForm, publication_year: e.target.value })}
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                  placeholder="Año"
                />
                <input
                  value={publicationForm.publication_type}
                  onChange={(e) => setPublicationForm({ ...publicationForm, publication_type: e.target.value })}
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                  placeholder="Tipo"
                />
                <input
                  type="number"
                  min={1}
                  value={publicationForm.authors_count}
                  onChange={(e) => setPublicationForm({ ...publicationForm, authors_count: Math.max(1, Number(e.target.value || 1)) })}
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                  placeholder="Autores"
                />
                <select
                  value={publicationForm.source_kind}
                  onChange={(e) => setPublicationForm({ ...publicationForm, source_kind: e.target.value })}
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                >
                  {['MANUAL', 'SCOPUS', 'ORCID'].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="flex gap-4 pt-2">
                <button onClick={savePublication} className="bg-slate-900 text-white px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-green-600 transition-colors flex items-center gap-2"><Check size={16} /> Guardar</button>
                <button onClick={() => setAddingPublication(false)} className="border-2 border-slate-900 px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-100 transition-colors flex items-center gap-2"><X size={16} /> Cancelar</button>
              </div>
            </div>
          )}
          {publications.length === 0 ? (
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Sin publicaciones registradas</p>
          ) : (
            <div className="space-y-3">
              {publications.map((p) => (
                <div key={p.id} className="border border-slate-100 bg-slate-50 px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <p className="font-bold text-slate-800 flex-1">{p.publicationTitle}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {quartileBadge(p.quartile)}
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{p.publicationYear}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{p.publicationType}</span>
                    <span className="text-[9px] text-slate-400">·</span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{p.authorsCount} autor(es)</span>
                    <span className="text-[9px] text-slate-400">·</span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{p.sourceKind}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Experience */}
        <section className="bg-white border-2 border-slate-200 p-10 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-orange-500 p-3"><Briefcase className="text-white w-6 h-6" /></div>
            <h3 className="font-black text-xl uppercase tracking-[0.2em] text-slate-900">Experiencia</h3>
            <span className="ml-auto bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1 tracking-widest">{experiences.length} registrada(s)</span>
            <button
              onClick={() => setAddingExperience((prev) => !prev)}
              className="ml-4 p-2 bg-slate-900 text-white rounded-full hover:bg-orange-500 transition-colors"
              title="Agregar Experiencia"
            >
              <Plus size={20} />
            </button>
          </div>
          {addingExperience && (
            <div className="mb-6 p-6 border-4 border-slate-900 bg-orange-50 space-y-4 animate-in fade-in slide-in-from-top-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-700">Nueva experiencia y soporte</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  value={experienceForm.experience_type}
                  onChange={(e) => setExperienceForm({ ...experienceForm, experience_type: e.target.value })}
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                >
                  {['Profesional', 'Docencia Universitaria', 'Investigación', 'Colciencias Senior', 'Colciencias Junior'].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <input
                  value={experienceForm.company_name}
                  onChange={(e) => setExperienceForm({ ...experienceForm, company_name: e.target.value })}
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                  placeholder="Empresa"
                />
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={experienceForm.certified}
                    onChange={(e) => setExperienceForm({ ...experienceForm, certified: e.target.checked })}
                    className="w-5 h-5 accent-orange-600 border-2 border-slate-900"
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Certificada</span>
                </label>
                <input
                  type="date"
                  value={experienceForm.started_at}
                  onChange={(e) => setExperienceForm({ ...experienceForm, started_at: e.target.value })}
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                />
                <input
                  type="date"
                  value={experienceForm.ended_at}
                  onChange={(e) => setExperienceForm({ ...experienceForm, ended_at: e.target.value })}
                  className="border-2 border-slate-900 px-4 py-2 text-sm font-bold focus:outline-none"
                />
                <label className="border-2 border-dashed border-slate-400 px-4 py-2 text-[10px] font-black uppercase text-slate-700 cursor-pointer flex items-center justify-center">
                  {experienceForm.support_file?.name || 'Adjuntar soporte experiencia'}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setExperienceForm({ ...experienceForm, support_file: e.target.files?.[0] || null })}
                  />
                </label>
              </div>
              <div className="flex gap-4 pt-2">
                <button onClick={saveExperience} className="bg-slate-900 text-white px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-green-600 transition-colors flex items-center gap-2"><Check size={16} /> Guardar</button>
                <button onClick={() => setAddingExperience(false)} className="border-2 border-slate-900 px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-100 transition-colors flex items-center gap-2"><X size={16} /> Cancelar</button>
              </div>
            </div>
          )}
          {experiences.length === 0 ? (
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Sin experiencias registradas</p>
          ) : (
            <div className="space-y-3">
              {experiences.map((e) => {
                const yrs = calcYears(e.startedAt, e.endedAt);
                return (
                  <div key={e.id} className="border border-slate-100 bg-slate-50 px-6 py-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-slate-800">{e.experienceType}</p>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{yrs.toFixed(1)} años</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] text-slate-500 font-bold">{e.startedAt || '—'} → {e.endedAt || 'Presente'}</span>
                      {e.certified && (
                        <span className="inline-block bg-green-100 text-green-800 text-[9px] font-black uppercase tracking-widest px-3 py-1 border border-green-300">Certificado</span>
                      )}
                    </div>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{(e as any).supportName || (e as any).support_name || 'Sin soporte cargado'}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Score breakdown */}
        <section className="bg-white border-8 border-slate-950 p-12 shadow-2xl">
          <div className="flex items-center gap-4 mb-10">
            <div className="bg-slate-950 p-3"><Award className="text-white w-6 h-6" /></div>
            <h3 className="font-black text-2xl uppercase tracking-[0.2em] text-slate-900">Calificación Escalafón</h3>
          </div>

          {scoreBreakdown && (
            <>
              <div className="mb-8 rounded-2xl border border-blue-100 bg-blue-50 px-6 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-700">Posible calificación según soportes y workflow</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  Esta lectura toma en cuenta el tipo de documentos cargados. Es preliminar hasta que el auxiliar valide la conformidad documental de cada frente.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                {workflowBreakdown.map(({ label, value, color, state, hint }) => (
                  <div key={label} className={`border-4 p-6 ${color}`}>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2 text-center">{label}</p>
                    <p className="text-4xl font-black text-slate-950 text-center">{value.toFixed(1)}</p>
                    <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-700 text-center">{state}</p>
                    <p className="mt-2 text-[10px] font-semibold leading-relaxed text-slate-600 text-center">{hint}</p>
                  </div>
                ))}
              </div>

              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6 border-l-4 border-slate-300 pl-4">
                Posible resultado por soportes: {scoreBreakdown.finalPts.toFixed(1)} pts · categoría posible {scoreBreakdown.finalCat.name}
              </p>

              <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-800">Última versión IA registrada</p>
                {latestAiVersion ? (
                  <>
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      Puntaje IA: {latestAiVersion.totalScore.toFixed(1)} pts · categoría sugerida {latestAiVersion.suggestedCategory}
                    </p>
                    <p className="mt-1 text-[11px] font-black uppercase tracking-widest text-amber-700">
                      Estado: {latestAiVersion.versionStatus}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    Aún no hay una versión IA registrada para este expediente. Genera Dictamen IA para dejarlo pendiente.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex items-center gap-8 border-t-4 border-slate-200 pt-10">
            <div className="text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Puntaje Final Oficial</p>
              <p className="text-8xl font-black text-slate-950 tracking-tighter leading-none">{(selectedRequest.finalPts || 0).toFixed(1)}</p>
            </div>
            <div className="flex-1">
              <div className={`py-5 px-8 text-center font-black text-[13px] uppercase tracking-[0.4em] ${selectedRequest.finalCat?.bgColor || 'bg-slate-500'} text-white mb-4`}>
                DOCENTE {selectedRequest.finalCat?.name || 'SIN CATEGORÍA'}
              </div>
              <p className="text-slate-600 font-bold text-sm italic leading-relaxed">"{selectedRequest.outputMessage}"</p>
            </div>
          </div>
        </section>

      </div>

      <AIDictamenModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onRegenerate={() => generateAI(selectedRequest)}
        isLoading={aiGenerating}
        analysis={aiAnalysis}
        request={selectedRequest}
        titles={titles}
        languages={languages}
        publications={publications}
        experiences={experiences}
        scoreBreakdown={scoreBreakdown}
      />
    </>
  );
};

export default DetalleView;

