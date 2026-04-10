import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  FileText,
  Key,
  LayoutDashboard,
  Mail,
  Plus,
  Save,
  Search,
  ServerCog,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { DbConnection } from '../module_bindings';
import type { PortalRole, SystemSetting, UserProfile } from '../module_bindings/types';
import { getSpacetimeConnectionConfig } from '../services/spacetime';
import { getPortalCredentialsForRole, getPortalSession } from '../services/portalAuth';
import { APIConfigSection } from '../components/APIConfigSection';
import { RAGConfigSection } from '../components/RAGConfigSection';
import type {
  RoleKey,
  TabId,
  RoleConfig,
  ApiConfig,
  ResendConfig,
  AIConfig,
  WorkflowActions,
  MailTemplate,
  NewUserForm,
  RagConfig,
  RagDocument,
} from '../types/config';

const SETTING_KEYS = {
  ai: 'cfg.ai',
  actions: 'cfg.actions',
  ragConfig: 'cfg.rag.config',
  ragDocuments: 'cfg.rag.documents',
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
    role: 'auxiliar',
    label: 'Auxiliar',
    portal: 'auxiliares',
    description: 'Auditoria documental y validacion operativa.',
    active: true,
  },
  {
    role: 'director',
    label: 'Director',
    portal: 'directores',
    description: 'Supervision y analisis de resultados.',
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

const PLACEHOLDER_SAMPLE: Record<string, string> = {
  tracking_id: 'UDES-7X41ABCD',
  nombre: 'Juan Perez',
  correo: 'juan.perez@udes.edu.co',
  campus: 'VALLEDUPAR',
  rol: 'AUXILIAR',
  estado: 'EN_AUDITORIA',
  fecha_registro: '2026-04-10',
  fecha_revision: '2026-04-12',
  observaciones: 'Adjuntar soporte actualizado del titulo de maestria.',
  categoria_final: 'ASISTENTE',
  puntaje_final: '72.50',
  workflow: 'WORKFLOW_RECEIVED',
};

const TOKENS_BY_WORKFLOW: Record<string, string[]> = {
  WORKFLOW_RECEIVED: ['tracking_id', 'nombre', 'correo', 'campus', 'fecha_registro', 'workflow'],
  WORKFLOW_AUDIT_REQUEST: ['tracking_id', 'nombre', 'estado', 'observaciones', 'fecha_revision', 'workflow'],
  WORKFLOW_APPROVED: ['tracking_id', 'nombre', 'categoria_final', 'puntaje_final', 'workflow'],
};

const NEW_USER_EMPTY: NewUserForm = {
  nombre: '',
  correo: '',
  campus: 'VALLEDUPAR',
  password: '',
  role: 'auxiliar',
};

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
      (_key, nestedValue) => (typeof nestedValue === 'bigint' ? nestedValue.toString() : nestedValue),
      space,
    );
  } catch {
    return '[unserializable]';
  }
};

const isReducerMissingError = (error: unknown, reducerName: string): boolean => {
  if (!(error instanceof Error)) return false;
  return error.message.includes(`Reducer no disponible: ${reducerName}`);
};

