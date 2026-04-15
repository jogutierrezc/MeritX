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
    program_name: t.string().index('btree'),
    faculty_name: t.string().index('btree'),
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

const application_audit_criterion = table(
  { name: 'application_audit_criterion', public: true },
  {
    criterion_id: t.string().primaryKey(),
    tracking_id: t.string().index('btree'),
    criterion_key: t.string().index('btree'),
    criterion_label: t.string(),
    criterion_status: t.string().index('btree'),
    quantity: t.f64(),
    unit_label: t.string(),
    base_weight: t.f64(),
    recommended_score: t.f64(),
    weighted_score: t.f64(),
    support_summary: t.string(),
    notes: t.string(),
    reviewer_username: t.string().optional(),
    valuation_stage: t.string().index('btree'),
    updated_at: t.timestamp(),
  },
);

const audit_score_snapshot = table(
  { name: 'audit_score_snapshot', public: true },
  {
    id: t.u32().primaryKey().autoInc(),
    tracking_id: t.string().index('btree'),
    valuation_stage: t.string().index('btree'),
    actor_username: t.string(),
    actor_role: t.string(),
    suggested_score: t.f64(),
    current_weighted_score: t.f64(),
    final_weighted_score: t.f64().optional(),
    final_category: t.string().optional(),
    notes: t.string(),
    criteria_count: t.u32(),
    created_at: t.timestamp(),
  },
);

