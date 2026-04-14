/**
 * Servicio de integraciones externas
 * Maneja pruebas de conexión y generación de códigos de registro
 */

export interface IntegrationTestResult {
  success: boolean;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface RegistrationCode {
  service: string;
  code: string;
  instructions: string;
  expiresAt?: Date;
}

/**
 * Prueba conexión a SCOPUS API
 */
export const testScopusConnection = async (apiKey: string): Promise<IntegrationTestResult> => {
  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      message: 'API Key de SCOPUS no proporcionada',
      timestamp: new Date(),
    };
  }

  try {
    const response = await fetch('https://api.elsevier.com/content/search/scopus?query=AUTH(test)&count=1', {
      method: 'GET',
      headers: {
        'X-ELS-APIKey': apiKey.trim(),
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: 'Conexión exitosa con SCOPUS. API Key válida.',
        timestamp: new Date(),
        metadata: {
          resultsFound: data['opensearch:totalResults'] || 0,
        },
      };
    } else if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        message: 'API Key de SCOPUS inválida o expirada (401/403)',
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        message: `Error de SCOPUS: ${response.status} ${response.statusText}`,
        timestamp: new Date(),
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error al conectar con SCOPUS: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date(),
    };
  }
};

/**
 * Prueba conexión a ORCID API
 */
export const testOrcidConnection = async (clientId: string, clientSecret: string): Promise<IntegrationTestResult> => {
  if (!clientId || !clientSecret) {
    return {
      success: false,
      message: 'Client ID o Client Secret de ORCID no proporcionados',
      timestamp: new Date(),
    };
  }

  try {
    // ORCID token endpoint blocks browser CORS for client credentials.
    // In frontend we can only verify service reachability and basic config format.
    const discovery = await fetch('https://orcid.org/.well-known/openid-configuration', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!discovery.ok) {
      return {
        success: false,
        message: `ORCID no respondió correctamente (${discovery.status} ${discovery.statusText})`,
        timestamp: new Date(),
      };
    }

    const hasValidIdFormat = /^APP-[A-Z0-9]{16}$/.test(clientId.trim()) || clientId.trim().length >= 8;
    if (!hasValidIdFormat) {
      return {
        success: false,
        message: 'Client ID de ORCID parece inválido por formato.',
        timestamp: new Date(),
      };
    }

    return {
      success: true,
      message:
        'ORCID accesible. Nota: la validación real de Client Secret requiere backend por política CORS del endpoint oauth/token.',
      timestamp: new Date(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: message.includes('Failed to fetch')
        ? 'Error de red/CORS al consultar ORCID desde navegador. Usa un endpoint backend para validar credenciales.'
        : `Error al conectar con ORCID: ${message}`,
      timestamp: new Date(),
    };
  }
};

/**
 * Prueba conexión a Google Gemini API
 */
export const testGeminiConnection = async (apiKey: string): Promise<IntegrationTestResult> => {
  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      message: 'API Key de Gemini no proporcionada',
      timestamp: new Date(),
    };
  }

  try {
    const sanitizedKey = apiKey.trim();
    if (sanitizedKey.includes(' ') || sanitizedKey.includes('*')) {
      return {
        success: false,
        message: 'La API Key de Gemini tiene caracteres inválidos (espacios o *).',
        timestamp: new Date(),
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${sanitizedKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Test connection',
                },
              ],
            },
          ],
        }),
      },
    );

    if (response.ok) {
      return {
        success: true,
        message: 'Conexión exitosa con Google Gemini. API Key válida.',
        timestamp: new Date(),
      };
    } else if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        message: 'API Key de Gemini inválida o no tiene permisos (401/403)',
        timestamp: new Date(),
      };
    } else {
      let details = '';
      try {
        const errorJson = await response.json();
        details = errorJson?.error?.message ? `: ${errorJson.error.message}` : '';
      } catch {
        // Ignore body parse failures and keep generic message
      }
      return {
        success: false,
        message: `Error de Gemini: ${response.status} ${response.statusText}${details}`,
        timestamp: new Date(),
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error al conectar con Gemini: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date(),
    };
  }
};

/**
 * Prueba conexión a APIFreeLLM
 */
export const testApifreellmConnection = async (apiKey: string): Promise<IntegrationTestResult> => {
  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      message: 'API Key de APIFreeLLM no proporcionada',
      timestamp: new Date(),
    };
  }

  try {
    const response = await fetch('https://api.aimlapi.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
    });

    if (response.ok) {
      return {
        success: true,
        message: 'Conexión exitosa con APIFreeLLM. API Key válida.',
        timestamp: new Date(),
      };
    } else if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        message: 'API Key de APIFreeLLM inválida o expirada (401/403)',
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        message: `Error de APIFreeLLM: ${response.status} ${response.statusText}`,
        timestamp: new Date(),
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error al conectar con APIFreeLLM: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date(),
    };
  }
};

/**
 * Prueba conexión a OpenRouter API
 */
export const testOpenRouterConnection = async (apiKey: string): Promise<IntegrationTestResult> => {
  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      message: 'API Key de OpenRouter no proporcionada',
      timestamp: new Date(),
    };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const total = Array.isArray(data?.data) ? data.data.length : 0;
      return {
        success: true,
        message: 'Conexión exitosa con OpenRouter. API Key válida.',
        timestamp: new Date(),
        metadata: { modelsAvailable: total },
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        message: 'API Key de OpenRouter inválida o sin permisos (401/403)',
        timestamp: new Date(),
      };
    }

    return {
      success: false,
      message: `Error de OpenRouter: ${response.status} ${response.statusText}`,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      success: false,
      message: `Error al conectar con OpenRouter: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date(),
    };
  }
};

/**
 * Genera código de registro para servicios externos
 */
export const generateRegistrationCode = (service: 'scopus' | 'orcid' | 'gemini'): RegistrationCode => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const code = `${service.toUpperCase()}-${timestamp}-${random}`;

  const instructions: Record<string, string> = {
    scopus: `Registro para SCOPUS:
1. Visita https://dev.elsevier.com/
2. Inicia sesión con tu cuenta Elsevier
3. Ve a "My Applications"
4. Crea una nueva aplicación
5. Copia el "API Key" recibido
6. Usa este código como referencia: ${code}`,

    orcid: `Registro para ORCID:
1. Visita https://orcid.org/account
2. Inicia sesión o crea una cuenta
3. Ve a "Integrations" > "Register for API access"
4. Completa el formulario de registro
5. Usa este código como referencia: ${code}
6. Después recibirás Client ID y Client Secret`,

    gemini: `Registro para Google Gemini:
1. Visita https://aistudio.google.com/app/apikey
2. Inicia sesión con tu cuenta Google
3. Haz clic en "Create API key"
4. Selecciona o crea un proyecto
5. Copia la API Key generada
6. Usa este código como referencia: ${code}`,
  };

  return {
    service,
    code,
    instructions: instructions[service] || 'Instrucciones no disponibles',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
  };
};
