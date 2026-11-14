const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
async function request(path, accessToken, options = {}) {
  let response;
  try {
    response = await fetch(`${base}/printings${path}`, {
      ...options, signal: options.signal || AbortSignal.timeout(30000), cache: 'no-store',
      headers: { Authorization: `Bearer ${accessToken}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    });
  } catch {
    throw new Error('Não foi possível comunicar com o backend. Atualize a lista antes de tentar novamente.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || (typeof payload.error === 'string' ? payload.error : 'Não foi possível concluir a operação.'));
  return payload;
}
export const listPrintings = (status, page, token, signal) => request(`?status=${status}&page=${page}`, token, { signal });
export const markPrinting = (id, token) => request(`/${id}/printed`, token, { method: 'PATCH', body: JSON.stringify({ confirmed: true }) });
export const downloadPrinting = (id, token) => request(`/${id}/download`, token, { method: 'POST' });
