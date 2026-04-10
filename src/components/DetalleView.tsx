import React, { useMemo, useState } from 'react';
import { ArrowLeft, Award, BookOpen, BrainCircuit, Briefcase, GraduationCap, Languages, User } from 'lucide-react';
import type { AppExperience, AppLanguage, AppPublication, AppTitle, RequestRecord } from '../types/domain';
import { calculateAdvancedEscalafon } from '../utils/calculateEscalafon';
import AIDictamenModal from './AIDictamenModal';

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
}) => {
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const scoreBreakdown = useMemo(() => {
    try {
      const formState = {
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
          fuente: p.sourceKind as 'SCOPUS' | 'MANUAL',
        })),
        experiencia: experiences.map((e) => ({
          tipo: e.experienceType as 'Profesional' | 'Docencia Universitaria' | 'Investigación',
          inicio: e.startedAt,
          fin: e.endedAt,
          certificacion: e.certified ? 'SI' as const : 'NO' as const,
        })),
      };
      return calculateAdvancedEscalafon(formState);
    } catch {
      return null;
    }
  }, [selectedRequest, titles, languages, publications, experiences]);

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
        </div>
        {titles.length === 0 ? (
          <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Sin títulos registrados</p>
        ) : (
          <div className="space-y-3">
            {titles.map((t) => (
              <div key={t.id} className="flex items-center justify-between border border-slate-100 bg-slate-50 px-6 py-4">
                <p className="font-bold text-slate-800">{t.titleName}</p>
                {levelBadge(t.titleLevel)}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Languages */}
      <section className="bg-white border-2 border-slate-200 p-10 shadow-sm">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-purple-600 p-3"><Languages className="text-white w-6 h-6" /></div>
          <h3 className="font-black text-xl uppercase tracking-[0.2em] text-slate-900">Idiomas</h3>
          <span className="ml-auto bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1 tracking-widest">{languages.length} registrado(s)</span>
        </div>
        {languages.length === 0 ? (
          <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Sin idiomas registrados</p>
        ) : (
          <div className="space-y-3">
            {languages.map((l) => (
              <div key={l.id} className="flex items-center justify-between border border-slate-100 bg-slate-50 px-6 py-4">
                <p className="font-bold text-slate-800">{l.languageName}</p>
                <div className="flex items-center gap-2">
                  {levelBadge(l.languageLevel)}
                  {l.convalidation && (
                    <span className="inline-block bg-green-100 text-green-800 text-[9px] font-black uppercase tracking-widest px-3 py-1 border border-green-300">Convalidado</span>
                  )}
                </div>
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
        </div>
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
        </div>
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

        {scoreBreakdown ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {[
                { label: 'Académico', value: scoreBreakdown.ptsAcad, color: 'border-blue-600 bg-blue-50' },
                { label: 'Idiomas', value: scoreBreakdown.ptsIdioma, color: 'border-purple-600 bg-purple-50' },
                { label: 'Producción', value: scoreBreakdown.ptsPI, color: 'border-teal-600 bg-teal-50' },
                { label: 'Experiencia', value: Math.min(scoreBreakdown.ptsExpBruta, scoreBreakdown.appliedTope), color: 'border-orange-500 bg-orange-50' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`border-4 p-6 text-center ${color}`}>
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">{label}</p>
                  <p className="text-4xl font-black text-slate-950">{value.toFixed(1)}</p>
                </div>
              ))}
            </div>

            {scoreBreakdown.ptsExpBruta > scoreBreakdown.appliedTope && (
              <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-6 border-l-4 border-orange-500 pl-4">
                Exp. bruta {scoreBreakdown.ptsExpBruta.toFixed(1)} pts — aplicado tope {scoreBreakdown.appliedTope.toFixed(1)} pts por categoría
              </p>
            )}

            <div className="flex items-center gap-8 border-t-4 border-slate-200 pt-10">
              <div className="text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Puntaje Final</p>
                <p className="text-8xl font-black text-slate-950 tracking-tighter leading-none">{scoreBreakdown.finalPts.toFixed(1)}</p>
              </div>
              <div className="flex-1">
                <div className={`py-5 px-8 text-center font-black text-[13px] uppercase tracking-[0.4em] ${scoreBreakdown.finalCat?.bgColor || 'bg-slate-500'} text-white mb-4`}>
                  DOCENTE {scoreBreakdown.finalCat?.name || 'SIN CATEGORÍA'}
                </div>
                <p className="text-slate-600 font-bold text-sm italic leading-relaxed">"{scoreBreakdown.outputMessage}"</p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-10">
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Score calculado al registrar: {(selectedRequest.finalPts || 0).toFixed(1)} pts</p>
            <div className={`mt-4 inline-block py-4 px-8 font-black text-[12px] uppercase tracking-[0.4em] ${selectedRequest.finalCat?.bgColor || 'bg-slate-500'} text-white`}>
              DOCENTE {selectedRequest.finalCat?.name || 'SIN CATEGORÍA'}
            </div>
          </div>
        )}
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

