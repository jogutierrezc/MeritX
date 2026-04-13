import type { FormState, EscalafonResult, Category } from '../types/domain';
import { CATEGORIES } from '../types/escalafon';

/**
 * REGLAMENTO DE ESCALAFÓN UDES - MOTOR DE CÁLCULO IA
 * Implementación de flujo operativo con resolución de solapamientos (exclusividad temporal)
 * y programación lineal con restricciones de saturación (topes máximos por categoría).
 */

// Definición de constantes según Acuerdos 003/2013, 008/2019 y Resolución 013/2019
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
  idiomas: { C1: 100, B2: 60, B1: 30, A2: 20 },
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
  // --- FASE 1: ASIGNACIÓN MATEMÁTICA DE TÍTULOS E IDIOMAS ---
  const ptsAcad = data.titulos.reduce((acc, t) => acc + (ESCALAFON_CONFIG.PUNTOS_TITULOS[t.nivel as keyof typeof ESCALAFON_CONFIG.PUNTOS_TITULOS] || 0), 0);
  
  const highestLevel = data.titulos.reduce((max, t) => {
    const levels = ['Ninguno', 'Pregrado', 'Especialización', 'Maestría', 'Doctorado'];
    return levels.indexOf(t.nivel) > levels.indexOf(max) ? t.nivel : max;
  }, 'Ninguno');

  const ptsIdioma = data.idiomas.reduce(
    (max, i) => Math.max(max, ESCALAFON_CONFIG.PUNTOS_IDIOMA[i.nivel as keyof typeof ESCALAFON_CONFIG.PUNTOS_IDIOMA] || 0),
    0
  );
  
  const userLangLevel = data.idiomas.reduce(
    (max, i) => Math.max(max, ESCALAFON_CONFIG.PUNTOS_IDIOMA[i.nivel as keyof typeof ESCALAFON_CONFIG.PUNTOS_IDIOMA] ? ESCALAFON_CONFIG.VALOR_IDIOMA[i.nivel as keyof typeof ESCALAFON_CONFIG.VALOR_IDIOMA] : 0),
    0
  );

  // --- FASE 2: EVALUACIÓN DE PRODUCCIÓN INTELECTUAL (CEPI) ---
  const ptsPI = data.produccion.reduce((acc, art) => {
    let base = { Q1: 70, Q2: 50, Q3: 30, Q4: 20 }[art.cuartil as string] || 0;
    if (art.tipo === 'Libro') base = CRITERIO_REFERENCIA.produccion.LibroInvestigacion;
    if (art.tipo === 'Patente') base = CRITERIO_REFERENCIA.produccion.PatenteInvencion;
    
    // Regla de Coautoría
    const autores = art.autores || 1;
    let factor = 1;
    if (autores >= 3 && autores <= 4) factor = 0.5;
    else if (autores >= 5) factor = 1 / autores;
    
    return acc + (base * factor);
  }, 0);

  // --- FASE 3: CÁLCULO DE EXPERIENCIA CALIFICADA (ALGORITMO DE NO DUPLICIDAD) ---
  let ptsExpBruta = 0;
  
  // 3.1 Extraer y ordenar todos los hitos de tiempo (fechas de inicio y fin)
  const datesSet = new Set<number>();
  data.experiencia.forEach((exp) => {
    if (exp.inicio) {
      datesSet.add(new Date(exp.inicio).getTime());
      datesSet.add(exp.fin ? new Date(exp.fin).getTime() : new Date().getTime());
    }
  });
  
  const sortedDates = Array.from(datesSet).sort((a, b) => a - b);

  // 3.2 Barrido cronológico para evitar doble conteo (Priorizando el peso máximo por segmento)
  for (let i = 0; i < sortedDates.length - 1; i++) {
    const segmentStart = sortedDates[i];
    const segmentEnd = sortedDates[i + 1];
    
    // Cálculo proporcional a 360 días por año académico
    const segmentDurationYears = (segmentEnd - segmentStart) / (1000 * 60 * 60 * 24 * 360);
    
    let maxWeightInSegment = 0;

    data.experiencia.forEach((exp) => {
      if (!exp.inicio) return;
      const expStart = new Date(exp.inicio).getTime();
      const expEnd = exp.fin ? new Date(exp.fin).getTime() : new Date().getTime();

      // Tolerancia mínima para asegurar que la experiencia cubre el segmento
      if (expStart <= segmentStart + 1000 && expEnd >= segmentEnd - 1000) {
        const weight = { 
          'Profesional': CRITERIO_REFERENCIA.experienciaAnual.Profesional, 
          'Docencia Universitaria': CRITERIO_REFERENCIA.experienciaAnual.DocenciaUniversitaria, 
          'Investigación': CRITERIO_REFERENCIA.experienciaAnual.Investigacion 
        }[exp.tipo] || 0;
        
        if (weight > maxWeightInSegment) {
          maxWeightInSegment = weight;
        }
      }
    });

    ptsExpBruta += segmentDurationYears * maxWeightInSegment;
  }

  // 3.3 Bono Único de Colciencias (si aplica, extraer del state genérico o simular)
  // Nota: Asegúrate de tener este campo en FormState (ej. data.colciencias)
  const categoriaColciencias = (data as any).colciencias;
  if (categoriaColciencias === 'Senior') {
    ptsExpBruta += CRITERIO_REFERENCIA.experienciaAnual.ColcienciasSenior;
  } else if (categoriaColciencias === 'Junior') {
    ptsExpBruta += CRITERIO_REFERENCIA.experienciaAnual.ColcienciasJunior;
  }

  // Puntos base puramente de méritos no dependientes de topes
  const ptsBaseSinExp = ptsAcad + ptsIdioma + ptsPI;

  // --- FASE 4: SATURACIÓN LÓGICA Y DETERMINACIÓN DE CATEGORÍA ---
  const categoriasOrdenadas = [
    { id: 'titular', ...ESCALAFON_CONFIG.RANGOS.TITULAR, reqTitulo: 'Doctorado', reqIdioma: 'B2' },
    { id: 'asociado', ...ESCALAFON_CONFIG.RANGOS.ASOCIADO, reqTitulo: 'Maestría', reqIdioma: 'B1' },
    { id: 'asistente', ...ESCALAFON_CONFIG.RANGOS.ASISTENTE, reqTitulo: 'Especialización', reqIdioma: 'A2' },
    { id: 'auxiliar', ...ESCALAFON_CONFIG.RANGOS.AUXILIAR, reqTitulo: 'Pregrado', reqIdioma: 'Ninguno' }
  ];

  let finalCat: Category = CATEGORIES.find((c) => c.id === 'none') || { id: 'none', name: 'Sin Categoría' };
  let appliedTope = 0;
  let finalPts = ptsBaseSinExp;
  let observations = "";

  for (const cat of categoriasOrdenadas) {
    // 4.1 Aplicar el algoritmo de saturación (Límite máximo de experiencia para la categoría evaluada)
    const expTopada = Math.min(ptsExpBruta, cat.capExp);
    const totalSimulado = ptsBaseSinExp + expTopada;

    // 4.2 Verificación de Barreras Doctrinarias (Títulos e Idioma)
    const cumpleTitulo = (cat.reqTitulo === 'Doctorado' && highestLevel === 'Doctorado') ||
                         (cat.reqTitulo === 'Maestría' && ['Maestría', 'Doctorado'].includes(highestLevel)) ||
                         (cat.reqTitulo === 'Especialización' && ['Especialización', 'Maestría', 'Doctorado'].includes(highestLevel)) ||
                         (cat.reqTitulo === 'Pregrado');

    const cumpleIdioma = userLangLevel >= (ESCALAFON_CONFIG.VALOR_IDIOMA as Record<string, number>)[cat.reqIdioma];

    // 4.3 Verificación de Puntos Totales
    const cumplePuntos = totalSimulado >= cat.min;

    // Si cumple todos los requisitos, es la categoría más alta que puede alcanzar
    if (cumpleTitulo && cumpleIdioma && cumplePuntos) {
      finalCat = CATEGORIES.find((c) => c.id === cat.id) || finalCat;
      appliedTope = cat.capExp;
      finalPts = totalSimulado;
      break; 
    }
  }

  // --- FASE 5: RETORNO Y EXPLICABILIDAD PARA LA IA ---
  if (finalCat.id === 'none') {
    observations = "No cumple con los requisitos base de puntaje o titulación mínima para ingresar como Auxiliar.";
  } else {
    observations = `Categorizado como ${finalCat.name}. `;
    
    if (ptsExpBruta > appliedTope) {
      observations += `Saturación Activa: El docente certificó ${Math.round(ptsExpBruta)} pts de experiencia, pero se aplicó el límite estricto de ${appliedTope} pts de la categoría ${finalCat.name}. `;
      observations += `La experiencia restante no se pierde, pero requiere aumentar la producción intelectual y/o formación académica para desbloquear un tope mayor. `;
    } else {
      observations += `No se requirió aplicar techo de experiencia (${Math.round(ptsExpBruta)} pts < Tope ${appliedTope} pts). `;
    }

    // Sugerencia para plan de carrera
    const indexActual = categoriasOrdenadas.findIndex(c => c.id === finalCat.id);
    if (indexActual > 0) {
      const proxima = categoriasOrdenadas[indexActual - 1];
      observations += `Ruta de ascenso: Para aspirar a ${proxima.name}, necesita un título mínimo de ${proxima.reqTitulo}, idioma nivel ${proxima.reqIdioma} y alcanzar ${proxima.min} pts totales.`;
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