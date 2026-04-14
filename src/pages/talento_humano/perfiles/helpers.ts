import type { AiCriterionRow } from './types';

export const clamp = (value: number) => (Number.isFinite(value) ? value : 0);

export const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const normalizeTitleLevel = (level: string): 'Pregrado' | 'Especialización' | 'Maestría' | 'Doctorado' => {
  const normalized = normalizeText(level);
  if (normalized.includes('doctor')) return 'Doctorado';
  if (normalized.includes('maestr') || normalized.includes('magister')) return 'Maestría';
  if (normalized.includes('especial')) return 'Especialización';
  return 'Pregrado';
};

export const normalizeLanguageLevel = (level: string): 'A2' | 'B1' | 'B2' | 'C1' => {
  const normalized = level.toUpperCase().trim();
  if (normalized.includes('C1')) return 'C1';
  if (normalized.includes('B2')) return 'B2';
  if (normalized.includes('B1')) return 'B1';
  return 'A2';
};

export const normalizeExperienceType = (value: string): 'Profesional' | 'Docencia Universitaria' | 'Investigación' => {
  const normalized = normalizeText(value);
  if (normalized.includes('invest')) return 'Investigación';
  if (normalized.includes('docenc')) return 'Docencia Universitaria';
  return 'Profesional';
};

export const diffYears = (start: string, end: string) => {
  const from = new Date(start);
  const to = end ? new Date(end) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
};

export const hasSupport = (supportName?: string | null, supportPath?: string | null) =>
  Boolean((supportName && supportName.trim()) || (supportPath && supportPath.trim()));

export const toSafeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parseAiJson = (text: string): { rows: AiCriterionRow[]; narrativa: string } | null => {
  const cleaned = text.trim();
  const candidate = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

  const tryParse = (raw: string) => {
    const parsed = JSON.parse(raw) as any;
    const rowsRaw = Array.isArray(parsed?.rows) ? parsed.rows : [];
    const rows: AiCriterionRow[] = rowsRaw.map((row: any) => ({
      criterio: String(row?.criterio || '').trim(),
      soporteValido: Boolean(row?.soporteValido),
      puntajeSugerido: toSafeNumber(row?.puntajeSugerido, 0),
      comentario: String(row?.comentario || '').trim(),
    }));
    return { rows, narrativa: String(parsed?.narrativa || '').trim() };
  };

  try {
    return tryParse(candidate);
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return tryParse(candidate.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};
