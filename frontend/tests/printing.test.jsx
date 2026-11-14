import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PrintingPage } from '../src/pages/PrintingPage.jsx';
import { listPrintings, markPrinting } from '../src/services/printing-api.js';
vi.mock('../src/services/printing-api.js', () => ({ listPrintings: vi.fn(), markPrinting: vi.fn(), downloadPrinting: vi.fn() }));
const record = { id: '123', nome: 'Maria', numero: '51999999999', data: null, impresso: false, hasFile: false };
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  listPrintings.mockResolvedValue({ records: [record], total: 1, pageSize: 25 });
  markPrinting.mockResolvedValue({ impresso: true });
});
it('renders optional metadata and switches to history', async () => {
  render(<PrintingPage accessToken="token" />);
  expect(await screen.findByText('Maria')).toBeInTheDocument();
  expect(screen.getByText('Data não informada')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Baixar arquivo' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Histórico' }));
  await waitFor(() => expect(listPrintings).toHaveBeenLastCalledWith('printed', 1, 'token', expect.any(AbortSignal)));
});
it('requires confirmation and refreshes only after a successful update', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<PrintingPage accessToken="token" />);
  const button = await screen.findByRole('button', { name: 'Marcar como impresso' });
  fireEvent.click(button);
  expect(markPrinting).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(button);
  await waitFor(() => expect(markPrinting).toHaveBeenCalledWith('123', 'token'));
  expect(await screen.findByText(/Solicitação marcada como impressa/)).toBeInTheDocument();
  confirm.mockRestore();
});
it('shows schema errors and allows retry', async () => {
  listPrintings.mockRejectedValueOnce(new Error('Verifique public.impressoes.'));
  render(<PrintingPage accessToken="token" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Verifique public.impressoes.');
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista' }));
  expect(await screen.findByText('Maria')).toBeInTheDocument();
});
