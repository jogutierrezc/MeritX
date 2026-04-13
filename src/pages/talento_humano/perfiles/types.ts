export type ArrayKey = 'titulos' | 'idiomas' | 'produccion' | 'experiencia';

export type MatrixRow = {
  section: 'Estudios Cursados' | 'Experiencia' | 'Otros';
  criterio: string;
  detalle: string;
  cantidad: number;
  valor: number;
  puntaje: number;
  hasSupport: boolean;
  supportNote: string;
};

export type AiCriterionRow = {
  criterio: string;
  soporteValido: boolean;
  puntajeSugerido: number;
  comentario: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type ManualRow = {
  id: string;
  section: MatrixRow['section'];
  criterio: string;
  detalle: string;
  cantidad: number;
  valor: number;
  puntaje: number;
  soportado: boolean;
  comentario: string;
};

export type AnalysisVersionRecord = {
  versionId: string;
  trackingId: string;
  sourceType: 'MOTOR' | 'IA' | 'MANUAL_TH';
  versionStatus: string;
  totalScore: number;
  suggestedCategory: string;
  rowsPayload: string;
  narrative: string;
  notes: string;
  createdBy?: string;
  createdRole?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
};

export type SelectedAnalysis = {
  rows: MatrixRow[];
  matrixTotal: number;
  suggested: {
    finalPts: number;
    finalCat: { name: string; bgColor?: string };
    outputMessage?: string;
  };
  hasDocumentSupports: boolean;
};
