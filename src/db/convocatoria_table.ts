/**
 * Re-export types from SpacetimeDB Convocatoria table
 * Note: property names are camelCase as returned by the SpacetimeDB SDK.
 */

export type ConvocatoriaType = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  periodo: string;
  año: number;
  fechaApertura: string;
  fechaCierre: string;
  estado: 'ABIERTA' | 'CERRADA' | 'CANCELADA';
  postulacionesCount?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Alias for compatibility with older code
 */
export type ConvocatoriaData = ConvocatoriaType;
