import React, { useState } from 'react';
import {
  ArrowLeft, Award, BookOpen, Briefcase, Globe,
  Languages, Link as LinkIcon, Minus, Plus, Send, Trash2,
  Database, Mail,
} from 'lucide-react';

// ---- Types ----
export type NivelTitulo = 'Pregrado' | 'Especialización' | 'Maestría' | 'Doctorado';
export type NivelIdioma = 'A2' | 'B1' | 'B2' | 'C1';
export type TipoExperiencia = 'Profesional' | 'Docencia Universitaria' | 'Investigación';
export type Cuartil = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export type PostulacionFormState = {
  nombre: string;
  email: string;
  documento: string;
  programa: string;
  facultad: string;
  scopusProfile: string;
  esIngresoNuevo: boolean;
  isAccreditedSource: boolean;
  yearsInCategory: number;
  hasTrabajoAprobadoCEPI: boolean;
  titulos: Array<{ titulo: string; nivel: NivelTitulo }>;
  idiomas: Array<{ idioma: string; nivel: NivelIdioma; convalidacion: 'SI' | 'NO' }>;
  produccion: Array<{
    titulo: string; cuartil: Cuartil; fecha: string;
    tipo?: string; autores?: number; fuente?: 'SCOPUS' | 'ORCID' | 'MANUAL';
  }>;
  experiencia: Array<{ tipo: TipoExperiencia; inicio: string; fin: string; certificacion: 'SI' | 'NO' }>;
  orcid: string;
};

const emptyForm: PostulacionFormState = {
  nombre: '', email: '', documento: '', programa: '', facultad: '',
  scopusProfile: '', esIngresoNuevo: true, isAccreditedSource: false,
  yearsInCategory: 0, hasTrabajoAprobadoCEPI: false,
  titulos: [{ titulo: '', nivel: 'Pregrado' }],
  idiomas: [{ idioma: 'Inglés', nivel: 'A2', convalidacion: 'NO' }],
  produccion: [],
  experiencia: [{ tipo: 'Docencia Universitaria', inicio: '', fin: '', certificacion: 'NO' }],
  orcid: '',
};

type Props = {
  onSubmit: (data: PostulacionFormState) => Promise<void>;
  onBack: () => void;
  loading: boolean;
  error?: string;
};