const renderTemplate = (html: string, subject?: string) => {
  const replaceToken = (input: string) =>
    input.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, token: string) => PLACEHOLDER_SAMPLE[token] || `{{${token}}}`);

  const renderedBody = replaceToken(html);
  const renderedSubject = replaceToken(subject || 'Sin asunto');

  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;padding:16px;background:#f8fafc;color:#0f172a;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:16px;">
        <p style="margin:0 0 12px;font-size:12px;color:#475569;"><strong>Asunto:</strong> ${renderedSubject}</p>
        <div>${renderedBody}</div>
      </div>
    </div>
  `;
};

const ConfigPage = () => {
  const connectionRef = useRef<DbConnection | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>('usuarios');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const [portalAuthReady, setPortalAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [roles, setRoles] = useState<RoleConfig[]>(DEFAULT_ROLES);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [newUser, setNewUser] = useState<NewUserForm>(NEW_USER_EMPTY);
  const [apiConfig, setApiConfig] = useState<ApiConfig>(DEFAULT_API_CONFIG);
  const [resendConfig, setResendConfig] = useState<ResendConfig>(DEFAULT_RESEND_CONFIG);
  const [templates, setTemplates] = useState<MailTemplate[]>(DEFAULT_TEMPLATES);
  const [aiConfig, setAiConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG);
  const [actions, setActions] = useState<WorkflowActions>(DEFAULT_ACTIONS);
  const [ragConfig, setRagConfig] = useState<RagConfig>(DEFAULT_RAG_CONFIG);
  const [ragDocuments, setRagDocuments] = useState<RagDocument[]>([]);

  const menuItems = [
    { id: 'usuarios' as const, icon: Users, label: 'Usuarios' },
    { id: 'roles' as const, icon: ShieldCheck, label: 'Gestion de Roles' },
    { id: 'api' as const, icon: Key, label: 'Configuracion de API' },
    { id: 'email' as const, icon: Mail, label: 'Configuracion Email' },
    { id: 'plantillas' as const, icon: FileText, label: 'Plantillas HTML' },
    { id: 'ia' as const, icon: Sparkles, label: 'Motor de IA y Acciones' },
    { id: 'rag' as const, icon: ServerCog, label: 'RAG y Modelos IA' },
  ];

  const ensurePortalSession = async (conn?: DbConnection | null) => {
    const connection = conn || connectionRef.current;
    if (!connection) throw new Error('Sin conexion Spacetime.');

    const uiSession = getPortalSession();
    if (!uiSession) throw new Error('No hay sesión del portal en la aplicación.');
    if (uiSession.role !== 'admin') throw new Error('Solo admin puede modificar configuración.');

    const credentials = getPortalCredentialsForRole(uiSession.role);
    if (!credentials) throw new Error('No se encontraron credenciales para abrir sesión en Spacetime.');

    const reducers = connection.reducers as any;
    const loginReducer = reducers.portalLogin || reducers.portal_login;
    if (typeof loginReducer !== 'function') throw new Error('Reducer portal_login no disponible.');

    await loginReducer({
      role: uiSession.role,
      username: credentials.username,
      password: credentials.password,
    });

    setPortalAuthReady(true);
  };

  useEffect(() => {
    const { host, databaseName } = getSpacetimeConnectionConfig();

    const connection = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(databaseName)
      .onConnect((conn: DbConnection) => {
        setConnected(true);

        ensurePortalSession(conn).catch((error: unknown) => {
          console.error(error);
          setPortalAuthReady(false);
          setStatusMessage('No fue posible abrir sesión admin en Spacetime para ejecutar cambios protegidos.');
        });
      })
      .onConnectError((_ctx: unknown, error: unknown) => {
        console.error(error);
        setStatusMessage('No fue posible conectar con SpacetimeDB.');
      })
      .build();

    connectionRef.current = connection;

    const refreshFromCache = () => {
      const dbView = connection.db as any;
      const settingsTable = dbView.system_setting || dbView.systemSetting;
      const roleTable = dbView.portal_role || dbView.portalRole;
      const userTable = dbView.user_profile || dbView.userProfile;
      const apiTable = dbView.api_config || dbView.apiConfig;
      const resendTable = dbView.resend_config || dbView.resendConfig;
      const emailTemplateTable = dbView.email_template || dbView.emailTemplate;
      const ragConfigTable = dbView.rag_config || dbView.ragConfig;
      const ragDocumentTable = dbView.rag_document || dbView.ragDocument;

      const settingRows = settingsTable ? (Array.from(settingsTable.iter()) as SystemSetting[]) : [];
      const roleRows = roleTable ? (Array.from(roleTable.iter()) as PortalRole[]) : [];
      const userRows = userTable ? (Array.from(userTable.iter()) as UserProfile[]) : [];
      const apiRows = apiTable ? (Array.from(apiTable.iter()) as Array<any>) : [];
      const resendRows = resendTable ? (Array.from(resendTable.iter()) as Array<any>) : [];
      const templateRows = emailTemplateTable ? (Array.from(emailTemplateTable.iter()) as Array<any>) : [];
      const ragConfigRows = ragConfigTable ? (Array.from(ragConfigTable.iter()) as Array<any>) : [];
      const ragDocumentRows = ragDocumentTable ? (Array.from(ragDocumentTable.iter()) as Array<any>) : [];

      if (roleRows.length > 0) {
        console.log('[loadRoles] Datos crudos de roleRows:', safeJSONStringify(roleRows, 2));
        console.log('[loadRoles] Propiedades del primer rol:', Object.keys(roleRows[0]));

        const mappedRoles = roleRows
          .map((item: any) => {
            console.log('[loadRoles] Mapeando rol:', item);

            // Try all possible property name variations for role_key
            const roleKey = item.role_key || item.roleKey || item['role-key'] || item.roleId;

            if (!roleKey) {
              console.error('[loadRoles] Rol sin role_key válida. Propiedades disponibles:', Object.keys(item));
              console.error('[loadRoles] Contenido completo:', safeJSONStringify(item));
              return null;
            }

            const roleName = item.role_name || item.roleName || 'Sin nombre';
            const portalModule = item.portal_module || item.portalModule || 'portal';

            const mappedRole = {
              role: String(roleKey).trim() as RoleKey,
              label: String(roleName).trim(),
              portal: String(portalModule).trim(),
              description: item.description ? String(item.description).trim() : '',
              active: Boolean(item.active),
            };

            console.log('[loadRoles] Rol mapeado:', mappedRole);
            return mappedRole;
          })
          .filter((r) => r !== null);

        console.log('[loadRoles] Roles mapeados totales:', mappedRoles.length);

        if (mappedRoles.length > 0) {
          console.log('[loadRoles] Estableciendo roles desde BD:', mappedRoles);
          setRoles(mappedRoles);
        } else {
          console.warn('[loadRoles] No valid roles found in database after mapping. Using defaults.');
          setRoles(DEFAULT_ROLES);
        }
      } else {
        console.log('[loadRoles] No roles found in database. Using default roles.');
        setRoles(DEFAULT_ROLES);
      }

      setUsers(userRows);

      const settingMap = new Map(settingRows.map((row) => [row.key, row.value]));

      const defaultApi = apiRows.find((row) => row.configKey === 'default');
      if (defaultApi) {
        setApiConfig({
          geminiApiKey: defaultApi.geminiApiKey,
          apifreellmApiKey: defaultApi.apifreellmApiKey,
          scopusApiKey: defaultApi.scopusApiKey,
          orcidClientId: defaultApi.orcidClientId,
          orcidClientSecret: defaultApi.orcidClientSecret,
        });

        if (defaultApi.scopusApiKey) {
          window.localStorage.setItem('meritx.scopusApiKey', String(defaultApi.scopusApiKey));
          window.localStorage.setItem('scopusApiKey', String(defaultApi.scopusApiKey));
        }
      }

      const defaultResend = resendRows.find((row) => row.configKey === 'default');
      if (defaultResend) {
        setResendConfig({
          apiKey: defaultResend.apiKey,
          fromEmail: defaultResend.fromEmail,
          fromName: defaultResend.fromName,
          enabled: defaultResend.enabled,
        });
      }

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

      const defaultRagConfig = ragConfigRows.find((row) => row.configKey === 'default' || row.config_key === 'default');
      const fallbackRagConfig = safeJSONParse<RagConfig>(settingMap.get(SETTING_KEYS.ragConfig), DEFAULT_RAG_CONFIG);
      if (defaultRagConfig) {
        setRagConfig({
          enabled: Boolean(defaultRagConfig.enabled),
          bucketName: String(defaultRagConfig.bucketName ?? defaultRagConfig.bucket_name ?? DEFAULT_RAG_CONFIG.bucketName),
          retrievalTopK: Number(defaultRagConfig.retrievalTopK ?? defaultRagConfig.retrieval_top_k ?? DEFAULT_RAG_CONFIG.retrievalTopK),
          chunkSize: Number(defaultRagConfig.chunkSize ?? defaultRagConfig.chunk_size ?? DEFAULT_RAG_CONFIG.chunkSize),
          chunkOverlap: Number(defaultRagConfig.chunkOverlap ?? defaultRagConfig.chunk_overlap ?? DEFAULT_RAG_CONFIG.chunkOverlap),
          selectedProvider: String(
            defaultRagConfig.selectedProvider ?? defaultRagConfig.selected_provider ?? DEFAULT_RAG_CONFIG.selectedProvider,
          ) as RagConfig['selectedProvider'],
          selectedModel: String(defaultRagConfig.selectedModel ?? defaultRagConfig.selected_model ?? DEFAULT_RAG_CONFIG.selectedModel),
          fallbackProvider: String(
            defaultRagConfig.fallbackProvider ?? defaultRagConfig.fallback_provider ?? DEFAULT_RAG_CONFIG.fallbackProvider,
          ) as RagConfig['fallbackProvider'],
          fallbackModel: String(defaultRagConfig.fallbackModel ?? defaultRagConfig.fallback_model ?? DEFAULT_RAG_CONFIG.fallbackModel),
          systemContext: String(defaultRagConfig.systemContext ?? defaultRagConfig.system_context ?? DEFAULT_RAG_CONFIG.systemContext),
        });
      } else {
        setRagConfig(fallbackRagConfig);
      }

      const mappedRagDocuments = ragDocumentRows
        .map((row) => ({
          documentKey: String(row.documentKey ?? row.document_key ?? ''),
          fileName: String(row.fileName ?? row.file_name ?? ''),
          fileType: String(row.fileType ?? row.file_type ?? 'application/octet-stream'),
          fileSizeBytes: Number(row.fileSizeBytes ?? row.file_size_bytes ?? 0),
          bucketName: String(row.bucketName ?? row.bucket_name ?? defaultRagConfig?.bucket_name ?? DEFAULT_RAG_CONFIG.bucketName),
          storagePath: String(row.storagePath ?? row.storage_path ?? ''),
          active: Boolean(row.active),
          uploadedBy: row.uploadedBy ?? row.uploaded_by,
          uploadedAt: row.uploadedAt ?? row.uploaded_at,
        }))
        .filter((row) => row.documentKey);

      if (mappedRagDocuments.length > 0) {
        setRagDocuments(mappedRagDocuments);
      } else {
        setRagDocuments(safeJSONParse<RagDocument[]>(settingMap.get(SETTING_KEYS.ragDocuments), []));
      }

      setAiConfig(safeJSONParse(settingMap.get(SETTING_KEYS.ai), DEFAULT_AI_CONFIG));
      setActions(safeJSONParse(settingMap.get(SETTING_KEYS.actions), DEFAULT_ACTIONS));
    };

    const subscription = connection
      .subscriptionBuilder()
      .onApplied(() => {
        try {
          refreshFromCache();
        } catch (error) {
          console.error(error);
          setStatusMessage('Error al procesar datos de configuración (serialización).');
        }
        setLoading(false);
      })
      .onError((ctx: unknown) => {
        console.error(ctx);
        setLoading(false);
        setStatusMessage('Error de suscripcion en Spacetime.');
      })
      .subscribe([
        'SELECT * FROM portal_role',
        'SELECT * FROM user_profile',
        'SELECT * FROM api_config',
        'SELECT * FROM resend_config',
        'SELECT * FROM email_template',
        'SELECT * FROM system_setting',
        'SELECT * FROM rag_config',
        'SELECT * FROM rag_document',
      ]);

    return () => {
      subscription.unsubscribe();
      connection.disconnect();
      connectionRef.current = null;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return users;
    return users.filter((item) => {
      return (
        item.nombre.toLowerCase().includes(q) ||
        item.correo.toLowerCase().includes(q) ||
        item.campus.toLowerCase().includes(q) ||
        item.role.toLowerCase().includes(q)
      );
    });
  }, [searchTerm, users]);

  const runReducer = async (reducerName: string, args: object) => {
    const connection = connectionRef.current;
    if (!connection) throw new Error('Sin conexion Spacetime.');

    await ensurePortalSession(connection);

    const reducerView = connection.reducers as any;
    const toCamel = (value: string) => value.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    const toSnake = (value: string) =>
      value
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
    const normalize = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

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
      const availableKeys = Object.keys(reducerView).filter((key) => typeof reducerView[key] === 'function');
      const wanted = new Set(candidates.map(normalize));
      const matchedKey = availableKeys.find((key) => wanted.has(normalize(key)));
      if (matchedKey && typeof reducerView[matchedKey] === 'function') {
        fn = reducerView[matchedKey] as (payload: object) => Promise<void>;
      }
    }

    if (!fn) {
      const availableKeys = Object.keys(reducerView).filter((key) => typeof reducerView[key] === 'function');
      const isRagReducer =
        reducerName === 'upsert_rag_config' ||
        reducerName === 'upsert_rag_document' ||
        reducerName === 'deactivate_rag_document';

      if (isRagReducer) {
        throw new Error(
          `Reducer no disponible: ${reducerName}. El cliente o la BD activa no tienen el schema RAG publicado. Reducers visibles: ${availableKeys.join(', ') || '(ninguno)'}. Ejecuta: npm run spacetime:generate; spacetime publish --server maincloud --module-path spacetimedb -y categoria-k4x5z; reinicia el servidor Vite.`,
        );
      }

      throw new Error(`Reducer no disponible: ${reducerName}`);
    }

    await fn(args);
  };

  const saveRoles = async () => {
    console.log('[saveRoles] === INICIANDO GUARDADO DE ROLES ===');
    console.log('[saveRoles] Estado actual de roles:', safeJSONStringify(roles, 2));

    let rolesToSave = roles && Array.isArray(roles) ? [...roles] : [...DEFAULT_ROLES];

    console.log('[saveRoles] Roles a procesar:', rolesToSave.length);

    for (let i = 0; i < rolesToSave.length; i++) {
      const role = rolesToSave[i];

      console.log(`[saveRoles] Validando rol ${i}:`, safeJSONStringify(role));

      if (!role) {
        console.error(`[saveRoles] Rol ${i} es null/undefined`);
        throw new Error(`Rol #${i} es null o undefined`);
      }

      const roleKey = role && role.role ? String(role.role).trim() : null;

      console.log(`[saveRoles] Rol ${i} - role.role value:`, role.role, `- trimmed: "${roleKey}"`);

      if (!roleKey || roleKey === '' || roleKey === 'null' || roleKey === 'undefined') {
        console.error(`[saveRoles] Rol ${i} - role_key INVÁLIDA:`, {
          'role.role': role.role,
          tipo: typeof role.role,
          trimmed: roleKey,
          'objeto completo': role,
        });
        throw new Error(
          `Rol #${i} tiene role_key inválida. Recibido: ${safeJSONStringify({
            'role.role': role.role,
            tipo: typeof role.role,
            objeto: role,
          })}`,
        );
      }

      const roleName = role.label ? String(role.label).trim() : `Rol ${roleKey}`;
      const portalModule = role.portal ? String(role.portal).trim() : 'portal';
      const description = role.description ? String(role.description).trim() : '';

      const payload = {
        roleKey: roleKey,
        roleName: roleName,
        portalModule: portalModule,
        description,
        active: Boolean(role.active),
      };

      console.log(`[saveRoles] Rol ${i} payload a enviar:`, safeJSONStringify(payload));

      try {
        await runReducer('upsert_portal_role', payload);
        console.log(`[saveRoles] ✓ Rol ${i} (${roleKey}) guardado exitosamente`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[saveRoles] ✗ Error guardando rol ${i} (${roleKey}):`, errMsg);
        throw err;
      }
    }

    console.log('[saveRoles] === ✓ TODOS LOS ROLES GUARDADOS EXITOSAMENTE ===');
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

    const settingsPayload: Array<{ key: string; value: string }> = [
      { key: SETTING_KEYS.ai, value: JSON.stringify(aiConfig) },
      { key: SETTING_KEYS.actions, value: JSON.stringify(actions) },
    ];

    for (const item of settingsPayload) {
      await runReducer('upsert_system_setting', {
        key: item.key,
        scope: 'CONFIG',
        campus: undefined,
        value: item.value,
      });
    }
  };

  const saveRagConfig = async () => {
    const normalizedRagConfig: RagConfig = {
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
        enabled: normalizedRagConfig.enabled,
        bucketName: normalizedRagConfig.bucketName,
        retrievalTopK: normalizedRagConfig.retrievalTopK,
        chunkSize: normalizedRagConfig.chunkSize,
        chunkOverlap: normalizedRagConfig.chunkOverlap,
        selectedProvider: normalizedRagConfig.selectedProvider,
        selectedModel: normalizedRagConfig.selectedModel,
        fallbackProvider: normalizedRagConfig.fallbackProvider,
        fallbackModel: normalizedRagConfig.fallbackModel,
        systemContext: normalizedRagConfig.systemContext,
      });
    } catch (error) {
      if (!isReducerMissingError(error, 'upsert_rag_config')) throw error;

      await runReducer('upsert_system_setting', {
        key: SETTING_KEYS.ragConfig,
        scope: 'CONFIG',
        campus: undefined,
        value: safeJSONStringify(normalizedRagConfig),
      });
    }
  };

  const uploadRagDocument = async (file: File) => {
    const contentBase64: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No fue posible leer el archivo para RAG.'));
      reader.onload = () => {
        const raw = String(reader.result || '');
        const payload = raw.includes(',') ? raw.split(',')[1] : raw;
        resolve(payload);
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

      const docs = [nextDoc, ...ragDocuments.filter((item) => item.documentKey !== nextDoc.documentKey)];
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
      await runReducer('deactivate_rag_document', {
        documentKey,
      });
    } catch (error) {
      if (!isReducerMissingError(error, 'deactivate_rag_document')) throw error;

      const docs = ragDocuments.map((item) => (item.documentKey === documentKey ? { ...item, active: false } : item));
      setRagDocuments(docs);
      await runReducer('upsert_system_setting', {
        key: SETTING_KEYS.ragDocuments,
        scope: 'CONFIG',
        campus: undefined,
        value: safeJSONStringify(docs),
      });
    }
  };

  const addUser = async () => {
    if (!newUser.nombre.trim() || !newUser.correo.trim() || !newUser.password.trim()) {
      setStatusMessage('Completa nombre, correo y contraseña para crear el usuario.');
      return;
    }

    try {
      setSaving(true);
      await runReducer('register_user_profile', {
        nombre: newUser.nombre.trim(),
        correo: newUser.correo.trim().toLowerCase(),
        campus: newUser.campus.trim().toUpperCase(),
        password: newUser.password,
        role: newUser.role,
      });
      setNewUser(NEW_USER_EMPTY);
      setStatusMessage('Usuario creado correctamente en SpacetimeDB.');
    } catch (error) {
      console.error(error);
      setStatusMessage('No fue posible crear el usuario. Verifica sesión admin en Spacetime.');
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    try {
      setSaving(true);
      setStatusMessage('');
      await saveRoles();
      await saveSettings();
      await saveRagConfig();
      setStatusMessage('Configuracion guardada en SpacetimeDB.');
    } catch (error) {
      console.error(error);
      setStatusMessage('No fue posible guardar. Verifica sesión admin en Spacetime.');
    } finally {
      setSaving(false);
    }
  };

  const session = getPortalSession();

  const SectionHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div className="mb-8">
      <h2 className="text-3xl font-black tracking-tight text-slate-800">{title}</h2>
      <p className="font-medium text-slate-500">{subtitle}</p>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 bg-white/80 px-6 backdrop-blur-md">
        <div className="flex h-20 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 p-2 shadow-lg shadow-blue-200">
              <ShieldCheck className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase leading-none tracking-tight text-blue-900">
                Panel <span className="text-blue-600">Admin</span>
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                SpacetimeDB · Configuracion avanzada
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-400 transition-colors hover:text-blue-600">
              <Bell size={20} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
            </button>
            <div className="mx-2 h-8 w-[1px] bg-slate-200" />
            <div className="hidden text-right md:block">
              <p className="text-xs font-black leading-none text-slate-800">{session?.username || 'Admin'}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-tighter text-slate-400">
                {connected ? (portalAuthReady ? 'Sesion admin activa' : 'Conectado sin sesion admin') : 'Sin conexion'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-220px)]">
        <aside className="sticky top-0 hidden h-[calc(100vh-220px)] w-80 border-r border-slate-200 bg-white p-8 lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-8">
            <div className="px-4 py-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Menu configuracion</span>
            </div>

            <nav className="space-y-2">
              {menuItems.map((item) => (
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
                    className={`transition-all duration-300 ${activeTab === item.id ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'}`}
                  />
                </button>
              ))}
            </nav>
          </div>

          <div className="space-y-4">
            <div className="group relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white">
              <div className="relative z-10">
                <p className="mb-1 text-xs font-bold opacity-80">Estado de configuración</p>
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

        <main className="flex-1 p-6 md:p-10">
          <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar usuarios o configuración..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-6 text-sm font-medium shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              onClick={saveAll}
              disabled={saving || loading}
              className="flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 disabled:opacity-60"
            >
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar Configuracion'}
            </button>
          </div>

          {statusMessage && (
            <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
              {statusMessage}
            </div>
          )}

          {activeTab === 'usuarios' && (
            <div className="space-y-6">
              <SectionHeader title="Usuarios del Sistema" subtitle="Administra los accesos y permisos de los colaboradores." />

              <div className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/50">
                <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-slate-700">
                  <div className="h-6 w-2 rounded-full bg-blue-600" /> Crear Nuevo Usuario
                </h3>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Nombre Completo</label>
                    <input
                      value={newUser.nombre}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, nombre: e.target.value }))}
                      placeholder="Ej. Juan Perez"
                      className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Correo Electronico</label>
                    <input
                      value={newUser.correo}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, correo: e.target.value }))}
                      placeholder="usuario@udes.edu.co"
                      className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Campus</label>
                    <select
                      value={newUser.campus}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, campus: e.target.value }))}
                      className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
                    >
                      <option>VALLEDUPAR</option>
                      <option>BUCARAMANGA</option>
                      <option>CUCUTA</option>
                      <option>BOGOTA</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Rol</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value as RoleKey }))}
                      className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
                    >
                      {roles
                        .filter((role) => role.active)
                        .map((role) => (
                          <option key={role.role} value={role.role}>
                            {role.label}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Contraseña</label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="********"
                      className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  <button
                    onClick={addUser}
                    disabled={saving}
                    className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 font-bold text-white shadow-lg transition-all hover:bg-blue-700 md:col-span-2"
                  >
                    <Plus size={20} /> Agregar Usuario al Sistema
                  </button>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/40">
                <h3 className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-slate-500">Usuarios Registrados</h3>
                <div className="space-y-3">
                  {filteredUsers.length === 0 && <p className="text-sm font-semibold text-slate-400">No hay usuarios para mostrar.</p>}
                  {filteredUsers.map((user) => (
                    <div key={`${user.correo}-${user.id}`} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{user.nombre}</p>
                        <p className="text-xs font-medium text-slate-500">
                          {user.correo} · {user.campus}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-600">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        {user.role}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-6">
              <SectionHeader title="Gestion de Roles" subtitle="Define niveles de acceso y permisos de cada perfil." />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {roles.map((role, index) => (
                  <div key={role.role} className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-md transition-all hover:shadow-xl">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-all group-hover:bg-blue-600 group-hover:text-white">
                          <ShieldCheck size={24} />
                        </div>
                        <div className="space-y-2">
                          <input
                            value={role.label}
                            onChange={(e) => setRoles((prev) => prev.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)))}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                          />
                          <input
                            value={role.portal}
                            onChange={(e) => setRoles((prev) => prev.map((r, i) => (i === index ? { ...r, portal: e.target.value } : r)))}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 outline-none focus:border-blue-500"
                          />
                          <textarea
                            value={role.description}
                            onChange={(e) =>
                              setRoles((prev) => prev.map((r, i) => (i === index ? { ...r, description: e.target.value } : r)))
                            }
                            rows={2}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-600">
                        <input
                          type="checkbox"
                          checked={role.active}
                          onChange={(e) => setRoles((prev) => prev.map((r, i) => (i === index ? { ...r, active: e.target.checked } : r)))}
                        />
                        Activo
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-6">
              <SectionHeader title="Configuracion de API" subtitle="Conecta el sistema con Gemini, APIFreeLLM, SCOPUS y ORCID." />
              <APIConfigSection apiConfig={apiConfig} onUpdateApiConfig={setApiConfig} />
            </div>
          )}

          {activeTab === 'email' && (
            <div className="space-y-6">
              <SectionHeader
                title="Configuracion de Email"
                subtitle="Parametros de envio para notificaciones automaticas con Resend."
              />
              <div className="space-y-6 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl">
                <div className="space-y-2">
                  <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Resend API Key</label>
                  <input
                    type="password"
                    value={resendConfig.apiKey}
                    onChange={(e) => setResendConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="re_sk_..."
                    className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-6 py-4 outline-none transition-all focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">From Email (Remitente)</label>
                  <input
                    value={resendConfig.fromEmail}
                    onChange={(e) => setResendConfig((prev) => ({ ...prev, fromEmail: e.target.value }))}
                    placeholder="escalafon@udes.edu.co"
                    className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-6 py-4 font-bold outline-none transition-all focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">From Name</label>
                  <input
                    value={resendConfig.fromName}
                    onChange={(e) => setResendConfig((prev) => ({ ...prev, fromName: e.target.value }))}
                    placeholder="Escalafon UDES"
                    className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-6 py-4 font-bold outline-none transition-all focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <input
                    type="checkbox"
                    className="h-5 w-5 cursor-pointer accent-blue-600"
                    checked={resendConfig.enabled}
                    onChange={(e) => setResendConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
                  />
                  <span className="text-sm font-bold text-blue-900">Habilitar envio de correos con Resend</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'ia' && (
            <div className="space-y-6">
              <SectionHeader
                title="Motor de IA y Acciones"
                subtitle="Selecciona el modelo de IA y define automatizaciones de workflow."
              />

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="space-y-4 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-700">
                    <ServerCog size={18} /> Configuracion del modelo
                  </h3>
                  <div className="space-y-2">
                    <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Proveedor IA</label>
                    <select
                      value={aiConfig.provider}
                      onChange={(e) => setAiConfig((prev) => ({ ...prev, provider: e.target.value as AIConfig['provider'] }))}
                      className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
                    >
                      <option value="gemini">Gemini</option>
                      <option value="apifreellm">APIFreeLLM</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Modelo</label>
                    <input
                      value={aiConfig.model}
                      onChange={(e) => setAiConfig((prev) => ({ ...prev, model: e.target.value }))}
                      placeholder="gemini-2.5-flash"
                      className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Temperature</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={aiConfig.temperature}
                        onChange={(e) => setAiConfig((prev) => ({ ...prev, temperature: Number(e.target.value) || 0 }))}
                        className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Max Tokens</label>
                      <input
                        type="number"
                        min="128"
                        max="8192"
                        value={aiConfig.maxTokens}
                        onChange={(e) => setAiConfig((prev) => ({ ...prev, maxTokens: Number(e.target.value) || 0 }))}
                        className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-700">
                    <Settings size={18} /> Acciones automaticas
                  </h3>

                  {[
                    { key: 'autoScoreOnSubmit', label: 'Calcular puntaje automaticamente al registrar' },
                    { key: 'autoNotifyOnReceived', label: 'Notificar recepcion de postulacion' },
                    { key: 'autoNotifyOnAuditRequest', label: 'Notificar solicitud de subsanacion' },
                    { key: 'autoNotifyOnApproval', label: 'Notificar aprobacion final' },
                    { key: 'autoSyncScopus', label: 'Sincronizar SCOPUS automaticamente' },
                  ].map((action) => (
                    <label key={action.key} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                        checked={actions[action.key as keyof WorkflowActions]}
                        onChange={(e) =>
                          setActions((prev) => ({
                            ...prev,
                            [action.key]: e.target.checked,
                          }))
                        }
                      />
                      <span className="text-sm font-semibold text-slate-700">{action.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rag' && (
            <div className="space-y-6">
              <SectionHeader
                title="RAG y Seleccion Inteligente de Modelos"
                subtitle="Configura el bucket documental, la fuente IA principal/fallback y prueba alternativas con recomendacion." 
              />
              <RAGConfigSection
                ragConfig={ragConfig}
                ragDocuments={ragDocuments}
                apiConfig={apiConfig}
                onChangeRagConfig={setRagConfig}
                onSaveRagConfig={async () => {
                  try {
                    setStatusMessage('');
                    await saveRagConfig();
                    setStatusMessage('Configuracion RAG guardada correctamente.');
                  } catch (error) {
                    console.error(error);
                    setStatusMessage('No fue posible guardar la configuracion RAG.');
                  }
                }}
                onUploadDocument={async (file) => {
                  try {
                    setStatusMessage('');
                    await uploadRagDocument(file);
                    setStatusMessage(`Documento ${file.name} cargado al bucket RAG.`);
                  } catch (error) {
                    console.error(error);
                    setStatusMessage('No fue posible cargar el documento RAG.');
                  }
                }}
                onDeactivateDocument={async (documentKey) => {
                  try {
                    setStatusMessage('');
                    await deactivateRagDocument(documentKey);
                    setStatusMessage('Documento RAG desactivado correctamente.');
                  } catch (error) {
                    console.error(error);
                    setStatusMessage('No fue posible desactivar el documento RAG.');
                  }
                }}
              />
            </div>
          )}

          {activeTab === 'plantillas' && (
            <div className="space-y-6 pb-10">
              <SectionHeader
                title="Plantillas de Correo HTML"
                subtitle="Edita HTML por workflow y previsualiza el resultado con placeholders."
              />
              <div className="space-y-5">
                {templates.map((tpl, index) => {
                  const workflowTokens = TOKENS_BY_WORKFLOW[tpl.key] || Object.keys(PLACEHOLDER_SAMPLE);

                  return (
                    <div key={tpl.key} className="space-y-4 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-lg">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-2">
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-tight text-blue-700">
                          {tpl.key}
                        </span>
                        <label className="flex items-center gap-2 text-xs font-bold text-green-600">
                          <input
                            type="checkbox"
                            checked={tpl.enabled}
                            onChange={(e) =>
                              setTemplates((prev) =>
                                prev.map((item, itemIndex) => (itemIndex === index ? { ...item, enabled: e.target.checked } : item)),
                              )
                            }
                          />
                          <CheckCircle2 size={14} /> Activo
                        </label>
                      </div>

                      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Placeholders disponibles</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {workflowTokens.map((token) => (
                            <span key={token} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800">
                              {`{{${token}}}`}
                            </span>
                          ))}
                        </div>
                      </div>

                      <input
                        type="text"
                        value={tpl.subject}
                        onChange={(e) =>
                          setTemplates((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, subject: e.target.value } : item)))
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none transition-all focus:border-blue-500"
                        placeholder="Asunto del correo"
                      />

                      <textarea
                        rows={8}
                        value={tpl.html}
                        onChange={(e) =>
                          setTemplates((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, html: e.target.value } : item)))
                        }
                        className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm outline-none transition-all focus:border-blue-500"
                      />

                      <div>
                        <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">Previsualizacion HTML</p>
                        <iframe
                          title={`preview-${tpl.key}`}
                          className="h-64 w-full rounded-2xl border border-slate-200 bg-white"
                          sandbox=""
                          srcDoc={renderTemplate(tpl.html, tpl.subject)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loading && <p className="mt-8 text-sm font-semibold text-slate-500">Cargando datos desde Spacetime...</p>}
        </main>
      </div>
    </div>
  );
};

export default ConfigPage;
