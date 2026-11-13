export const SCHEDULE_TEXT_DAYS = [
  ['segunda', 'SEGUNDA-FEIRA'],
  ['terca', 'TERÇA-FEIRA'],
  ['quarta', 'QUARTA-FEIRA'],
  ['quinta', 'QUINTA-FEIRA'],
  ['sexta', 'SEXTA-FEIRA'],
];

const timeToMinutes = (value) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
};

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

export const hasPeriodData = (period) => Boolean(period
  && (hasText(period.disciplina) || hasText(period.professor) || hasText(period.sala) || hasText(period.textoOriginal)));

export const isPublishablePeriod = (period) => Boolean(period
  && hasPeriodData(period)
  && (period.estado !== 'vazio_documento'
    || period.manualOverride
    || period.compartilhamentoStatus === 'substituida'
    || period.origemEdicao === 'manual'));

export const getPublishablePeriods = (periods = []) => periods
  .filter(isPublishablePeriod)
  .slice()
  .sort((left, right) => timeToMinutes(left.inicio) - timeToMinutes(right.inicio));

export const formatSchedulePeriod = (period) => {
  const details = [period.professor && `Professor: ${period.professor}`, period.sala && `Sala: ${period.sala}`]
    .filter(Boolean)
    .join(' | ');
  return `${period.inicio} - ${period.disciplina}${details ? ` | ${details}` : ''}`;
};

export const formatScheduleText = ({ schedule, resolveDay }) => {
  const lines = [`TURMA: ${schedule.turma}`, '', `CURSO: ${schedule.curso}`];
  for (const [dayKey, label] of SCHEDULE_TEXT_DAYS) {
    const day = schedule.dias?.[dayKey];
    if (!day || day.situacao === 'sem_aulas') continue;
    const effective = resolveDay(dayKey, day);
    const periods = getPublishablePeriods(effective?.periods || []);
    if (!periods.length) continue;
    lines.push('', label, ...periods.map(formatSchedulePeriod));
  }
  return lines.join('\n');
};

const TECHNICAL_PLACEHOLDERS = [
  /^POSIÇÃO (?:\d+|\?): CÉLULA VAZIA NO DOCUMENTO$/,
  /^DIA NÃO CONFIGURADO$/,
  /^PERÍODO NÃO RETORNADO$/,
];

export const findScheduleTextPlaceholders = (text) => String(text || '')
  .split('\n')
  .filter((line) => TECHNICAL_PLACEHOLDERS.some((pattern) => pattern.test(line.trim())));
