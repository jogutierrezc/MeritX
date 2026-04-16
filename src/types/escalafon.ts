import type { Category, FormState } from './domain';

export const CATEGORIES: Category[] = [
  { id: 'titular', name: 'Titular', min: 981, max: Infinity, capExp: 500, minIdioma: 'C1', minTitulo: 'Doctorado', yearsRequired: 5, bgColor: 'bg-slate-950', borderColor: 'border-slate-800' },
  { id: 'asociado', name: 'Asociado', min: 751, max: 980, capExp: 350, minIdioma: 'B1', minTitulo: 'Maestría', yearsRequired: 4, bgColor: 'bg-blue-900', borderColor: 'border-blue-800' },
  { id: 'asistente', name: 'Asistente', min: 481, max: 750, capExp: 250, minIdioma: 'A2', minTitulo: 'Especialización', yearsRequired: 3, bgColor: 'bg-blue-700', borderColor: 'border-blue-600' },
  { id: 'auxiliar', name: 'Auxiliar', min: 340, max: 480, capExp: 160, minIdioma: 'A2', minTitulo: 'Pregrado', yearsRequired: 0, bgColor: 'bg-blue-600', borderColor: 'border-blue-500' },
  { id: 'none', name: 'Sin Categoría', min: 0, max: 339, capExp: 160, minIdioma: 'A2', minTitulo: 'Ninguno', yearsRequired: 0, bgColor: 'bg-slate-400', borderColor: 'border-slate-300' },
];

export const emptyForm: FormState = {
  nombre: '',
  documento: '',
  programa: '',
  facultad: '',
  campus: 'Bucaramanga',
  scopusProfile: '',
  esIngresoNuevo: true,
  isAccreditedSource: false,
  yearsInCategory: 0,
  hasTrabajoAprobadoCEPI: false,
  titulos: [{ titulo: '', nivel: 'Pregrado', fechaGrado: '', universidadOrigen: '', tipoUniversidad: 'NACIONAL', tituloConvalidado: 'NO' }],
  idiomas: [{ idioma: 'Inglés', nivel: 'A2', convalidacion: 'NO', supportName: '', supportPath: '' }],
  produccion: [],
  experiencia: [{ tipo: 'Docencia Universitaria', empresa: '', inicio: '', fin: '', certificacion: 'NO' }],
  orcid: '',
};
