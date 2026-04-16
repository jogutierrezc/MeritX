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

export type SelectedTitleDetail = {
  id: number;
  titleName: string;
  titleLevel: string;
  supportName?: string;
  supportPath?: string;
  supportFile?: File | null;
};

export type SelectedExperienceDetail = {
  id: number;
  experienceType: string;
  startedAt: string;
  endedAt: string;
  certified: boolean;
  supportName?: string;
  supportPath?: string;
  supportFile?: File | null;
};

export type SelectedPublicationDetail = {
  id: number;
  publicationTitle: string;
  quartile: string;
  publicationYear: string;
  sourceKind: 'SCOPUS' | 'ORCID' | 'MANUAL';
};

import type { EscalafonResult } from '../../../types/domain';

export type SelectedAnalysis = {
  rows: MatrixRow[];
  matrixTotal: number;
  suggested: EscalafonResult;
  hasDocumentSupports: boolean;
  titles: SelectedTitleDetail[];
  experiences: SelectedExperienceDetail[];
  publications: SelectedPublicationDetail[];
};
