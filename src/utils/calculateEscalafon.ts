import type { FormState, EscalafonResult, Category } from '../types/domain';
import { CATEGORIES } from '../types/escalafon';

/**
 * REGLAMENTO DE ESCALAFÓN - MOTOR DE CÁLCULO
 * Implementación del flujo operativo de 4 fases y las 3 ópticas de valoración.
 */

// Definición de constantes según el Reglamento de Escalafón UDES
export const ESCALAFON_CONFIG = {
  RANGOS: {
    AUXILIAR: { min: 340, max: 480, capExp: 160, name: 'Auxiliar' },
    ASISTENTE: { min: 481, max: 750, capExp: 250, name: 'Asistente' },
    ASOCIADO: { min: 751, max: 980, capExp: 350, name: 'Asociado' },
    TITULAR: { min: 981, max: Infinity, capExp: 500, name: 'Titular' },
  },
  PUNTOS_TITULOS: {
    'Pregrado': 300,
    'Especialización': 90,
    'Maestría': 200,
    'Doctorado': 500
  },
  PUNTOS_IDIOMA: {
    'A2': 20,
    'B1': 30,
    'B2': 60,
    'C1': 100,
    'Ninguno': 0
  },
  VALOR_IDIOMA: { 'Ninguno': 0, 'A2': 1, 'B1': 2, 'B2': 3, 'C1': 4 }
};

export const CRITERIO_REFERENCIA = {
  titulos: {
    Doctorado: 500,
    Pregrado: 300,
    MaestriaInvestigacion: 300,
    EspecializacionMedicoQuirurgica: 300,
    MaestriaProfundizacion: 200,
    SubespecialidadMedicoQuirurgica: 100,
    Especializacion: 90,
    MaestriaAdicional: 90,
    TituloProfesionalAdicional: 60,
    EspecializacionAdicional: 30,
  },
  idiomas: {
    C1: 100,
    B2: 60,
    B1: 30,
    A2: 20,
  },
  experienciaAnual: {
    Investigacion: 50,
    DocenciaUniversitaria: 30,
    Profesional: 20,
    ColcienciasSenior: 100,
    ColcienciasJunior: 50,
  },
  produccion: {
    PatenteInvencion: 300,
    ModeloUtilidad: 120,
    LibroInvestigacion: 100,
    ArticuloQ1: 70,
    SoftwareEspecializado: 70,
    DisenoIndustrialBiotecnologia: 70,
    ArticuloQ2: 50,
    LibroTexto: 50,
    ProyectoEstadoEmpresa: 50,
    CapituloLibroInvestigacion: 40,
    TraduccionObraExtranjera: 40,
    ArticuloQ3: 30,
    ArticuloQ4: 20,
  },
} as const;

export const getSuggestedCategoryByPoints = (points: number) => {
  if (points >= ESCALAFON_CONFIG.RANGOS.TITULAR.min) return 'TITULAR';
  if (points >= ESCALAFON_CONFIG.RANGOS.ASOCIADO.min && points <= ESCALAFON_CONFIG.RANGOS.ASOCIADO.max) return 'ASOCIADO';
  if (points >= ESCALAFON_CONFIG.RANGOS.ASISTENTE.min && points <= ESCALAFON_CONFIG.RANGOS.ASISTENTE.max) return 'ASISTENTE';
  if (points >= ESCALAFON_CONFIG.RANGOS.AUXILIAR.min && points <= ESCALAFON_CONFIG.RANGOS.AUXILIAR.max) return 'AUXILIAR';
  return 'SIN CATEGORIA';
};

