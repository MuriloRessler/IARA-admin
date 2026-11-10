import { useMemo } from 'react';
import { formatScheduleText, ScheduleFormatError } from '../services/schedule-format.js';

export function ScheduleTextPreview({ schedule, schedules }) {
  const result = useMemo(() => {
    try {
      return { text: formatScheduleText(schedule, schedules), error: null };
    } catch (error) {
      if (error instanceof ScheduleFormatError) return { text: '', error: error.message };
      return { text: '', error: 'Não foi possível gerar a prévia desta grade.' };
    }
  }, [schedule, schedules]);

  return (
    <section className="panel-card text-preview" aria-labelledby="text-preview-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Formato futuro do banco</p>
          <h2 id="text-preview-title">Prévia da coluna horario</h2>
        </div>
        <span className="panel-note">Somente consulta</span>
      </div>
      {result.error ? <div className="preview-blocked" role="status">{result.error} Resolva as pendências para visualizar o texto final.</div> : <pre>{result.text}</pre>}
    </section>
  );
}