const audit_criterion_event = table(
  { name: 'audit_criterion_event', public: true },
  {
    id: t.u32().primaryKey().autoInc(),
    tracking_id: t.string().index('btree'),
    criterion_key: t.string().index('btree'),
    valuation_stage: t.string().index('btree'),
    actor_username: t.string(),
    actor_role: t.string(),
    previous_status: t.string().optional(),
    new_status: t.string(),
    previous_base_weight: t.f64().optional(),
    new_base_weight: t.f64(),
    previous_recommended_score: t.f64().optional(),
    new_recommended_score: t.f64(),
    previous_weighted_score: t.f64().optional(),
    new_weighted_score: t.f64(),
    message: t.string(),
    created_at: t.timestamp(),
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

const openrouter_config = table(
  { name: 'openrouter_config', public: true },
  {
    config_key: t.string().primaryKey(),
    api_key: t.string(),
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

const rag_normative = table(
  { name: 'rag_normative', public: true },
  {
    normative_key: t.string().primaryKey(),
    title: t.string().index('btree'),
    document_id: t.string().index('btree'),
    json_content: t.string(),
    bucket_name: t.string().index('btree'),
    storage_path: t.string(),
    active: t.bool().index('btree'),
    uploaded_by: t.string().optional(),
    uploaded_at: t.timestamp(),
    updated_at: t.timestamp(),
  },
);

const convocatoria = table(
  { name: 'convocatoria', public: true },
  {
    id: t.string().primaryKey(),
    codigo: t.string().unique().index('btree'),
    nombre: t.string().index('btree'),
    descripcion: t.string(),
    periodo: t.string().index('btree'),
    año: t.u32().index('btree'),
    fecha_apertura: t.string(),
    fecha_cierre: t.string(),
    estado: t.string().index('btree'),
    postulaciones_count: t.u32(),
    created_by: t.string().optional(),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  },
);

const application_convocatoria = table(
  { name: 'application_convocatoria', public: true },
  {
    tracking_id: t.string().primaryKey(),
    convocatoria_id: t.string().index('btree'),
    linked_by: t.string().optional(),
    linked_at: t.timestamp(),
  },
);

const faculty = table(
  { name: 'faculty', public: true },
  {
    faculty_id: t.string().primaryKey(),
    faculty_name: t.string().unique().index('btree'),
    active: t.bool(),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  },
);

const academic_program = table(
  { name: 'academic_program', public: true },
  {
    program_id: t.string().primaryKey(),
    faculty_id: t.string().index('btree'),
    program_name: t.string().index('btree'),
    active: t.bool().index('btree'),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
    formation_level: t.string().default('PREGRADO').index('btree'),
  },
);

const user_faculty_assignment = table(
  { name: 'user_faculty_assignment', public: true },
  {
    user_email: t.string().primaryKey(),
    role_key: t.string().index('btree'),
    faculty_id: t.string().index('btree'),
    faculty_name: t.string().index('btree'),
    active: t.bool(),
    assigned_by: t.string().optional(),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  },
);

const application_decano_document = table(
  { name: 'application_decano_document', public: true },
  {
    document_id: t.string().primaryKey(),
    tracking_id: t.string().index('btree'),
    document_type: t.string().index('btree'),
    file_name: t.string(),
    file_url: t.string().optional(),
    file_path: t.string().optional(),
    uploaded_by: t.string().optional(),
    uploaded_at: t.timestamp(),
  },
);

const application_decano_review = table(
  { name: 'application_decano_review', public: true },
  {
    tracking_id: t.string().primaryKey(),
    review_status: t.string().index('btree'),
    observations: t.string(),
    reviewed_by: t.string().optional(),
    updated_at: t.timestamp(),
  },
);

const application_analysis_version = table(
  { name: 'application_analysis_version', public: true },
  {
    version_id: t.string().primaryKey(),
    tracking_id: t.string().index('btree'),
    source_type: t.string().index('btree'),
    version_status: t.string().index('btree'),
    rows_payload: t.string(),
    total_score: t.f64(),
    suggested_category: t.string().index('btree'),
    narrative: t.string(),
    notes: t.string(),
    created_by: t.string().optional(),
    created_role: t.string().optional(),
    approved_by: t.string().optional(),
    approved_at: t.timestamp().optional(),
    created_at: t.timestamp(),
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
  application_audit_criterion,
  audit_event,
  audit_score_snapshot,
  audit_criterion_event,
  system_setting,
  report_snapshot,
  api_config,
  openrouter_config,
  resend_config,
  email_template,
  rag_config,
  rag_document,
  rag_normative,
  convocatoria,
  application_convocatoria,
  faculty,
  academic_program,
  user_faculty_assignment,
  application_decano_document,
  application_decano_review,
  application_analysis_version,
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
    role_key: 'decano',
    role_name: 'Decano',
    portal_module: 'decano',
    description: 'Consejo de Facultad para aval o rechazo de postulación.',
  },
  {
    role_key: 'cap',
    role_name: 'CAP',
    portal_module: 'cap',
    description: 'Comité de Asuntos Profesorales para valoración intermedia.',
  },
  {
    role_key: 'cepi',
    role_name: 'CEPI',
    portal_module: 'cepi',
    description: 'Comité de Evaluación de Producción Intelectual para decisión final.',
  },
  {
    role_key: 'talento_humano',
    role_name: 'Talento Humano',
    portal_module: 'talento_humano',
    description: 'Gestión administrativa de personal y soportes laborales.',
  },
] as const;

type RoleKey = (typeof DEFAULT_ROLES)[number]['role_key'];

function requireSession(ctx: any, role: RoleKey | RoleKey[]) {
  const session = ctx.db.portal_session.identity.find(ctx.sender);
  if (!session || !session.active) {
    throw new SenderError('No hay una sesión activa para este portal.');
  }
  const allowedRoles = Array.isArray(role) ? role : [role];
  if (session.role !== 'admin' && !allowedRoles.includes(session.role)) {
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

function isDecanoLikeRole(roleKey: string) {
  return roleKey.trim().toLowerCase().includes('decano');
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

type AuditCriterionPayload = {
  criterionKey?: string;
  criterionLabel?: string;
  criterionStatus?: string;
  quantity?: number;
  unitLabel?: string;
  baseWeight?: number;
  recommendedScore?: number;
  weightedScore?: number;
  supportSummary?: string;
  notes?: string;
};

function toCleanString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function toStableKey(value: string, fallbackPrefix: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || `${fallbackPrefix}_${nextId()}`;
}

function toSafeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parseAuditCriteriaPayload(payload?: string): AuditCriterionPayload[] {
  if (!payload || !payload.trim()) return [];

  try {
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed)) throw new Error('criteria_payload debe ser una lista.');

    return parsed
      .map((item) => ({
        criterionKey: toCleanString(item?.criterionKey),
        criterionLabel: toCleanString(item?.criterionLabel),
        criterionStatus: toCleanString(item?.criterionStatus, 'PRESENTADO') || 'PRESENTADO',
        quantity: toSafeNumber(item?.quantity),
        unitLabel: toCleanString(item?.unitLabel),
        baseWeight: toSafeNumber(item?.baseWeight),
        recommendedScore: toSafeNumber(item?.recommendedScore),
        weightedScore: toSafeNumber(item?.weightedScore),
        supportSummary: toCleanString(item?.supportSummary),
        notes: toCleanString(item?.notes),
      }))
      .filter((item) => item.criterionKey || item.criterionLabel);
  } catch (error) {
    throw new SenderError(`criteria_payload inválido: ${error instanceof Error ? error.message : String(error)}`);
  }
}

type FacultyProgramImportProgram = {
  name: string;
  level: string;
};

type FacultyProgramsImportItem = {
  facultyName: string;
  programs: FacultyProgramImportProgram[];
};

type AnalysisRowPayload = {
  section: string;
  criterion: string;
  detail: string;
  quantity: number;
  value: number;
  baseScore: number;
  suggestedScore: number;
  hasSupport: boolean;
  supportNote: string;
  comment: string;
};

function parseFacultyProgramsPayload(payload?: string): FacultyProgramsImportItem[] {
  if (!payload || !payload.trim()) return [];

  try {
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed)) throw new Error('payload debe ser una lista.');

    return parsed
      .map((item) => {
        const programList =
          (Array.isArray(item?.programs) && item.programs)
          || (Array.isArray(item?.programas) && item.programas)
          || (Array.isArray(item?.academicPrograms) && item.academicPrograms)
          || (Array.isArray(item?.programasAcademicos) && item.programasAcademicos)
          || [];

        return {
        facultyName: toCleanString(
          item?.facultyName
          || item?.faculty
          || item?.faculty_name
          || item?.nombreFacultad
          || item?.facultad,
        ),
        programs: Array.isArray(programList)
          ? programList
            .map((program: unknown) => {
              if (typeof program === 'string') {
                const name = toCleanString(program);
                return name ? { name, level: 'PREGRADO' } : null;
              }

              const parsedProgram = program as Record<string, unknown>;
              const name = toCleanString(
                parsedProgram?.name
                || parsedProgram?.program
                || parsedProgram?.programName
                || parsedProgram?.program_name
                || parsedProgram?.nombre
                || parsedProgram?.programa,
              );
              if (!name) return null;

              const level = toCleanString(
                parsedProgram?.level
                || parsedProgram?.formationLevel
                || parsedProgram?.nivel
                || parsedProgram?.nivelFormacion,
                'PREGRADO',
              ).toUpperCase();

              return { name, level: level || 'PREGRADO' };
            })
            .filter(
              (program: FacultyProgramImportProgram | null): program is FacultyProgramImportProgram =>
                Boolean(program?.name),
            )
          : [],
      };
      })
      .filter((item) => item.facultyName);
  } catch (error) {
    throw new SenderError(`import_payload inválido: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeAnalysisSourceType(sourceType: string) {
  const normalized = sourceType.trim().toUpperCase();
  if (['MOTOR', 'IA', 'MANUAL_TH'].includes(normalized)) return normalized;
  throw new SenderError('source_type inválido. Usa MOTOR, IA o MANUAL_TH.');
}

function parseAnalysisRowsPayload(payload: string): AnalysisRowPayload[] {
  if (!payload.trim()) {
    throw new SenderError('rows_payload es obligatorio.');
  }

  try {
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed)) {
      throw new Error('rows_payload debe ser una lista JSON.');
    }

    return parsed.map((item) => ({
      section: toCleanString(item?.section, 'Otros'),
      criterion: toCleanString(item?.criterion || item?.criterio, ''),
      detail: toCleanString(item?.detail || item?.detalle, ''),
      quantity: toSafeNumber(item?.quantity ?? item?.cantidad, 0),
      value: toSafeNumber(item?.value ?? item?.valor, 0),
      baseScore: toSafeNumber(item?.baseScore ?? item?.puntajeBase ?? item?.puntaje, 0),
      suggestedScore: toSafeNumber(item?.suggestedScore ?? item?.puntajeSugerido ?? item?.puntaje, 0),
      hasSupport: Boolean(item?.hasSupport ?? item?.soportado),
      supportNote: toCleanString(item?.supportNote || item?.support_note || '', ''),
      comment: toCleanString(item?.comment || item?.comentario || '', ''),
    })).filter((row) => row.criterion);
  } catch (error) {
    throw new SenderError(`rows_payload inválido: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function isFinalWorkflowState(status: string, stage: string) {
  const normalizedStatus = status.trim().toUpperCase();
  const normalizedStage = stage.trim().toUpperCase();
  return ['APTO', 'APROBADO', 'FINALIZADO', 'CERRADO'].includes(normalizedStatus)
    || normalizedStage.includes('FINAL')
    || normalizedStage.includes('APPROVED');
}

function upsertAuditCriteria(
  ctx: any,
  trackingId: string,
  stage: string,
  actorUsername: string,
  actorRole: string,
  criteria: AuditCriterionPayload[],
) {
  const stageKey = stage
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'stage';

  for (const criterion of criteria) {
    const criterionKey = (criterion.criterionKey || criterion.criterionLabel || `criterion-${nextId()}`)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const criterionId = `${trackingId}:${stageKey}:${criterionKey}`;
    const label = criterion.criterionLabel || criterionKey.replace(/_/g, ' ').toUpperCase();
    const existing = ctx.db.application_audit_criterion.criterion_id.find(criterionId);
    const nextRow = {
      criterion_id: criterionId,
      tracking_id: trackingId,
      criterion_key: criterionKey,
      criterion_label: label,
      criterion_status: criterion.criterionStatus || 'PRESENTADO',
      quantity: criterion.quantity ?? 0,
      unit_label: criterion.unitLabel || '',
      base_weight: criterion.baseWeight ?? 0,
      recommended_score: criterion.recommendedScore ?? 0,
      weighted_score: criterion.weightedScore ?? 0,
      support_summary: criterion.supportSummary || '',
      notes: criterion.notes || '',
      reviewer_username: actorUsername,
      valuation_stage: stage,
      updated_at: ctx.timestamp,
    };

    if (existing) {
      const hasChanged = existing.criterion_status !== nextRow.criterion_status
        || existing.base_weight !== nextRow.base_weight
        || existing.recommended_score !== nextRow.recommended_score
        || existing.weighted_score !== nextRow.weighted_score
        || existing.notes !== nextRow.notes
        || existing.support_summary !== nextRow.support_summary
        || existing.quantity !== nextRow.quantity
        || existing.unit_label !== nextRow.unit_label
        || existing.valuation_stage !== nextRow.valuation_stage;

      ctx.db.application_audit_criterion.criterion_id.update({
        ...existing,
        ...nextRow,
      });

      if (hasChanged) {
        ctx.db.audit_criterion_event.insert({
          id: nextId(),
          tracking_id: trackingId,
          criterion_key: criterionKey,
          valuation_stage: stage,
          actor_username: actorUsername,
          actor_role: actorRole,
          previous_status: existing.criterion_status,
          new_status: nextRow.criterion_status,
          previous_base_weight: existing.base_weight,
          new_base_weight: nextRow.base_weight,
          previous_recommended_score: existing.recommended_score,
          new_recommended_score: nextRow.recommended_score,
          previous_weighted_score: existing.weighted_score,
          new_weighted_score: nextRow.weighted_score,
          message: nextRow.notes || `Criterio ${label} actualizado en etapa ${stage}.`,
          created_at: ctx.timestamp,
        });
      }
    } else {
      ctx.db.application_audit_criterion.insert(nextRow);
      ctx.db.audit_criterion_event.insert({
        id: nextId(),
        tracking_id: trackingId,
        criterion_key: criterionKey,
        valuation_stage: stage,
        actor_username: actorUsername,
        actor_role: actorRole,
        previous_status: undefined,
        new_status: nextRow.criterion_status,
        previous_base_weight: undefined,
        new_base_weight: nextRow.base_weight,
        previous_recommended_score: undefined,
        new_recommended_score: nextRow.recommended_score,
        previous_weighted_score: undefined,
        new_weighted_score: nextRow.weighted_score,
        message: nextRow.notes || `Criterio ${label} registrado en etapa ${stage}.`,
        created_at: ctx.timestamp,
      });
    }
  }
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

  const decano = ctx.db.portal_user.username.find('decano');
  if (!decano) {
    ctx.db.portal_user.insert({
      id: nextId(),
      username: 'decano',
      password: 'Decano123!',
      role: 'decano',
      display_name: 'Consejo de Facultad',
      active: true,
      created_at: ctx.timestamp,
    });
  }

  const cap = ctx.db.portal_user.username.find('cap');
  if (!cap) {
    ctx.db.portal_user.insert({
      id: nextId(),
      username: 'cap',
      password: 'Cap123!',
      role: 'cap',
      display_name: 'Comité CAP',
      active: true,
      created_at: ctx.timestamp,
    });
  }

  const cepi = ctx.db.portal_user.username.find('cepi');
  if (!cepi) {
    ctx.db.portal_user.insert({
      id: nextId(),
      username: 'cepi',
      password: 'Cepi123!',
      role: 'cepi',
      display_name: 'Comité CEPI',
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

  seedProfile('Consejo de Facultad', 'decano@udes.edu.co', 'VALLEDUPAR', 'Decano123!', 'decano');
  seedProfile('Comité CAP', 'cap@udes.edu.co', 'VALLEDUPAR', 'Cap123!', 'cap');
  seedProfile('Comité CEPI', 'cepi@udes.edu.co', 'VALLEDUPAR', 'Cepi123!', 'cepi');
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
  seedRole('decano', 'Decano', 'Consejo de Facultad para aval inicial');
  seedRole('cap', 'CAP', 'Comité de Asuntos Profesorales');
  seedRole('cepi', 'CEPI', 'Comité de Evaluación de Producción Intelectual');
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

  const openrouterDefault = ctx.db.openrouter_config.config_key.find('default');
  if (!openrouterDefault) {
    ctx.db.openrouter_config.insert({
      config_key: 'default',
      api_key: '',
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
    seedRole('decano', 'Decano', 'Consejo de Facultad para aval inicial');
    seedRole('cap', 'CAP', 'Comité de Asuntos Profesorales');
    seedRole('cepi', 'CEPI', 'Comité de Evaluación de Producción Intelectual');
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
    const session = requireSession(ctx, 'admin');
    
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

export const delete_portal_role = spacetimedb.reducer(
  { role_key: t.string() },
  (ctx, { role_key }) => {
    requireSession(ctx, 'admin');
    const role = ctx.db.portal_role.role_key.find(role_key);
    if (!role) throw new SenderError('El rol no existe.');

    const usersWithRole = Array.from(ctx.db.portal_user.iter()).filter((u) => u.role === role_key);
    if (usersWithRole.length > 0) {
      throw new SenderError(
        `No se puede eliminar el rol '${role_key}' porque hay ${usersWithRole.length} usuarios asignados a él.`,
      );
    }

    ctx.db.portal_role.role_key.delete(role_key);
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
    const session = requireSession(ctx, 'admin');
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
    faculty_id: t.string().optional(),
  },
  (ctx, args) => {
    const session = requireSession(ctx, 'admin');
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

    const previousAssignment = ctx.db.user_faculty_assignment.user_email.find(correo);
    if (isDecanoLikeRole(args.role)) {
      const facultyId = args.faculty_id || '';
      requireNonEmpty(facultyId, 'Facultad asignada para decano');
      const faculty = ctx.db.faculty.faculty_id.find(facultyId);
      if (!faculty || !faculty.active) {
        throw new SenderError('La facultad seleccionada para el decano no existe o está inactiva.');
      }

      const nextAssignment = {
        user_email: correo,
        role_key: args.role,
        faculty_id: faculty.faculty_id,
        faculty_name: faculty.faculty_name,
        active: true,
        assigned_by: session.username,
        created_at: previousAssignment?.created_at || ctx.timestamp,
        updated_at: ctx.timestamp,
      };

      if (previousAssignment) {
        ctx.db.user_faculty_assignment.user_email.update(nextAssignment);
      } else {
        ctx.db.user_faculty_assignment.insert(nextAssignment);
      }
    } else if (previousAssignment) {
      ctx.db.user_faculty_assignment.user_email.delete(correo);
    }
  },
);

export const update_user_profile = spacetimedb.reducer(
  {
    correo: t.string(),
    nombre: t.string().optional(),
    campus: t.string().optional(),
    role: t.string().optional(),
    active: t.bool().optional(),
    faculty_id: t.string().optional(),
  },
  (ctx, args) => {
    const session = requireSession(ctx, 'admin');
    const correo = requireEmail(args.correo);

    const profile = ctx.db.user_profile.correo.find(correo);
    if (!profile) {
      throw new SenderError('No existe un perfil con ese correo.');
    }

    const portalUser = ctx.db.portal_user.username.find(correo);
    if (!portalUser) {
      throw new SenderError('No existe un usuario de portal con ese correo.');
    }

    const nextRole = toCleanString(args.role, profile.role);
    requireRoleExists(ctx, nextRole);

    const nextNombre = toCleanString(args.nombre, profile.nombre);
    const nextCampus = toCleanString(args.campus, profile.campus);
    const nextActive = args.active ?? profile.active;

    ctx.db.user_profile.id.update({
      ...profile,
      nombre: nextNombre,
      campus: nextCampus,
      role: nextRole,
      active: nextActive,
      updated_at: ctx.timestamp,
    });

    ctx.db.portal_user.id.update({
      ...portalUser,
      display_name: nextNombre,
      role: nextRole,
      active: nextActive,
    });

    const previousAssignment = ctx.db.user_faculty_assignment.user_email.find(correo);
    if (isDecanoLikeRole(nextRole)) {
      const facultyId = toCleanString(args.faculty_id, previousAssignment?.faculty_id || '');
      requireNonEmpty(facultyId, 'Facultad asignada para decano');

      const faculty = ctx.db.faculty.faculty_id.find(facultyId);
      if (!faculty || !faculty.active) {
        throw new SenderError('La facultad seleccionada para el decano no existe o está inactiva.');
      }

      const nextAssignment = {
        user_email: correo,
        role_key: nextRole,
        faculty_id: faculty.faculty_id,
        faculty_name: faculty.faculty_name,
        active: nextActive,
        assigned_by: session.username,
        created_at: previousAssignment?.created_at || ctx.timestamp,
        updated_at: ctx.timestamp,
      };

      if (previousAssignment) {
        ctx.db.user_faculty_assignment.user_email.update(nextAssignment);
      } else {
        ctx.db.user_faculty_assignment.insert(nextAssignment);
      }
    } else if (previousAssignment) {
      ctx.db.user_faculty_assignment.user_email.delete(correo);
    }
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
    convocatoria_id: t.string().optional(),
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
      status: 'PENDIENTE_AVAL_FACULTAD',
      source_portal: 'AUTOREGISTRO',
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });

    if (args.convocatoria_id) {
      const convocatoria = ctx.db.convocatoria.id.find(args.convocatoria_id);
      if (!convocatoria) {
        throw new SenderError('La convocatoria seleccionada no existe.');
      }

      ctx.db.application_convocatoria.insert({
        tracking_id: args.tracking_id,
        convocatoria_id: args.convocatoria_id,
        linked_by: 'public_portal',
        linked_at: ctx.timestamp,
      });

      ctx.db.convocatoria.id.update({
        ...convocatoria,
        postulaciones_count: (convocatoria.postulaciones_count || 0) + 1,
        updated_at: ctx.timestamp,
      });
    }

    ctx.db.application_audit.insert({
      tracking_id: args.tracking_id,
      current_status: 'PENDIENTE_AVAL_FACULTAD',
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
      tracking_id: args.tracking_id,
      language_name: args.language_name,
      language_level: args.language_level,
      convalidation: args.convalidation,
    });
  },
);

export const update_application_language = spacetimedb.reducer(
  {
    id: t.u32(),
    language_name: t.string(),
    language_level: t.string(),
    convalidation: t.bool(),
  },
  (ctx, args) => {
    const lang = ctx.db.application_language.id.find(args.id);
    if (!lang) throw new SenderError('El idioma no existe.');
    ctx.db.application_language.id.update({
      ...lang,
      language_name: args.language_name,
      language_level: args.language_level,
      convalidation: args.convalidation,
    });
  },
);

export const delete_application_language = spacetimedb.reducer(
  {
    id: t.u32(),
  },
  (ctx, args) => {
    const lang = ctx.db.application_language.id.find(args.id);
    if (!lang) throw new SenderError('El idioma no existe.');
    ctx.db.application_language.id.delete(args.id);
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

export const update_application_title_support = spacetimedb.reducer(
  {
    id: t.u32(),
    support_name: t.string().optional(),
    support_path: t.string().optional(),
  },
  (ctx, args) => {
    requireSession(ctx, ['talento_humano', 'cap']);
    const current = ctx.db.application_title.id.find(args.id);
    if (!current) throw new SenderError('El título no existe.');

    ctx.db.application_title.id.update({
      ...current,
      support_name: args.support_name,
      support_path: args.support_path,
    });
  },
);

export const update_application_experience_support = spacetimedb.reducer(
  {
    id: t.u32(),
    support_name: t.string().optional(),
    support_path: t.string().optional(),
  },
  (ctx, args) => {
    requireSession(ctx, ['talento_humano', 'cap']);
    const current = ctx.db.application_experience.id.find(args.id);
    if (!current) throw new SenderError('La experiencia no existe.');

    ctx.db.application_experience.id.update({
      ...current,
      support_name: args.support_name,
      support_path: args.support_path,
    });
  },
);

export const update_application_publication_source_kind = spacetimedb.reducer(
  {
    id: t.u32(),
    source_kind: t.string(),
  },
  (ctx, args) => {
    requireSession(ctx, ['talento_humano', 'cap']);
    const current = ctx.db.application_publication.id.find(args.id);
    if (!current) throw new SenderError('La publicación no existe.');

    const normalized = String(args.source_kind || '').trim().toUpperCase();
    if (!['SCOPUS', 'ORCID', 'MANUAL'].includes(normalized)) {
      throw new SenderError('source_kind inválido. Usa SCOPUS, ORCID o MANUAL.');
    }

    ctx.db.application_publication.id.update({
      ...current,
      source_kind: normalized,
    });
  },
);

export const upsert_faculty = spacetimedb.reducer(
  {
    faculty_name: t.string(),
    active: t.bool().optional(),
  },
  (ctx, args) => {
    requireSession(ctx, 'admin');
    requireNonEmpty(args.faculty_name, 'Facultad');

    const facultyId = toStableKey(args.faculty_name, 'faculty');
    const existing = ctx.db.faculty.faculty_id.find(facultyId);

    if (existing) {
      ctx.db.faculty.faculty_id.update({
        ...existing,
        faculty_name: args.faculty_name,
        active: args.active ?? existing.active,
        updated_at: ctx.timestamp,
      });
    } else {
      ctx.db.faculty.insert({
        faculty_id: facultyId,
        faculty_name: args.faculty_name,
        active: args.active ?? true,
        created_at: ctx.timestamp,
        updated_at: ctx.timestamp,
      });
    }
  },
);

export const upsert_academic_program = spacetimedb.reducer(
  {
    faculty_id: t.string(),
    program_name: t.string(),
    formation_level: t.string().optional(),
    active: t.bool().optional(),
  },
  (ctx, args) => {
    requireSession(ctx, 'admin');
    requireNonEmpty(args.faculty_id, 'Facultad');
    requireNonEmpty(args.program_name, 'Programa');

    const ownerFaculty = ctx.db.faculty.faculty_id.find(args.faculty_id);
    if (!ownerFaculty) {
      throw new SenderError('La facultad seleccionada no existe.');
    }

    const programId = `${args.faculty_id}:${toStableKey(args.program_name, 'program')}`;
    const existing = ctx.db.academic_program.program_id.find(programId);

    if (existing) {
      ctx.db.academic_program.program_id.update({
        ...existing,
        faculty_id: args.faculty_id,
        program_name: args.program_name,
        formation_level: toCleanString(args.formation_level, existing.formation_level || 'PREGRADO').toUpperCase(),
        active: args.active ?? existing.active,
        updated_at: ctx.timestamp,
      });
    } else {
      ctx.db.academic_program.insert({
        program_id: programId,
        faculty_id: args.faculty_id,
        program_name: args.program_name,
        formation_level: toCleanString(args.formation_level, 'PREGRADO').toUpperCase(),
        active: args.active ?? true,
        created_at: ctx.timestamp,
        updated_at: ctx.timestamp,
      });
    }
  },
);

export const import_faculty_programs = spacetimedb.reducer(
  {
    import_payload: t.string(),
  },
  (ctx, args) => {
    requireSession(ctx, 'admin');
    const rows = parseFacultyProgramsPayload(args.import_payload);
    if (rows.length === 0) {
      throw new SenderError('No se encontraron datos válidos para importar.');
    }

    const totalPrograms = rows.reduce((acc, row) => acc + row.programs.length, 0);
    if (totalPrograms === 0) {
      throw new SenderError('No se encontraron programas válidos. Usa "programs" o "programas" con al menos un programa por facultad.');
    }

    for (const row of rows) {
      const facultyId = toStableKey(row.facultyName, 'faculty');
      const existingFaculty = ctx.db.faculty.faculty_id.find(facultyId);
      if (existingFaculty) {
        ctx.db.faculty.faculty_id.update({
          ...existingFaculty,
          faculty_name: row.facultyName,
          active: true,
          updated_at: ctx.timestamp,
        });
      } else {
        ctx.db.faculty.insert({
          faculty_id: facultyId,
          faculty_name: row.facultyName,
          active: true,
          created_at: ctx.timestamp,
          updated_at: ctx.timestamp,
        });
      }

      for (const program of row.programs) {
        const programId = `${facultyId}:${toStableKey(program.name, 'program')}`;
        const existingProgram = ctx.db.academic_program.program_id.find(programId);
        if (existingProgram) {
          ctx.db.academic_program.program_id.update({
            ...existingProgram,
            faculty_id: facultyId,
            program_name: program.name,
            formation_level: program.level || 'PREGRADO',
            active: true,
            updated_at: ctx.timestamp,
          });
        } else {
          ctx.db.academic_program.insert({
            program_id: programId,
            faculty_id: facultyId,
            program_name: program.name,
            formation_level: program.level || 'PREGRADO',
            active: true,
            created_at: ctx.timestamp,
            updated_at: ctx.timestamp,
          });
        }
      }
    }
  },
);

export const record_decano_review = spacetimedb.reducer(
  {
    tracking_id: t.string(),
    review_status: t.string(),
    observations: t.string().optional(),
    interview_file_name: t.string().optional(),
    interview_file_url: t.string().optional(),
    interview_file_path: t.string().optional(),
    decision_file_name: t.string().optional(),
    decision_file_url: t.string().optional(),
    decision_file_path: t.string().optional(),
  },
  (ctx, args) => {
    const session = requireSession(ctx, 'decano');
    requireNonEmpty(args.tracking_id, 'Tracking');
    requireNonEmpty(args.review_status, 'Estado de revisión');

    const app = ctx.db.application.tracking_id.find(args.tracking_id);
    if (!app) throw new SenderError('La postulación no existe.');

    const normalizedStatus = args.review_status.trim().toUpperCase();
    const mappedStatus = normalizedStatus === 'APTO_PARA_CONTINUAR'
      ? 'AVALADO_FACULTAD'
      : normalizedStatus === 'RECHAZAR_POSTULACION'
        ? 'RECHAZADO_FACULTAD'
        : 'PENDIENTE_AVAL_FACULTAD';

    if (args.interview_file_name?.trim()) {
      const documentId = `${args.tracking_id}:interview:${nextId()}`;
      ctx.db.application_decano_document.insert({
        document_id: documentId,
        tracking_id: args.tracking_id,
        document_type: 'INTERVIEW',
        file_name: args.interview_file_name.trim(),
        file_url: args.interview_file_url,
        file_path: args.interview_file_path,
        uploaded_by: session.username,
        uploaded_at: ctx.timestamp,
      });
    }

    if (args.decision_file_name?.trim()) {
      const documentId = `${args.tracking_id}:decision:${nextId()}`;
      ctx.db.application_decano_document.insert({
        document_id: documentId,
        tracking_id: args.tracking_id,
        document_type: 'DECISION',
        file_name: args.decision_file_name.trim(),
        file_url: args.decision_file_url,
        file_path: args.decision_file_path,
        uploaded_by: session.username,
        uploaded_at: ctx.timestamp,
      });
    }

    const existingReview = ctx.db.application_decano_review.tracking_id.find(args.tracking_id);
    const nextReview = {
      tracking_id: args.tracking_id,
      review_status: normalizedStatus,
      observations: args.observations || '',
      reviewed_by: session.username,
      updated_at: ctx.timestamp,
    };

    if (existingReview) {
      ctx.db.application_decano_review.tracking_id.update({
        ...existingReview,
        ...nextReview,
      });
    } else {
      ctx.db.application_decano_review.insert(nextReview);
    }

    ctx.db.application.tracking_id.update({
      ...app,
      status: mappedStatus,
      output_message:
        mappedStatus === 'AVALADO_FACULTAD'
          ? 'La postulación fue avalada por Consejo de Facultad y enviada a CAP.'
          : mappedStatus === 'RECHAZADO_FACULTAD'
            ? 'La postulación fue rechazada por Consejo de Facultad.'
            : 'La postulación sigue pendiente de revisión en Consejo de Facultad.',
      updated_at: ctx.timestamp,
    });

    const audit = ctx.db.application_audit.tracking_id.find(args.tracking_id);
    if (audit) {
      ctx.db.application_audit.tracking_id.update({
        ...audit,
        current_status: mappedStatus,
        observations: args.observations || audit.observations,
        reviewer_username: session.username,
        updated_at: ctx.timestamp,
      });
    }

    ctx.db.audit_event.insert({
      id: nextId(),
      tracking_id: args.tracking_id,
      actor_username: session.username,
      actor_role: session.role,
      event_type: 'DECANO_REVIEW_RECORDED',
      message: args.observations || `Revisión de decano registrada con estado ${normalizedStatus}.`,
      created_at: ctx.timestamp,
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
    const session = requireSession(ctx, ['decano', 'cap', 'cepi']);
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
    suggested_score: t.f64().optional(),
    current_weighted_score: t.f64().optional(),
    final_weighted_score: t.f64().optional(),
    valuation_stage: t.string().optional(),
    final_category: t.string().optional(),
    criteria_payload: t.string().optional(),
  },
  (ctx, args) => {
    const session = requireSession(ctx, ['cap', 'cepi']);
    const audit = ctx.db.application_audit.tracking_id.find(args.tracking_id);
    if (!audit) throw new SenderError('No existe auditoría para ese expediente.');

    const app = ctx.db.application.tracking_id.find(args.tracking_id);
    if (!app) throw new SenderError('La postulación no existe.');

    const valuationStage = toCleanString(args.valuation_stage, 'CAP_REVIEW') || 'CAP_REVIEW';
    const criteria = parseAuditCriteriaPayload(args.criteria_payload);
    const suggestedScore = args.suggested_score ?? 0;
    const currentWeightedScore = args.current_weighted_score ?? suggestedScore;
    const explicitFinalWeightedScore = args.final_weighted_score;
    const finalWeightedScore = explicitFinalWeightedScore ?? (isFinalWorkflowState(args.current_status, valuationStage) ? currentWeightedScore : undefined);
    const finalCategory = toCleanString(args.final_category, app.final_category || '') || undefined;

    ctx.db.application_audit.tracking_id.update({
      ...audit,
      tracking_id: args.tracking_id,
      current_status: args.current_status,
      title_validated: args.title_validated,
      experience_certified: args.experience_certified,
      publication_verified: args.publication_verified,
      language_validated: args.language_validated,
      observations: args.observations,
      reviewer_username: session.username,
      updated_at: ctx.timestamp,
    });

    if (criteria.length > 0) {
      upsertAuditCriteria(ctx, args.tracking_id, valuationStage, session.username, session.role, criteria);
    }

    ctx.db.audit_score_snapshot.insert({
      id: nextId(),
      tracking_id: args.tracking_id,
      valuation_stage: valuationStage,
      actor_username: session.username,
      actor_role: session.role,
      suggested_score: suggestedScore,
      current_weighted_score: currentWeightedScore,
      final_weighted_score: finalWeightedScore,
      final_category: finalCategory,
      notes: args.observations,
      criteria_count: criteria.length,
      created_at: ctx.timestamp,
    });

    if (isFinalWorkflowState(args.current_status, valuationStage) && finalWeightedScore !== undefined) {
      ctx.db.application.tracking_id.update({
        ...app,
        final_points: finalWeightedScore,
        final_category: finalCategory || app.final_category,
        updated_at: ctx.timestamp,
      });
    }

    ctx.db.audit_event.insert({
      id: nextId(),
      tracking_id: args.tracking_id,
      actor_username: session.username,
      actor_role: session.role,
      event_type: 'AUDIT_RECORDED',
      message: args.observations || `Auditoría registrada en etapa ${valuationStage}.`,
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

export const upsert_openrouter_config = spacetimedb.reducer(
  {
    config_key: t.string(),
    api_key: t.string(),
  },
  (ctx, args) => {
    requireSession(ctx, 'admin');
    requireNonEmpty(args.config_key, 'Config key');

    const existing = ctx.db.openrouter_config.config_key.find(args.config_key);
    if (existing) {
      ctx.db.openrouter_config.config_key.update({
        ...existing,
        api_key: args.api_key,
        updated_at: ctx.timestamp,
      });
    } else {
      ctx.db.openrouter_config.insert({
        config_key: args.config_key,
        api_key: args.api_key,
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

export const upsert_rag_normative = spacetimedb.reducer(
  {
    normative_key: t.string(),
    title: t.string(),
    document_id: t.string(),
    json_content: t.string(),
    bucket_name: t.string(),
    storage_path: t.string(),
    active: t.bool(),
  },
  (ctx, args) => {
    const session = requireSession(ctx, 'admin');
    requireNonEmpty(args.normative_key, 'Normative key');
    requireNonEmpty(args.title, 'Título de normativa');
    requireNonEmpty(args.json_content, 'Contenido JSON');

    // Minimal JSON validation
    try {
      JSON.parse(args.json_content);
    } catch {
      throw new SenderError('json_content no es un JSON válido.');
    }

    const existing = ctx.db.rag_normative.normative_key.find(args.normative_key);
    if (existing) {
      ctx.db.rag_normative.normative_key.update({
        ...existing,
        title: args.title,
        document_id: args.document_id,
        json_content: args.json_content,
        bucket_name: args.bucket_name,
        storage_path: args.storage_path,
        active: args.active,
        uploaded_by: session.username,
        updated_at: ctx.timestamp,
      });
    } else {
      ctx.db.rag_normative.insert({
        normative_key: args.normative_key,
        title: args.title,
        document_id: args.document_id,
        json_content: args.json_content,
        bucket_name: args.bucket_name,
        storage_path: args.storage_path,
        active: args.active,
        uploaded_by: session.username,
        uploaded_at: ctx.timestamp,
        updated_at: ctx.timestamp,
      });
    }
  },
);

export const deactivate_rag_normative = spacetimedb.reducer(
  {
    normative_key: t.string(),
  },
  (ctx, args) => {
    requireSession(ctx, 'admin');
    requireNonEmpty(args.normative_key, 'Normative key');

    const existing = ctx.db.rag_normative.normative_key.find(args.normative_key);
    if (!existing) throw new SenderError('Normativa RAG no encontrada.');

    ctx.db.rag_normative.normative_key.update({
      ...existing,
      active: false,
      updated_at: ctx.timestamp,
    });
  },
);

export const create_convocatoria = spacetimedb.reducer(
  {
    codigo: t.string(),
    nombre: t.string(),
    descripcion: t.string(),
    periodo: t.string(),
    año: t.u32(),
    fecha_apertura: t.string(),
    fecha_cierre: t.string(),
    estado: t.string(),
  },
  (ctx, args) => {
    requireSession(ctx, ['cap', 'talento_humano']);
    requireNonEmpty(args.codigo, 'Código');
    requireNonEmpty(args.nombre, 'Nombre');

    const existing = ctx.db.convocatoria.codigo.find(args.codigo);
    if (existing) {
      throw new SenderError('El código de convocatoria ya existe.');
    }

    // Reducers must stay deterministic across replicas; derive ID from stable input.
    const id = args.codigo.trim().toLowerCase();
    ctx.db.convocatoria.insert({
      id,
      codigo: args.codigo,
      nombre: args.nombre,
      descripcion: args.descripcion,
      periodo: args.periodo,
      año: args.año,
      fecha_apertura: args.fecha_apertura,
      fecha_cierre: args.fecha_cierre,
      estado: args.estado,
      postulaciones_count: 0,
      created_by: ctx.sender.toString(),
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
  },
);

export const update_convocatoria = spacetimedb.reducer(
  {
    id: t.string(),
    nombre: t.string(),
    descripcion: t.string(),
    estado: t.string(),
  },
  (ctx, args) => {
    requireSession(ctx, ['cap', 'talento_humano']);
    requireNonEmpty(args.id, 'ID');
    requireNonEmpty(args.nombre, 'Nombre');

    const existing = ctx.db.convocatoria.id.find(args.id);
    if (!existing) {
      throw new SenderError('Convocatoria no encontrada.');
    }

    ctx.db.convocatoria.id.update({
      ...existing,
      nombre: args.nombre,
      descripcion: args.descripcion,
      estado: args.estado,
      updated_at: ctx.timestamp,
    });
  },
);

export const close_convocatoria = spacetimedb.reducer(
  {
    id: t.string(),
  },
  (ctx, args) => {
    requireSession(ctx, ['cap', 'talento_humano']);
    requireNonEmpty(args.id, 'ID');

    const existing = ctx.db.convocatoria.id.find(args.id);
    if (!existing) {
      throw new SenderError('Convocatoria no encontrada.');
    }

    ctx.db.convocatoria.id.update({
      ...existing,
      estado: 'CERRADA',
      updated_at: ctx.timestamp,
    });
  },
);

export const link_application_convocatoria = spacetimedb.reducer(
  {
    tracking_id: t.string(),
    convocatoria_id: t.string(),
  },
  (ctx, args) => {
    const session = requireSession(ctx, 'cap');
    requireNonEmpty(args.tracking_id, 'Tracking');
    requireNonEmpty(args.convocatoria_id, 'Convocatoria');

    const app = ctx.db.application.tracking_id.find(args.tracking_id);
    if (!app) throw new SenderError('La postulación no existe.');

    const convocatoria = ctx.db.convocatoria.id.find(args.convocatoria_id);
    if (!convocatoria) throw new SenderError('La convocatoria no existe.');

    const existing = ctx.db.application_convocatoria.tracking_id.find(args.tracking_id);
    if (existing?.convocatoria_id === args.convocatoria_id) {
      return;
    }

    if (existing) {
      const oldConv = ctx.db.convocatoria.id.find(existing.convocatoria_id);
      if (oldConv) {
        ctx.db.convocatoria.id.update({
          ...oldConv,
          postulaciones_count: Math.max(0, (oldConv.postulaciones_count || 0) - 1),
          updated_at: ctx.timestamp,
        });
      }

      ctx.db.application_convocatoria.tracking_id.update({
        ...existing,
        convocatoria_id: args.convocatoria_id,
        linked_by: session.username,
        linked_at: ctx.timestamp,
      });
    } else {
      ctx.db.application_convocatoria.insert({
        tracking_id: args.tracking_id,
        convocatoria_id: args.convocatoria_id,
        linked_by: session.username,
        linked_at: ctx.timestamp,
      });
    }

    ctx.db.convocatoria.id.update({
      ...convocatoria,
      postulaciones_count: (convocatoria.postulaciones_count || 0) + 1,
      updated_at: ctx.timestamp,
    });
  },
);

export const save_application_analysis_version = spacetimedb.reducer(
  {
    tracking_id: t.string(),
    source_type: t.string(),
    rows_payload: t.string(),
    total_score: t.f64(),
    suggested_category: t.string(),
    narrative: t.string().optional(),
    notes: t.string().optional(),
  },
  (ctx, args) => {
    const session = requireSession(ctx, ['talento_humano', 'cap', 'cepi']);
    requireNonEmpty(args.tracking_id, 'Tracking');
    requireNonEmpty(args.source_type, 'Tipo de fuente');
    requireNonEmpty(args.suggested_category, 'Categoría sugerida');

    const app = ctx.db.application.tracking_id.find(args.tracking_id);
    if (!app) {
      throw new SenderError('La postulación no existe.');
    }

    const sourceType = normalizeAnalysisSourceType(args.source_type);
    const parsedRows = parseAnalysisRowsPayload(args.rows_payload);
    if (parsedRows.length === 0) {
      throw new SenderError('La versión debe incluir al menos un criterio.');
    }

    const versionId = `${args.tracking_id}:${sourceType}:${nextId()}`;
    ctx.db.application_analysis_version.insert({
      version_id: versionId,
      tracking_id: args.tracking_id,
      source_type: sourceType,
      version_status: sourceType === 'MOTOR' ? 'REFERENCIA' : 'BORRADOR',
      rows_payload: JSON.stringify(parsedRows),
      total_score: args.total_score,
      suggested_category: args.suggested_category,
      narrative: args.narrative || '',
      notes: args.notes || '',
      created_by: session.username,
      created_role: session.role,
      approved_by: undefined,
      approved_at: undefined,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });

    ctx.db.audit_event.insert({
      id: nextId(),
      tracking_id: args.tracking_id,
      actor_username: session.username,
      actor_role: session.role,
      event_type: 'ANALYSIS_VERSION_SAVED',
      message: `Versión ${sourceType} guardada (${versionId}).`,
      created_at: ctx.timestamp,
    });
  },
);

export const approve_application_analysis_version = spacetimedb.reducer(
  {
    version_id: t.string(),
    output_message: t.string().optional(),
  },
  (ctx, args) => {
    const session = requireSession(ctx, 'cap');
    requireNonEmpty(args.version_id, 'Version ID');

    const targetVersion = ctx.db.application_analysis_version.version_id.find(args.version_id);
    if (!targetVersion) {
      throw new SenderError('La versión de análisis no existe.');
    }

    const app = ctx.db.application.tracking_id.find(targetVersion.tracking_id);
    if (!app) {
      throw new SenderError('La postulación asociada no existe.');
    }

    const sameTracking = Array.from(ctx.db.application_analysis_version.tracking_id.filter(targetVersion.tracking_id));
    for (const row of sameTracking) {
      if (row.version_status === 'OFICIAL' && row.version_id !== targetVersion.version_id) {
        ctx.db.application_analysis_version.version_id.update({
          ...row,
          version_status: 'HISTORICO',
          updated_at: ctx.timestamp,
        });
      }
    }

    ctx.db.application_analysis_version.version_id.update({
      ...targetVersion,
      version_status: 'OFICIAL',
      approved_by: session.username,
      approved_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });

    ctx.db.application.tracking_id.update({
      ...app,
      final_points: targetVersion.total_score,
      final_category: targetVersion.suggested_category,
      output_message:
        args.output_message
        || `CAP aprobó como oficial la versión ${targetVersion.source_type} (${targetVersion.version_id}).`,
      updated_at: ctx.timestamp,
    });

    const audit = ctx.db.application_audit.tracking_id.find(targetVersion.tracking_id);
    if (audit) {
      ctx.db.application_audit.tracking_id.update({
        ...audit,
        current_status: 'TABLA_OFICIAL_CAP',
        observations: `Versión oficial CAP: ${targetVersion.version_id}`,
        reviewer_username: session.username,
        updated_at: ctx.timestamp,
      });
    }

    ctx.db.audit_event.insert({
      id: nextId(),
      tracking_id: targetVersion.tracking_id,
      actor_username: session.username,
      actor_role: session.role,
      event_type: 'ANALYSIS_VERSION_APPROVED',
      message: `CAP aprobó como oficial la versión ${targetVersion.version_id}.`,
      created_at: ctx.timestamp,
    });
  },
);

