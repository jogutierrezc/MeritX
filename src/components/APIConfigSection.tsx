import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Loader, Copy, Eye, EyeOff, Zap } from 'lucide-react';
import type { ApiConfig } from '../types/config';
import {
  testScopusConnection,
  testOrcidConnection,
  testGeminiConnection,
  testApifreellmConnection,
  testOpenRouterConnection,
  generateRegistrationCode,
  type IntegrationTestResult,
  type RegistrationCode,
} from '../services/integrations';

interface Props {
  apiConfig: ApiConfig;
  onUpdateApiConfig: (config: ApiConfig) => void;
}

export const APIConfigSection: React.FC<Props> = ({ apiConfig, onUpdateApiConfig }) => {
  const [testResults, setTestResults] = useState<Record<string, IntegrationTestResult>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [showRegistration, setShowRegistration] = useState<string | null>(null);
  const [registrationCode, setRegistrationCode] = useState<RegistrationCode | null>(null);
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});

  const testConnections = {
    geminiApiKey: async () => {
      setTesting((p) => ({ ...p, geminiApiKey: true }));
      const result = await testGeminiConnection(apiConfig.geminiApiKey);
      setTestResults((p) => ({ ...p, geminiApiKey: result }));
      setTesting((p) => ({ ...p, geminiApiKey: false }));
    },
    apifreellmApiKey: async () => {
      setTesting((p) => ({ ...p, apifreellmApiKey: true }));
      const result = await testApifreellmConnection(apiConfig.apifreellmApiKey);
      setTestResults((p) => ({ ...p, apifreellmApiKey: result }));
      setTesting((p) => ({ ...p, apifreellmApiKey: false }));
    },
    openrouterApiKey: async () => {
      setTesting((p) => ({ ...p, openrouterApiKey: true }));
      const result = await testOpenRouterConnection(apiConfig.openrouterApiKey);
      setTestResults((p) => ({ ...p, openrouterApiKey: result }));
      setTesting((p) => ({ ...p, openrouterApiKey: false }));
    },
    scopusApiKey: async () => {
      setTesting((p) => ({ ...p, scopusApiKey: true }));
      const result = await testScopusConnection(apiConfig.scopusApiKey);
      setTestResults((p) => ({ ...p, scopusApiKey: result }));
      setTesting((p) => ({ ...p, scopusApiKey: false }));
    },
    orcid: async () => {
      setTesting((p) => ({ ...p, orcid: true }));
      const result = await testOrcidConnection(apiConfig.orcidClientId, apiConfig.orcidClientSecret);
      setTestResults((p) => ({ ...p, orcid: result }));
      setTesting((p) => ({ ...p, orcid: false }));
    },
  };

  const handleGenerateCode = (service: 'scopus' | 'orcid' | 'gemini') => {
    const code = generateRegistrationCode(service);
    setRegistrationCode(code);
    setShowRegistration(service);
  };

  const toggleFieldVisibility = (field: string) => {
    setVisibleFields((p) => ({ ...p, [field]: !p[field] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Código copiado al portapapeles');
  };

  const APIField = ({
    field,
    label,
    showRegistrationBtn = false,
    testFn = null,
    orcidSpecial = false,
  }: {
    field: string;
    label: string;
    showRegistrationBtn?: boolean;
    testFn?: (() => Promise<void>) | null;
    orcidSpecial?: boolean;
  }) => {
    const value = orcidSpecial ? null : apiConfig[field as keyof ApiConfig];
    const result = testResults[orcidSpecial ? 'orcid' : field];
    const isLoading = testing[orcidSpecial ? 'orcid' : field];
    const isVisible = visibleFields[field];

    return (
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black uppercase tracking-widest text-slate-600">{label}</label>
          <div className="flex items-center gap-2">
            {result && (
              <div className="flex items-center gap-1 text-xs font-bold">
                {result.success ? (
                  <CheckCircle2 size={14} className="text-green-600" />
                ) : (
                  <AlertCircle size={14} className="text-red-600" />
                )}
                <span className={result.success ? 'text-green-600' : 'text-red-600'}>
                  {result.success ? 'Conectado' : 'Error'}
                </span>
              </div>
            )}
          </div>
        </div>

        {orcidSpecial ? (
          <div className="space-y-2">
            <div className="relative">
              <input
                type={isVisible ? 'text' : 'password'}
                value={apiConfig.orcidClientId}
                onChange={(e) => onUpdateApiConfig({ ...apiConfig, orcidClientId: e.target.value })}
                placeholder="Client ID"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-xs outline-none transition-all focus:border-blue-500"
              />
              <button
                onClick={() => toggleFieldVisibility('orcidClientId')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
            <div className="relative">
              <input
                type={isVisible ? 'text' : 'password'}
                value={apiConfig.orcidClientSecret}
                onChange={(e) => onUpdateApiConfig({ ...apiConfig, orcidClientSecret: e.target.value })}
                placeholder="Client Secret"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-xs outline-none transition-all focus:border-blue-500"
              />
              <button
                onClick={() => toggleFieldVisibility('orcidClientSecret')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <input
              type={isVisible ? 'text' : 'password'}
              value={value ?? ''}
              onChange={(e) => onUpdateApiConfig({ ...apiConfig, [field]: e.target.value })}
              placeholder="••••••••••••••••"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-xs outline-none transition-all focus:border-blue-500"
            />
            <button
              onClick={() => toggleFieldVisibility(field)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {testFn && (
            <button
              onClick={testFn}
              disabled={isLoading}
              className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-60"
            >
              {isLoading ? (
                <Loader size={12} className="animate-spin" />
              ) : (
                <Zap size={12} />
              )}
              Probar
            </button>
          )}
          {showRegistrationBtn && (
            <button
              onClick={() => handleGenerateCode(field as 'scopus' | 'orcid' | 'gemini')}
              className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
            >
              Código de registro
            </button>
          )}
        </div>

        {result && !result.success && (
          <p className="text-xs text-red-600 font-medium">{result.message}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl">
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-sm font-semibold text-blue-900">
            💡 Prueba la conexión de cada servicio y genera códigos de registro si es necesario.
          </p>
        </div>

        <APIField
          field="geminiApiKey"
          label="Google Gemini API Key"
          testFn={testConnections.geminiApiKey}
          showRegistrationBtn={true}
        />

        <APIField
          field="apifreellmApiKey"
          label="APIFreeLLM API Key"
          testFn={testConnections.apifreellmApiKey}
        />

        <APIField
          field="openrouterApiKey"
          label="OpenRouter API Key"
          testFn={testConnections.openrouterApiKey}
        />

        <APIField
          field="scopusApiKey"
          label="SCOPUS API Key"
          testFn={testConnections.scopusApiKey}
          showRegistrationBtn={true}
        />

        <APIField
          field="ORCID"
          label="ORCID Credentials"
          testFn={testConnections.orcid}
          orcidSpecial={true}
          showRegistrationBtn={true}
        />
      </div>

      {registrationCode && showRegistration && (
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-amber-900">Código de Registro: {showRegistration.toUpperCase()}</h3>
            <button
              onClick={() => setShowRegistration(null)}
              className="text-amber-600 hover:text-amber-800"
            >
              ✕
            </button>
          </div>

          <div className="rounded-lg bg-white p-4 mb-4 font-mono text-sm text-slate-800 border border-amber-200">
            {registrationCode.code}
          </div>

          <button
            onClick={() => copyToClipboard(registrationCode.code)}
            className="flex items-center gap-2 mb-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"
          >
            <Copy size={16} /> Copiar código
          </button>

          <div className="whitespace-pre-wrap rounded-lg bg-slate-100 p-4 text-xs text-slate-700 overflow-x-auto">
            {registrationCode.instructions}
          </div>

          <p className="mt-3 text-xs text-amber-800 font-medium">
            Este código expira el {registrationCode.expiresAt?.toLocaleDateString('es-CO')}
          </p>
        </div>
      )}
    </div>
  );
};
