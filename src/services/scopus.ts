import { ScopusResult, Produccion } from '../types';
import { SCOPUS_CONFIG } from '../constants';

const SCOPUS_API_KEY_STORAGE_KEYS = ['meritx.scopusApiKey', 'scopusApiKey'];

const resolveScopusApiKey = (providedKey?: string): string => {
  const fromArg = (providedKey || '').trim();
  if (fromArg) return fromArg;

  const fromEnv = (SCOPUS_CONFIG.apiKey || '').trim();
  if (fromEnv) return fromEnv;

  if (typeof window !== 'undefined') {
    for (const key of SCOPUS_API_KEY_STORAGE_KEYS) {
      const stored = (window.localStorage.getItem(key) || '').trim();
      if (stored) return stored;
    }
  }

  return '';
};

export type ImportedScopusProduction = {
  titulo: string;
  cuartil: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  fecha: string;
  tipo: string;
  autores: number;
  fuente: 'SCOPUS';
};

const QUARTILE_VALUES: Array<'Q1' | 'Q2' | 'Q3' | 'Q4'> = ['Q1', 'Q2', 'Q3', 'Q4'];

const extractScopusQuery = (profileInput: string): string => {
  const input = profileInput.trim();

  // ORCID format: 0000-0000-0000-0000
  if (/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(input)) {
    return `ORCID(${input})`;
  }

  // SCOPUS profile URLs often include authorId query param.
  const authorIdMatch = input.match(/authorId=(\d+)/i) || input.match(/au-id\/(\d+)/i);
  if (authorIdMatch?.[1]) {
    return `AU-ID(${authorIdMatch[1]})`;
  }

  // Plain numeric inputs are treated as Scopus Author ID.
  if (/^\d{7,14}$/.test(input)) {
    return `AU-ID(${input})`;
  }

  // Fallback: search by author string.
  return `AUTH(${input})`;
};

const findQuartileText = (value: unknown): 'Q1' | 'Q2' | 'Q3' | 'Q4' | null => {
  if (typeof value === 'string') {
    const match = value.toUpperCase().match(/\bQ[1-4]\b/);
    if (match) {
      return match[0] as 'Q1' | 'Q2' | 'Q3' | 'Q4';
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const detected = findQuartileText(item);
      if (detected) return detected;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) {
      const detected = findQuartileText(nested);
      if (detected) return detected;
    }
  }

  return null;
};

const quartileFromCitationCount = (count: number): 'Q1' | 'Q2' | 'Q3' | 'Q4' => {
  if (count >= 60) return 'Q1';
  if (count >= 25) return 'Q2';
  if (count >= 8) return 'Q3';
  return 'Q4';
};

