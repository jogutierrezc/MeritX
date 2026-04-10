import React from 'react';
import { ArrowLeft, BookOpen, Briefcase, Database, Globe, Languages, Link as LinkIcon, Minus, Plus } from 'lucide-react';
import type { FormState } from '../types/domain';

type ArrayKey = 'titulos' | 'idiomas' | 'produccion' | 'experiencia';

type Props = {
  formData: FormState;
  setFormData: React.Dispatch<React.SetStateAction<FormState>>;
  setView: (v: string) => void;
  handleSave: () => void;
  addTitulo: () => void;
  addIdioma: () => void;
  addExperiencia: () => void;
  addProduccionManual: () => void;
  removeArrayItem: (key: ArrayKey, index: number) => void;
  importScopusProduccion: () => void;
};

const NuevoView: React.FC<Props> = ({
  formData,
  setFormData,
  setView,
  handleSave,
  addTitulo,
  addIdioma,
  addExperiencia,
  addProduccionManual,
  removeArrayItem,
  importScopusProduccion,
}) => {
  return (
    <div className="max-w-5xl mx-auto space-y-12 animate-in slide-in-from-bottom-10 duration-700 pb-20">
      <div className="bg-white p-12 border-4 border-slate-950 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-8">
          <button
            onClick={() => setView('lista')}
            className="p-4 bg-slate-100 hover:bg-slate-950 hover:text-white transition-all text-slate-950 border border-slate-200"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">
              Carga de <span className="text-blue-600">Variables</span>
            </h2>
            <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.4em] mt-2">
              Vectorización de méritos - Auditoría CAP
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Identificación */}
        <section className="bg-white p-10 border-2 border-slate-200 space-y-10">
          <div className="flex items-center gap-3 text-slate-950 border-l-8 border-slate-950 pl-6">
            <Database size={20} />
            <h3 className="font-black uppercase tracking-widest text-[11px]">Identificación Institucional</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <input
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              type="text"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 focus:border-slate-950 outline-none font-bold text-[11px] uppercase"
              placeholder="APELLIDO, NOMBRE"
            />
            <input
              value={formData.documento}
              onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
              type="text"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 focus:border-slate-950 outline-none font-bold text-[11px] uppercase"
              placeholder="N° DOCUMENTO"
            />
            <input
              value={formData.programa}
              onChange={(e) => setFormData({ ...formData, programa: e.target.value })}
              type="text"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 focus:border-slate-950 outline-none font-bold text-[11px] uppercase"
              placeholder="PROGRAMA RELACIONADO"
            />
            <input
              value={formData.facultad}
              onChange={(e) => setFormData({ ...formData, facultad: e.target.value })}
              type="text"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 focus:border-slate-950 outline-none font-bold text-[11px] uppercase"
              placeholder="FACULTAD RELACIONADA"
            />
            <div className="flex gap-px bg-slate-200 border border-slate-200">
              <button
                onClick={() => setFormData({ ...formData, esIngresoNuevo: true })}
                className={`flex-1 p-4 text-[10px] font-black uppercase ${formData.esIngresoNuevo ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}
              >
                Ingreso Nuevo
              </button>
              <button
                onClick={() => setFormData({ ...formData, esIngresoNuevo: false })}
                className={`flex-1 p-4 text-[10px] font-black uppercase ${!formData.esIngresoNuevo ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}
              >
                Ascenso
              </button>
            </div>
            {!formData.esIngresoNuevo ? (
              <input
                type="number"
                placeholder="AÑOS EN CAT. ACTUAL"
                value={formData.yearsInCategory}
                onChange={(e) =>
                  setFormData({ ...formData, yearsInCategory: parseInt(e.target.value || '0', 10) || 0 })
                }
                className="p-4 border-2 outline-none focus:border-slate-950 font-bold text-[11px]"
              />
            ) : (
              <div className="flex items-center gap-4 bg-blue-50 p-4 border border-blue-100">
                <input
                  type="checkbox"
                  checked={formData.isAccreditedSource}
                  onChange={(e) => setFormData({ ...formData, isAccreditedSource: e.target.checked })}
                  className="w-6 h-6 accent-blue-600"
                  id="acc"
                />
                <label htmlFor="acc" className="text-[10px] font-black text-blue-900 uppercase leading-tight cursor-pointer">
                  ¿Programa acreditado?
                </label>
              </div>
            )}
          </div>
        </section>

        {/* Formación Académica */}
        <section className="bg-white p-10 border-2 border-slate-200 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-slate-950 border-l-8 border-slate-950 pl-6">
              <BookOpen size={20} />
              <h3 className="font-black uppercase tracking-widest text-[11px]">Formación Académica</h3>
            </div>
            <button
              onClick={addTitulo}
              className="bg-slate-950 text-white px-4 py-2 text-[10px] font-black uppercase flex items-center gap-2"
            >
              <Plus size={14} /> AGREGAR
            </button>
          </div>
          <div className="space-y-3">
            {formData.titulos.map((t, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 border border-slate-200 p-3 bg-slate-50">
                <input
                  value={t.titulo}
                  onChange={(e) => {
                    const arr = [...formData.titulos];
                    arr[i] = { ...arr[i], titulo: e.target.value };
                    setFormData({ ...formData, titulos: arr });
                  }}
                  placeholder="TÍTULO"
                  className="md:col-span-7 p-3 border bg-white border-slate-200 text-[11px] font-bold uppercase"
                />
                <select
                  value={t.nivel}
                  onChange={(e) => {
                    const arr = [...formData.titulos];
                    arr[i] = { ...arr[i], nivel: e.target.value as FormState['titulos'][number]['nivel'] };
                    setFormData({ ...formData, titulos: arr });
                  }}
                  className="md:col-span-4 p-3 border bg-white border-slate-200 text-[10px] font-black uppercase"
                >
                  <option>Pregrado</option>
                  <option>Especialización</option>
                  <option>Maestría</option>
                  <option>Doctorado</option>
                </select>
                <button
                  onClick={() => removeArrayItem('titulos', i)}
                  className="md:col-span-1 p-3 bg-rose-50 text-rose-700 hover:bg-rose-100"
                >
                  <Minus size={14} className="mx-auto" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Idiomas */}
        <section className="bg-white p-10 border-2 border-slate-200 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-slate-950 border-l-8 border-slate-950 pl-6">
              <Languages size={20} />
              <h3 className="font-black uppercase tracking-widest text-[11px]">Idiomas</h3>
            </div>
            <button
              onClick={addIdioma}
              className="bg-slate-950 text-white px-4 py-2 text-[10px] font-black uppercase flex items-center gap-2"
            >
              <Plus size={14} /> AGREGAR
            </button>
          </div>
          <div className="space-y-3">
            {formData.idiomas.map((idm, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 border border-slate-200 p-3 bg-slate-50">
                <input
                  value={idm.idioma}
                  onChange={(e) => {
                    const arr = [...formData.idiomas];
                    arr[i] = { ...arr[i], idioma: e.target.value };
                    setFormData({ ...formData, idiomas: arr });
                  }}
                  placeholder="IDIOMA"
                  className="md:col-span-4 p-3 border bg-white border-slate-200 text-[11px] font-bold uppercase"
                />
                <select
                  value={idm.nivel}
                  onChange={(e) => {
                    const arr = [...formData.idiomas];
                    arr[i] = { ...arr[i], nivel: e.target.value as FormState['idiomas'][number]['nivel'] };
                    setFormData({ ...formData, idiomas: arr });
                  }}
                  className="md:col-span-3 p-3 border bg-white border-slate-200 text-[10px] font-black uppercase"
                >
                  <option>A2</option>
                  <option>B1</option>
                  <option>B2</option>
                  <option>C1</option>
                </select>
                <select
                  value={idm.convalidacion}
                  onChange={(e) => {
                    const arr = [...formData.idiomas];
                    arr[i] = { ...arr[i], convalidacion: e.target.value as 'SI' | 'NO' };
                    setFormData({ ...formData, idiomas: arr });
                  }}
                  className="md:col-span-4 p-3 border bg-white border-slate-200 text-[10px] font-black uppercase"
                >
                  <option value="SI">CONVALIDACIÓN: SI</option>
                  <option value="NO">CONVALIDACIÓN: NO</option>
                </select>
                <button
                  onClick={() => removeArrayItem('idiomas', i)}
                  className="md:col-span-1 p-3 bg-rose-50 text-rose-700 hover:bg-rose-100"
                >
                  <Minus size={14} className="mx-auto" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Producción Intelectual */}
        <section className="bg-white p-10 border-2 border-slate-200 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-slate-950 border-l-8 border-slate-950 pl-6">
              <LinkIcon size={20} />
              <h3 className="font-black uppercase tracking-widest text-[11px]">Producción Intelectual (SCOPUS)</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <input
              value={formData.scopusProfile}
              onChange={(e) => setFormData({ ...formData, scopusProfile: e.target.value })}
              placeholder="PERFIL/ID SCOPUS DEL PROFESOR"
              className="md:col-span-7 p-4 bg-slate-50 border-2 border-slate-100 focus:border-slate-950 outline-none font-bold text-[11px] uppercase"
            />
            <button
              onClick={importScopusProduccion}
              className="md:col-span-3 bg-slate-950 text-white px-4 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2"
            >
              <Globe size={14} /> IMPORTAR SCOPUS
            </button>
            <button
              onClick={addProduccionManual}
              className="md:col-span-2 bg-blue-600 text-white px-4 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2"
            >
              <Plus size={14} /> MANUAL
            </button>
          </div>
          <div className="space-y-3">
            {formData.produccion.map((art, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 border border-slate-200 p-3 bg-slate-50">
                <input
                  value={art.titulo}
                  onChange={(e) => {
                    const arr = [...formData.produccion];
                    arr[i] = { ...arr[i], titulo: e.target.value };
                    setFormData({ ...formData, produccion: arr });
                  }}
                  placeholder="TÍTULO INVESTIGACIÓN"
                  className="md:col-span-5 p-3 border bg-white border-slate-200 text-[11px] font-bold"
                />
                <select
                  value={art.cuartil}
                  onChange={(e) => {
                    const arr = [...formData.produccion];
                    arr[i] = { ...arr[i], cuartil: e.target.value as FormState['produccion'][number]['cuartil'] };
                    setFormData({ ...formData, produccion: arr });
                  }}
                  className="md:col-span-2 p-3 border bg-white border-slate-200 text-[10px] font-black uppercase"
                >
                  <option>Q1</option>
                  <option>Q2</option>
                  <option>Q3</option>
                  <option>Q4</option>
                </select>
                <input
                  type="number"
                  value={art.fecha}
                  onChange={(e) => {
                    const arr = [...formData.produccion];
                    arr[i] = { ...arr[i], fecha: e.target.value };
                    setFormData({ ...formData, produccion: arr });
                  }}
                  placeholder="AÑO"
                  className="md:col-span-2 p-3 border bg-white border-slate-200 text-[11px] font-bold"
                />
                <div className="md:col-span-2 p-3 bg-white border border-slate-200 text-[10px] font-black uppercase text-slate-500 flex items-center justify-center">
                  {art.fuente || 'MANUAL'}
                </div>
                <button
                  onClick={() => removeArrayItem('produccion', i)}
                  className="md:col-span-1 p-3 bg-rose-50 text-rose-700 hover:bg-rose-100"
                >
                  <Minus size={14} className="mx-auto" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Experiencia */}
        <section className="bg-white p-10 border-2 border-slate-200 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-slate-950 border-l-8 border-slate-950 pl-6">
              <Briefcase size={20} />
              <h3 className="font-black uppercase tracking-widest text-[11px]">Experiencia Relacionada</h3>
            </div>
            <button
              onClick={addExperiencia}
              className="bg-slate-950 text-white px-4 py-2 text-[10px] font-black uppercase flex items-center gap-2"
            >
              <Plus size={14} /> AGREGAR
            </button>
          </div>
          <div className="space-y-3">
            {formData.experiencia.map((exp, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 border border-slate-200 p-3 bg-slate-50">
                <select
                  value={exp.tipo}
                  onChange={(e) => {
                    const arr = [...formData.experiencia];
                    arr[i] = { ...arr[i], tipo: e.target.value as FormState['experiencia'][number]['tipo'] };
                    setFormData({ ...formData, experiencia: arr });
                  }}
                  className="md:col-span-3 p-3 border bg-white border-slate-200 text-[10px] font-black uppercase"
                >
                  <option>Profesional</option>
                  <option>Docencia Universitaria</option>
                  <option>Investigación</option>
                </select>
                <input
                  type="date"
                  value={exp.inicio}
                  onChange={(e) => {
                    const arr = [...formData.experiencia];
                    arr[i] = { ...arr[i], inicio: e.target.value };
                    setFormData({ ...formData, experiencia: arr });
                  }}
                  className="md:col-span-2 p-3 border bg-white border-slate-200 text-[11px] font-bold"
                />
                <input
                  type="date"
                  value={exp.fin}
                  onChange={(e) => {
                    const arr = [...formData.experiencia];
                    arr[i] = { ...arr[i], fin: e.target.value };
                    setFormData({ ...formData, experiencia: arr });
                  }}
                  className="md:col-span-2 p-3 border bg-white border-slate-200 text-[11px] font-bold"
                />
                <select
                  value={exp.certificacion}
                  onChange={(e) => {
                    const arr = [...formData.experiencia];
                    arr[i] = { ...arr[i], certificacion: e.target.value as 'SI' | 'NO' };
                    setFormData({ ...formData, experiencia: arr });
                  }}
                  className="md:col-span-4 p-3 border bg-white border-slate-200 text-[10px] font-black uppercase"
                >
                  <option value="SI">PRESENTA CERTIFICACIÓN: SI</option>
                  <option value="NO">PRESENTA CERTIFICACIÓN: NO</option>
                </select>
                <button
                  onClick={() => removeArrayItem('experiencia', i)}
                  className="md:col-span-1 p-3 bg-rose-50 text-rose-700 hover:bg-rose-100"
                >
                  <Minus size={14} className="mx-auto" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* CEPI toggle */}
        <div className="bg-blue-50 border-2 border-blue-200 p-4 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-wide text-blue-900">¿Trabajo aprobado por CEPI?</p>
          <button
            onClick={() => setFormData({ ...formData, hasTrabajoAprobadoCEPI: !formData.hasTrabajoAprobadoCEPI })}
            className={`px-4 py-2 text-[10px] font-black uppercase ${
              formData.hasTrabajoAprobadoCEPI ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-300'
            }`}
          >
            {formData.hasTrabajoAprobadoCEPI ? 'SI' : 'NO'}
          </button>
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-blue-600 text-white py-10 font-black text-sm tracking-[0.5em] shadow-2xl hover:bg-blue-700 active:scale-95 transition-all"
        >
          CONSOLIDAR Y REGISTRAR
        </button>
      </div>
    </div>
  );
};

export default NuevoView;
