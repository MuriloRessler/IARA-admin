import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicationPanel } from '../src/components/PublicationPanel.jsx';
import { getPublicationBackup, previewPublication, publishSchedules } from '../src/services/api.js';

vi.mock('../src/services/api.js', () => ({
  getPublicationBackup: vi.fn(),
  previewPublication: vi.fn(),
  publishSchedules: vi.fn(),
}));

const preview = {
  publicationAvailable: true,
  publicationVersion: 'preview-version',
  database: { available: true, currentChecksum: 'current-checksum', legacyRecords: 0 },
  summary: { turmas: 49, cursos: 8, aulasProprias: 10, aulasCompartilhadas: 2, alteracoesManuais: 1, registrosCriados: 48, registrosAtualizados: 1, registrosInalterados: 0 },
  records: [{ turma: '61 1', curso: 'Informática', horario: 'TURMA: 61 1\nSEGUNDA-FEIRA\n07:30 - Matemática' }],
  changes: { created: [{ after: { turma: '61 1' } }], updated: [], unchanged: [] },
  issues: [],
  warnings: [],
};

describe('publication panel', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:backup');
    URL.revokeObjectURL = vi.fn();
  });

  it('shows the preview, downloads a backup and requires final confirmation before publishing', async () => {
    previewPublication.mockResolvedValue(preview);
    getPublicationBackup.mockResolvedValue({ exportedAt: '2026-11-11T12:00:00.000Z', recordsChecksum: 'backup-checksum', records: [] });
    publishSchedules.mockResolvedValue({ success: true, publishedAt: '2026-11-11T12:01:00.000Z', summary: { turmas: 49, registrosCriados: 48, registrosAtualizados: 1, registrosInalterados: 0 } });
    render(<PublicationPanel schedules={{ sample: { curso: 'Informática', turma: '61 1' } }} courses={[{ name: 'Informática', classes: ['61 1'] }]} accessToken="token" />);

    fireEvent.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    await waitFor(() => expect(screen.getByText('Prévia gerada. Nenhum registro foi alterado.')).toBeInTheDocument());
    expect(screen.getByText(/TURMA: 61 1/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Baixar backup dos horários atuais' }));
    await waitFor(() => expect(getPublicationBackup).toHaveBeenCalledWith('token'));
    fireEvent.click(screen.getByRole('button', { name: 'Publicar horários no Supabase' }));
    expect(screen.getByRole('heading', { name: 'Confirmar publicação' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e publicar' }));
    await waitFor(() => expect(publishSchedules).toHaveBeenCalled());
    expect(screen.getByText('Publicação concluída e verificada no Supabase.')).toBeInTheDocument();
  });

  it('shows a backend error without discarding the editor state', async () => {
    previewPublication.mockRejectedValue(new Error('A publicação está indisponível.'));
    render(<PublicationPanel schedules={{ sample: {} }} courses={[]} accessToken="token" />);
    fireEvent.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('A publicação está indisponível.'));
  });
});