export const PostulacionForm = ({ onSubmit, onBack, loading, error }: Props) => {
  const [form, setForm] = useState<PostulacionFormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof PostulacionFormState, string>>>({});

  const validate = () => {
    const errors: typeof fieldErrors = {};
    if (!form.nombre.trim()) errors.nombre = 'Requerido';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errors.email = 'Correo válido requerido';
    if (!form.documento.trim()) errors.documento = 'Requerido';
    if (!form.programa.trim()) errors.programa = 'Requerido';
    if (!form.facultad.trim()) errors.facultad = 'Requerido';
    if (form.titulos.length === 0) errors.titulos = 'Agregue al menos un título';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit(form);
  };

  const updateArr = <K extends 'titulos' | 'idiomas' | 'produccion' | 'experiencia'>(
    key: K, index: number, value: Partial<PostulacionFormState[K][number]>
  ) => {
    const arr = [...form[key]] as any[];
    arr[index] = { ...arr[index], ...value };
    setForm(prev => ({ ...prev, [key]: arr }));
  };

  const removeArr = (key: 'titulos' | 'idiomas' | 'produccion' | 'experiencia', index: number) =>
    setForm(prev => ({ ...prev, [key]: (prev[key] as any[]).filter((_, i) => i !== index) }));

  const fetchScopusMock = () => {
    if (!form.orcid && !form.scopusProfile) return;
    const mock = [
      { titulo: 'Evaluación comparativa de producción académica en IES colombianas', cuartil: 'Q2' as Cuartil, fecha: '2024', tipo: 'Artículo', autores: 2, fuente: 'SCOPUS' as const },
      { titulo: 'Marco legal del escalafón docente universitario en Colombia', cuartil: 'Q1' as Cuartil, fecha: '2023', tipo: 'Artículo', autores: 1, fuente: 'SCOPUS' as const },
    ];
    setForm(prev => ({ ...prev, produccion: [...prev.produccion, ...mock] }));
  };

  const field = (key: keyof PostulacionFormState) => (fieldErrors[key]
    ? 'w-full p-4 bg-rose-50 border-b-4 border-rose-400 focus:border-blue-600 outline-none font-bold text-sm uppercase transition-all'
    : 'w-full p-4 bg-slate-50 border-b-4 border-slate-200 focus:border-blue-600 outline-none font-bold text-sm uppercase transition-all'
  );

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in slide-in-from-bottom-10 duration-700 pb-20">
      {/* Header */}
      <div className="bg-white p-10 border-8 border-slate-950 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
        <div className="flex items-center gap-8">
          <button
            onClick={onBack}
            className="p-4 bg-slate-50 hover:bg-slate-950 hover:text-white transition-all border-4 border-slate-950 active:scale-90"
          >
            <ArrowLeft size={28} />
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none italic">
              Formulario de <span className="text-blue-600">Postulación</span>
            </h2>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] mt-3">
              Suministre sus méritos académicos para auditoría CAP
            </p>
          </div>
        </div>
        <Send size={48} className="text-blue-600/10 hidden md:block" />
      </div>

      {/* Error from parent (e.g. email already in use) */}
      {error && (
        <div className="bg-rose-50 border-4 border-rose-500 p-6 text-rose-800 font-black text-sm uppercase tracking-wide">
          ⚠ {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-8 space-y-8">

          {/* Identificación */}
          <section className="bg-white p-10 border-2 border-slate-200 space-y-8 hover:border-blue-600 transition-colors">
            <div className="flex items-center gap-4 border-l-[8px] border-slate-950 pl-6 uppercase font-black text-xs tracking-widest">
              <Database size={18} className="text-blue-600" /> Identificación del Candidato
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Mail size={10} /> Correo Electrónico Institucional *
                </label>
                <input
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  type="email"
                  className={field('email')}
                  placeholder="CORREO@UDES.EDU.CO"
                />
                {fieldErrors.email && <p className="text-rose-500 text-[9px] font-black uppercase">{fieldErrors.email}</p>}
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                  Su código de postulación será enviado a este correo y servirá como contraseña de acceso
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Completo *</label>
                <input
                  value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  type="text"
                  className={field('nombre')}
                  placeholder="APELLIDOS, NOMBRES"
                />
                {fieldErrors.nombre && <p className="text-rose-500 text-[9px] font-black uppercase">{fieldErrors.nombre}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">N° Identificación *</label>
                <input
                  value={form.documento}
                  onChange={e => setForm(p => ({ ...p, documento: e.target.value }))}
                  type="text"
                  className={field('documento')}
                  placeholder="CC / PASAPORTE"
                />
                {fieldErrors.documento && <p className="text-rose-500 text-[9px] font-black uppercase">{fieldErrors.documento}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Programa *</label>
                <input
                  value={form.programa}
                  onChange={e => setForm(p => ({ ...p, programa: e.target.value }))}
                  type="text"
                  className={field('programa')}
                  placeholder="PROGRAMA ACADÉMICO"
                />
                {fieldErrors.programa && <p className="text-rose-500 text-[9px] font-black uppercase">{fieldErrors.programa}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Facultad *</label>
                <input
                  value={form.facultad}
                  onChange={e => setForm(p => ({ ...p, facultad: e.target.value }))}
                  type="text"
                  className={field('facultad')}
                  placeholder="UNIDAD ACADÉMICA"
                />
                {fieldErrors.facultad && <p className="text-rose-500 text-[9px] font-black uppercase">{fieldErrors.facultad}</p>}
              </div>
              <div className="flex gap-px bg-slate-200 border border-slate-200 col-span-full">
                <button
                  onClick={() => setForm(p => ({ ...p, esIngresoNuevo: true }))}
                  className={`flex-1 p-4 text-[10px] font-black uppercase transition-all ${form.esIngresoNuevo ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}
                >
                  Ingreso Nuevo
                </button>
                <button
                  onClick={() => setForm(p => ({ ...p, esIngresoNuevo: false }))}
                  className={`flex-1 p-4 text-[10px] font-black uppercase transition-all ${!form.esIngresoNuevo ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}
                >
                  Ascenso de Categoría
                </button>
              </div>
              {!form.esIngresoNuevo && (
                <input
                  type="number"
                  placeholder="AÑOS EN CATEGORÍA ACTUAL"
                  value={form.yearsInCategory || ''}
                  onChange={e => setForm(p => ({ ...p, yearsInCategory: parseInt(e.target.value || '0', 10) }))}
                  className="p-4 bg-slate-50 border-b-4 border-slate-200 focus:border-blue-600 outline-none font-bold text-sm"
                />
              )}
            </div>
          </section>

          {/* Producción Intelectual */}
          <section className="bg-white p-10 border-2 border-slate-200 space-y-8 hover:border-blue-600 transition-colors">
            <div className="flex items-center gap-4 border-l-[8px] border-slate-950 pl-6 uppercase font-black text-xs tracking-widest">
              <BookOpen size={18} className="text-blue-600" /> Producción Intelectual
            </div>
            <div className="flex gap-px border-4 border-slate-950 shadow-xl overflow-hidden">
              <input
                value={form.orcid}
                onChange={e => setForm(p => ({ ...p, orcid: e.target.value }))}
                type="text"
                placeholder="SCOPUS AUTHOR ID / ORCID"
                className="flex-1 p-5 bg-slate-50 outline-none font-mono text-sm tracking-widest uppercase"
              />
              <button
                onClick={fetchScopusMock}
                className="bg-slate-950 text-white px-10 font-black text-[10px] uppercase hover:bg-blue-600 transition-all flex items-center gap-3"
              >
                <LinkIcon size={16} /> VINCULAR
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setForm(p => ({
                  ...p, produccion: [...p.produccion, { titulo: '', cuartil: 'Q4', fecha: String(new Date().getFullYear()), tipo: 'Artículo', autores: 1, fuente: 'MANUAL' }],
                }))}
                className="bg-blue-600 text-white px-6 py-2 text-[9px] font-black uppercase hover:bg-blue-700 transition-all flex items-center gap-2"
              >
                <Plus size={14} /> AGREGAR MANUAL
              </button>
            </div>
            <div className="space-y-px bg-slate-200 border-2 border-slate-200">
              {form.produccion.map((art, i) => (
                <div key={i} className="p-6 bg-white flex justify-between items-center group hover:bg-blue-50 transition-colors gap-4">
                  <div className="flex-1 min-w-0">
                    <input
                      value={art.titulo}
                      onChange={e => updateArr('produccion', i, { titulo: e.target.value })}
                      placeholder="TÍTULO DE LA PUBLICACIÓN"
                      className="w-full bg-transparent text-[11px] font-black uppercase tracking-tight text-slate-900 outline-none border-b border-slate-200 pb-1 mb-2"
                    />
                    <div className="flex items-center gap-4 flex-wrap">
                      <select
                        value={art.cuartil}
                        onChange={e => updateArr('produccion', i, { cuartil: e.target.value as Cuartil })}
                        className="bg-slate-950 text-white px-3 py-1 text-[9px] font-black uppercase"
                      >
                        <option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option>
                      </select>
                      <input
                        value={art.fecha}
                        onChange={e => updateArr('produccion', i, { fecha: e.target.value })}
                        type="number"
                        placeholder="AÑO"
                        className="w-20 bg-slate-100 px-2 py-1 text-[10px] font-bold outline-none"
                      />
                      <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <Globe size={10} /> {art.fuente || 'MANUAL'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeArr('produccion', i)}
                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {form.produccion.length === 0 && (
                <div className="bg-white p-12 text-center text-slate-300 text-[10px] font-bold uppercase italic tracking-[0.2em]">
                  Pendiente de vinculación científica
                </div>
              )}
            </div>
          </section>

          {/* Experiencia */}
          <section className="bg-white p-10 border-2 border-slate-200 space-y-8 hover:border-blue-600 transition-colors">
            <div className="flex justify-between items-center border-b-2 border-slate-100 pb-6">
              <div className="flex items-center gap-4 border-l-[8px] border-slate-950 pl-6 uppercase font-black text-xs tracking-widest">
                <Briefcase size={18} className="text-blue-600" /> Experiencia Relacionada
              </div>
              <button
                onClick={() => setForm(p => ({ ...p, experiencia: [...p.experiencia, { tipo: 'Docencia Universitaria', inicio: '', fin: '', certificacion: 'NO' }] }))}
                className="bg-slate-950 text-white px-6 py-2 text-[9px] font-black uppercase hover:bg-blue-600 transition-all"
              >
                + CARGO
              </button>
            </div>
            <div className="space-y-4">
              {form.experiencia.map((exp, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-0 border-2 border-slate-100 relative group">
                  <select
                    value={exp.tipo}
                    onChange={e => updateArr('experiencia', i, { tipo: e.target.value as TipoExperiencia })}
                    className="p-4 bg-white text-[10px] font-bold uppercase outline-none border-r border-slate-100 focus:bg-blue-50"
                  >
                    <option>Profesional</option>
                    <option>Docencia Universitaria</option>
                    <option>Investigación</option>
                  </select>
                  <div className="border-r border-slate-100 p-3 bg-slate-50 flex flex-col">
                    <label className="text-[8px] font-black text-slate-400 mb-1">INICIO</label>
                    <input
                      type="date"
                      value={exp.inicio}
                      onChange={e => updateArr('experiencia', i, { inicio: e.target.value })}
                      className="bg-transparent text-[10px] font-bold outline-none"
                    />
                  </div>
                  <div className="border-r border-slate-100 p-3 bg-slate-50 flex flex-col">
                    <label className="text-[8px] font-black text-slate-400 mb-1">FINALIZACIÓN</label>
                    <input
                      type="date"
                      value={exp.fin}
                      onChange={e => updateArr('experiencia', i, { fin: e.target.value })}
                      className="bg-transparent text-[10px] font-bold outline-none"
                    />
                  </div>
                  <button
                    onClick={() => updateArr('experiencia', i, { certificacion: exp.certificacion === 'SI' ? 'NO' : 'SI' })}
                    className={`p-4 text-[9px] font-black uppercase transition-all ${exp.certificacion === 'SI' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 hover:text-blue-600'}`}
                  >
                    SOPORTE: {exp.certificacion}
                  </button>
                  <button
                    onClick={() => removeArr('experiencia', i)}
                    className="absolute -top-3 -right-3 bg-white text-rose-600 p-1 border-2 border-slate-950 opacity-0 group-hover:opacity-100 transition-all shadow-md"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-4 space-y-8">

          {/* Formación Académica */}
          <section className="bg-white p-8 border-2 border-slate-950 space-y-6 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.05)]">
            <div className="flex justify-between items-center border-b-4 border-slate-950 pb-4">
              <h3 className="font-black text-[10px] uppercase tracking-widest flex items-center gap-3">
                <Award size={20} className="text-blue-600" /> Formación Académica *
              </h3>
              <button
                onClick={() => setForm(p => ({ ...p, titulos: [...p.titulos, { titulo: '', nivel: 'Maestría' }] }))}
                className="bg-blue-600 text-white p-1.5 hover:bg-slate-950 transition-all shadow-lg"
              >
                <Plus size={20} />
              </button>
            </div>
            {fieldErrors.titulos && (
              <p className="text-rose-500 text-[9px] font-black uppercase">{fieldErrors.titulos}</p>
            )}
            <div className="space-y-4">
              {form.titulos.map((t, i) => (
                <div key={i} className="p-5 bg-slate-50 border-2 border-slate-100 space-y-3 relative group hover:border-blue-600 transition-colors">
                  <input
                    value={t.titulo}
                    onChange={e => updateArr('titulos', i, { titulo: e.target.value })}
                    className="w-full p-3 bg-white border-2 border-slate-200 outline-none text-[10px] font-black uppercase focus:border-blue-600"
                    placeholder="NOMBRE DEL PROGRAMA"
                  />
                  <select
                    value={t.nivel}
                    onChange={e => updateArr('titulos', i, { nivel: e.target.value as NivelTitulo })}
                    className="w-full p-3 bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest"
                  >
                    <option>Pregrado</option>
                    <option>Especialización</option>
                    <option>Maestría</option>
                    <option>Doctorado</option>
                  </select>
                  {form.titulos.length > 1 && (
                    <button
                      onClick={() => removeArr('titulos', i)}
                      className="absolute -top-2 -right-2 bg-white text-rose-600 p-1 border-2 border-slate-950 opacity-0 group-hover:opacity-100 transition-all shadow-md"
                    >
                      <Minus size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Bilingüismo */}
          <section className="bg-slate-950 p-8 text-white border-b-[12px] border-blue-600 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/20 pb-4">
              <h3 className="font-black text-[10px] uppercase tracking-widest flex items-center gap-3">
                <Languages size={20} className="text-blue-400" /> Bilingüismo
              </h3>
              <button
                onClick={() => setForm(p => ({ ...p, idiomas: [...p.idiomas, { idioma: 'Inglés', nivel: 'B1', convalidacion: 'NO' }] }))}
                className="bg-white/10 p-1.5 hover:bg-white/20 transition-all"
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="space-y-4">
              {form.idiomas.map((idm, i) => (
                <div key={i} className="p-4 bg-white/5 border border-white/10 space-y-3">
                  <div className="flex gap-px shadow-xl">
                    <input
                      value={idm.idioma}
                      onChange={e => updateArr('idiomas', i, { idioma: e.target.value })}
                      className="flex-1 p-3 bg-slate-800 text-[10px] font-bold outline-none uppercase text-white"
                      placeholder="IDIOMA"
                    />
                    <select
                      value={idm.nivel}
                      onChange={e => updateArr('idiomas', i, { nivel: e.target.value as NivelIdioma })}
                      className="p-3 bg-blue-600 text-[10px] font-black text-white outline-none"
                    >
                      <option>A2</option><option>B1</option><option>B2</option><option>C1</option>
                    </select>
                  </div>
                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => updateArr('idiomas', i, { convalidacion: idm.convalidacion === 'SI' ? 'NO' : 'SI' })}
                      className={`px-4 py-1.5 text-[9px] font-black uppercase transition-all ${idm.convalidacion === 'SI' ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-400'}`}
                    >
                      CONVALIDACIÓN: {idm.convalidacion}
                    </button>
                    {form.idiomas.length > 1 && (
                      <button onClick={() => removeArr('idiomas', i)} className="text-rose-400 hover:text-rose-300 transition-all">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CEPI */}
          <div className="bg-blue-50 border-2 border-blue-200 p-5 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wide text-blue-900 leading-tight">
              ¿Tiene trabajo aprobado por CEPI?
            </p>
            <button
              onClick={() => setForm(p => ({ ...p, hasTrabajoAprobadoCEPI: !p.hasTrabajoAprobadoCEPI }))}
              className={`px-4 py-2 text-[10px] font-black uppercase transition-all ${form.hasTrabajoAprobadoCEPI ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-300'}`}
            >
              {form.hasTrabajoAprobadoCEPI ? 'SÍ' : 'NO'}
            </button>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-12 font-black text-base tracking-[0.5em] shadow-[12px_12px_0px_0px_rgba(30,58,138,0.3)] hover:bg-blue-700 active:scale-[0.98] disabled:opacity-70 transition-all flex flex-col items-center justify-center gap-6 group"
          >
            {loading
              ? <span className="w-8 h-8 border-4 border-white/20 border-t-white animate-spin" />
              : <Send size={36} className="group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
            }
            {loading ? 'PROCESANDO...' : 'RADICAR EXPEDIENTE'}
          </button>

        </div>
      </div>
    </div>
  );
};

export default PostulacionForm;
