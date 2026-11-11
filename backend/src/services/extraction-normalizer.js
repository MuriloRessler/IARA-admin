import { getCourse } from '../config/courses.js';
import { auditDayPositions, summarizeExtractionAudit } from './extraction-audit.js';
import { detectScheduleProfile, getPositionStart } from './schedule-rules.js';

const DAYS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
const DAY_LABELS = { segunda: 'Segunda-feira', terca: 'Terça-feira', quarta: 'Quarta-feira', quinta: 'Quinta-feira', sexta: 'Sexta-feira' };
const normalizeText = (value) => value?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim() || '';
const validTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '');
const warning = (message, page = null) => ({ id: `${Date.now()}-${Math.random()}`, message, page, resolvido: false });
const safeId = (value) => normalizeText(value).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

const createSchedule = (course, classCode, association) => ({
  curso: course,
  turma: classCode,
  origem: 'extracao',
  revisao: 'nao_revisado',
  avisos: [],
  associacaoTurma: association || { regiao: null, confianca: 'nao_identificada' },
  dias: Object.fromEntries(DAYS.map((day) => [day, { situacao: 'pendente', periodos: [], compartilhamento: null, revisao: 'nao_revisado', avisos: [] }])),
});

export const resolveExtractedClass = (value, course) => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return null;
  const matches = course.classes.filter((classCode) => {
    const normalizedClass = normalizeText(classCode);
    return normalizedValue === normalizedClass || normalizedValue.endsWith(` ${normalizedClass}`) || normalizedValue.includes(` ${normalizedClass} `);
  });
  return matches.length === 1 ? matches[0] : null;
};

const resolveState = (rawPosition) => {
  if (['reconhecido', 'vazio_documento', 'nao_reconhecido', 'parcial'].includes(rawPosition.estado)) return rawPosition.estado;
  if (rawPosition.statusCelula === 'vazia') return 'vazio_documento';
  if (rawPosition.statusCelula === 'ilegivel') return 'parcial';
  return rawPosition.disciplina ? 'reconhecido' : 'nao_reconhecido';
};

const expandAssociatedPositions = (rawPositions, profile) => rawPositions.flatMap((rawPosition) => {
  const associated = [...new Set((rawPosition.posicoesAssociadas || []).filter((position) => Number.isInteger(position)))];
  if (associated.length <= 1 || !profile) {
    return [{ ...rawPosition, _blockWarning: associated.length > 1 ? 'Bloco visual não dividido automaticamente: o perfil de horários não foi confirmado.' : null }];
  }
  return associated.map((position) => ({
    ...rawPosition,
    posicao: position,
    inicio: getPositionStart(profile, position) || rawPosition.inicio,
    inicioOrigem: 'perfil_confirmado',
    posicoesAssociadas: [position],
    origemNormalizacao: 'divisao_estrutural',
  }));
});

const hasPotentialGroupedInterval = (rawPosition, profile) => {
  if (rawPosition.posicoesAssociadas?.length || !validTime(rawPosition.inicio) || !validTime(rawPosition.fim)) return false;
  const [startHour, startMinute] = rawPosition.inicio.split(':').map(Number);
  const [endHour, endMinute] = rawPosition.fim.split(':').map(Number);
  const duration = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (!profile) return duration >= 100;
  const startIndex = profile.starts.indexOf(rawPosition.inicio);
  const endIndex = profile.starts.indexOf(rawPosition.fim);
  const effectiveEndIndex = endIndex;
  return startIndex >= 0 && effectiveEndIndex - startIndex >= 2;
};

