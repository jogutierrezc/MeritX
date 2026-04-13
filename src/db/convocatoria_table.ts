/**
 * Re-export types from SpacetimeDB Convocatoria table
 */

export type ConvocatoriaType = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  periodo: string;
  año: number;
  estado: 'ABIERTA' | 'CERRADA' | 'CANCELADA';
  fecha_apertura: string;
  fecha_cierre: string;
  postulaciones_count?: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
};

/**
 * Alias for compatibility with older code
 */
export type ConvocatoriaData = ConvocatoriaType;
