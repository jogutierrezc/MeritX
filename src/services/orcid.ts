import { Produccion, OrcidProfile, OrcidWork } from '../types';
import { ORCID_CONFIG } from '../constants';

/**
 * Get ORCID authorization URL for OAuth flow
 */
export const getOrcidAuthUrl = (redirectUri: string = ORCID_CONFIG.redirectUri): string => {
  const params = new URLSearchParams({
    client_id: ORCID_CONFIG.clientId,
    response_type: 'code',
    scope: ORCID_CONFIG.scope,
    redirect_uri: redirectUri,
  });

  return `${ORCID_CONFIG.authorizationEndpoint}?${params.toString()}`;
};

/**
 * Exchange authorization code for access token
 * This should be handled by your backend for security reasons
 */
export const exchangeOrcidCode = async (
  code: string,
  redirectUri: string = ORCID_CONFIG.redirectUri
): Promise<{ access_token: string; orcid: string } | null> => {
  try {
    // This call should be made from your backend to avoid exposing the client secret
    const response = await fetch('/api/orcid/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) throw new Error('Failed to exchange code');
    return response.json();
  } catch (error) {
    console.error('Error exchanging ORCID code:', error);
    return null;
  }
};

/**
 * Fetch ORCID profile data using access token
 */
export const fetchOrcidProfile = async (accessToken: string, orcid: string): Promise<OrcidProfile | null> => {
  try {
    const response = await fetch(`https://orcid.org/v3.0/${orcid}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) throw new Error('Failed to fetch ORCID profile');
    return response.json();
  } catch (error) {
    console.error('Error fetching ORCID profile:', error);
    return null;
  }
};

/**
 * Fetch ORCID works (publications/research)
 */
export const fetchOrcidWorks = async (
  accessToken: string,
  orcid: string
): Promise<Produccion[]> => {
  try {
    const response = await fetch(`https://orcid.org/v3.0/${orcid}/works`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) throw new Error('Failed to fetch ORCID works');
    const data = await response.json();

    // Transform ORCID works to Produccion format
    // Note: ORCID doesn't provide quartile directly, this would need to be enriched
    const works: Produccion[] = data.group?.map((workGroup: any) => {
      const work = workGroup['work-summary'][0];
      return {
        id: work['put-code'],
        titulo: work.title?.title?.value || 'Untitled',
        cuartil: 'Q2', // Default, should be enriched with external data
        fecha: work['publication-date']?.year?.value || new Date().getFullYear().toString(),
        source: 'ORCID Record',
      };
    }) || [];

    return works;
  } catch (error) {
    console.error('Error fetching ORCID works:', error);
    return [];
  }
};

/**
 * Mock ORCID data fetch for development
 */
export const fetchOrcidDataMock = (): Produccion[] => {
  return [
    {
      id: 1,
      titulo: 'Democracia, gobernanza y populismo',
      cuartil: 'Q1',
      fecha: '2021',
      source: 'ORCID Record',
    },
    {
      id: 2,
      titulo: 'Políticas Públicas en el contexto UDES',
      cuartil: 'Q2',
      fecha: '2023',
      source: 'ORCID Record',
    },
    {
      id: 3,
      titulo: 'Investigación socio-jurídica en Santander',
      cuartil: 'Q1',
      fecha: '2022',
      source: 'ORCID Record',
    },
  ];
};
