const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export const getHealth = async () => {
  const response = await fetch(`${apiBaseUrl}/health`);

  if (!response.ok) {
    throw new Error(`Backend responded with HTTP ${response.status}`);
  }

  return response.json();
};

export const getCurrentAdmin = async (accessToken) => {
  const response = await fetch(`${apiBaseUrl}/auth/me`, {
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

export const extractSchedules = async (file, course, accessToken, calibration = null) => {
  const body = new FormData();
  body.append('file', file);
  body.append('course', course);
  if (calibration) body.append('calibration', JSON.stringify(calibration));
  let response;
  try {
    response = await fetch(`${apiBaseUrl}/schedules/extract`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });
  } catch (error) {
    const communicationError = new Error('Não foi possível comunicar com o backend durante a extração. Verifique se o servidor está em execução e tente novamente.');
    communicationError.cause = error;
    communicationError.code = 'BACKEND_UNREACHABLE';
    throw communicationError;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : payload.error?.message;
    const error = new Error(message || `A extração falhou (HTTP ${response.status}).`);
    error.status = response.status;
    error.code = payload.error?.code;
    throw error;
  }
  return payload;
};

export const importHtmlSchedules = async (file, accessToken) => {
  const body = new FormData();
  body.append('file', file);
  let response;
  try {
    response = await fetch(`${apiBaseUrl}/schedules/import-html`, {
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

export const getCellPreview = async (file, page, bbox, accessToken) => {
  const body = new FormData();
  body.append('file', file);
  body.append('page', String(page));
  body.append('bbox', JSON.stringify(bbox));
  const response = await fetch(`${apiBaseUrl}/schedules/cell-preview`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || `Cell preview failed with HTTP ${response.status}`);
  }
  return URL.createObjectURL(await response.blob());
};

const publicationRequest = async (path, accessToken, options = {}) => {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}/schedules/publication/${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    const communicationError = new Error('Não foi possível comunicar com o backend durante a operação de publicação. Verifique se o servidor está em execução.');
    communicationError.code = 'BACKEND_UNREACHABLE';
    communicationError.cause = error;
    throw communicationError;
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
