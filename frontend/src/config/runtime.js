const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export const apiBaseUrl = configuredApiBaseUrl || (import.meta.env.DEV ? 'http://localhost:3001/api' : '');

export function getApiBaseUrl() {
  if (apiBaseUrl) return apiBaseUrl;

  const error = new Error('A URL da API não foi configurada para este ambiente. Defina VITE_API_BASE_URL e gere o build novamente.');
  error.code = 'API_CONFIGURATION_ERROR';
  throw error;
}
