import { SenderError, schema, table, t } from 'spacetimedb/server';

const portal_user = table(
  { name: 'portal_user' },
  {
    id: t.u32().primaryKey().autoInc(),
    username: t.string().unique(),
    password: t.string(),
    role: t.string().index('btree'),
    display_name: t.string(),
    active: t.bool(),
    created_at: t.timestamp(),
  },
);

const user_profile = table(
  { name: 'user_profile', public: true },
  {
    id: t.u32().primaryKey().autoInc(),
    nombre: t.string().index('btree'),
    correo: t.string().unique(),
    campus: t.string().index('btree'),
    password: t.string(),
    role: t.string().index('btree'),
    active: t.bool(),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  },
);

const portal_role = table(
  { name: 'portal_role', public: true },
  {
    role_key: t.string().primaryKey(),
    role_name: t.string(),
    portal_module: t.string().index('btree'),
    description: t.string(),
    active: t.bool(),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  },
);

const portal_session = table(
  { name: 'portal_session', public: true },
  {
    identity: t.identity().primaryKey(),
    username: t.string().index('btree'),
    role: t.string().index('btree'),
    display_name: t.string(),
    active: t.bool(),
    logged_in_at: t.timestamp(),
    last_seen_at: t.timestamp(),
  },
);

const application = table(
  { name: 'application', public: true },
  {
    tracking_id: t.string().primaryKey(),
    professor_name: t.string().index('btree'),
    document_number: t.string().index('btree'),
    campus: t.string().index('btree'),
    program_name: t.string(),
    faculty_name: t.string(),
    scopus_profile: t.string().optional(),
    status: t.string().index('btree'),
    output_message: t.string(),
    final_points: t.f64(),
    final_category: t.string(),
    source_portal: t.string(),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  },
);

const application_title = table(
  { name: 'application_title', public: true },
  {
    id: t.u32().primaryKey().autoInc(),
    tracking_id: t.string().index('btree'),
    title_name: t.string(),
    title_level: t.string().index('btree'),
    support_name: t.string().optional(),
    support_url: t.string().optional(),
    support_path: t.string().optional(),
  },
);

const application_language = table(
  { name: 'application_language', public: true },
  {
    id: t.u32().primaryKey().autoInc(),
    tracking_id: t.string().index('btree'),
    language_name: t.string().index('btree'),
    language_level: t.string().index('btree'),
    convalidation: t.bool(),
  },
);

const application_publication = table(
  { name: 'application_publication', public: true },
  {
    id: t.u32().primaryKey().autoInc(),
    tracking_id: t.string().index('btree'),
    publication_title: t.string(),
    quartile: t.string().index('btree'),
    publication_year: t.string().index('btree'),
    publication_type: t.string(),
    authors_count: t.u32(),
    source_kind: t.string().index('btree'),
  },
);

const application_experience = table(
  { name: 'application_experience', public: true },
  {
    id: t.u32().primaryKey().autoInc(),
    tracking_id: t.string().index('btree'),
    experience_type: t.string().index('btree'),
    started_at: t.string(),
    ended_at: t.string(),
    certified: t.bool(),
    support_name: t.string().optional(),
    support_url: t.string().optional(),
    support_path: t.string().optional(),
  },
);

const application_audit = table(
  { name: 'application_audit', public: true },
  {
    tracking_id: t.string().primaryKey(),
    current_status: t.string().index('btree'),
    title_validated: t.bool(),
    experience_certified: t.bool(),
    publication_verified: t.bool(),
    language_validated: t.bool(),
    observations: t.string(),
    reviewer_username: t.string().optional(),
    updated_at: t.timestamp(),
  },
);

const audit_event = table(
  { name: 'audit_event', public: true },
  {
    id: t.u32().primaryKey().autoInc(),
    tracking_id: t.string().index('btree'),
    actor_username: t.string(),
    actor_role: t.string(),
    event_type: t.string().index('btree'),
    message: t.string(),
    created_at: t.timestamp(),
  },
);

const system_setting = table(
  { name: 'system_setting', public: true },
  {
    key: t.string().primaryKey(),
    scope: t.string().index('btree'),
    campus: t.string().optional(),
    value: t.string(),
    updated_at: t.timestamp(),
  },
);

