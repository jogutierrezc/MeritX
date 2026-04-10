import { FormData, CalculatePointsResult, CategoryConfig } from '../types';
import { CATEGORIES } from '../constants';

/**
 * Motor de Escalafón Docente UDES
 * Integra Fases de Verificación, Asignación Matemática, Evaluación CEPI y Cálculo de Experiencia.
 */

// Mapeo de niveles de idioma para validación doctrinal
const LANG_RANK: Record<string, number> = { 'Ninguno': 0, 'A2': 1, 'B1': 2, 'B2': 3, 'C1': 4 };

// Requisitos mínimos por categoría (Óptica Doctrinal)
const REQUIREMENTS: Record<string, { minLang: number; minTitle: string }> = {
  'Titular': { minLang: 3, minTitle: 'Doctorado' },    // Requiere B2 e inferior
  'Asociado': { minLang: 2, minTitle: 'Maestría' },    // Requiere B1 e inferior
  'Asistente': { minLang: 1, minTitle: 'Especialización' }, // Requiere A2 e inferior
  'Auxiliar': { minLang: 0, minTitle: 'Pregrado' },
  'Sin Categoría': { minLang: 0, minTitle: 'Ninguno' }
};

export const calculatePoints = (data: FormData): CalculatePointsResult => {
  // --- FASE 2: ASIGNACIÓN MATEMÁTICA DE TÍTULOS E IDIOMAS ---
  let ptsTitulos = 0;
  const levels = data.titulos.map((t) => t.nivel);

  if (levels.includes('Pregrado')) ptsTitulos += 300;
  if (levels.includes('Especialización')) ptsTitulos += 90;
  if (levels.includes('Maestría')) ptsTitulos += 200;
  if (levels.includes('Doctorado')) ptsTitulos += 500;

  const highestTitle = levels.reduce((max, curr) => {
    const order = ['Ninguno', 'Pregrado', 'Especialización', 'Maestría', 'Doctorado'];
    return order.indexOf(curr) > order.indexOf(max) ? curr : max;
  }, 'Ninguno');

  const ptsIdioma = data.idiomas.reduce((max, i) => {
    const val = { A2: 20, B1: 30, B2: 60, C1: 100 }[i.nivel] || 0;
    return Math.max(max, val);
  }, 0);

  const highestLangLevel = data.idiomas.reduce((max, i) => 
    Math.max(max, LANG_RANK[i.nivel] || 0), 0
  );

  // --- FASE 3: EVALUACIÓN DE PRODUCCIÓN INTELECTUAL (CEPI) ---
  const ptsProduccion = data.produccion.reduce((acc, art) => {
    let base = { Q1: 70, Q2: 50, Q3: 30, Q4: 20 }[art.cuartil] || 0;
    if (art.tipo === 'Libro') base = 100;
    if (art.tipo === 'Patente') base = 200;

    // Condición Matemática de Autores
    const autores = art.autores || 1;
    let factor = 1;
    if (autores >= 3 && autores <= 4) factor = 0.5;
    else if (autores >= 5) factor = 1 / autores;

    return acc + (base * factor);
  }, 0);

  // --- FASE 4: CÁLCULO DE EXPERIENCIA CALIFICADA ---
  let ptsExpRaw = 0;
  data.experiencia.forEach((exp) => {
    const start = new Date(exp.inicio);
    const end = exp.fin ? new Date(exp.fin) : new Date();
    const years = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    
    const factor = {
      Profesional: 20,
      'Docencia Universitaria': 30,
      Investigación: 50,
    }[exp.tipo] || 0;
    
    ptsExpRaw += years * factor;
  });

  // --- SELECCIÓN DE CATEGORÍA (CRUCE DE ÓPTICAS) ---
  const baseQualitative = ptsTitulos + ptsIdioma + ptsProduccion;
  
  // Asumimos que CATEGORIES viene ordenado de Titular a Auxiliar (mayor a menor)
  let finalCat: CategoryConfig = CATEGORIES.find(c => c.name === 'Sin Categoría') || CATEGORIES[CATEGORIES.length - 1];
  let finalPts = 0;
  let cappedExp = 0;

  for (let cat of CATEGORIES) {
    if (cat.name === 'Sin Categoría') continue;

    // A. Óptica Legal: Aplicar tope de experiencia de la categoría evaluada
    const currentCap = cat.capExp || 160;
    const testExp = Math.min(ptsExpRaw, currentCap);
    const testTotal = baseQualitative + testExp;

    // B. Óptica Doctrinal: Verificar barreras de título e idioma
    const req = REQUIREMENTS[cat.name] || { minLang: 0, minTitle: 'Pregrado' };
    
    const hasTitle = (req.minTitle === 'Doctorado' && highestTitle === 'Doctorado') ||
                     (req.minTitle === 'Maestría' && ['Maestría', 'Doctorado'].includes(highestTitle)) ||
                     (req.minTitle === 'Especialización' && ['Especialización', 'Maestría', 'Doctorado'].includes(highestTitle)) ||
                     (req.minTitle === 'Pregrado');
    
    const hasLang = highestLangLevel >= req.minLang;

    // C. Fase 1: Verificación de Rangos de Puntos
    if (testTotal >= cat.min && hasTitle && hasLang) {
      finalCat = cat;
      finalPts = testTotal;
      cappedExp = testExp;
      break; // Encontramos la categoría más alta posible
    }
  }

  // Fallback por si no cumple mínimos de ninguna categoría
  if (finalPts === 0) {
    cappedExp = Math.min(ptsExpRaw, 160);
    finalPts = baseQualitative + cappedExp;
  }

  return { ptsTitulos, ptsIdioma, ptsProduccion, ptsExpRaw, cappedExp, finalPts, finalCat };
};

export const formatDate = (date: Date | string): string => {
  if (typeof date === 'string') return date.split('T')[0];
  return date.toISOString().split('T')[0];
};

export const getCategoryColor = (category: CategoryConfig): string => {
  return category.bgColor;
};

export const getInitialFormData = (): FormData => ({
  nombre: '',
  documento: '',
  programa: '',
  facultad: '',
  titulos: [],
  idiomas: [],
  produccion: [],
  experiencia: [],
  orcid: '',
});