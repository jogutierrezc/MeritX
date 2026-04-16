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
  importOrcidProduccion: () => void;
  facultyOptions: Array<{ id: string; name: string }>;
  programOptions: Array<{ id: string; facultyId: string; name: string; level: string }>;
  openConvocatorias: Array<{ id: string; codigo: string; nombre: string; periodo: string }>;
  selectedConvocatoriaId: string;
  setSelectedConvocatoriaId: (id: string) => void;
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
  importOrcidProduccion,
  facultyOptions,
  programOptions,
  openConvocatorias,
  selectedConvocatoriaId,
  setSelectedConvocatoriaId,
}) => {
  const selectedFaculty = facultyOptions.find((faculty) => faculty.name === formData.facultad);
  const availablePrograms = selectedFaculty
    ? programOptions.filter((program) => program.facultyId === selectedFaculty.id)
    : [];

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
            <div className="md:col-span-2">
              <select
                value={selectedConvocatoriaId}
                onChange={(e) => setSelectedConvocatoriaId(e.target.value)}
                className="w-full p-4 bg-amber-50 border-2 border-amber-200 focus:border-amber-500 outline-none font-black text-[11px] uppercase"
              >
                <option value="">SELECCIONA CONVOCATORIA ABIERTA</option>
                {openConvocatorias.map((convocatoria) => (
                  <option key={convocatoria.id} value={convocatoria.id}>
                    {convocatoria.codigo} - {convocatoria.nombre} ({convocatoria.periodo})
                  </option>
                ))}
              </select>
            </div>
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
            <select
              value={formData.campus || ''}
              onChange={(e) => setFormData({ ...formData, campus: e.target.value })}
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 focus:border-slate-950 outline-none font-bold text-[11px] uppercase"
            >
              <option value="">SELECCIONA CAMPUS</option>
              <option value="Bucaramanga">Bucaramanga</option>
              <option value="Valledupar">Valledupar</option>
              <option value="Cúcuta">Cúcuta</option>
              <option value="Bogotá">Bogotá</option>
            </select>
            <select
              value={formData.facultad}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  facultad: e.target.value,
                  programa: '',
                })
              }
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 focus:border-slate-950 outline-none font-bold text-[11px] uppercase"
            >
              <option value="">FACULTAD RELACIONADA</option>
              {facultyOptions.map((faculty) => (
                <option key={faculty.id} value={faculty.name}>
                  {faculty.name}
                </option>
              ))}
            </select>
            <select
              value={formData.programa}
              onChange={(e) => setFormData({ ...formData, programa: e.target.value })}
              disabled={!formData.facultad}
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 focus:border-slate-950 outline-none font-bold text-[11px] uppercase disabled:opacity-60"
            >
              <option value="">{formData.facultad ? 'PROGRAMA RELACIONADO' : 'SELECCIONA FACULTAD PRIMERO'}</option>
              {availablePrograms.map((program) => (
                <option key={program.id} value={program.name}>
                  {program.name} {program.level ? `(${program.level})` : ''}
                </option>
              ))}
            </select>
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
                  className="md:col-span-5 p-3 border bg-white border-slate-200 text-[11px] font-bold uppercase"
                />
                <select
                  value={t.nivel}
                  onChange={(e) => {
                    const arr = [...formData.titulos];
                    arr[i] = { ...arr[i], nivel: e.target.value as FormState['titulos'][number]['nivel'] };
                    setFormData({ ...formData, titulos: arr });
                  }}
                  className="md:col-span-3 p-3 border bg-white border-slate-200 text-[10px] font-black uppercase"
                >
                  <option>Pregrado</option>
                  <option>Especialización</option>
                  <option>Especialización Médico Quirúrgica</option>
                  <option>Maestría</option>
                  <option>Maestría de Profundización</option>
                  <option>Maestría de Investigación</option>
                  <option>Doctorado</option>
                </select>
                <label className="md:col-span-3 p-3 border bg-white border-slate-200 text-[10px] font-black uppercase text-slate-600 cursor-pointer flex items-center justify-center">
                  {t.supportName || 'Adjuntar soporte'}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const selected = e.target.files?.[0];
                      const arr = [...formData.titulos];
                      arr[i] = {
                        ...arr[i],
                        supportName: selected?.name || '',
                        supportPath: selected ? `professor-supports/titles/${Date.now()}-${selected.name}` : '',
                        supportFile: selected || null,
                      };
                      setFormData({ ...formData, titulos: arr });
                    }}
                  />
                </label>
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
                  className="md:col-span-3 p-3 border bg-white border-slate-200 text-[11px] font-bold uppercase"
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
                  className="md:col-span-3 p-3 border bg-white border-slate-200 text-[10px] font-black uppercase"
                >
                  <option value="SI">CONVALIDACIÓN: SI</option>
                  <option value="NO">CONVALIDACIÓN: NO</option>
                </select>
                <label className="md:col-span-2 p-3 border bg-white border-slate-200 text-[10px] font-black uppercase text-slate-600 cursor-pointer flex items-center justify-center">
                  {idm.supportName || 'Soporte idioma'}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const selected = e.target.files?.[0];
                      const arr = [...formData.idiomas];
                      arr[i] = {
                        ...arr[i],
                        supportName: selected?.name || '',
                        supportPath: selected ? `professor-supports/languages/${Date.now()}-${selected.name}` : '',
                      };
                      setFormData({ ...formData, idiomas: arr });
                    }}
                  />
                </label>
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
              <h3 className="font-black uppercase tracking-widest text-[11px]">Producción Intelectual (SCOPUS / ORCID)</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(260px,1fr)_auto]">
            <input
              value={formData.scopusProfile}
              onChange={(e) => setFormData({ ...formData, scopusProfile: e.target.value })}
              placeholder="ID ORCID, ID SCOPUS O URL DEL PERFIL"
              className="p-4 bg-slate-50 border-2 border-slate-100 focus:border-slate-950 outline-none font-bold text-[11px] uppercase"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={importScopusProduccion}
                className="bg-slate-950 text-white px-4 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2"
              >
                <Globe size={14} /> IMPORTAR SCOPUS
              </button>
              <button
                onClick={importOrcidProduccion}
                className="bg-indigo-600 text-white px-4 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2"
              >
                <LinkIcon size={14} /> CONSULTAR ORCID
              </button>
              <button
                onClick={addProduccionManual}
                className="bg-blue-600 text-white px-4 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2"
              >
                <Plus size={14} /> MANUAL
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {formData.produccion.map((art, i) => (
              <div key={i} className="border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
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
                {(!art.fuente || art.fuente === 'MANUAL') && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    <select
                      value={art.tipo || 'Artículo'}
                      onChange={(e) => {
                        const arr = [...formData.produccion];
                        arr[i] = { ...arr[i], tipo: e.target.value };
                        setFormData({ ...formData, produccion: arr });
                      }}
                      className="md:col-span-6 p-3 border bg-white border-slate-200 text-[10px] font-black uppercase"
                    >
                      <option value="Artículo">Artículo Científico</option>
                      <option value="Patente de Investigación">Patente de Investigación</option>
                      <option value="Modelo de Utilidad">Modelo de Utilidad</option>
                      <option value="Libro de Investigación">Libro de Investigación</option>
                      <option value="Software Especializado">Software Especializado</option>
                      <option value="Diseño Industrial">Diseño Industrial</option>
                      <option value="Libro de Texto">Libro de Texto</option>
                      <option value="Proyecto Estado-Empresa">Proyecto Estado-Empresa</option>
                      <option value="Capítulo de Libro de Investigación">Capítulo de Libro de Investigación</option>
                      <option value="Traducción de Obra Extranjera">Traducción de Obra Extranjera</option>
                    </select>
                    <label className="md:col-span-6 flex items-center gap-2 p-3 border border-dashed border-slate-300 bg-white cursor-pointer hover:bg-slate-50">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.png"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const arr = [...formData.produccion];
                          arr[i] = { ...arr[i], supportName: file.name, supportPath: URL.createObjectURL(file) };
                          setFormData({ ...formData, produccion: arr });
                        }}
                      />
                      <span className="text-[10px] font-black uppercase text-slate-500 truncate">
                        {art.supportName ? art.supportName : 'SUBIR SOPORTE'}
                      </span>
                    </label>
                  </div>
                )}
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
                  className="md:col-span-2 p-3 border bg-white border-slate-200 text-[10px] font-black uppercase"
                >
                  <option>Profesional</option>
                  <option>Docencia Universitaria</option>
                  <option>Investigación</option>
                  <option>Colciencias Senior</option>
                  <option>Colciencias Junior</option>
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
                  className="md:col-span-3 p-3 border bg-white border-slate-200 text-[10px] font-black uppercase"
                >
                  <option value="SI">PRESENTA CERTIFICACIÓN: SI</option>
                  <option value="NO">PRESENTA CERTIFICACIÓN: NO</option>
                </select>
                <label className="md:col-span-4 p-3 border bg-white border-slate-200 text-[10px] font-black uppercase text-slate-600 cursor-pointer flex items-center justify-center">
                  {exp.supportName || 'Adjuntar certificado'}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const selected = e.target.files?.[0];
                      const arr = [...formData.experiencia];
                      arr[i] = {
                        ...arr[i],
                        supportName: selected?.name || '',
                        supportPath: selected ? `professor-supports/experience/${Date.now()}-${selected.name}` : '',
                        supportFile: selected || null,
                      };
                      setFormData({ ...formData, experiencia: arr });
                    }}
                  />
                </label>
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
