const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export const getHealth = async () => {
  const response = await fetch(`${apiBaseUrl}/health`);

  if (!response.ok) {
    throw new Error(`Backend responded with HTTP ${response.status}`);
  }

  return response.json();
};
