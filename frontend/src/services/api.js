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
  const response = await fetch(`${apiBaseUrl}/schedules/extract`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || `Extraction failed with HTTP ${response.status}`);
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
