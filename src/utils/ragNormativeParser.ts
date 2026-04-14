/**
 * Converts a normative JSON entry (rag_normative) into rich text chunks suitable for RAG retrieval.
 *
 * Expected JSON structure (example – Acuerdo No. 008 de 2019 UDES):
 * {
 *   "documento": "Acuerdo No. 008 de 2019",
 *   "titulo_oficial": "Por medio del cual se regula el Escalafón Profesoral...",
 *   "emisor": "Consejo Superior - Universidad de Santander",
 *   "fecha_expedicion": "04 de marzo de 2019",
 *   "articulos": [
 *     { "numero": "Artículo 1", "titulo": "...", "contenido": "..." }
 *   ]
 * }
 *
 * Each article becomes a self-contained chunk with a header so the LLM can cite it precisely.
 */

export type RawNormativeJson = {
  documento?: string;
  titulo_oficial?: string;
  emisor?: string;
  fecha_expedicion?: string;
  articulos?: Array<{
    numero?: string;
    titulo?: string;
    contenido?: string;
    [key: string]: unknown;
  }>;
  // allow extra fields
  [key: string]: unknown;
};

/** Parse the json_content string tolerantly. Returns null if the string is not valid JSON. */
export function parseNormativeJson(jsonContent: string): RawNormativeJson | null {
  try {
    const parsed = JSON.parse(jsonContent);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as RawNormativeJson;
  } catch {
    return null;
  }
}

/** Extract the documento/title from the parsed JSON for display. */
export function normativeDisplayTitle(parsed: RawNormativeJson | null, fallback = 'Normativa'): string {
  if (!parsed) return fallback;
  return String(
    parsed.documento || parsed.titulo_oficial || fallback,
  ).trim();
}

/** Extract article count for display. */
export function normativeArticleCount(parsed: RawNormativeJson | null): number {
  if (!parsed || !Array.isArray(parsed.articulos)) return 0;
  return parsed.articulos.length;
}

/**
 * Converts a normative JSON entry into RAG-ready text chunks.
 * Returns an array of strings – one per article (plus one summary chunk for the document header).
 */
export function normativeToRagChunks(
  jsonContent: string,
  titleOverride?: string,
): string[] {
  const parsed = parseNormativeJson(jsonContent);
  if (!parsed) {
    // If it's not parseable structured JSON, return it as a single plain-text chunk.
    return [jsonContent.slice(0, 4000).trim()];
  }
  const chunks: string[] = [];

  // Helper: normalize keys (remove diacritics, punctuation, underscores) for tolerant lookup
  const normKey = (k: string) =>
    String(k || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase();

  const findValue = (obj: any, candidates: string[]): any => {
    if (!obj || typeof obj !== 'object') return undefined;
    for (const c of candidates) {
      if (c in obj) return obj[c];
    }
    // fallback: try to find by normalized key name
    const wanted = candidates.map((c) => normKey(c));
    for (const k of Object.keys(obj)) {
      if (wanted.includes(normKey(k))) return obj[k];
    }
    return undefined;
  };

  const documento = String(findValue(parsed, ['documento', 'document', 'doc', 'titulo_oficial']) || '').trim();
  const tituloOficial = String(findValue(parsed, ['titulo_oficial', 'titulo', 'title', 'official_title']) || '').trim();
  const emisor = String(findValue(parsed, ['emisor', 'issuer', 'autor', 'autoridad']) || '').trim();
  const fecha = String(findValue(parsed, ['fecha_expedicion', 'fecha', 'date']) || '').trim();
  const docHeader = [
    documento || titleOverride || 'Normativa',
    tituloOficial ? `— ${tituloOficial}` : '',
    emisor ? `Emitido por: ${emisor}` : '',
    fecha ? `Fecha: ${fecha}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  // Summary chunk – useful for top-level queries.
  chunks.push([docHeader, tituloOficial, emisor, fecha].filter(Boolean).join('\n').trim());

  // Tolerant article extraction: support 'articulos', 'articles', 'items', etc.
  const articuloCandidates = ['articulos', 'artículos', 'articles', 'items', 'arts'];
  let articulos: any[] = [];
  const rawArt = findValue(parsed, articuloCandidates as any);
  if (Array.isArray(rawArt)) articulos = rawArt;
  else {
    // try scanning object keys for an array-valued field
    for (const k of Object.keys(parsed)) {
      if (Array.isArray((parsed as any)[k])) {
        const lk = normKey(k);
        if (lk.includes('art') || lk.includes('item') || lk.includes('article')) {
          articulos = (parsed as any)[k];
          break;
        }
      }
    }
  }

  for (const art of articulos) {
    if (!art || typeof art !== 'object') continue;
    const numero = String(findValue(art, ['numero', 'n', 'num', 'numero_articulo', 'numeroArticulo', 'nro']) || '').trim();
    const titulo = String(findValue(art, ['titulo', 'title', 'nombre']) || '').trim();
    const contenido = String(findValue(art, ['contenido', 'content', 'texto', 'texto_completo', 'body']) || '').trim();
    if (!contenido && !titulo) continue;

    const chunk = [
      `[${docHeader}]`,
      numero ? `${numero}${titulo ? ' — ' + titulo : ''}:` : titulo ? `${titulo}:` : '',
      contenido,
    ]
      .filter(Boolean)
      .join('\n')
      .trim();

    if (chunk.length >= 30) chunks.push(chunk.slice(0, 2500));
  }

  return chunks;
}
