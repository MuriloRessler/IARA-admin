import { getApiBaseUrl } from '../config/runtime.js';

export const getCurrentAdmin = async (accessToken) => {
  const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = new Error(`Authorization failed with HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
};

export const importHtmlSchedules = async (file, accessToken) => {
  const body = new FormData();
  body.append('file', file);
  let response;
  try {
    response = await fetch(`${getApiBaseUrl()}/schedules/import-html`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });
  } catch (error) {
    const communicationError = new Error('Não foi possível comunicar com o backend durante a importação HTML. Verifique se o servidor está em execução e tente novamente.');
    communicationError.cause = error;
    communicationError.code = 'BACKEND_UNREACHABLE';
    throw communicationError;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : payload.error?.message;
    const error = new Error(message || `A importação HTML falhou (HTTP ${response.status}).`);
    error.status = response.status;
    error.code = payload.error?.code;
    throw error;
  }
  return payload;
};

const PUBLICATION_TIMEOUT_MS = 30000;

const publicationRequest = async (path, accessToken, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PUBLICATION_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${getApiBaseUrl()}/schedules/publication/${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    const communicationError = new Error(timedOut
      ? 'A operação de publicação excedeu o tempo limite. Consulte o estado do banco antes de tentar novamente.'
      : 'Não foi possível comunicar com o backend durante a operação de publicação. Verifique se o servidor está em execução.');
    communicationError.code = timedOut ? 'PUBLICATION_TIMEOUT' : 'BACKEND_UNREACHABLE';
    communicationError.cause = error;
    throw communicationError;
  } finally {
    clearTimeout(timeoutId);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || `A operação de publicação falhou (HTTP ${response.status}).`);
    error.status = response.status;
    error.code = payload.error?.code;
    error.details = payload.error?.details;
    throw error;
  }
  return payload;
};

export const previewPublication = (schedules, accessToken) => publicationRequest('preview', accessToken, {
  method: 'POST',
  body: JSON.stringify({ schedules }),
});

export const getPublicationBackup = (accessToken) => publicationRequest('backup', accessToken);

export const publishSchedules = (payload, accessToken) => publicationRequest('publish', accessToken, {
  method: 'POST',
  body: JSON.stringify(payload),
});
