import { DbConnection } from '../module_bindings';
import { getSpacetimeConnectionConfig } from './spacetime';
import { getPortalSession } from './portalAuth';
import { calculateAdvancedEscalafon as calculateAdvancedEscalafonBase } from '../utils/calculateEscalafon';
import { importScopusProduccion as importScopusProduccionFromApi } from './scopus';
import { importOrcidProduccion as importOrcidProduccionFromApi } from './orcid';

export const CAMPUS = ['VALLEDUPAR', 'BUCARAMANGA', 'CUCUTA', 'BOGOTA'] as const;
export type Campus = (typeof CAMPUS)[number];

export type TitleItem = {
  titulo: string;
  nivel: 'Pregrado' | 'Especialización' | 'Maestría' | 'Doctorado';
  soporte?: File | null;
  soporteNombre?: string;
};

export type LanguageItem = {
  idioma: string;
  nivel: 'A2' | 'B1' | 'B2' | 'C1';
  convalidacion: 'SI' | 'NO';
};

export type ProductionItem = {
  titulo: string;
  cuartil: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  fecha: string;
  tipo?: string;
  autores?: number;
  fuente?: 'SCOPUS' | 'ORCID' | 'MANUAL' | 'scopus' | 'orcid' | 'manual';
  soporte?: File | null;
  soporteNombre?: string;
};

export type ExperienceItem = {
  tipo: 'Profesional' | 'Docencia Universitaria' | 'Investigación' | 'Colciencias Senior' | 'Colciencias Junior';
  inicio: string;
  fin: string;
  certificacion: 'SI' | 'NO';
  soporte?: File | null;
  soporteNombre?: string;
};

export type RegistroForm = {
  nombre: string;
  documento: string;
  programa: string;
  facultad: string;
  campus: Campus;
  scopusProfile: string;
  permanencia: number;
  yearsInCategory: number;
  esIngresoNuevo: boolean;
  isAccreditedSource: boolean;
  hasTrabajoAprobadoCEPI: boolean;
  titulos: TitleItem[];
  idiomas: LanguageItem[];
  produccion: ProductionItem[];
  experiencia: ExperienceItem[];
  orcid: string;
};

export const emptyForm: RegistroForm = {
  nombre: '',
  documento: '',
  programa: '',
  facultad: '',
  campus: 'VALLEDUPAR',
  scopusProfile: '',
  permanencia: 0,
  yearsInCategory: 0,
  esIngresoNuevo: false,
  isAccreditedSource: false,
  hasTrabajoAprobadoCEPI: false,
  titulos: [],
  idiomas: [],
  produccion: [],
  experiencia: [],
  orcid: '',
};

let reducerConnection: DbConnection | null = null;

const getReducerConnection = (): DbConnection => {
  if (reducerConnection) return reducerConnection;

  const { host, databaseName } = getSpacetimeConnectionConfig();
  reducerConnection = DbConnection.builder()
    .withUri(host)
    .withDatabaseName(databaseName)
    .build();

  return reducerConnection;
};

export const runReducer = async (reducerName: string, args: object) => {
  const connection = getReducerConnection();
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

export const calculateAdvancedEscalafon = (input: unknown) => {
  return calculateAdvancedEscalafonBase(input as any);
};

export {
  getPortalSession,
  importScopusProduccionFromApi,
  importOrcidProduccionFromApi,
};
