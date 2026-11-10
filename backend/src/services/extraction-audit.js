const days = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

const isFilled = (position) => position.estado === 'reconhecido' || position.estado === 'parcial' || position.estado === 'nao_reconhecido';

export const auditDayPositions = ({ positions, expectedPositions = [], dayLabel }) => {
  const seen = new Set();
  const duplicatePositions = [];
  const outOfOrder = positions.some((position, index) => {
    if (position.posicao == null) return false;
    if (seen.has(position.posicao)) duplicatePositions.push(position.posicao);
    seen.add(position.posicao);
    const previous = positions[index - 1]?.posicao;
    return previous != null && position.posicao < previous;
  });
  const returnedPositions = new Set(positions.filter((position) => position.posicao != null).map((position) => position.posicao));
  const missingPositions = expectedPositions.filter((position) => !returnedPositions.has(position));
  const counts = positions.reduce((result, position) => {
    result.identificadas += 1;
    if (position.estado === 'vazio_documento') result.vazias += 1;
    else if (position.estado === 'nao_reconhecido') result.naoReconhecidas += 1;
    else if (position.estado === 'parcial') result.parciais += 1;
    if (isFilled(position) && position.disciplina) result.preenchidas += 1;
    return result;
  }, { identificadas: 0, preenchidas: 0, vazias: 0, naoReconhecidas: 0, parciais: 0 });
  const warnings = [
    ...missingPositions.map((position) => `${dayLabel}: a posição do ${position}º período não foi retornada pela extração.`),
    ...(duplicatePositions.length ? [`${dayLabel}: posições duplicadas retornadas: ${[...new Set(duplicatePositions)].join(', ')}.`] : []),
    ...(outOfOrder ? [`${dayLabel}: as posições retornadas estão fora de ordem.`] : []),
  ];
  return { ...counts, esperadas: expectedPositions.length, faltantes: missingPositions, warnings };
};

export const summarizeExtractionAudit = (scheduleAudits) => {
  const summary = { posicoesIdentificadas: 0, posicoesPreenchidas: 0, posicoesVazias: 0, posicoesNaoReconhecidas: 0, posicoesParciais: 0, posicoesEsperadas: 0, posicoesFaltantes: 0, avisos: 0 };
  for (const audit of scheduleAudits) {
    for (const day of days) {
      const value = audit.dias[day];
      summary.posicoesIdentificadas += value.identificadas;
      summary.posicoesPreenchidas += value.preenchidas;
      summary.posicoesVazias += value.vazias;
      summary.posicoesNaoReconhecidas += value.naoReconhecidas;
      summary.posicoesParciais += value.parciais;
      summary.posicoesEsperadas += value.esperadas;
      summary.posicoesFaltantes += value.faltantes.length;
      summary.avisos += value.warnings.length;
    }
  }
  return summary;
};
