import { CategoryConfig } from '../types';

export const CATEGORIES: CategoryConfig[] = [
  {
    name: 'Titular',
    min: 981,
    max: Infinity,
    color: 'slate-950',
    bgColor: 'bg-slate-950',
    border: 'border-slate-800',
    capExp: 300,
  },
  {
    name: 'Asociado',
    min: 751,
    max: 980,
    color: 'blue-900',
    bgColor: 'bg-blue-900',
    border: 'border-blue-800',
    capExp: 280,
  },
  {
    name: 'Asistente',
    min: 481,
    max: 750,
    color: 'blue-700',
    bgColor: 'bg-blue-700',
    border: 'border-blue-600',
    capExp: 260,
  },
  {
    name: 'Auxiliar',
    min: 340,
    max: 480,
    color: 'blue-600',
    bgColor: 'bg-blue-600',
    border: 'border-blue-500',
    capExp: 240,
  },
  {
    name: 'Sin Categoría',
    min: 0,
    max: 339,
    color: 'slate-400',
    bgColor: 'bg-slate-400',
    border: 'border-slate-300',
    capExp: 160,
  },
];

export const FIREBASE_CONFIG = {
  // Configure with your Firebase credentials
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

export const ORCID_CONFIG = {
  clientId: import.meta.env.VITE_ORCID_CLIENT_ID || 'APP-FIV2ITMHWJTH29SV',
  clientSecret: import.meta.env.VITE_ORCID_CLIENT_SECRET || '',
  redirectUri: import.meta.env.VITE_ORCID_REDIRECT_URI || 'http://localhost:5173/auth/orcid-callback',
  authorizationEndpoint: 'https://orcid.org/oauth/authorize',
  tokenEndpoint: 'https://orcid.org/oauth/token',
  scope: '/authenticate',
};

export const SCOPUS_CONFIG = {
  apiKey: import.meta.env.VITE_SCOPUS_API_KEY || '',
  baseUrl: 'https://api.elsevier.com',
  authenticateEndpoint: '/authenticate',
};

export const ROUTES = {
  LISTA: 'lista',
  NUEVO: 'nuevo',
  DETALLE: 'detalle',
};
