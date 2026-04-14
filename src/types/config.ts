/**
 * Tipos compartidos del sistema
 */

export type CoreRoleKey = 'admin' | 'decano' | 'cap' | 'cepi' | 'talento_humano';
export type RoleKey = CoreRoleKey | (string & {});
export type TabId = 'usuarios' | 'roles' | 'api' | 'email' | 'plantillas' | 'ia' | 'rag';

export type RoleConfig = {
  role: RoleKey;
  label: string;
  portal: string;
  description: string;
  active: boolean;
};

export type ApiConfig = {
  geminiApiKey: string;
  apifreellmApiKey: string;
  openrouterApiKey: string;
  scopusApiKey: string;
  orcidClientId: string;
  orcidClientSecret: string;
};

export type ResendConfig = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  enabled: boolean;
};

export type AIConfig = {
  provider: 'gemini' | 'apifreellm' | 'openrouter';
  model: string;
  temperature: number;
  maxTokens: number;
};

export type WorkflowActions = {
  autoScoreOnSubmit: boolean;
  autoNotifyOnReceived: boolean;
  autoNotifyOnAuditRequest: boolean;
  autoNotifyOnApproval: boolean;
  autoSyncScopus: boolean;
};

export type MailTemplate = {
  key: string;
  subject: string;
  html: string;
  enabled: boolean;
};

export type NewUserForm = {
  nombre: string;
  correo: string;
  campus: string;
  password: string;
  role: RoleKey;
  facultyId?: string;
};

export type RagConfig = {
  enabled: boolean;
  bucketName: string;
  retrievalTopK: number;
  chunkSize: number;
  chunkOverlap: number;
  selectedProvider: 'gemini' | 'apifreellm' | 'openrouter';
  selectedModel: string;
  fallbackProvider: 'gemini' | 'apifreellm' | 'openrouter';
  fallbackModel: string;
  systemContext: string;
};

export type RagDocument = {
  documentKey: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  bucketName: string;
  storagePath: string;
  active: boolean;
  uploadedBy?: string;
  uploadedAt?: string;
};

export type RagNormative = {
  normativeKey: string;
  title: string;
  content: string; // raw JSON string
  active: boolean;
  documentId?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  storagePath?: string;
};

export type ModelTestConditions = {
  taskType: 'legal' | 'scoring' | 'classification' | 'email';
  maxLatencyMs: number;
  maxCostTier: 1 | 2 | 3;
  minimumQuality: 1 | 2 | 3 | 4 | 5;
  ragRequired: boolean;
  prompt: string;
};

export type ModelAlternative = {
  provider: 'gemini' | 'apifreellm' | 'openrouter';
  model: string;
  estimatedLatencyMs: number;
  costTier: 1 | 2 | 3;
  qualityScore: 1 | 2 | 3 | 4 | 5;
  ragCompatibility: boolean;
  finalScore: number;
  reason: string;
};
