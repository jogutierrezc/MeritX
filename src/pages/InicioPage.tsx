import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  BookOpen,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileUp,
  GraduationCap,
  IdCard,
  KeyRound,
  Languages,
  Link as LinkIcon,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
} from 'lucide-react';

import { DbConnection } from '../module_bindings';
import LoadingOverlay from '../components/LoadingOverlay';
import type { FormState } from '../types/domain';
import { calculateAdvancedEscalafon } from '../utils/calculateEscalafon';
import { importScopusProduccion as importScopusProduccionFromApi } from '../services/scopus';
import { getSpacetimeConnectionConfig } from '../services/spacetime';
import { getPortalSession } from '../services/portalAuth';

const CAMPUS = ['VALLEDUPAR', 'BUCARAMANGA', 'CUCUTA', 'BOGOTA'] as const;

type Campus = (typeof CAMPUS)[number];

type TitleItem = {
  titulo: string;
  nivel: 'Pregrado' | 'Especialización' | 'Maestría' | 'Doctorado';
  soporte: File | null;
  soporteNombre: string;
};

type LanguageItem = {
  idioma: string;
  nivel: 'A2' | 'B1' | 'B2' | 'C1';
  convalidacion: 'SI' | 'NO';
};

type ProductionItem = {
  titulo: string;
  cuartil: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  fecha: string;
  tipo: string;
  autores: number;
  fuente: 'SCOPUS' | 'MANUAL';
};

type ExperienceItem = {
  tipo: 'Profesional' | 'Docencia Universitaria' | 'Investigación';
  inicio: string;
  fin: string;
  certificacion: 'SI' | 'NO';
  soporte: File | null;
  soporteNombre: string;
};

type RegistroForm = {
  nombre: string;
  documento: string;
  programa: string;
  facultad: string;
  campus: Campus;
  scopusProfile: string;
  permanencia: number;
  yearsInCategory: number;
  esIngresoNuevo: boolean;
  titulos: TitleItem[];
  idiomas: LanguageItem[];
  produccion: ProductionItem[];
  experiencia: ExperienceItem[];
};

const emptyForm: RegistroForm = {
  nombre: '',
  documento: '',
  programa: '',
  facultad: '',
  campus: 'VALLEDUPAR',
  scopusProfile: '',
  permanencia: 0,
  yearsInCategory: 0,
  esIngresoNuevo: true,
  titulos: [{ titulo: '', nivel: 'Pregrado', soporte: null, soporteNombre: '' }],
  idiomas: [{ idioma: 'INGLES', nivel: 'A2', convalidacion: 'NO' }],
  produccion: [],
  experiencia: [{ tipo: 'Docencia Universitaria', inicio: '', fin: '', certificacion: 'NO', soporte: null, soporteNombre: '' }],
};

interface Props {
  standalone?: boolean;
}