const normalizeDay = ({ rawDay = {}, dayKey, profile, scheduleId }) => {
  const rawPositions = rawDay.posicoes || rawDay.periodos || [];
  const periods = expandAssociatedPositions(rawPositions, profile).map((rawPosition, index) => {
    const position = Number.isInteger(rawPosition.posicao) ? rawPosition.posicao : index + 1;
    const estado = resolveState(rawPosition);
    const inicio = validTime(rawPosition.inicio) ? rawPosition.inicio : '';
    const period = {
      id: `extracted-${scheduleId}-${dayKey}-${position}-${index}`,
      posicao: position,
      estado,
      inicio,
      disciplina: rawPosition.disciplina || '',
      professor: rawPosition.professor || '',
      sala: rawPosition.sala || '',
      paginaFonte: rawPosition.pagina || null,
      incertezas: rawPosition.incertezas || [],
      bbox: rawPosition.bbox || null,
      textoOriginal: rawPosition.textoOriginal || '',
      inicioOrigem: rawPosition.inicioOrigem || (inicio ? 'documento' : null),
      revisao: 'nao_revisado',
      origemEdicao: rawPosition.origemNormalizacao ? 'normalizacao' : 'extracao',
      inicioPendente: estado !== 'vazio_documento' && !inicio,
    };
    const messages = [];
    if (rawPosition.inicio && !validTime(rawPosition.inicio)) messages.push('Horário de início ilegível ou inválido.');
    if (estado !== 'vazio_documento' && !inicio) messages.push('Horário de início não reconhecido; confirme a posição no documento.');
    if (estado === 'nao_reconhecido' || estado === 'parcial') messages.push('A posição foi preservada, mas exige conferência humana.');
    if (!period.disciplina && estado !== 'vazio_documento') messages.push('Disciplina não reconhecida; informe-a na conferência.');
    if (rawPosition._blockWarning) messages.push(rawPosition._blockWarning);
    if (hasPotentialGroupedInterval(rawPosition, profile)) messages.push('Possível bloco de posições detectado; confirme as células associadas antes de revisar.');
    period._warnings = messages.concat(rawPosition.incertezas || []).map((message) => warning(message, rawPosition.pagina || null));
    return period;
  });

  const positionAudit = auditDayPositions({
    positions: periods,
    expectedPositions: profile ? profile.starts.map((_start, index) => index + 1) : [],
    dayLabel: DAY_LABELS[dayKey],
  });
  const dayWarnings = [
    ...(rawDay.avisos || []).map((message) => warning(message)),
    ...periods.flatMap((period) => period._warnings),
    ...positionAudit.warnings.map((message) => warning(message)),
  ];
  const hasNonEmptyPosition = periods.some((period) => period.estado !== 'vazio_documento');
  const day = {
    situacao: rawDay.situacaoDocumento === 'dia_em_branco' && !hasNonEmptyPosition ? 'pendente' : (hasNonEmptyPosition ? 'com_aulas' : 'pendente'),
    periodos: periods.map(({ _warnings, ...period }) => period),
    compartilhamento: null,
    revisao: 'nao_revisado',
    avisos: dayWarnings,
  };
  return { day, audit: positionAudit };
};

export const normalizeExtraction = ({ extracted, courseName, fileName, pageCount }) => {
  const course = getCourse(courseName);
  if (!course) throw new Error('Unknown course');
  const profile = detectScheduleProfile({ courseName: course.name, pageCount, extracted });
  const schedules = {};
  const unrecognizedClasses = [];
  const warnings = [...(extracted.observacoes || [])];
  const scheduleAudits = [];

  for (const extractedClass of extracted.turmas || []) {
    const classCode = resolveExtractedClass(extractedClass.turma, course);
    if (!classCode) {
      if (extractedClass.turma) unrecognizedClasses.push(extractedClass.turma);
      warnings.push(`Turma não reconhecida: ${extractedClass.turma || 'identificação ausente'}.`);
      continue;
    }
    const association = extractedClass.turmaAssociacao || { regiao: null, confianca: 'nao_identificada' };
    const scheduleId = `${safeId(course.name)}-${safeId(classCode)}`;
    const schedule = createSchedule(course.name, classCode, association);
    const audit = { turma: classCode, dias: {} };
    for (const day of DAYS) {
      const normalized = normalizeDay({ rawDay: extractedClass[day], dayKey: day, profile, scheduleId });
      schedule.dias[day] = normalized.day;
      audit.dias[day] = normalized.audit;
    }
    if (association.confianca === 'duvidosa') schedule.dias.segunda.avisos.push(warning('A associação da região da tabela com esta turma é duvidosa; confira as colunas.'));
    schedule.diagnostico = { perfil: profile?.course || null, paginas: pageCount, dias: audit.dias, extracao: extracted.diagnosticoEstrutural || null };
    scheduleAudits.push(audit);
    schedules[`${course.name}::${classCode}`] = schedule;
  }

  const diagnostico = {
    curso: course.name,
    arquivo: fileName,
    paginas: pageCount,
    perfilAplicado: profile?.course || null,
    turmasDetectadas: (extracted.turmas || []).length,
    turmasReconhecidas: Object.keys(schedules).length,
    turmasNaoReconhecidas: unrecognizedClasses.length,
    ...summarizeExtractionAudit(scheduleAudits),
  };
  return {
    status: 'ready_for_review',
    curso: course.name,
    arquivo: fileName,
    paginasAnalisadas: extracted.paginasAnalisadas || pageCount,
    schedules,
    classes: Object.values(schedules).map((schedule) => schedule.turma),
    unrecognizedClasses,
    warnings: [...warnings, ...scheduleAudits.flatMap((audit) => DAYS.flatMap((day) => audit.dias[day].warnings))],
    diagnostico,
    diagnosticoEstrutural: extracted.diagnosticoEstrutural || null,
    review: 'nao_revisado',
  };
};
