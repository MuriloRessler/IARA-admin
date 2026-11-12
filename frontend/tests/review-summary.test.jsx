import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ValidationSummary } from '../src/components/ValidationSummary.jsx';
import { createEmptySchedule } from '../src/services/schedule-model.js';

describe('review summary', () => {
  it('keeps review details compact and expandable while showing blocking errors separately', () => {
    const schedule = createEmptySchedule('Informática', '61 1');
    schedule.dias.segunda = {
      ...schedule.dias.segunda,
      situacao: 'com_aulas',
      revisao: 'nao_revisado',
      periodos: [{ id: 'period-1', inicio: '07:30', revisao: 'nao_revisado' }],
    };
    render(<ValidationSummary
      schedule={schedule}
      validation={{
        valid: false,
        errorCount: 3,
        issues: [
          { day: 'segunda', label: 'SEGUNDA-FEIRA', message: 'Período 1 ainda não foi revisado.' },
          { day: 'segunda', label: 'SEGUNDA-FEIRA', message: 'Dia ainda não foi marcado como revisado.' },
          { day: 'terca', label: 'TERÇA-FEIRA', message: 'Dia com aulas não pode conter compartilhamento.' },
        ],
      }}
    />);

    expect(screen.getByText('Revisão da turma')).toBeInTheDocument();
    expect(screen.getByText(/Dia com aulas não pode conter compartilhamento/)).toBeInTheDocument();
    const disclosure = screen.getByText('Ver detalhes da revisão');
    const details = disclosure.closest('details');
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(disclosure);
    expect(details).toHaveAttribute('open');
    expect(screen.getByText((_, element) => element?.tagName === 'LI' && element.textContent.includes('SEGUNDA-FEIRA: 1 período(s) e dia não revisado'))).toBeInTheDocument();
  });
});
