export type Category = {
  id: string;
  name: string;
  min: number;
  max: number;
  capExp: number;
  minIdioma: 'A2' | 'B1' | 'B2' | 'C1';
  minTitulo: 'Pregrado' | 'Especialización' | 'Maestría' | 'Doctorado' | 'Ninguno';
  yearsRequired: number;
  bgColor: string;
  borderColor: string;
};

export type FormState = {
  nombre: string;
  documento: string;
  programa: string;
  facultad: string;
  scopusProfile: string;
  esIngresoNuevo: boolean;
  isAccreditedSource: boolean;
  yearsInCategory: number;
  hasTrabajoAprobadoCEPI: boolean;
  titulos: Array<{
    titulo: string;
    nivel: 'Pregrado' | 'Especialización' | 'Especialización Médico Quirúrgica' | 'Maestría' | 'Maestría de Profundización' | 'Maestría de Investigación' | 'Doctorado';
    supportName?: string;
    supportPath?: string;
  }>;
  idiomas: Array<{
    idioma: string;
    nivel: 'A2' | 'B1' | 'B2' | 'C1';
    convalidacion: 'SI' | 'NO';
    supportName?: string;
    supportPath?: string;
  }>;
  produccion: Array<{ titulo: string; cuartil: 'Q1' | 'Q2' | 'Q3' | 'Q4'; fecha: string; tipo?: string; autores?: number; fuente?: 'SCOPUS' | 'ORCID' | 'MANUAL'; supportName?: string; supportPath?: string }>;
  experiencia: Array<{
    tipo: 'Profesional' | 'Docencia Universitaria' | 'Investigación' | 'Colciencias Senior' | 'Colciencias Junior';
    inicio: string;
    fin: string;
    certificacion: 'SI' | 'NO';
    supportName?: string;
    supportPath?: string;
  }>;
  orcid: string;
};

export type RequestRecord = {
  id: string;
  nombre: string;
  documento: string;
  programa?: string;
  facultad: string;
  esIngresoNuevo: boolean;
  finalPts: number;
  finalCat: { name: string; bgColor: string };
  outputMessage: string;
  status: string;
  audit?: {
    currentStatus: string;
    titleValidated: boolean;
    experienceCertified: boolean;
    publicationVerified: boolean;
    languageValidated: boolean;
    observations: string;
    reviewerUsername?: string;
  };
};

export type EscalafonResult = {
  ptsAcad: number;
  ptsIdioma: number;
  ptsPI: number;
  ptsExpBruta: number;
  appliedTope: number;
  finalPts: number;
  finalCat: Category;
  outputMessage: string;
};

export type AppTitle = {
  id: number;
  trackingId: string;
  titleName: string;
  titleLevel: string;
};

export type AppLanguage = {
  id: number;
  trackingId: string;
  languageName: string;
  languageLevel: string;
  convalidation: boolean;
};

export type AppPublication = {
  id: number;
  trackingId: string;
  publicationTitle: string;
  quartile: string;
  publicationYear: string;
  publicationType: string;
  authorsCount: number;
  sourceKind: string;
};

export type AppExperience = {
  id: number;
  trackingId: string;
  experienceType: string;
  startedAt: string;
  endedAt: string;
  certified: boolean;
};
