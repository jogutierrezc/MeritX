import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronRight,
  FileText,
  Key,
  LayoutDashboard,
  Mail,
  Save,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { DbConnection } from '../../module_bindings';
import type {
  Faculty,
  PortalRole,
  SystemSetting,
  UserFacultyAssignment,
  UserProfile,
} from '../../module_bindings/types';
import { getPortalSession } from '../../services/portalAuth';
import { useSpacetime } from '../../context/SpacetimeContext';
import { APIConfigSection } from '../../components/APIConfigSection';
import AppLogo from '../../components/Common/AppLogo';
import { RagSettingsModule } from './modules/RagSettingsModule';
import { RagDocumentosModule } from './modules/RagDocumentosModule';
import { RagNormativaModule } from './modules/RagNormativaModule';
import type {
  AIConfig,
  ApiConfig,
  MailTemplate,
  NewUserForm,
  RagConfig,
  RagDocument,
  RagNormative,
  ResendConfig,
  RoleConfig,
  RoleKey,
  TabId,
  WorkflowActions,
} from '../../types/config';

import { UsuariosModule } from './UsuariosModule';
import { FacultadesModule } from './FacultadesModule';
import { RolesModule } from './RolesModule';
import { EmailModule } from './EmailModule';
import { IAModule } from './IAModule';
import { PlantillasModule } from './PlantillasModule';

// ─── Constants & defaults ────────────────────────────────────────────────────

const SETTING_KEYS = {
  ai: 'cfg.ai',
  actions: 'cfg.actions',
  openrouterApiKey: 'cfg.openrouter.apiKey',
  ragConfig: 'cfg.rag.config',
  ragDocuments: 'cfg.rag.documents',
  ragNormatives: 'cfg.rag.normatives',
} as const;

const DEFAULT_ROLES: RoleConfig[] = [
  {
    role: 'admin',
    label: 'Administrador',
    portal: 'expedientes',
    description: 'Gestion global de expedientes, reportes y configuracion.',
    active: true,
  },
  {
    role: 'decano',
    label: 'Decano',
    portal: 'decano',
    description: 'Consejo de Facultad para aval inicial o rechazo.',
    active: true,
  },
  {
    role: 'cap',
    label: 'CAP',
    portal: 'cap',
    description: 'Comite de Asuntos Profesorales para valoracion intermedia.',
    active: true,
  },
  {
    role: 'cepi',
    label: 'CEPI',
    portal: 'cepi',
    description: 'Comite de Evaluacion de Produccion Intelectual para decision final.',
    active: true,
  },
  {
    role: 'talento_humano',
    label: 'Talento Humano',
    portal: 'talento',
    description: 'Gestion de personal y administracion academica.',
    active: true,
  },
];

const DEFAULT_API_CONFIG: ApiConfig = {
  geminiApiKey: '',
  apifreellmApiKey: '',
  openrouterApiKey: '',
  scopusApiKey: '',
  orcidClientId: '',
  orcidClientSecret: '',
};

const DEFAULT_RESEND_CONFIG: ResendConfig = {
  apiKey: '',
  fromEmail: '',
  fromName: '',
  enabled: false,
};

const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  maxTokens: 2048,
};

const DEFAULT_ACTIONS: WorkflowActions = {
  autoScoreOnSubmit: true,
  autoNotifyOnReceived: true,
  autoNotifyOnAuditRequest: true,
  autoNotifyOnApproval: true,
  autoSyncScopus: false,
};

const DEFAULT_RAG_CONFIG: RagConfig = {
  enabled: true,
  bucketName: 'rag-udes',
  retrievalTopK: 5,
  chunkSize: 1200,
  chunkOverlap: 150,
  selectedProvider: 'gemini',
  selectedModel: 'gemini-2.5-flash',
  fallbackProvider: 'apifreellm',
  fallbackModel: 'gpt-4o-mini',
  systemContext:
    'Eres un asistente juridico-academico para escalafon docente UDES. Responde con soporte normativo, cita fuentes del contexto RAG y explica criterios de puntaje.',
};