export const calculateAdvancedEscalafon = (data: FormState): EscalafonResult => {
  // --- FASE 2: ASIGNACIÓN MATEMÁTICA DE TÍTULOS E IDIOMAS ---
  // Los títulos son aditivos según el reglamento (Pregrado + Posgrados)
  const ptsAcad = data.titulos.reduce((acc, t) => acc + (ESCALAFON_CONFIG.PUNTOS_TITULOS[t.nivel] || 0), 0);
  
  const highestLevel = data.titulos.reduce((max, t) => {
    const levels = ['Ninguno', 'Pregrado', 'Especialización', 'Maestría', 'Doctorado'];
    return levels.indexOf(t.nivel) > levels.indexOf(max) ? t.nivel : max;
  }, 'Ninguno');

  const ptsIdioma = data.idiomas.reduce(
    (max, i) => Math.max(max, ESCALAFON_CONFIG.PUNTOS_IDIOMA[i.nivel] || 0),
    0
  );
  
  const userLangLevel = data.idiomas.reduce(
    (max, i) => Math.max(max, ESCALAFON_CONFIG.PUNTOS_IDIOMA[i.nivel] ? ESCALAFON_CONFIG.VALOR_IDIOMA[i.nivel] : 0),
    0
  );

  // --- FASE 3: EVALUACIÓN DE PRODUCCIÓN INTELECTUAL (CEPI) ---
  const ptsPI = data.produccion.reduce((acc, art) => {
    let base = { Q1: 70, Q2: 50, Q3: 30, Q4: 20 }[art.cuartil] || 0;
    if (art.tipo === 'Libro') base = CRITERIO_REFERENCIA.produccion.LibroInvestigacion;
    if (art.tipo === 'Patente') base = CRITERIO_REFERENCIA.produccion.PatenteInvencion;
    
    const autores = art.autores || 1;
    let factor = 1;
    if (autores >= 3 && autores <= 4) factor = 0.5;
    else if (autores >= 5) factor = 1 / autores;
    
    return acc + (base * factor);
  }, 0);

  // --- FASE 4: CÁLCULO DE EXPERIENCIA CALIFICADA (LÍQUIDA) ---
  let ptsExpBruta = 0;
  data.experiencia.forEach((exp) => {
    if (!exp.inicio) return;
    const years = (new Date(exp.fin || new Date().toISOString()).getTime() - new Date(exp.inicio).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    const factor = { Profesional: 20, 'Docencia Universitaria': 30, Investigación: 50 }[exp.tipo] || 0;
    ptsExpBruta += Math.max(0, years * factor);
  });

  // Puntos base sin tope de experiencia
  const ptsBaseSinExp = ptsAcad + ptsIdioma + ptsPI;

  // --- FASE 1 & ÓPTICA LEGAL: DETERMINACIÓN DE CATEGORÍA ---
  // Iteramos de mayor a menor para encontrar el "Techo" legal y doctrinal
  const categoriasOrdenadas = [
    { id: 'titular', ...ESCALAFON_CONFIG.RANGOS.TITULAR, reqTitulo: 'Doctorado', reqIdioma: 'B2' },
    { id: 'asociado', ...ESCALAFON_CONFIG.RANGOS.ASOCIADO, reqTitulo: 'Maestría', reqIdioma: 'B1' },
    { id: 'asistente', ...ESCALAFON_CONFIG.RANGOS.ASISTENTE, reqTitulo: 'Especialización', reqIdioma: 'A2' },
    { id: 'auxiliar', ...ESCALAFON_CONFIG.RANGOS.AUXILIAR, reqTitulo: 'Pregrado', reqIdioma: 'Ninguno' }
  ];

  let finalCat: Category = CATEGORIES.find((c) => c.id === 'none')!;
  let appliedTope = 0;
  let finalPts = ptsBaseSinExp;
  let observations = "";

  for (const cat of categoriasOrdenadas) {
    // 1. Aplicamos Tope Legal de Experiencia para esta categoría
    const expTopada = Math.min(ptsExpBruta, cat.capExp);
    const totalSimulado = ptsBaseSinExp + expTopada;

    // 2. Verificación de Barreras Doctrinarias (Títulos e Idioma)
    const cumpleTitulo = (cat.reqTitulo === 'Doctorado' && highestLevel === 'Doctorado') ||
                         (cat.reqTitulo === 'Maestría' && ['Maestría', 'Doctorado'].includes(highestLevel)) ||
                         (cat.reqTitulo === 'Especialización' && ['Especialización', 'Maestría', 'Doctorado'].includes(highestLevel)) ||
                         (cat.reqTitulo === 'Pregrado');

    const cumpleIdioma = userLangLevel >= (ESCALAFON_CONFIG.VALOR_IDIOMA as Record<string, number>)[cat.reqIdioma];

    // 3. Verificación de Rango de Puntos
    const cumplePuntos = totalSimulado >= cat.min;

    if (cumpleTitulo && cumpleIdioma && cumplePuntos) {
      finalCat = CATEGORIES.find((c) => c.id === cat.id) ?? CATEGORIES.find((c) => c.id === 'none')!;
      appliedTope = cat.capExp;
      finalPts = totalSimulado;
      break; 
    }
  }

  // --- CONSTRUCCIÓN DEL MENSAJE FINAL (ÓPTICA FLEXIBLE) ---
  if (finalCat.id === 'none') {
    observations = "No cumple con los requisitos base de puntaje o titulación para Auxiliar.";
  } else {
    observations = `Categorizado como ${finalCat.name}. `;
    observations += `Se aplicó la Óptica Legal: Experiencia topada a ${appliedTope} pts. `;
    
    // Si la experiencia bruta era mucho mayor, mencionamos la homologación
    if (ptsExpBruta > appliedTope) {
      observations += `Sus ${Math.round(ptsExpBruta)} pts de experiencia total fueron comprimidos al máximo legal de la categoría para favorecer su ingreso. `;
    }

    // Sugerencia para ascenso (Óptica Doctrinal)
    const indexActual = categoriasOrdenadas.findIndex(c => c.id === finalCat.id);
    if (indexActual > 0) {
      const proxima = categoriasOrdenadas[indexActual - 1];
      observations += `Para ascender a ${proxima.name} requiere nivel de idioma ${proxima.reqIdioma} y título de ${proxima.reqTitulo}.`;
    }
  }

  return {
    ptsAcad,
    ptsIdioma,
    ptsPI,
    ptsExpBruta,
    appliedTope,
    finalPts,
    finalCat,
    outputMessage: observations
  };
};