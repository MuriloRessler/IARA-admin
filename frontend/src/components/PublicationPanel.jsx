import { useEffect, useMemo, useState } from 'react';
import { getPublicationBackup, previewPublication, publishSchedules } from '../services/api.js';

const scheduleFingerprint = (schedules) => JSON.stringify(schedules);

const downloadJson = (payload, fileName) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const changeFor = (changes, turma) => [...(changes?.created || []), ...(changes?.updated || []), ...(changes?.unchanged || [])]
  .find((change) => change.after?.turma === turma);

export function PublicationPanel({ schedules, courses, accessToken }) {
  const [preview, setPreview] = useState(null);
  const [previewInput, setPreviewInput] = useState('');
  const [backup, setBackup] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedTurma, setSelectedTurma] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmedReview, setConfirmedReview] = useState(false);
  const [acceptUnreviewedRisk, setAcceptUnreviewedRisk] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  const currentInput = useMemo(() => scheduleFingerprint(schedules), [schedules]);
  const stale = Boolean(preview && previewInput !== currentInput);
  const visibleRecords = useMemo(() => (preview?.records || []).filter((record) => !selectedCourse || record.curso === selectedCourse), [preview, selectedCourse]);
  const selectedRecord = visibleRecords.find((record) => record.turma === selectedTurma) || visibleRecords[0];
  const selectedChange = selectedRecord ? changeFor(preview?.changes, selectedRecord.turma) : null;
  const hasUnreviewedRisk = Boolean(preview?.review && !preview.review.complete);

  useEffect(() => {
    setAcceptUnreviewedRisk(false);
    setConfirmedReview(false);
    setConfirmOpen(false);
  }, [currentInput]);

  const runPreview = async () => {
    setBusy('preview');
    setError('');
    setMessage('');
    try {
      const result = await previewPublication(schedules, accessToken);
      setPreview(result);
      setPreviewInput(currentInput);
      setAcceptUnreviewedRisk(false);
      setSelectedTurma(result.records?.[0]?.turma || '');
      setReport(null);
      setMessage('Prévia gerada. Nenhum registro foi alterado.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const downloadBackup = async () => {
    setBusy('backup');
    setError('');
    try {
      const result = await getPublicationBackup(accessToken);
      setBackup(result);
      downloadJson(result, `iara-horarios-backup-${new Date().toISOString().slice(0, 10)}.json`);
      setMessage('Backup baixado. A publicação exigirá que o estado do banco continue igual a este backup.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const openConfirmation = () => {
    setError('');
    setConfirmedReview(false);
    setConfirmOpen(true);
  };

  const publish = async () => {
    if (!preview || stale || !backup || !confirmedReview || (hasUnreviewedRisk && !acceptUnreviewedRisk)) return;
    setBusy('publish');
    setError('');
    try {
      const result = await publishSchedules({
        schedules,
        previewVersion: preview.publicationVersion,
        baseRecordsChecksum: preview.database.currentChecksum,
        backupChecksum: backup.recordsChecksum,
        acceptUnreviewedRisk,
        confirmPublication: true,
      }, accessToken);
      setReport(result);
      setConfirmOpen(false);
      setMessage('Publicação concluída e verificada no Supabase.');
    } catch (requestError) {
      setError(requestError.message);
      setConfirmOpen(false);
    } finally {
      setBusy('');
    }
  };

  const selectedCourseClasses = courses.find((course) => course.name === selectedCourse)?.classes || [];

  return (
    <section className="panel-card publication-panel" aria-labelledby="publication-title">
      <div className="panel-heading">
        <div><p className="eyebrow">Etapa 3 de 3</p><h2 id="publication-title">Revisar publicação</h2></div>
        <span className="panel-note">Supabase · ação explícita</span>
      </div>
      <p>Gere uma prévia com as grades consolidadas que estão no editor. A publicação não executa nova extração e só acontece depois da prévia, do backup e da confirmação final; revisão incompleta exige aceite explícito de risco.</p>
      <div className="publication-actions">
        <button className="secondary-button" type="button" onClick={runPreview} disabled={busy !== ''}>{busy === 'preview' ? 'Gerando prévia…' : 'Gerar prévia'}</button>
        <button className="secondary-button" type="button" onClick={downloadBackup} disabled={busy !== ''}>{busy === 'backup' ? 'Baixando backup…' : 'Baixar backup dos horários atuais'}</button>
      </div>
      {preview && <>
        <div className="extraction-diagnostics publication-summary">
          <span>{preview.summary.turmas} turma(s)</span>
          <span>{preview.summary.cursos} curso(s)</span>
          <span>{preview.summary.aulasProprias} aula(s) própria(s)</span>
          <span>{preview.summary.aulasCompartilhadas} aula(s) compartilhada(s)</span>
          <span>{preview.summary.alteracoesManuais} alteração(ões) manual(is)</span>
          <span>{preview.summary.turmasCompletamenteRevisadas || 0} turma(s) completamente revisada(s)</span>
          <span>{preview.summary.turmasComRevisaoIncompleta || 0} turma(s) com revisão incompleta</span>
          <span>{preview.summary.periodosNaoRevisados || 0} período(s) não revisado(s)</span>
          <span>{preview.summary.pendenciasBloqueantes || preview.issues.length} erro(s) bloqueante(s)</span>
          <span>{preview.summary.registrosCriados} registro(s) novo(s)</span>
          <span>{preview.summary.registrosAtualizados} atualização(ões)</span>
          <span>{preview.summary.registrosInalterados} inalterado(s)</span>
        </div>
        <div className={`publication-database ${preview.database.available && preview.database.publicationEnabled ? 'publication-database--ready' : 'publication-database--blocked'}`}>
          {preview.database.available
            ? `Banco consultado em ${preview.database.schema || 'public'}."${preview.database.table || 'Horarios'}". ${preview.database.legacyRecords} registro(s) legado(s) sem turma foram preservados.${preview.database.publicationEnabled ? ' Publicação habilitada.' : ' Publicação desabilitada pela configuração do backend; defina PUBLICATION_ENABLED=true e reinicie o backend após a revisão operacional.'}`
            : `Publicação indisponível: ${preview.database.reason || 'o esquema do banco ainda não está preparado.'}`}
        </div>
        {stale && <p className="feedback feedback--error">A grade foi alterada depois desta prévia. Gere uma nova prévia antes de publicar.</p>}
        {preview.issues.length > 0 && <div className="publication-issues" role="alert"><strong>Pendências que bloqueiam a publicação ({preview.issues.length})</strong><ul>{preview.issues.map((item, index) => <li key={`${item.code}-${item.path}-${index}`}>{item.message}</li>)}</ul></div>}
        {hasUnreviewedRisk && <div className="publication-review-summary">
          <strong>Revisão incompleta</strong>
          <p>Há turmas, dias ou períodos ainda não revisados. Você pode revisar os itens individualmente ou aceitar explicitamente o risco na confirmação final.</p>
          <details>
            <summary>Ver detalhes da revisão</summary>
            <ul>{(preview.review.byDay || []).map((day) => <li key={day.key}>{day.label}: {day.unreviewedPeriods} período(s) e {day.unreviewedDays} dia(s) não revisado(s).</li>)}</ul>
          </details>
        </div>}
        {preview.warnings.length > 0 && <div className="publication-warnings"><strong>Avisos</strong><ul>{preview.warnings.map((item, index) => <li key={`${item.code}-${index}`}>{item.message}</li>)}</ul></div>}
        <div className="publication-filters">
          <label className="field-label">Curso<select value={selectedCourse} onChange={(event) => { setSelectedCourse(event.target.value); setSelectedTurma(''); }}><option value="">Todos</option>{courses.map((course) => <option key={course.name} value={course.name}>{course.name}</option>)}</select></label>
          <label className="field-label">Turma<select value={selectedRecord?.turma || ''} onChange={(event) => setSelectedTurma(event.target.value)}><option value="">Selecione</option>{(selectedCourse ? selectedCourseClasses : visibleRecords.map((record) => record.turma)).map((classCode) => <option key={classCode} value={classCode}>{classCode}</option>)}</select></label>
        </div>
        {selectedRecord && <div className="publication-record-preview"><div><strong>{selectedRecord.turma}</strong><span>{selectedRecord.curso}</span></div><pre>{selectedRecord.horario}</pre><small>{selectedChange ? (preview.changes?.updated?.some((change) => change.after.turma === selectedRecord.turma) ? 'Será atualizado' : preview.changes?.created?.some((change) => change.after.turma === selectedRecord.turma) ? 'Será criado' : 'Permanecerá inalterado') : 'Registro da prévia'}</small></div>}
        {backup && <p className="helper-text">Backup confirmado em {backup.exportedAt}. Ele será comparado novamente antes da gravação.</p>}
        <button className="primary-button" type="button" onClick={openConfirmation} disabled={busy !== '' || stale || !preview.publicationAvailable || preview.issues.length > 0 || !backup}>Publicar horários no Supabase</button>
      </>}
      {!preview && <p className="helper-text">Gere a prévia para consultar o banco e visualizar as diferenças antes de qualquer publicação.</p>}
      {confirmOpen && preview && <div className="publication-confirmation" role="dialog" aria-modal="true" aria-labelledby="publication-confirm-title">
        <h3 id="publication-confirm-title">Confirmar publicação</h3>
        <p>Serão publicados {preview.summary.turmas} registros. Os horários atualmente publicados serão substituídos somente para as turmas correspondentes.</p>
        <p>{preview.summary.registrosCriados} registro(s) serão criados e {preview.summary.registrosAtualizados} serão atualizados.</p>
        {hasUnreviewedRisk && <label className="publication-risk-checkbox"><input type="checkbox" checked={acceptUnreviewedRisk} onChange={(event) => setAcceptUnreviewedRisk(event.target.checked)} /> Estou ciente de que alguns horários não foram revisados e que a publicação pode conter informações incorretas. Desejo prosseguir mesmo assim.</label>}
        <label><input type="checkbox" checked={confirmedReview} onChange={(event) => setConfirmedReview(event.target.checked)} /> Confirmo que revisei a prévia, baixei o backup e autorizo a publicação.</label>
        <div className="publication-actions"><button className="secondary-button" type="button" onClick={() => setConfirmOpen(false)} disabled={busy === 'publish'}>Cancelar</button><button className="primary-button" type="button" onClick={publish} disabled={!confirmedReview || (hasUnreviewedRisk && !acceptUnreviewedRisk) || busy === 'publish'}>{busy === 'publish' ? 'Publicando…' : 'Confirmar e publicar'}</button></div>
      </div>}
      {message && <p className="feedback feedback--success" role="status">{message}</p>}
      {error && <p className="feedback feedback--error" role="alert">{error}</p>}
      {report && <div className="publication-report" role="status"><strong>Relatório da publicação</strong><span>{report.summary.turmas} turma(s) verificadas em {new Date(report.publishedAt).toLocaleString('pt-BR')}.</span><span>{report.summary.registrosCriados} criada(s) · {report.summary.registrosAtualizados} atualizada(s) · {report.summary.registrosInalterados} inalterada(s).</span></div>}
    </section>
  );
}