const DEFAULT_TEMPLATES: MailTemplate[] = [
  {
    key: 'WORKFLOW_RECEIVED',
    subject: 'Postulacion recibida - {{tracking_id}}',
    html: '<h2>Hola {{nombre}}</h2><p>Tu postulacion {{tracking_id}} ha sido recibida el {{fecha_registro}}.</p>',
    enabled: true,
  },
  {
    key: 'WORKFLOW_AUDIT_REQUEST',
    subject: 'Solicitud de complementacion - {{tracking_id}}',
    html: '<h2>Hola {{nombre}}</h2><p>Se necesita complementar tu postulacion.</p><p>Observaciones: {{observaciones}}</p>',
    enabled: true,
  },
  {
    key: 'WORKFLOW_APPROVED',
    subject: 'Resultado aprobado - {{tracking_id}}',
    html: '<h2>Hola {{nombre}}</h2><p>Tu postulacion {{tracking_id}} fue aprobada con categoria {{categoria_final}}.</p>',
    enabled: true,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const safeJSONParse = <T,>(value: string | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const safeJSONStringify = (value: unknown, space?: number): string => {
  try {
    return JSON.stringify(
      value,
      (_key, v) => (typeof v === 'bigint' ? v.toString() : v),
      space,
    );
  } catch {
    return '[unserializable]';
  }
};

const isReducerMissingError = (error: unknown, reducerName: string): boolean =>
  error instanceof Error && error.message.includes(`Reducer no disponible: ${reducerName}`);

const isDecanoLikeRole = (role: string) => role.trim().toLowerCase().includes('decano');

// ─── Sidebar items ────────────────────────────────────────────────────────────

const MENU_ITEMS: { id: TabId; icon: React.FC<{ size?: number }>; label: string }[] = [
  { id: 'usuarios', icon: Users, label: 'Usuarios' },
  { id: 'roles', icon: ShieldCheck, label: 'Gestion de Roles' },
  { id: 'api', icon: Key, label: 'Configuracion de API' },
  { id: 'email', icon: Mail, label: 'Configuracion Email' },
  { id: 'plantillas', icon: FileText, label: 'Plantillas HTML' },
  { id: 'ia', icon: Sparkles, label: 'Motor de IA y Acciones' },
  { id: 'rag', icon: ServerCog, label: 'RAG y Modelos IA' },
];

// ─── AdminPortal ──────────────────────────────────────────────────────────────

const AdminPortal = () => {
  const { connection, connected, portalAuthReady, globalDataReady, session } = useSpacetime();

  const [activeTab, setActiveTab] = useState<TabId>('usuarios');
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [roles, setRoles] = useState<RoleConfig[]>(DEFAULT_ROLES);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [userFacultyAssignments, setUserFacultyAssignments] = useState<
    Record<string, { facultyId: string; facultyName: string; active: boolean }>
  >({});
  const [apiConfig, setApiConfig] = useState<ApiConfig>(DEFAULT_API_CONFIG);
  const [resendConfig, setResendConfig] = useState<ResendConfig>(DEFAULT_RESEND_CONFIG);
  const [templates, setTemplates] = useState<MailTemplate[]>(DEFAULT_TEMPLATES);
  const [aiConfig, setAiConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG);
  const [actions, setActions] = useState<WorkflowActions>(DEFAULT_ACTIONS);
  const [ragConfig, setRagConfig] = useState<RagConfig>(DEFAULT_RAG_CONFIG);
  const [ragDocuments, setRagDocuments] = useState<RagDocument[]>([]);
  const [ragNormatives, setRagNormatives] = useState<RagNormative[]>([]);

  // ── Connection ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!connection) {
      setLoading(true);
      return;
    }

    const refreshFromCache = () => {
      const db = connection.db as any;

      const settingRows: SystemSetting[] = db.system_setting
        ? (Array.from(db.system_setting.iter()) as SystemSetting[])
        : [];
      const roleTable = db.portal_role || db.portalRole;
      const roleRows: PortalRole[] = roleTable
        ? (Array.from(roleTable.iter()) as PortalRole[])
        : [];
      const userTable = db.user_profile || db.userProfile;
      const userRows: UserProfile[] = userTable
        ? (Array.from(userTable.iter()) as UserProfile[])
        : [];
      const facultyTable = db.faculty;
      const facultyRows: Faculty[] = facultyTable
        ? (Array.from(facultyTable.iter()) as Faculty[])
        : [];
      const assignmentTable = db.user_faculty_assignment || db.userFacultyAssignment;
      const assignmentRows: UserFacultyAssignment[] = assignmentTable
        ? (Array.from(assignmentTable.iter()) as UserFacultyAssignment[])
        : [];
      const apiRows = db.api_config ? (Array.from(db.api_config.iter()) as any[]) : [];
      const openrouterRows = db.openrouter_config
        ? (Array.from(db.openrouter_config.iter()) as any[])
        : [];
      const resendRows = db.resend_config ? (Array.from(db.resend_config.iter()) as any[]) : [];
      const templateRows = db.email_template ? (Array.from(db.email_template.iter()) as any[]) : [];
      const ragConfigRows = db.rag_config ? (Array.from(db.rag_config.iter()) as any[]) : [];
      const ragDocumentRows = db.rag_document ? (Array.from(db.rag_document.iter()) as any[]) : [];
      const ragNormativeRows = db.rag_normative ? (Array.from(db.rag_normative.iter()) as any[]) : [];

      // Roles
      if (roleRows.length > 0) {
        const mapped = roleRows
          .map((item: any) => {
            const roleKey = item.role_key ?? item.roleKey;
            if (!roleKey) return null;
            return {
              role: String(roleKey).trim() as RoleKey,
              label: String(item.role_name ?? item.roleName ?? 'Sin nombre').trim(),
              portal: String(item.portal_module ?? item.portalModule ?? 'portal').trim(),
              description: item.description ? String(item.description).trim() : '',
              active: Boolean(item.active),
            };
          })
          .filter(Boolean) as RoleConfig[];
        setRoles(mapped.length > 0 ? mapped : DEFAULT_ROLES);
      }

      setUsers(userRows);
      setUserFacultyAssignments(
        assignmentRows.reduce((acc, row) => {
          acc[String(row.userEmail).toLowerCase()] = {
            facultyId: row.facultyId,
            facultyName: row.facultyName,
            active: row.active,
          };
          return acc;
        }, {} as Record<string, { facultyId: string; facultyName: string; active: boolean }>),
      );
      setFaculties(
        facultyRows
          .filter((row) => row.active)
          .sort((left, right) => left.facultyName.localeCompare(right.facultyName)),
      );

      // API config
      const defaultApi = apiRows.find((row) => row.configKey === 'default');
      const openrouterTableValue =
        openrouterRows.find((row) => row.configKey === 'default')?.apiKey || '';
      const openrouterSetting =
        settingRows.find((row) => row.key === SETTING_KEYS.openrouterApiKey)?.value || '';
      const effectiveOpenrouterKey = openrouterTableValue || openrouterSetting;
      if (defaultApi) {
        setApiConfig({
          geminiApiKey: defaultApi.geminiApiKey,
          apifreellmApiKey: defaultApi.apifreellmApiKey,
          openrouterApiKey: effectiveOpenrouterKey,
          scopusApiKey: defaultApi.scopusApiKey,
          orcidClientId: defaultApi.orcidClientId,
          orcidClientSecret: defaultApi.orcidClientSecret,
        });
        if (defaultApi.scopusApiKey) {
          window.localStorage.setItem('meritx.scopusApiKey', String(defaultApi.scopusApiKey));
          window.localStorage.setItem('scopusApiKey', String(defaultApi.scopusApiKey));
        }
      } else {
        setApiConfig((prev) => ({
          ...prev,
          openrouterApiKey: effectiveOpenrouterKey,
        }));
      }

      // Resend config
      const defaultResend = resendRows.find((row) => row.configKey === 'default');
      if (defaultResend) {
        setResendConfig({
          apiKey: defaultResend.apiKey,
          fromEmail: defaultResend.fromEmail,
          fromName: defaultResend.fromName,
          enabled: defaultResend.enabled,
        });
      }

      // Email templates
      if (templateRows.length > 0) {
        setTemplates(
          templateRows
            .map((row) => ({
              key: row.templateKey,
              subject: row.subject,
              html: row.htmlContent,
              enabled: row.enabled,
            }))
            .sort((a, b) => a.key.localeCompare(b.key)),
        );
      }

      // System settings
      const settingMap = new Map(settingRows.map((row) => [row.key, row.value]));

      // RAG config
      const defaultRagConfig = ragConfigRows.find(
        (row) => row.configKey === 'default' || row.config_key === 'default',
      );
      if (defaultRagConfig) {
        setRagConfig({
          enabled: Boolean(defaultRagConfig.enabled),
          bucketName: String(
            defaultRagConfig.bucketName ?? defaultRagConfig.bucket_name ?? DEFAULT_RAG_CONFIG.bucketName,
          ),
          retrievalTopK: Number(
            defaultRagConfig.retrievalTopK ??
              defaultRagConfig.retrieval_top_k ??
              DEFAULT_RAG_CONFIG.retrievalTopK,
          ),
          chunkSize: Number(
            defaultRagConfig.chunkSize ?? defaultRagConfig.chunk_size ?? DEFAULT_RAG_CONFIG.chunkSize,
          ),
          chunkOverlap: Number(
            defaultRagConfig.chunkOverlap ??
              defaultRagConfig.chunk_overlap ??
              DEFAULT_RAG_CONFIG.chunkOverlap,
          ),
          selectedProvider: String(
            defaultRagConfig.selectedProvider ??
              defaultRagConfig.selected_provider ??
              DEFAULT_RAG_CONFIG.selectedProvider,
          ) as RagConfig['selectedProvider'],
          selectedModel: String(
            defaultRagConfig.selectedModel ??
              defaultRagConfig.selected_model ??
              DEFAULT_RAG_CONFIG.selectedModel,
          ),
          fallbackProvider: String(
            defaultRagConfig.fallbackProvider ??
              defaultRagConfig.fallback_provider ??
              DEFAULT_RAG_CONFIG.fallbackProvider,
          ) as RagConfig['fallbackProvider'],
          fallbackModel: String(
            defaultRagConfig.fallbackModel ??
              defaultRagConfig.fallback_model ??
              DEFAULT_RAG_CONFIG.fallbackModel,
          ),
          systemContext: String(
            defaultRagConfig.systemContext ??
              defaultRagConfig.system_context ??
              DEFAULT_RAG_CONFIG.systemContext,
          ),
        });
      } else {
        setRagConfig(safeJSONParse<RagConfig>(settingMap.get(SETTING_KEYS.ragConfig), DEFAULT_RAG_CONFIG));
      }

      // RAG documents
      const mappedDocs = ragDocumentRows
        .map((row) => ({
          documentKey: String(row.documentKey ?? row.document_key ?? ''),
          fileName: String(row.fileName ?? row.file_name ?? ''),
          fileType: String(row.fileType ?? row.file_type ?? 'application/octet-stream'),
          fileSizeBytes: Number(row.fileSizeBytes ?? row.file_size_bytes ?? 0),
          bucketName: String(
            row.bucketName ?? row.bucket_name ?? defaultRagConfig?.bucket_name ?? DEFAULT_RAG_CONFIG.bucketName,
          ),
          storagePath: String(row.storagePath ?? row.storage_path ?? ''),
          active: Boolean(row.active),
          uploadedBy: row.uploadedBy ?? row.uploaded_by,
          uploadedAt: row.uploadedAt ?? row.uploaded_at,
        }))
        .filter((row) => row.documentKey);
      setRagDocuments(
        mappedDocs.length > 0
          ? mappedDocs
          : safeJSONParse<RagDocument[]>(settingMap.get(SETTING_KEYS.ragDocuments), []),
      );

      const mappedNormatives = ragNormativeRows
        .map((row: any) => ({
          normativeKey: String(row.normativeKey ?? row.normative_key ?? ''),
          title: String(row.title ?? ''),
          content: String(row.jsonContent ?? row.json_content ?? ''),
          active: Boolean(row.active),
          documentId: String(row.documentId ?? row.document_id ?? ''),
          uploadedBy: row.uploadedBy ?? row.uploaded_by,
          uploadedAt: row.uploadedAt ?? row.uploaded_at,
          storagePath: String(row.storagePath ?? row.storage_path ?? ''),
        }))
        .filter((r: any) => r.normativeKey);

      setRagNormatives(
        mappedNormatives.length > 0
          ? mappedNormatives
          : safeJSONParse<RagNormative[]>(settingMap.get(SETTING_KEYS.ragNormatives), []),
      );

      setAiConfig(safeJSONParse(settingMap.get(SETTING_KEYS.ai), DEFAULT_AI_CONFIG));
      setActions(safeJSONParse(settingMap.get(SETTING_KEYS.actions), DEFAULT_ACTIONS));
    };

    if (globalDataReady) {
      try {
        refreshFromCache();
        setLoading(false);
      } catch (error) {
        console.error(error);
        setStatusMessage('Error de carga inicial en Spacetime.');
        setLoading(false);
      }
    }

    return () => {
      // cleanup if needed
    };
  }, [connection, globalDataReady]);

  // ── Reducer runner ─────────────────────────────────────────────────────────

  const runReducer = async (reducerName: string, args: object) => {
    if (!connection) throw new Error('Sin conexion Spacetime.');

    const reducerView = connection.reducers as any;
    const toCamel = (v: string) => v.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    const toSnake = (v: string) =>
      v
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
    const normalize = (v: string) => v.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const candidates = Array.from(
      new Set([
        reducerName,
        toCamel(reducerName),
        toSnake(reducerName),
        `${toCamel(reducerName)}Reducer`,
        `${toSnake(reducerName)}_reducer`,
      ]),
    );

    let fn: ((payload: object) => Promise<void>) | null = null;

    for (const key of candidates) {
      if (typeof reducerView[key] === 'function') {
        fn = reducerView[key] as (payload: object) => Promise<void>;
        break;
      }
    }

    if (!fn) {
      const availableKeys = Object.keys(reducerView).filter(
        (key) => typeof reducerView[key] === 'function',
      );
      const wanted = new Set(candidates.map(normalize));
      const matchedKey = availableKeys.find((key) => wanted.has(normalize(key)));
      if (matchedKey) fn = reducerView[matchedKey] as (payload: object) => Promise<void>;
    }

    if (!fn) {
      const isRagReducer = [
        'upsert_rag_config',
        'upsert_rag_document',
        'deactivate_rag_document',
      ].includes(reducerName);
      if (isRagReducer) {
        const keys = Object.keys(reducerView)
          .filter((k) => typeof reducerView[k] === 'function')
          .join(', ');
        throw new Error(
          `Reducer no disponible: ${reducerName}. Reducers visibles: ${keys || '(ninguno)'}. Ejecuta: spacetime generate y reinicia Vite.`,
        );
      }
      throw new Error(`Reducer no disponible: ${reducerName}`);
    }

    await fn(args);
  };

  // ── Save functions ─────────────────────────────────────────────────────────

  const saveRoles = async () => {
    const seen = new Set<string>();

    for (const role of roles) {
      const roleKey = role?.role ? String(role.role).trim() : null;
      if (!roleKey || roleKey === 'null' || roleKey === 'undefined') {
        throw new Error('Todos los roles deben tener una clave de rol válida.');
      }
      if (seen.has(roleKey)) {
        throw new Error(`La clave de rol ${roleKey} está repetida.`);
      }
      seen.add(roleKey);

      await runReducer('upsert_portal_role', {
        roleKey,
        roleName: role.label ? String(role.label).trim() : roleKey,
        portalModule: role.portal ? String(role.portal).trim() : 'portal',
        description: role.description ? String(role.description).trim() : '',
        active: Boolean(role.active),
      });
    }
  };

  const saveSettings = async () => {
    await runReducer('upsert_api_config', {
      configKey: 'default',
      geminiApiKey: apiConfig.geminiApiKey,
      apifreellmApiKey: apiConfig.apifreellmApiKey,
      scopusApiKey: apiConfig.scopusApiKey,
      orcidClientId: apiConfig.orcidClientId,
      orcidClientSecret: apiConfig.orcidClientSecret,
      aiProvider: aiConfig.provider,
      aiModel: aiConfig.model,
    });
    window.localStorage.setItem('meritx.scopusApiKey', apiConfig.scopusApiKey || '');
    window.localStorage.setItem('scopusApiKey', apiConfig.scopusApiKey || '');

    await runReducer('upsert_resend_config', {
      configKey: 'default',
      apiKey: resendConfig.apiKey,
      fromEmail: resendConfig.fromEmail,
      fromName: resendConfig.fromName,
      enabled: resendConfig.enabled,
    });

    for (const template of templates) {
      await runReducer('upsert_email_template', {
        templateKey: template.key,
        workflowKey: template.key,
        subject: template.subject,
        htmlContent: template.html,
        enabled: template.enabled,
      });
    }

    for (const item of [
      { key: SETTING_KEYS.ai, value: JSON.stringify(aiConfig) },
      { key: SETTING_KEYS.actions, value: JSON.stringify(actions) },
    ]) {
      await runReducer('upsert_system_setting', {
        key: item.key,
        scope: 'CONFIG',
        campus: undefined,
        value: item.value,
      });
    }

    try {
      await runReducer('upsert_openrouter_config', {
        configKey: 'default',
        apiKey: apiConfig.openrouterApiKey || '',
      });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('Reducer no disponible: upsert_openrouter_config')) {
        throw error;
      }
      await runReducer('upsert_system_setting', {
        key: SETTING_KEYS.openrouterApiKey,
        scope: 'CONFIG',
        campus: undefined,
        value: apiConfig.openrouterApiKey || '',
      });
    }
  };

  const saveRagConfig = async () => {
    const normalized: RagConfig = {
      ...ragConfig,
      bucketName: ragConfig.bucketName.trim() || DEFAULT_RAG_CONFIG.bucketName,
      retrievalTopK: Math.max(1, ragConfig.retrievalTopK),
      chunkSize: Math.max(256, ragConfig.chunkSize),
      chunkOverlap: Math.max(0, ragConfig.chunkOverlap),
      selectedModel: ragConfig.selectedModel.trim(),
      fallbackModel: ragConfig.fallbackModel.trim(),
      systemContext: ragConfig.systemContext.trim(),
    };
    try {
      await runReducer('upsert_rag_config', {
        configKey: 'default',
        ...normalized,
      });
    } catch (error) {
      if (!isReducerMissingError(error, 'upsert_rag_config')) throw error;
      await runReducer('upsert_system_setting', {
        key: SETTING_KEYS.ragConfig,
        scope: 'CONFIG',
        campus: undefined,
        value: safeJSONStringify(normalized),
      });
    }
  };

  const uploadRagDocument = async (file: File) => {
    const contentBase64: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No fue posible leer el archivo para RAG.'));
      reader.onload = () => {
        const raw = String(reader.result ?? '');
        resolve(raw.includes(',') ? raw.split(',')[1] : raw);
      };
      reader.readAsDataURL(file);
    });
    const documentKey = `${Date.now()}-${file.name}`.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
    const bucketName = ragConfig.bucketName.trim() || DEFAULT_RAG_CONFIG.bucketName;
    const nextDoc: RagDocument = {
      documentKey,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSizeBytes: file.size,
      bucketName,
      storagePath: `${bucketName}/${documentKey}`,
      active: true,
      uploadedAt: new Date().toISOString(),
    };
    try {
      await runReducer('upsert_rag_document', {
        documentKey,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSizeBytes: BigInt(file.size),
        bucketName,
        storagePath: `${bucketName}/${documentKey}`,
        contentBase64,
        active: true,
      });
    } catch (error) {
      if (!isReducerMissingError(error, 'upsert_rag_document')) throw error;
      const docs = [nextDoc, ...ragDocuments.filter((d) => d.documentKey !== nextDoc.documentKey)];
      setRagDocuments(docs);
      await runReducer('upsert_system_setting', {
        key: SETTING_KEYS.ragDocuments,
        scope: 'CONFIG',
        campus: undefined,
        value: safeJSONStringify(docs),
      });
    }
  };

  const deactivateRagDocument = async (documentKey: string) => {
    try {
      await runReducer('deactivate_rag_document', { documentKey });
    } catch (error) {
      if (!isReducerMissingError(error, 'deactivate_rag_document')) throw error;
      const docs = ragDocuments.map((d) => (d.documentKey === documentKey ? { ...d, active: false } : d));
      setRagDocuments(docs);
      await runReducer('upsert_system_setting', {
        key: SETTING_KEYS.ragDocuments,
        scope: 'CONFIG',
        campus: undefined,
        value: safeJSONStringify(docs),
      });
    }
  };

  const uploadRagNormative = async (title: string, json: string, file?: File) => {
    const normativeKey = `${Date.now()}-${title}`.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
    const bucketName = ragConfig.bucketName.trim() || DEFAULT_RAG_CONFIG.bucketName;
    const nextNorm = {
      normativeKey,
      title: title || (file ? file.name.replace(/\.[^.]+$/, '') : 'normativa'),
      content: json,
      active: true,
      uploadedAt: new Date().toISOString(),
      storagePath: `${bucketName}/${normativeKey}`,
    } as RagNormative;

    try {
      await runReducer('upsert_rag_normative', {
        normativeKey,
        title: nextNorm.title,
        jsonContent: json,
        bucketName,
        storagePath: nextNorm.storagePath,
        active: true,
      });
    } catch (error) {
      if (!isReducerMissingError(error, 'upsert_rag_normative')) throw error;
      const items = [nextNorm, ...ragNormatives.filter((r) => r.normativeKey !== nextNorm.normativeKey)];
      setRagNormatives(items);
      await runReducer('upsert_system_setting', {
        key: SETTING_KEYS.ragNormatives,
        scope: 'CONFIG',
        campus: undefined,
        value: safeJSONStringify(items),
      });
    }
  };

  const deactivateRagNormative = async (normativeKey: string) => {
    try {
      await runReducer('deactivate_rag_normative', { normativeKey });
    } catch (error) {
      // If the reducer isn't present (older deployments), fall back to system_setting.
      // Also handle the case where the reducer exists but the normative is only stored in system_setting
      // (reducer will throw a SenderError with message 'Normativa RAG no encontrada.').
      const errMsg = (error && (error as any).message) || String(error);
      if (!isReducerMissingError(error, 'deactivate_rag_normative') && !/Normativa RAG no encontrada/i.test(errMsg)) {
        throw error;
      }

      // Mark local copy as inactive and persist to legacy system_setting storage.
      const items = ragNormatives.map((r) => (r.normativeKey === normativeKey ? { ...r, active: false } : r));
      setRagNormatives(items);
      try {
        await runReducer('upsert_system_setting', {
          key: SETTING_KEYS.ragNormatives,
          scope: 'CONFIG',
          campus: undefined,
          value: safeJSONStringify(items),
        });
      } catch (e) {
        // If persisting legacy setting fails, at least keep in-memory state updated and log.
        console.error('Failed to persist legacy rag normatives after deactivate fallback', e);
      }
    }
  };

  const addUser = async (form: NewUserForm) => {
    if (!form.nombre.trim() || !form.correo.trim() || !form.password.trim()) {
      setStatusMessage('Completa nombre, correo y contraseña para crear el usuario.');
      return;
    }
    if (isDecanoLikeRole(String(form.role)) && !form.facultyId) {
      setStatusMessage('El rol decano requiere una facultad asignada.');
      return;
    }
    try {
      setSaving(true);
      await runReducer('register_user_profile', {
        nombre: form.nombre.trim(),
        correo: form.correo.trim().toLowerCase(),
        campus: form.campus.trim().toUpperCase(),
        password: form.password,
        role: form.role,
        facultyId: form.facultyId || undefined,
      });
      setStatusMessage('Usuario creado correctamente en SpacetimeDB.');
    } catch (error) {
      console.error(error);
      setStatusMessage('No fue posible crear el usuario. Verifica sesion admin en Spacetime.');
    } finally {
      setSaving(false);
    }
  };

  const updateUser = async (form: {
    correo: string;
    nombre: string;
    campus: string;
    role: string;
    active: boolean;
    facultyId?: string;
  }) => {
    if (!form.correo.trim()) {
      setStatusMessage('No se pudo actualizar: correo inválido.');
      return;
    }
    if (!form.role.trim()) {
      setStatusMessage('No se pudo actualizar: rol inválido.');
      return;
    }
    if (isDecanoLikeRole(form.role) && !form.facultyId) {
      setStatusMessage('El rol decano requiere una facultad asignada.');
      return;
    }

    try {
      setSaving(true);
      await runReducer('update_user_profile', {
        correo: form.correo.trim().toLowerCase(),
        nombre: form.nombre.trim(),
        campus: form.campus.trim().toUpperCase(),
        role: form.role,
        active: form.active,
        facultyId: form.facultyId || undefined,
      });
      setStatusMessage('Usuario actualizado correctamente.');
    } catch (error) {
      console.error(error);
      setStatusMessage('No fue posible actualizar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const importFacultyPrograms = async (json: string) => {
    if (!json.trim()) {
      setStatusMessage('Pega un JSON con facultades y programas para importar.');
      return;
    }
    try {
      setSaving(true);
      await runReducer('import_faculty_programs', { importPayload: json });
      setStatusMessage('Estructura de facultades y programas importada correctamente.');
    } catch (error) {
      console.error(error);
      setStatusMessage('No fue posible importar la estructura. Revisa el formato JSON.');
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    try {
      setSaving(true);
      setStatusMessage('');
      await saveSettings();
      await saveRagConfig();
      await saveRoles();
      setStatusMessage('Configuracion guardada en SpacetimeDB.');
    } catch (error) {
      console.error(error);
      setStatusMessage('No fue posible guardar. Verifica sesion admin en Spacetime.');
    } finally {
      setSaving(false);
    }
  };

  const saveApiOnly = async () => {
    try {
      setSaving(true);
      setStatusMessage('');
      await saveSettings();
      setStatusMessage('Configuracion de APIs guardada en SpacetimeDB.');
    } catch (error) {
      console.error(error);
      setStatusMessage('No fue posible guardar APIs. Verifica sesion admin en Spacetime.');
    } finally {
      setSaving(false);
    }
  };

  const addRole = () => {
    const suffix = roles.length + 1;
    setRoles((prev) => [
      ...prev,
      {
        role: `nuevo_rol_${suffix}`,
        label: `Nuevo Rol ${suffix}`,
        portal: 'portal',
        description: 'Rol personalizado creado desde configuración.',
        active: true,
      },
    ]);
  };

  const deleteRole = async (roleKey: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el rol '${roleKey}'?`)) return;

    try {
      setSaving(true);
      await runReducer('delete_portal_role', { roleKey });
      setRoles((prev) => prev.filter((r) => r.role !== roleKey));
      setStatusMessage('Rol eliminado correctamente.');
    } catch (error) {
      console.error(error);
      setStatusMessage(error instanceof Error ? error.message : 'Error al eliminar el rol.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50">
      {/* ── Top bar ── */}
      <div className="border-b border-slate-200 bg-white/80 px-6 backdrop-blur-md">
        <div className="flex h-20 items-center justify-between">
          <AppLogo className="flex items-center" imgClassName="h-11 w-auto md:h-12" />

          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-400 transition-colors hover:text-blue-600">
              <Bell size={20} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
            </button>
            <div className="mx-2 h-8 w-[1px] bg-slate-200" />
            <div className="hidden text-right md:block">
              <p className="text-xs font-black leading-none text-slate-800">{session?.username ?? 'Admin'}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-tighter text-slate-400">
                {connected
                  ? portalAuthReady
                    ? 'Sesion admin activa'
                    : 'Conectado sin sesion admin'
                  : 'Sin conexion'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body (sidebar + main) ── */}
      <div className="flex min-h-[calc(100vh-220px)]">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-[calc(100vh-220px)] w-80 border-r border-slate-200 bg-white p-8 lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-8">
            <div className="px-4 py-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Menu configuracion
              </span>
            </div>
            <nav className="space-y-2">
              {MENU_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`group flex w-full items-center justify-between rounded-2xl px-5 py-4 text-sm font-bold transition-all ${
                    activeTab === item.id
                      ? 'scale-[1.01] bg-blue-600 text-white shadow-xl shadow-blue-200'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={20} />
                    {item.label}
                  </div>
                  <ChevronRight
                    size={16}
                    className={`transition-all duration-300 ${
                      activeTab === item.id ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'
                    }`}
                  />
                </button>
              ))}
            </nav>
          </div>

          {/* Status card */}
          <div className="space-y-4">
            <div className="group relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white">
              <div className="relative z-10">
                <p className="mb-1 text-xs font-bold opacity-80">Estado de configuracion</p>
                <div className="mb-3 h-1.5 w-full rounded-full bg-white/20">
                  <div className="h-full w-4/5 rounded-full bg-white" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest">
                  {connected ? 'Sincronizado' : 'Pendiente de conexion'}
                </p>
              </div>
              <div className="absolute -bottom-4 -right-4 opacity-10 transition-transform duration-700 group-hover:rotate-12">
                <LayoutDashboard size={80} />
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-6 md:p-10">
          {/* Top action row */}
          <div className="mb-8 flex items-center justify-end">
            <button
              onClick={saveAll}
              disabled={saving || loading}
              className="flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 disabled:opacity-60"
            >
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar Configuracion'}
            </button>
          </div>

          {/* Status banner */}
          {statusMessage && (
            <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
              {statusMessage}
            </div>
          )}

          {/* ── Tab content ── */}

          {activeTab === 'usuarios' && (
            <div className="space-y-8">
              <UsuariosModule
                users={users}
                roles={roles}
                faculties={faculties}
                assignments={userFacultyAssignments}
                saving={saving}
                onAddUser={addUser}
                onUpdateUser={updateUser}
              />
              <FacultadesModule saving={saving} onImport={importFacultyPrograms} />
            </div>
          )}

          {activeTab === 'roles' && (
            <RolesModule roles={roles} onChange={setRoles} onAddRole={addRole} onDeleteRole={deleteRole} />
          )}

          {activeTab === 'api' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                <h2 className="text-3xl font-black tracking-tight text-slate-800">Configuracion de API</h2>
                <p className="font-medium text-slate-500">
                  Conecta el sistema con Gemini, APIFreeLLM, SCOPUS y ORCID.
                </p>
                </div>
                <button
                  onClick={saveApiOnly}
                  disabled={saving || loading}
                  className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Save size={16} />
                  {saving ? 'Guardando...' : 'Guardar APIs'}
                </button>
              </div>
              <APIConfigSection apiConfig={apiConfig} onUpdateApiConfig={setApiConfig} />
            </div>
          )}

          {activeTab === 'email' && (
            <EmailModule config={resendConfig} onChange={setResendConfig} />
          )}

          {activeTab === 'ia' && (
            <IAModule
              aiConfig={aiConfig}
              onAiConfigChange={setAiConfig}
              actions={actions}
              onActionsChange={setActions}
            />
          )}

          {activeTab === 'rag' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-slate-800">
                  RAG y Seleccion Inteligente de Modelos
                </h2>
                <p className="font-medium text-slate-500">
                  Configura el bucket documental, la fuente IA principal/fallback y prueba alternativas
                  con recomendacion.
                </p>
              </div>
              <RagSettingsModule
                ragConfig={ragConfig}
                apiConfig={apiConfig}
                onChangeRagConfig={setRagConfig}
                onSaveRagConfig={saveRagConfig}
                onStatus={setStatusMessage}
              />
              <RagDocumentosModule
                ragDocuments={ragDocuments}
                ragConfig={ragConfig}
                onUpload={uploadRagDocument}
                onDeactivate={deactivateRagDocument}
                onStatus={setStatusMessage}
              />
              <RagNormativaModule
                ragNormatives={ragNormatives}
                onUpload={async (title, json, documentId, file) => {
                  await uploadRagNormative(title, json, file);
                }}
                onDeactivate={deactivateRagNormative}
                onStatus={setStatusMessage}
              />
            </div>
          )}

          {activeTab === 'plantillas' && (
            <PlantillasModule templates={templates} onChange={setTemplates} />
          )}

          {loading && (
            <p className="mt-8 text-sm font-semibold text-slate-500">
              Cargando datos desde Spacetime...
            </p>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminPortal;
