// Teacher Profiles and Categories
export interface Titulo {
  titulo: string;
  nivel: 'Pregrado' | 'Especialización' | 'Maestría' | 'Doctorado';
}

export interface Idioma {
  idioma: string;
  nivel: 'A2' | 'B1' | 'B2' | 'C1';
  convalidacion: 'SI' | 'NO';
}

export interface Produccion {
  id?: number;
  titulo: string;
  cuartil: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  fecha: string;
  source: 'ORCID Record' | 'Scopus' | 'Manual';
  tipo?: string;
  autores?: number;
}

export interface Experiencia {
  tipo: 'Profesional' | 'Docencia Universitaria' | 'Investigación';
  inicio: string;
  fin: string;
  certificacion: 'SI' | 'NO';
}

export interface FormData {
  nombre: string;
  documento: string;
  programa: string;
  facultad: string;
  titulos: Titulo[];
  idiomas: Idioma[];
  produccion: Produccion[];
  experiencia: Experiencia[];
  orcid: string;
}

export interface CategoryConfig {
  name: 'Titular' | 'Asociado' | 'Asistente' | 'Auxiliar' | 'Sin Categoría';
  min: number;
  max: number;
  color: string;
  bgColor: string;
  border: string;
  capExp?: number;
}

export interface CalculatePointsResult {
  ptsTitulos: number;
  ptsIdioma: number;
  ptsProduccion: number;
  ptsExpRaw: number;
  cappedExp: number;
  finalPts: number;
  finalCat: CategoryConfig;
}

export interface Request extends FormData {
  id: string;
  ptsTitulos: number;
  ptsIdioma: number;
  ptsProduccion: number;
  ptsExpRaw: number;
  cappedExp: number;
  finalPts: number;
  finalCat: CategoryConfig;
  fechaRegistro: string;
}

// ORCID API Types
export interface OrcidProfile {
  orcid: string;
  name: string;
  email?: string;
  works?: OrcidWork[];
}

export interface OrcidWork {
  id: string;
  title: string;
  year: string;
  type: string;
}

// Scopus API Types
export interface ScopusResult {
  id: string;
  title: string;
  authors: string[];
  publicationYear: number;
  citationCount: number;
  quartile: 'Q1' | 'Q2' | 'Q3' | 'Q4';
}

// Auth Context
export interface AuthContextType {
  user: any | null;
  loading: boolean;
}