const report_snapshot = table(
  { name: 'report_snapshot', public: true },
  {
    id: t.u32().primaryKey().autoInc(),
    campus: t.string().index('btree'),
    metric_key: t.string().index('btree'),
    metric_value: t.f64(),
    period_label: t.string().index('btree'),
    created_at: t.timestamp(),
  },
);

const api_config = table(
  { name: 'api_config', public: true },
  {
    config_key: t.string().primaryKey(),
    gemini_api_key: t.string(),
    apifreellm_api_key: t.string(),
    scopus_api_key: t.string(),
    orcid_client_id: t.string(),
    orcid_client_secret: t.string(),
    ai_provider: t.string().index('btree'),
    ai_model: t.string().index('btree'),
    updated_at: t.timestamp(),
  },
);

const resend_config = table(
  { name: 'resend_config', public: true },
  {
    config_key: t.string().primaryKey(),
    api_key: t.string(),
    from_email: t.string(),
    from_name: t.string(),
    enabled: t.bool().index('btree'),
    updated_at: t.timestamp(),
  },
);

const email_template = table(
  { name: 'email_template', public: true },
  {
    template_key: t.string().primaryKey(),
    workflow_key: t.string().index('btree'),
    subject: t.string(),
    html_content: t.string(),
    enabled: t.bool().index('btree'),
    updated_at: t.timestamp(),
  },
);

const rag_config = table(
  { name: 'rag_config', public: true },
  {
    config_key: t.string().primaryKey(),
    enabled: t.bool().index('btree'),
    bucket_name: t.string(),
    retrieval_top_k: t.u32(),
    chunk_size: t.u32(),
    chunk_overlap: t.u32(),
    selected_provider: t.string().index('btree'),
    selected_model: t.string().index('btree'),
    fallback_provider: t.string().index('btree'),
    fallback_model: t.string().index('btree'),
    system_context: t.string(),
    updated_at: t.timestamp(),
  },
);

const rag_document = table(
  { name: 'rag_document', public: true },
  {
    document_key: t.string().primaryKey(),
    file_name: t.string().index('btree'),
    file_type: t.string().index('btree'),
    file_size_bytes: t.u64(),
    bucket_name: t.string().index('btree'),
    storage_path: t.string(),
    content_base64: t.string().optional(),
    active: t.bool().index('btree'),
    uploaded_by: t.string().optional(),
    uploaded_at: t.timestamp(),
    updated_at: t.timestamp(),
  },
);

const spacetimedb = schema({
  portal_user,
  user_profile,
  portal_role,
  portal_session,
  application,
  application_title,
  application_language,
  application_publication,
  application_experience,
  application_audit,
  audit_event,
  system_setting,
  report_snapshot,
  api_config,
  resend_config,
  email_template,
  rag_config,
  rag_document,
});

export default spacetimedb;

const DEFAULT_ROLES = [
  {
    role_key: 'admin',
    role_name: 'Administrador',
    portal_module: 'expedientes',
    description: 'Acceso total a expedientes, reportes y configuración.',
  },
  {
    role_key: 'auxiliar',
    role_name: 'Auxiliar',
    portal_module: 'auxiliares',
    description: 'Validación inicial y auditoría documental operativa.',
  },
  {
    role_key: 'director',
    role_name: 'Director',
    portal_module: 'director',
    description: 'Seguimiento directivo y revisión final de procesos.',
  },
  {
    role_key: 'talento_humano',
    role_name: 'Talento Humano',
    portal_module: 'talento_humano',
    description: 'Gestión administrativa de personal y soportes laborales.',
  },
] as const;

type RoleKey = (typeof DEFAULT_ROLES)[number]['role_key'];

function requireSession(ctx: any, role: RoleKey) {
  const session = ctx.db.portal_session.identity.find(ctx.sender);
  if (!session || !session.active) {
    throw new SenderError('No hay una sesión activa para este portal.');
  }
  if (session.role !== 'admin' && session.role !== role) {
    throw new SenderError('No tienes permisos para este recurso.');
  }
  return session;
}

function requireRoleExists(ctx: any, roleKey: string) {
  const role = ctx.db.portal_role.role_key.find(roleKey);
  if (!role || !role.active) {
    throw new SenderError('El rol seleccionado no existe o está inactivo.');
  }
  return role;
}

function requireNonEmpty(value: string, label: string) {
  if (!value.trim()) {
    throw new SenderError(`${label} es obligatorio.`);
  }
}

function requireEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new SenderError('Correo inválido.');
  }
  return email;
}

let idCounter = 0;
function nextId(): number {
  idCounter = (idCounter + 1) >>> 0;
  return (Date.now() + idCounter) >>> 0;
}

export const init = spacetimedb.init((ctx) => {
  for (const role of DEFAULT_ROLES) {
    const existingRole = ctx.db.portal_role.role_key.find(role.role_key);
    if (!existingRole) {
      ctx.db.portal_role.insert({
        ...role,
        active: true,
        created_at: ctx.timestamp,
        updated_at: ctx.timestamp,
      });
    }
  }

  const auxiliar = ctx.db.portal_user.username.find('auxiliar');
  if (!auxiliar) {
    ctx.db.portal_user.insert({
      id: nextId(),
      username: 'auxiliar',
      password: 'Auxiliar123!',
      role: 'auxiliar',
      display_name: 'Auxiliar Operativo',
      active: true,
      created_at: ctx.timestamp,
    });
  }

  const director = ctx.db.portal_user.username.find('director');
  if (!director) {
    ctx.db.portal_user.insert({
      id: nextId(),
      username: 'director',
      password: 'Director123!',
      role: 'director',
      display_name: 'Director Académico',
      active: true,
      created_at: ctx.timestamp,
    });
  }

  const talentoHumano = ctx.db.portal_user.username.find('talentohumano');
  if (!talentoHumano) {
    ctx.db.portal_user.insert({
      id: nextId(),
      username: 'talentohumano',
      password: 'Talento123!',
      role: 'talento_humano',
      display_name: 'Talento Humano',
      active: true,
      created_at: ctx.timestamp,
    });
  }

  const seedProfile = (
    nombre: string,
    correo: string,
    campus: string,
    password: string,
    role: RoleKey,
  ) => {
    const existing = ctx.db.user_profile.correo.find(correo);
    if (existing) return;
    ctx.db.user_profile.insert({
      id: nextId(),
      nombre,
      correo,
      campus,
      password,
      role,
      active: true,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
  };

  seedProfile('Auxiliar Operativo', 'auxiliar@udes.edu.co', 'VALLEDUPAR', 'Auxiliar123!', 'auxiliar');
  seedProfile('Director Académico', 'director@udes.edu.co', 'VALLEDUPAR', 'Director123!', 'director');
  seedProfile('Talento Humano', 'talentohumano@udes.edu.co', 'VALLEDUPAR', 'Talento123!', 'talento_humano');

  // Seed portal roles
  const seedRole = (roleKey: string, roleName: string, description: string) => {
    const existing = ctx.db.portal_role.role_key.find(roleKey);
    if (existing) return;
    ctx.db.portal_role.insert({
      role_key: roleKey,
      role_name: roleName,
      portal_module: 'portal',
      description,
      active: true,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
  };

  seedRole('admin', 'Administrador', 'Acceso administrativo completo al sistema');
  seedRole('auxiliar', 'Auxiliar', 'Acceso apoyo operativo');
  seedRole('director', 'Director', 'Acceso control directivo');
  seedRole('talento_humano', 'Talento Humano', 'Acceso gestión administrativa');

  const apiDefault = ctx.db.api_config.config_key.find('default');
  if (!apiDefault) {
    ctx.db.api_config.insert({
      config_key: 'default',
      gemini_api_key: '',
      apifreellm_api_key: '',
      scopus_api_key: '',
      orcid_client_id: '',
      orcid_client_secret: '',
      ai_provider: 'gemini',
      ai_model: 'gemini-2.5-flash',
      updated_at: ctx.timestamp,
    });
  }

  const resendDefault = ctx.db.resend_config.config_key.find('default');
  if (!resendDefault) {
    ctx.db.resend_config.insert({
      config_key: 'default',
      api_key: '',
      from_email: '',
      from_name: 'Escalafon UDES',
      enabled: false,
      updated_at: ctx.timestamp,
    });
  }

  const ragDefault = ctx.db.rag_config.config_key.find('default');
  if (!ragDefault) {
    ctx.db.rag_config.insert({
      config_key: 'default',
      enabled: false,
      bucket_name: 'rag-udes',
      retrieval_top_k: 5,
      chunk_size: 1500,
      chunk_overlap: 200,
      selected_provider: 'gemini',
      selected_model: 'gemini-2.5-flash',
      fallback_provider: 'apifreellm',
      fallback_model: 'gpt-4o-mini',
      system_context: 'Responde con base en normativa interna, priorizando documentos RAG activos y reglas de escalafón UDES.',
      updated_at: ctx.timestamp,
    });
  }

  const upsertSeedTemplate = (templateKey: string, workflowKey: string, subject: string, htmlContent: string) => {
    const existing = ctx.db.email_template.template_key.find(templateKey);
    if (existing) return;
    ctx.db.email_template.insert({
      template_key: templateKey,
      workflow_key: workflowKey,
      subject,
      html_content: htmlContent,
      enabled: true,
      updated_at: ctx.timestamp,
    });
  };

  upsertSeedTemplate(
    'WORKFLOW_RECEIVED',
    'WORKFLOW_RECEIVED',
    'Postulación recibida - {{tracking_id}}',
    '<h2>Hola {{nombre}}</h2><p>Tu postulación {{tracking_id}} fue recibida exitosamente.</p>',
  );
  upsertSeedTemplate(
    'WORKFLOW_AUDIT_REQUEST',
    'WORKFLOW_AUDIT_REQUEST',
    'Solicitud de subsanación - {{tracking_id}}',
    '<h2>Hola {{nombre}}</h2><p>Tu expediente {{tracking_id}} requiere subsanación: {{observaciones}}</p>',
  );
  upsertSeedTemplate(
    'WORKFLOW_APPROVED',
    'WORKFLOW_APPROVED',
    'Resultado aprobado - {{tracking_id}}',
    '<h2>Hola {{nombre}}</h2><p>Tu postulación {{tracking_id}} fue aprobada con categoría {{categoria_final}}.</p>',
  );
});

export const bootstrap_first_admin = spacetimedb.reducer(
  {
    nombre: t.string(),
    correo: t.string(),
    campus: t.string(),
    password: t.string(),
  },
  (ctx, args) => {
    requireNonEmpty(args.nombre, 'Nombre');
    requireNonEmpty(args.campus, 'Campus');
    requireNonEmpty(args.password, 'Contraseña');

    const correo = requireEmail(args.correo);
    requireRoleExists(ctx, 'admin');

    const firstAdminSetting = ctx.db.system_setting.key.find('security.first_admin_created');
    if (firstAdminSetting && firstAdminSetting.value === 'true') {
      throw new SenderError('El primer administrador ya fue configurado.');
    }

    const adminProfileByRole = Array.from(ctx.db.user_profile.role.filter('admin'));
    if (adminProfileByRole.length > 0) {
      throw new SenderError('Ya existe al menos un perfil admin en el sistema.');
    }

    const existingProfile = ctx.db.user_profile.correo.find(correo);
    if (existingProfile) {
      throw new SenderError('Ya existe un perfil con ese correo.');
    }

    const existingPortalUser = ctx.db.portal_user.username.find(correo);
    if (existingPortalUser) {
      throw new SenderError('Ya existe un usuario de portal con ese correo.');
    }

    ctx.db.user_profile.insert({
      id: nextId(),
      nombre: args.nombre,
      correo,
      campus: args.campus,
      password: args.password,
      role: 'admin',
      active: true,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });

    ctx.db.portal_user.insert({
      id: nextId(),
      username: correo,
      password: args.password,
      role: 'admin',
      display_name: args.nombre,
      active: true,
      created_at: ctx.timestamp,
    });

    const existingBootstrap = ctx.db.system_setting.key.find('security.first_admin_created');
    if (existingBootstrap) {
      ctx.db.system_setting.key.update({
        ...existingBootstrap,
        scope: 'SECURITY',
        campus: args.campus,
        value: 'true',
        updated_at: ctx.timestamp,
      });
    } else {
      ctx.db.system_setting.insert({
        key: 'security.first_admin_created',
        scope: 'SECURITY',
        campus: args.campus,
        value: 'true',
        updated_at: ctx.timestamp,
      });
    }
  },
);

export const init_portal_roles = spacetimedb.reducer(
  {},
  (ctx) => {
    const seedRole = (roleKey: string, roleName: string, description: string) => {
      const existing = ctx.db.portal_role.role_key.find(roleKey);
      if (existing) return;
      ctx.db.portal_role.insert({
        role_key: roleKey,
        role_name: roleName,
        portal_module: 'portal',
        description,
        active: true,
        created_at: ctx.timestamp,
        updated_at: ctx.timestamp,
      });
    };

    seedRole('admin', 'Administrador', 'Acceso administrativo completo al sistema');
    seedRole('auxiliar', 'Auxiliar', 'Acceso apoyo operativo');
    seedRole('director', 'Director', 'Acceso control directivo');
    seedRole('talento_humano', 'Talento Humano', 'Acceso gestión administrativa');
  },
);

export const portal_login = spacetimedb.reducer(
  { role: t.string(), username: t.string(), password: t.string() },
  (ctx, { role, username, password }) => {
    requireNonEmpty(role, 'Rol');
    requireNonEmpty(username, 'Usuario');
    requireNonEmpty(password, 'Contraseña');

    const selectedRole = requireRoleExists(ctx, role);
    const user = ctx.db.portal_user.username.find(username);
    if (!user || !user.active || user.password !== password) {
      throw new SenderError('Credenciales inválidas.');
    }
    if (user.role !== role) {
      throw new SenderError('El usuario no pertenece al rol seleccionado.');
    }

    const activeSession = ctx.db.portal_session.identity.find(ctx.sender);
    if (activeSession) {
      ctx.db.portal_session.identity.update({
        ...activeSession,
        username: user.username,
        role: user.role,
        display_name: user.display_name,
        active: true,
        logged_in_at: ctx.timestamp,
        last_seen_at: ctx.timestamp,
      });
    } else {
      ctx.db.portal_session.insert({
        identity: ctx.sender,
        username: user.username,
        role: user.role,
        display_name: user.display_name,
        active: true,
        logged_in_at: ctx.timestamp,
        last_seen_at: ctx.timestamp,
      });
    }
  },
);

export const portal_logout = spacetimedb.reducer((ctx) => {
  const session = ctx.db.portal_session.identity.find(ctx.sender);
  if (!session) return;
  ctx.db.portal_session.identity.delete(ctx.sender);
});

export const upsert_portal_role = spacetimedb.reducer(
  {
    role_key: t.string(),
    role_name: t.string(),
    portal_module: t.string(),
    description: t.string(),
    active: t.bool(),
  },
  (ctx, args) => {
    requireSession(ctx, 'admin');
    
    // Enhanced validation with detailed error messages
    const roleKey = args.role_key ? String(args.role_key).trim() : '';
    if (!roleKey) {
      throw new SenderError(`[upsert_portal_role] role_key vacío o inválido. Recibido: "${args.role_key}" (tipo: ${typeof args.role_key})`);
    }
    
    requireNonEmpty(args.role_key, 'Clave del rol');
    requireNonEmpty(args.role_name, 'Nombre del rol');
    requireNonEmpty(args.portal_module, 'Portal asignado');

    const existing = ctx.db.portal_role.role_key.find(args.role_key);
    if (existing) {
      ctx.db.portal_role.role_key.update({
        ...existing,
        role_name: args.role_name,
        portal_module: args.portal_module,
        description: args.description,
        active: args.active,
        updated_at: ctx.timestamp,
      });
    } else {
      ctx.db.portal_role.insert({
        ...args,
        created_at: ctx.timestamp,
        updated_at: ctx.timestamp,
      });
    }
  },
);

export const create_portal_user = spacetimedb.reducer(
  {
    username: t.string(),
    password: t.string(),
    role: t.string(),
    display_name: t.string(),
    active: t.bool(),
  },
  (ctx, args) => {
    requireSession(ctx, 'admin');
    requireNonEmpty(args.username, 'Usuario');
    requireNonEmpty(args.password, 'Contraseña');
    requireNonEmpty(args.role, 'Rol');
    requireNonEmpty(args.display_name, 'Nombre a mostrar');

    requireRoleExists(ctx, args.role);

    const existing = ctx.db.portal_user.username.find(args.username);
    if (existing) {
      throw new SenderError('Ya existe un usuario con ese username.');
    }

    ctx.db.portal_user.insert({
      id: nextId(),
      ...args,
      created_at: ctx.timestamp,
    });
  },
);

export const register_user_profile = spacetimedb.reducer(
  {
    nombre: t.string(),
    correo: t.string(),
    campus: t.string(),
    password: t.string(),
    role: t.string(),
  },
  (ctx, args) => {
    requireSession(ctx, 'admin');
    requireNonEmpty(args.nombre, 'Nombre');
    requireNonEmpty(args.campus, 'Campus');
    requireNonEmpty(args.password, 'Contraseña');
    requireNonEmpty(args.role, 'Rol');

    const correo = requireEmail(args.correo);
    requireRoleExists(ctx, args.role);

    const existingProfile = ctx.db.user_profile.correo.find(correo);
    if (existingProfile) {
      throw new SenderError('Ya existe un perfil con ese correo.');
    }

    const existingPortalUser = ctx.db.portal_user.username.find(correo);
    if (existingPortalUser) {
      throw new SenderError('Ya existe un usuario de portal con ese correo.');
    }

    ctx.db.user_profile.insert({
      id: nextId(),
      nombre: args.nombre,
      correo,
      campus: args.campus,
      password: args.password,
      role: args.role,
      active: true,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });

    ctx.db.portal_user.insert({
      id: nextId(),
      username: correo,
      password: args.password,
      role: args.role,
      display_name: args.nombre,
      active: true,
      created_at: ctx.timestamp,
    });
  },
);

export const register_professor = spacetimedb.reducer(
  {
    tracking_id: t.string(),
    professor_name: t.string(),
    document_number: t.string(),
    campus: t.string(),
    program_name: t.string(),
    faculty_name: t.string(),
    scopus_profile: t.string().optional(),
    final_points: t.f64(),
    final_category: t.string(),
    output_message: t.string(),
  },
  (ctx, args) => {
    requireNonEmpty(args.tracking_id, 'Tracking');
    requireNonEmpty(args.professor_name, 'Nombre del profesor');
    requireNonEmpty(args.document_number, 'Documento');
    requireNonEmpty(args.campus, 'Campus');

    const existing = ctx.db.application.tracking_id.find(args.tracking_id);
    if (existing) {
      throw new SenderError('Ya existe una postulación con ese tracking.');
    }

    ctx.db.application.insert({
      ...args,
      status: 'RECIBIDO',
      source_portal: 'AUTOREGISTRO',
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });

    ctx.db.application_audit.insert({
      tracking_id: args.tracking_id,
      current_status: 'RECIBIDO',
      title_validated: false,
      experience_certified: false,
      publication_verified: false,
      language_validated: false,
      observations: '',
      reviewer_username: undefined,
      updated_at: ctx.timestamp,
    });

    ctx.db.audit_event.insert({
      id: nextId(),
      tracking_id: args.tracking_id,
      actor_username: 'public_portal',
      actor_role: 'public',
      event_type: 'APPLICATION_REGISTERED',
      message: 'Postulación registrada desde el portal público.',
      created_at: ctx.timestamp,
    });
  },
);

export const add_application_title = spacetimedb.reducer(
  {
    tracking_id: t.string(),
    title_name: t.string(),
    title_level: t.string(),
    support_name: t.string().optional(),
    support_url: t.string().optional(),
    support_path: t.string().optional(),
  },
  (ctx, args) => {
    const app = ctx.db.application.tracking_id.find(args.tracking_id);
    if (!app) throw new SenderError('La postulación no existe.');
    ctx.db.application_title.insert({
      id: nextId(),
      ...args,
    });
  },
);

export const add_application_language = spacetimedb.reducer(
  {
    tracking_id: t.string(),
    language_name: t.string(),
    language_level: t.string(),
    convalidation: t.bool(),
  },
  (ctx, args) => {
    const app = ctx.db.application.tracking_id.find(args.tracking_id);
    if (!app) throw new SenderError('La postulación no existe.');
    ctx.db.application_language.insert({
      id: nextId(),
      ...args,
    });
  },
);

export const add_application_publication = spacetimedb.reducer(
  {
    tracking_id: t.string(),
    publication_title: t.string(),
    quartile: t.string(),
    publication_year: t.string(),
    publication_type: t.string(),
    authors_count: t.u32(),
    source_kind: t.string(),
  },
  (ctx, args) => {
    const app = ctx.db.application.tracking_id.find(args.tracking_id);
    if (!app) throw new SenderError('La postulación no existe.');
    ctx.db.application_publication.insert({
      id: nextId(),
      ...args,
    });
  },
);

export const add_application_experience = spacetimedb.reducer(
  {
    tracking_id: t.string(),
    experience_type: t.string(),
    started_at: t.string(),
    ended_at: t.string(),
    certified: t.bool(),
    support_name: t.string().optional(),
    support_url: t.string().optional(),
    support_path: t.string().optional(),
  },
  (ctx, args) => {
    const app = ctx.db.application.tracking_id.find(args.tracking_id);
    if (!app) throw new SenderError('La postulación no existe.');
    ctx.db.application_experience.insert({
      id: nextId(),
      ...args,
    });
  },
);

export const update_application_status = spacetimedb.reducer(
  {
    tracking_id: t.string(),
    status: t.string(),
    output_message: t.string(),
  },
  (ctx, args) => {
    const session = requireSession(ctx, 'auxiliar');
    const app = ctx.db.application.tracking_id.find(args.tracking_id);
    if (!app) throw new SenderError('La postulación no existe.');

    ctx.db.application.tracking_id.update({
      ...app,
      status: args.status,
      output_message: args.output_message,
      updated_at: ctx.timestamp,
    });

    const audit = ctx.db.application_audit.tracking_id.find(args.tracking_id);
    if (audit) {
      ctx.db.application_audit.tracking_id.update({
        ...audit,
        current_status: args.status,
        reviewer_username: session.username,
        updated_at: ctx.timestamp,
      });
    }

    ctx.db.audit_event.insert({
      id: nextId(),
      tracking_id: args.tracking_id,
      actor_username: session.username,
      actor_role: session.role,
      event_type: 'STATUS_UPDATED',
      message: args.output_message,
      created_at: ctx.timestamp,
    });
  },
);

export const record_application_audit = spacetimedb.reducer(
  {
    tracking_id: t.string(),
    current_status: t.string(),
    title_validated: t.bool(),
    experience_certified: t.bool(),
    publication_verified: t.bool(),
    language_validated: t.bool(),
    observations: t.string(),
  },
  (ctx, args) => {
    const session = requireSession(ctx, 'auxiliar');
    const audit = ctx.db.application_audit.tracking_id.find(args.tracking_id);
    if (!audit) throw new SenderError('No existe auditoría para ese expediente.');

    ctx.db.application_audit.tracking_id.update({
      ...audit,
      ...args,
      reviewer_username: session.username,
      updated_at: ctx.timestamp,
    });

    ctx.db.audit_event.insert({
      id: nextId(),
      tracking_id: args.tracking_id,
      actor_username: session.username,
      actor_role: session.role,
      event_type: 'AUDIT_RECORDED',
      message: args.observations,
      created_at: ctx.timestamp,
    });
  },
);

export const upsert_system_setting = spacetimedb.reducer(
  {
    key: t.string(),
    scope: t.string(),
    campus: t.string().optional(),
    value: t.string(),
  },
  (ctx, args) => {
    requireSession(ctx, 'admin');
    const existing = ctx.db.system_setting.key.find(args.key);
    if (existing) {
      ctx.db.system_setting.key.update({
        ...existing,
        scope: args.scope,
        campus: args.campus,
        value: args.value,
        updated_at: ctx.timestamp,
      });
    } else {
      ctx.db.system_setting.insert({
        ...args,
        updated_at: ctx.timestamp,
      });
    }
  },
);

export const create_report_snapshot = spacetimedb.reducer(
  {
    campus: t.string(),
    metric_key: t.string(),
    metric_value: t.f64(),
    period_label: t.string(),
  },
  (ctx, args) => {
    requireSession(ctx, 'admin');
    ctx.db.report_snapshot.insert({
      id: nextId(),
      ...args,
      created_at: ctx.timestamp,
    });
  },
);

export const upsert_api_config = spacetimedb.reducer(
  {
    config_key: t.string(),
    gemini_api_key: t.string(),
    apifreellm_api_key: t.string(),
    scopus_api_key: t.string(),
    orcid_client_id: t.string(),
    orcid_client_secret: t.string(),
    ai_provider: t.string(),
    ai_model: t.string(),
  },
  (ctx, args) => {
    requireSession(ctx, 'admin');
    requireNonEmpty(args.config_key, 'Config key');

    const existing = ctx.db.api_config.config_key.find(args.config_key);
    if (existing) {
      ctx.db.api_config.config_key.update({
        ...existing,
        ...args,
        updated_at: ctx.timestamp,
      });
    } else {
      ctx.db.api_config.insert({
        ...args,
        updated_at: ctx.timestamp,
      });
    }
  },
);

export const upsert_resend_config = spacetimedb.reducer(
  {
    config_key: t.string(),
    api_key: t.string(),
    from_email: t.string(),
    from_name: t.string(),
    enabled: t.bool(),
  },
  (ctx, args) => {
    requireSession(ctx, 'admin');
    requireNonEmpty(args.config_key, 'Config key');

    const existing = ctx.db.resend_config.config_key.find(args.config_key);
    if (existing) {
      ctx.db.resend_config.config_key.update({
        ...existing,
        ...args,
        updated_at: ctx.timestamp,
      });
    } else {
      ctx.db.resend_config.insert({
        ...args,
        updated_at: ctx.timestamp,
      });
    }
  },
);

export const upsert_email_template = spacetimedb.reducer(
  {
    template_key: t.string(),
    workflow_key: t.string(),
    subject: t.string(),
    html_content: t.string(),
    enabled: t.bool(),
  },
  (ctx, args) => {
    requireSession(ctx, 'admin');
    requireNonEmpty(args.template_key, 'Template key');
    requireNonEmpty(args.workflow_key, 'Workflow key');

    const existing = ctx.db.email_template.template_key.find(args.template_key);
    if (existing) {
      ctx.db.email_template.template_key.update({
        ...existing,
        workflow_key: args.workflow_key,
        subject: args.subject,
        html_content: args.html_content,
        enabled: args.enabled,
        updated_at: ctx.timestamp,
      });
    } else {
      ctx.db.email_template.insert({
        ...args,
        updated_at: ctx.timestamp,
      });
    }
  },
);

export const upsert_rag_config = spacetimedb.reducer(
  {
    config_key: t.string(),
    enabled: t.bool(),
    bucket_name: t.string(),
    retrieval_top_k: t.u32(),
    chunk_size: t.u32(),
    chunk_overlap: t.u32(),
    selected_provider: t.string(),
    selected_model: t.string(),
    fallback_provider: t.string(),
    fallback_model: t.string(),
    system_context: t.string(),
  },
  (ctx, args) => {
    requireSession(ctx, 'admin');
    requireNonEmpty(args.config_key, 'Config key');
    requireNonEmpty(args.bucket_name, 'Bucket name');

    const existing = ctx.db.rag_config.config_key.find(args.config_key);
    if (existing) {
      ctx.db.rag_config.config_key.update({
        ...existing,
        ...args,
        updated_at: ctx.timestamp,
      });
    } else {
      ctx.db.rag_config.insert({
        ...args,
        updated_at: ctx.timestamp,
      });
    }
  },
);

export const upsert_rag_document = spacetimedb.reducer(
  {
    document_key: t.string(),
    file_name: t.string(),
    file_type: t.string(),
    file_size_bytes: t.u64(),
    bucket_name: t.string(),
    storage_path: t.string(),
    content_base64: t.string().optional(),
    active: t.bool(),
  },
  (ctx, args) => {
    const session = requireSession(ctx, 'admin');
    requireNonEmpty(args.document_key, 'Document key');
    requireNonEmpty(args.file_name, 'File name');
    requireNonEmpty(args.bucket_name, 'Bucket name');

    const existing = ctx.db.rag_document.document_key.find(args.document_key);
    if (existing) {
      ctx.db.rag_document.document_key.update({
        ...existing,
        ...args,
        uploaded_by: session.username,
        updated_at: ctx.timestamp,
      });
    } else {
      ctx.db.rag_document.insert({
        ...args,
        uploaded_by: session.username,
        uploaded_at: ctx.timestamp,
        updated_at: ctx.timestamp,
      });
    }
  },
);

export const deactivate_rag_document = spacetimedb.reducer(
  {
    document_key: t.string(),
  },
  (ctx, args) => {
    requireSession(ctx, 'admin');
    requireNonEmpty(args.document_key, 'Document key');

    const existing = ctx.db.rag_document.document_key.find(args.document_key);
    if (!existing) throw new SenderError('Documento RAG no encontrado.');

    ctx.db.rag_document.document_key.update({
      ...existing,
      active: false,
      updated_at: ctx.timestamp,
    });
  },
);