const resolveQuartileFromSerial = async (
  apiKey: string,
  sourceId?: string,
  issn?: string,
): Promise<'Q1' | 'Q2' | 'Q3' | 'Q4' | null> => {
  const params = sourceId
    ? `source_id=${encodeURIComponent(sourceId)}`
    : issn
      ? `issn=${encodeURIComponent(issn)}`
      : '';

  if (!params) return null;

  try {
    const response = await fetch(`${SCOPUS_CONFIG.baseUrl}/content/serial/title?${params}`, {
      headers: {
        'X-ELS-APIKey': apiKey,
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;
    const serialData = await response.json();
    return findQuartileText(serialData);
  } catch {
    return null;
  }
};

export const importScopusProduccion = async (
  profileInput: string,
  apiKey: string,
  count = 10,
): Promise<ImportedScopusProduction[]> => {
  const effectiveApiKey = resolveScopusApiKey(apiKey);

  if (!effectiveApiKey) {
    throw new Error('No se encontró API Key de SCOPUS. Configúrala en Panel Admin > Configuración de API y guarda cambios.');
  }

  if (!profileInput.trim()) {
    throw new Error('Ingresa un identificador de autor SCOPUS, ORCID o nombre del profesor.');
  }

  const scopusQuery = extractScopusQuery(profileInput);
  const encodedQuery = encodeURIComponent(scopusQuery);

  const response = await fetch(
    `${SCOPUS_CONFIG.baseUrl}/content/search/scopus?query=${encodedQuery}&count=${count}&view=COMPLETE`,
    {
      headers: {
        'X-ELS-APIKey': effectiveApiKey,
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('La API Key de SCOPUS es inválida o no tiene permisos.');
    }
    throw new Error(`Error consultando SCOPUS (${response.status} ${response.statusText}).`);
  }

  const data = await response.json();
  const entries = (data?.['search-results']?.entry || []) as Array<Record<string, any>>;
  if (entries.length === 0) return [];

  const serialCache = new Map<string, 'Q1' | 'Q2' | 'Q3' | 'Q4' | null>();

  const imported = await Promise.all(
    entries.map(async (entry): Promise<ImportedScopusProduction> => {
      const sourceId = String(entry['source-id'] || '').trim();
      const issn = String(entry['prism:issn'] || '').trim();
      const cacheKey = sourceId || issn;

      const citedBy = Number.parseInt(String(entry['citedby-count'] || '0'), 10) || 0;

      let quartile = findQuartileText(entry);

      if (!quartile && cacheKey) {
        if (!serialCache.has(cacheKey)) {
          serialCache.set(cacheKey, await resolveQuartileFromSerial(effectiveApiKey, sourceId || undefined, issn || undefined));
        }
        quartile = serialCache.get(cacheKey) || null;
      }

      const normalizedQuartile = quartile && QUARTILE_VALUES.includes(quartile) ? quartile : quartileFromCitationCount(citedBy);

      return {
        titulo: entry['dc:title'] || 'Sin título',
        cuartil: normalizedQuartile,
        fecha: String(entry['prism:coverDate'] || '').split('-')[0] || String(new Date().getFullYear()),
        tipo: entry['subtypeDescription'] || 'Artículo',
        autores: Number.parseInt(String(entry['author-count'] || '1'), 10) || 1,
        fuente: 'SCOPUS',
      };
    }),
  );

  return imported;
};

/**
 * Authenticate with Scopus API
 * Documentation: https://api.elsevier.com/authenticate
 */
export const authenticateScopus = async (apiKey: string): Promise<boolean> => {
  try {
    const response = await fetch(`${SCOPUS_CONFIG.baseUrl}/authenticate`, {
      method: 'GET',
      headers: {
        'X-ELS-APIKey': apiKey,
        Accept: 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Error authenticating with Scopus:', error);
    return false;
  }
};

/**
 * Search for publications in Scopus by author
 */
export const searchScopusByAuthor = async (
  authorName: string,
  apiKey: string
): Promise<Produccion[]> => {
  try {
    const query = `AUTH("${authorName}")`;
    const encodedQuery = encodeURIComponent(query);

    const response = await fetch(
      `${SCOPUS_CONFIG.baseUrl}/content/search/scopus?query=${encodedQuery}&count=20`,
      {
        headers: {
          'X-ELS-APIKey': apiKey,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) throw new Error('Failed to search Scopus');
    const data = await response.json();

    // Transform Scopus results to Produccion format
    const results: Produccion[] = data['search-results']?.entry?.map(
      (entry: any) => ({
        id: parseInt(entry['dc:identifier']?.split(':')[1] || '0'),
        titulo: entry['dc:title'] || 'Untitled',
        cuartil: getQuartileFromSJR(entry['source-meta']?.['citescore-yearly-values']) || 'Q2',
        fecha: entry['prism:coverDate']?.split('-')[0] || new Date().getFullYear().toString(),
        source: 'Scopus',
      })
    ) || [];

    return results;
  } catch (error) {
    console.error('Error searching Scopus:', error);
    return [];
  }
};

/**
 * Search for publications in Scopus by ORCID
 */
export const searchScopusByOrcid = async (
  orcid: string,
  apiKey: string
): Promise<Produccion[]> => {
  try {
    const query = `ORCID("${orcid}")`;
    const encodedQuery = encodeURIComponent(query);

    const response = await fetch(
      `${SCOPUS_CONFIG.baseUrl}/content/search/scopus?query=${encodedQuery}&count=20`,
      {
        headers: {
          'X-ELS-APIKey': apiKey,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) throw new Error('Failed to search Scopus by ORCID');
    const data = await response.json();

    const results: Produccion[] = data['search-results']?.entry?.map(
      (entry: any) => ({
        id: parseInt(entry['dc:identifier']?.split(':')[1] || '0'),
        titulo: entry['dc:title'] || 'Untitled',
        cuartil: getQuartileFromSJR(entry['source-meta']?.['citescore-yearly-values']) || 'Q2',
        fecha: entry['prism:coverDate']?.split('-')[0] || new Date().getFullYear().toString(),
        source: 'Scopus',
      })
    ) || [];

    return results;
  } catch (error) {
    console.error('Error searching Scopus by ORCID:', error);
    return [];
  }
};

/**
 * Get journal rank information
 */
export const getJournalRank = async (issn: string, apiKey: string): Promise<string | null> => {
  try {
    const response = await fetch(
      `${SCOPUS_CONFIG.baseUrl}/content/serial/title?issn=${issn}`,
      {
        headers: {
          'X-ELS-APIKey': apiKey,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) throw new Error('Failed to get journal rank');
    const data = await response.json();

    return getQuartileFromSJR(data['serial-metadata-response']?.['entry']) || null;
  } catch (error) {
    console.error('Error getting journal rank:', error);
    return null;
  }
};

/**
 * Extract quartile from SJR (Scimago Journal Rank) data
 */
const getQuartileFromSJR = (sjrData: any): string | null => {
  if (!sjrData) return null;

  // SJR data structure varies, this is a basic implementation
  if (typeof sjrData === 'object' && 'sjr-value' in sjrData) {
    const sjrValue = parseFloat(sjrData['sjr-value']);
    if (sjrValue >= 0.75) return 'Q1';
    if (sjrValue >= 0.5) return 'Q2';
    if (sjrValue >= 0.25) return 'Q3';
    return 'Q4';
  }

  return null;
};

/**
 * Mock Scopus data fetch for development
 */
export const fetchScopusDataMock = (): Produccion[] => {
  return [
    {
      id: 1,
      titulo: 'Citation patterns in Latin American universities',
      cuartil: 'Q2',
      fecha: '2023',
      source: 'Scopus',
    },
    {
      id: 2,
      titulo: 'Excellence metrics in higher education systems',
      cuartil: 'Q1',
      fecha: '2022',
      source: 'Scopus',
    },
  ];
};