const InicioPage = ({ standalone = false }: Props) => {
  const connectionRef = useRef<DbConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [registroExitoso, setRegistroExitoso] = useState('');
  const [formData, setFormData] = useState<RegistroForm>(emptyForm);

  const liveScore = useMemo(() => {
    try {
      return calculateAdvancedEscalafon({
        nombre: formData.nombre,
        documento: formData.documento,
        programa: formData.programa,
        facultad: formData.facultad,
        scopusProfile: formData.scopusProfile,
        esIngresoNuevo: formData.esIngresoNuevo,
        isAccreditedSource: false,
        yearsInCategory: formData.yearsInCategory,
        hasTrabajoAprobadoCEPI: false,
        titulos: formData.titulos.filter((t) => t.titulo && t.nivel).map((t) => ({ titulo: t.titulo, nivel: t.nivel })),
        idiomas: formData.idiomas,
        produccion: formData.produccion,
        experiencia: formData.experiencia
          .filter((e) => e.inicio)
          .map((e) => ({ tipo: e.tipo, inicio: e.inicio, fin: e.fin, certificacion: e.certificacion })),
        orcid: '',
      });
    } catch {
      return null;
    }
  }, [formData]);

  useEffect(() => {
    const { host, databaseName } = getSpacetimeConnectionConfig();
    const connection = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(databaseName)
      .onConnect(() => setConnected(true))
      .onConnectError((_ctx: unknown, error: unknown) => {
        console.error(error);
        setConnected(false);
      })
      .build();

    connectionRef.current = connection;

    return () => {
      connection.disconnect();
      connectionRef.current = null;
    };
  }, []);

  const runReducer = async (reducerName: string, args: object) => {
    const connection = connectionRef.current;
    if (!connection) throw new Error('Sin conexión a SpacetimeDB.');

    const reducerView = connection.reducers as any;
    const candidates = [
      reducerName,
      reducerName.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
    ];

    let fn: ((payload: object) => Promise<void>) | null = null;
    for (const key of candidates) {
      if (typeof reducerView[key] === 'function') {
        fn = reducerView[key] as (payload: object) => Promise<void>;
        break;
      }
    }

    if (!fn) throw new Error(`Reducer no disponible: ${reducerName}`);
    await fn(args);
  };

  const updateField = <K extends keyof RegistroForm>(field: K, value: RegistroForm[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addTitulo = () => {
    setFormData((prev) => ({
      ...prev,
      titulos: [...prev.titulos, { titulo: '', nivel: 'Pregrado', soporte: null, soporteNombre: '' }],
    }));
  };

  const addIdioma = () => {
    setFormData((prev) => ({
      ...prev,
      idiomas: [...prev.idiomas, { idioma: '', nivel: 'A2', convalidacion: 'NO' }],
    }));
  };

  const addProduccionManual = () => {
    setFormData((prev) => ({
      ...prev,
      produccion: [
        ...prev.produccion,
        { titulo: '', cuartil: 'Q4', fecha: new Date().getFullYear().toString(), tipo: 'Artículo', autores: 1, fuente: 'MANUAL' },
      ],
    }));
  };

  const addExperiencia = () => {
    setFormData((prev) => ({
      ...prev,
      experiencia: [
        ...prev.experiencia,
        { tipo: 'Docencia Universitaria', inicio: '', fin: '', certificacion: 'NO', soporte: null, soporteNombre: '' },
      ],
    }));
  };

  const openStandaloneWindow = () => {
    window.open(`${window.location.pathname}?portal=autoregistro`, '_blank', 'noopener,noreferrer');
  };

  const importScopusProduccion = async () => {
    if (!formData.scopusProfile.trim()) {
      window.alert('Ingresa un identificador o URL de perfil SCOPUS.');
      return;
    }
    setLoading(true);
    try {
      const scopusKey = import.meta.env.VITE_SCOPUS_API_KEY || '';
      const imported = await importScopusProduccionFromApi(formData.scopusProfile, scopusKey, 20);

      if (imported.length === 0) {
        window.alert('SCOPUS no devolvió publicaciones para ese perfil.');
        return;
      }

      setFormData((prev) => ({ ...prev, produccion: [...prev.produccion, ...imported] }));
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : 'No fue posible importar la producción desde SCOPUS.');
    } finally {
      setLoading(false);
    }
  };

  const buildCalculationInput = (): FormState => ({
    nombre: formData.nombre,
    documento: formData.documento,
    programa: formData.programa,
    facultad: formData.facultad,
    scopusProfile: formData.scopusProfile,
    esIngresoNuevo: formData.esIngresoNuevo,
    isAccreditedSource: false,
    yearsInCategory: formData.yearsInCategory,
    hasTrabajoAprobadoCEPI: false,
    titulos: formData.titulos
      .filter((item) => item.titulo && item.nivel)
      .map((item) => ({ titulo: item.titulo, nivel: item.nivel })),
    idiomas: formData.idiomas,
    produccion: formData.produccion,
    experiencia: formData.experiencia
      .filter((item) => item.inicio)
      .map((item) => ({
        tipo: item.tipo,
        inicio: item.inicio,
        fin: item.fin,
        certificacion: item.certificacion,
      })),
    orcid: '',
  });

  const handleSubmit = async () => {
    if (!connected) {
      window.alert('No hay conexión con SpacetimeDB.');
      return;
    }
    if (!formData.nombre || !formData.documento || !formData.programa || !formData.facultad) {
      window.alert('Completa nombre, documento, programa y facultad.');
      return;
    }
    if (formData.titulos.some((item) => !item.titulo)) {
      window.alert('Cada título debe tener nombre.');
      return;
    }
    if (formData.experiencia.some((item) => !item.tipo || !item.inicio || !item.certificacion)) {
      window.alert('Cada experiencia debe incluir fechas y certificación.');
      return;
    }

    setLoading(true);
    try {
      const trackingId = `UDES-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

      const calculationInput = buildCalculationInput();
      const result = calculateAdvancedEscalafon(calculationInput);

      await runReducer('register_professor', {
        trackingId,
        professorName: formData.nombre.trim(),
        documentNumber: formData.documento.trim(),
        campus: formData.campus,
        programName: formData.programa.trim(),
        facultyName: formData.facultad.trim(),
        scopusProfile: formData.scopusProfile.trim() || undefined,
        finalPoints: result.finalPts,
        finalCategory: result.finalCat.name,
        outputMessage: 'Expediente recibido. Pendiente de auditoría por auxiliares.',
      });

      for (const item of formData.titulos) {
        await runReducer('add_application_title', {
          trackingId,
          titleName: item.titulo,
          titleLevel: item.nivel,
          supportName: item.soporteNombre || undefined,
        });
      }

      for (const item of formData.idiomas) {
        await runReducer('add_application_language', {
          trackingId,
          languageName: item.idioma,
          languageLevel: item.nivel,
          convalidation: item.convalidacion === 'SI',
        });
      }

      for (const item of formData.produccion) {
        await runReducer('add_application_publication', {
          trackingId,
          publicationTitle: item.titulo,
          quartile: item.cuartil,
          publicationYear: item.fecha,
          publicationType: item.tipo || 'Artículo',
          authorsCount: Number(item.autores || 1),
          sourceKind: item.fuente,
        });
      }

      for (const item of formData.experiencia) {
        await runReducer('add_application_experience', {
          trackingId,
          experienceType: item.tipo,
          startedAt: item.inicio,
          endedAt: item.fin,
          certified: item.certificacion === 'SI',
          supportName: item.soporteNombre || undefined,
        });
      }

      setRegistroExitoso(trackingId);
      setFormData(emptyForm);
    } catch (error) {
      console.error(error);
      window.alert('No fue posible registrar al profesor.');
    } finally {
      setLoading(false);
    }
  };

  const checklistItems = [
    'Identidad del profesor y campus de postulación.',
    'Títulos con soporte por cada nivel reportado.',
    'Idiomas con nivel y convalidación.',
    'Producción importada desde SCOPUS o cargada manualmente.',
    'Experiencia con fechas, tipo y certificados adjuntos.',
  ];

  const baseInputClass =
    'w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:bg-white';

  const chipButtonClass =
    'inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-800';

  return (
    <>
      <div className="space-y-8">
        {standalone && (
          <nav className="sticky top-3 z-50 rounded-3xl border border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-600 p-2 text-white shadow-lg shadow-blue-200">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-sm font-black tracking-tight text-blue-900">SISTEMA ESCALAFON</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Gestion Rectoria UDES</p>
                </div>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">Inicio</span>
                <span className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white">Acceso</span>
              </div>
            </div>
          </nav>
        )}

        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-1 shadow-2xl shadow-blue-200">
          <div className="relative flex flex-col gap-8 rounded-[1.85rem] bg-white/8 p-8 backdrop-blur-sm md:p-12 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-white">
                <ShieldCheck size={14} /> Portal de Autoregistro Profesoral
              </div>
              <h2 className="text-4xl font-black uppercase leading-tight text-white md:text-6xl">
                Alta de
                <br />
                <span className="text-blue-200">Profesor</span>
              </h2>
              <p className="max-w-2xl text-base font-medium text-blue-50 md:text-lg">
                Registro completo del docente con titulos, idiomas, produccion intelectual, experiencia y soportes.
              </p>
            </div>

            {!standalone && (
              <button
                onClick={openStandaloneWindow}
                className="group inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-7 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-blue-700 shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Abrir en ventana nueva
                <ExternalLink size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </button>
            )}

            <div className="absolute -bottom-14 -right-16 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -left-12 -top-12 h-44 w-44 rounded-full bg-blue-300/25 blur-2xl" />
          </div>
        </section>

        {registroExitoso && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                <CheckCircle2 className="mt-0.5" size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-700">Registro recibido</p>
                <p className="mt-2 text-lg font-black uppercase text-slate-950">Tracking {registroExitoso}</p>
                <p className="mt-2 text-sm font-semibold text-emerald-900">
                  La postulación quedó almacenada en la bandeja de auxiliares para auditoría inicial.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-8 lg:grid-cols-12">
          <aside className="space-y-6 lg:col-span-4">
            <div className="space-y-6 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/60">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">Datos obligatorios</p>
                <h3 className="mt-2 text-2xl font-black uppercase tracking-tight text-slate-800">Checklist de radicacion</h3>
              </div>
              <div className="space-y-4">
                {checklistItems.map((item) => (
                  <div key={item} className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 transition-all hover:bg-white hover:shadow-sm">
                    <div className="mt-0.5 rounded-lg bg-blue-100 p-1.5 text-blue-700 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                      <CheckCircle2 size={16} />
                    </div>
                    <p className="text-sm font-semibold leading-relaxed text-slate-600 group-hover:text-slate-900">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] bg-gradient-to-br from-slate-800 to-slate-900 p-7 text-white shadow-xl">
              <h4 className="text-base font-bold">Necesitas ayuda?</h4>
              <p className="mt-2 text-sm font-medium text-slate-300">
                Consulta el manual para completar tu registro sin rechazos por soportes incompletos.
              </p>
              <button className="mt-5 w-full rounded-xl border border-white/15 bg-white/10 py-3 text-sm font-bold transition-all hover:bg-white/20">
                Ver tutorial
              </button>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-1 text-blue-700" size={18} />
                <p className="text-xs font-semibold leading-relaxed text-blue-900">
                  No requiere contrasena. El acceso protegido empieza en los portales de auxiliares y administracion.
                </p>
              </div>
            </div>
          </aside>

          <section className="space-y-8 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/60 md:p-10 lg:col-span-8">
            <div className="grid gap-6 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <User size={14} className="text-blue-500" />
                  Nombre completo
                </span>
                <input
                  value={formData.nombre}
                  onChange={(e) => updateField('nombre', e.target.value.toUpperCase())}
                  className={baseInputClass}
                  placeholder="APELLIDOS Y NOMBRES"
                />
              </label>

              <label className="space-y-2">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <IdCard size={14} className="text-blue-500" />
                  No. de documento
                </span>
                <input
                  value={formData.documento}
                  onChange={(e) => updateField('documento', e.target.value.toUpperCase())}
                  className={baseInputClass}
                  placeholder="IDENTIFICACION"
                />
              </label>

              <label className="space-y-2">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <MapPin size={14} className="text-blue-500" />
                  Campus
                </span>
                <select
                  value={formData.campus}
                  onChange={(e) => updateField('campus', e.target.value as Campus)}
                  className={baseInputClass}
                >
                  {CAMPUS.map((campus) => (
                    <option key={campus} value={campus}>
                      {campus}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <BookOpen size={14} className="text-blue-500" />
                  Programa relacionado
                </span>
                <input
                  value={formData.programa}
                  onChange={(e) => updateField('programa', e.target.value.toUpperCase())}
                  className={baseInputClass}
                  placeholder="PROGRAMA"
                />
              </label>

              <label className="space-y-2">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <Building2 size={14} className="text-blue-500" />
                  Facultad relacionada
                </span>
                <input
                  value={formData.facultad}
                  onChange={(e) => updateField('facultad', e.target.value.toUpperCase())}
                  className={baseInputClass}
                  placeholder="FACULTAD"
                />
              </label>

              <label className="space-y-2">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <TrendingUp size={14} className="text-blue-500" />
                  Años en la UDES (permanencia)
                </span>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={formData.permanencia || 0}
                  onChange={(e) => updateField('permanencia', Math.max(0, Number(e.target.value) || 0))}
                  className={baseInputClass}
                  placeholder="0"
                />
              </label>

              <label className="space-y-2">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <TrendingUp size={14} className="text-blue-500" />
                  Años en categoría actual
                </span>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={formData.yearsInCategory || 0}
                  onChange={(e) => updateField('yearsInCategory', Math.max(0, Number(e.target.value) || 0))}
                  className={baseInputClass}
                  placeholder="0"
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 md:col-span-2">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-blue-600"
                  checked={formData.esIngresoNuevo}
                  onChange={(e) => updateField('esIngresoNuevo', e.target.checked)}
                />
                <span className="text-sm font-bold text-blue-900">Es ingreso nuevo (primera vinculación a la institución)</span>
              </label>
            </div>

            <section className="space-y-5 border-t border-slate-200 pt-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GraduationCap className="text-slate-900" size={18} />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-900">Formacion academica</h3>
                </div>
                <button onClick={addTitulo} className={chipButtonClass}>
                  <Plus size={14} /> Agregar titulo
                </button>
              </div>

              <div className="space-y-4">
                {formData.titulos.map((titulo, index) => (
                  <div key={`${titulo.titulo}-${index}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1.5fr_0.8fr_1fr_auto]">
                    <input
                      value={titulo.titulo}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        titulos: prev.titulos.map((item, itemIndex) => itemIndex === index ? { ...item, titulo: e.target.value.toUpperCase() } : item),
                      }))}
                      className={baseInputClass}
                      placeholder="TITULO"
                    />
                    <select
                      value={titulo.nivel}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        titulos: prev.titulos.map((item, itemIndex) => itemIndex === index ? { ...item, nivel: e.target.value as TitleItem['nivel'] } : item),
                      }))}
                      className={baseInputClass}
                    >
                      <option value="Pregrado">Pregrado</option>
                      <option value="Especialización">Especialización</option>
                      <option value="Maestría">Maestría</option>
                      <option value="Doctorado">Doctorado</option>
                    </select>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-blue-800 transition-all hover:bg-blue-100">
                      <FileUp size={14} />
                      {titulo.soporteNombre || 'Anexar certificado'}
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const selected = e.target.files?.[0] || null;
                          setFormData((prev) => ({
                            ...prev,
                            titulos: prev.titulos.map((item, itemIndex) => itemIndex === index ? { ...item, soporte: selected, soporteNombre: selected?.name || '' } : item),
                          }));
                        }}
                      />
                    </label>
                    <button
                      onClick={() => setFormData((prev) => ({ ...prev, titulos: prev.titulos.filter((_, itemIndex) => itemIndex !== index) }))}
                      className="rounded-xl bg-rose-50 px-4 py-3 text-rose-700"
                    >
                      <Minus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-5 border-t border-slate-200 pt-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Languages className="text-slate-900" size={18} />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-900">Idiomas</h3>
                </div>
                <button onClick={addIdioma} className={chipButtonClass}>
                  <Plus size={14} /> Agregar idioma
                </button>
              </div>

              <div className="space-y-4">
                {formData.idiomas.map((idioma, index) => (
                  <div key={`${idioma.idioma}-${index}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1.2fr_0.8fr_1fr_auto]">
                    <input
                      value={idioma.idioma}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        idiomas: prev.idiomas.map((item, itemIndex) => itemIndex === index ? { ...item, idioma: e.target.value.toUpperCase() } : item),
                      }))}
                      className={baseInputClass}
                      placeholder="IDIOMA"
                    />
                    <select
                      value={idioma.nivel}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        idiomas: prev.idiomas.map((item, itemIndex) => itemIndex === index ? { ...item, nivel: e.target.value as LanguageItem['nivel'] } : item),
                      }))}
                      className={baseInputClass}
                    >
                      <option value="A2">A2</option>
                      <option value="B1">B1</option>
                      <option value="B2">B2</option>
                      <option value="C1">C1</option>
                    </select>
                    <select
                      value={idioma.convalidacion}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        idiomas: prev.idiomas.map((item, itemIndex) => itemIndex === index ? { ...item, convalidacion: e.target.value as LanguageItem['convalidacion'] } : item),
                      }))}
                      className={baseInputClass}
                    >
                      <option value="SI">Convalidacion SI</option>
                      <option value="NO">Convalidacion NO</option>
                    </select>
                    <button
                      onClick={() => setFormData((prev) => ({ ...prev, idiomas: prev.idiomas.filter((_, itemIndex) => itemIndex !== index) }))}
                      className="rounded-xl bg-rose-50 px-4 py-3 text-rose-700"
                    >
                      <Minus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-5 border-t border-slate-200 pt-8">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex items-center gap-3">
                  <LinkIcon className="text-slate-900" size={18} />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-900">Produccion intelectual</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] xl:min-w-[560px]">
                  <input
                    value={formData.scopusProfile}
                    onChange={(e) => updateField('scopusProfile', e.target.value)}
                    className={baseInputClass}
                    placeholder="URL O ID DE PERFIL SCOPUS"
                  />
                  <button onClick={importScopusProduccion} className={chipButtonClass}>
                    Importar SCOPUS
                  </button>
                  <button onClick={addProduccionManual} className="rounded-xl bg-blue-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-blue-700">
                    Manual
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {formData.produccion.map((item, index) => (
                  <div key={`${item.titulo}-${index}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1.6fr_0.7fr_0.7fr_0.8fr_auto]">
                    <input
                      value={item.titulo}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        produccion: prev.produccion.map((prod, prodIndex) => prodIndex === index ? { ...prod, titulo: e.target.value } : prod),
                      }))}
                      className={baseInputClass}
                      placeholder="TITULO DE LA INVESTIGACION"
                    />
                    <select
                      value={item.cuartil}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        produccion: prev.produccion.map((prod, prodIndex) => prodIndex === index ? { ...prod, cuartil: e.target.value as ProductionItem['cuartil'] } : prod),
                      }))}
                      className={baseInputClass}
                    >
                      <option value="Q1">Q1</option>
                      <option value="Q2">Q2</option>
                      <option value="Q3">Q3</option>
                      <option value="Q4">Q4</option>
                    </select>
                    <input
                      value={item.fecha}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        produccion: prev.produccion.map((prod, prodIndex) => prodIndex === index ? { ...prod, fecha: e.target.value } : prod),
                      }))}
                      className={baseInputClass}
                      placeholder="2024"
                    />
                    <div className="flex items-center justify-center rounded-2xl border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-blue-800">
                      {item.fuente}
                    </div>
                    <button
                      onClick={() => setFormData((prev) => ({ ...prev, produccion: prev.produccion.filter((_, prodIndex) => prodIndex !== index) }))}
                      className="rounded-xl bg-rose-50 px-4 py-3 text-rose-700"
                    >
                      <Minus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-5 border-t border-slate-200 pt-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Briefcase className="text-slate-900" size={18} />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-900">Experiencia relacionada</h3>
                </div>
                <button onClick={addExperiencia} className={chipButtonClass}>
                  <Plus size={14} /> Agregar experiencia
                </button>
              </div>

              <div className="space-y-4">
                {formData.experiencia.map((item, index) => (
                  <div key={`${item.tipo}-${index}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_0.8fr_0.8fr_0.9fr_1fr_auto]">
                    <select
                      value={item.tipo}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        experiencia: prev.experiencia.map((exp, expIndex) => expIndex === index ? { ...exp, tipo: e.target.value as ExperienceItem['tipo'] } : exp),
                      }))}
                      className={baseInputClass}
                    >
                      <option value="Profesional">Profesional</option>
                      <option value="Docencia Universitaria">Docencia Universitaria</option>
                      <option value="Investigación">Investigación</option>
                    </select>
                    <input
                      type="date"
                      value={item.inicio}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        experiencia: prev.experiencia.map((exp, expIndex) => expIndex === index ? { ...exp, inicio: e.target.value } : exp),
                      }))}
                      className={baseInputClass}
                    />
                    <input
                      type="date"
                      value={item.fin}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        experiencia: prev.experiencia.map((exp, expIndex) => expIndex === index ? { ...exp, fin: e.target.value } : exp),
                      }))}
                      className={baseInputClass}
                    />
                    <select
                      value={item.certificacion}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        experiencia: prev.experiencia.map((exp, expIndex) => expIndex === index ? { ...exp, certificacion: e.target.value as ExperienceItem['certificacion'] } : exp),
                      }))}
                      className={baseInputClass}
                    >
                      <option value="SI">Certificacion SI</option>
                      <option value="NO">Certificacion NO</option>
                    </select>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-blue-800 transition-all hover:bg-blue-100">
                      <FileUp size={14} />
                      {item.soporteNombre || 'Anexar certificado'}
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const selected = e.target.files?.[0] || null;
                          setFormData((prev) => ({
                            ...prev,
                            experiencia: prev.experiencia.map((exp, expIndex) => expIndex === index ? { ...exp, soporte: selected, soporteNombre: selected?.name || '' } : exp),
                          }));
                        }}
                      />
                    </label>
                    <button
                      onClick={() => setFormData((prev) => ({ ...prev, experiencia: prev.experiencia.filter((_, expIndex) => expIndex !== index) }))}
                      className="rounded-xl bg-rose-50 px-4 py-3 text-rose-700"
                    >
                      <Minus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {liveScore && getPortalSession() && (
              <section className="space-y-5 rounded-[2rem] border border-slate-100 bg-slate-50 p-7 shadow-inner">
                <div className="flex items-center gap-3">
                  <BarChart3 className="text-blue-600" size={20} />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Simulación de criterios en tiempo real</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { label: 'Formación académica', pts: Math.round(liveScore.ptsAcad), color: 'bg-blue-600' },
                    { label: 'Idiomas', pts: Math.round(liveScore.ptsIdioma), color: 'bg-teal-600' },
                    { label: 'Producción intelectual', pts: Math.round(liveScore.ptsPI), color: 'bg-indigo-600' },
                    { label: 'Experiencia', pts: Math.round(Math.min(liveScore.ptsExpBruta, liveScore.appliedTope)), color: 'bg-amber-600' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                      <div className={`mb-2 h-1.5 w-8 rounded-full ${item.color}`} />
                      <p className="text-lg font-black text-slate-900">{item.pts} pts</p>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-700">Total estimado</p>
                    <p className="mt-1 text-3xl font-black text-slate-900">{Math.round(liveScore.finalPts)} pts</p>
                  </div>
                  <div className={`rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg ${
                    liveScore.finalCat.bgColor
                  }`}>
                    {liveScore.finalCat.name}
                  </div>
                </div>

                {liveScore.ptsExpBruta > liveScore.appliedTope && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
                    <TrendingUp size={14} className="mt-0.5" />
                    Experiencia bruta <strong>{Math.round(liveScore.ptsExpBruta)} pts</strong>, pero la categoría limita a <strong>{liveScore.appliedTope} pts</strong>.
                    Para aprovechar más experiencia debes ascender de categoría.
                  </div>
                )}

                {liveScore.outputMessage && (
                  <div className="flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs font-semibold text-indigo-900">
                    <Sparkles size={14} className="mt-0.5 text-indigo-600" />
                    {liveScore.outputMessage}
                  </div>
                )}
              </section>
            )}

            <button
              onClick={handleSubmit}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-[11px] font-black uppercase tracking-[0.22em] text-white shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 hover:shadow-blue-300"
            >
              Guardar y continuar
              <ArrowRight size={16} />
            </button>
          </section>
        </section>
      </div>

      {loading && <LoadingOverlay />}
    </>
  );
};

export default InicioPage;
