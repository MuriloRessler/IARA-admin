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

export const extractSchedules = async (file, course, accessToken) => {
  const body = new FormData();
  body.append('file', file);
  body.append('course', course);
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
