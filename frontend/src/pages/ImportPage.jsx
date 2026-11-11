import { useMemo, useState } from 'react';
import { CourseSelector } from '../components/CourseSelector.jsx';
import { PdfPreview } from '../components/PdfPreview.jsx';
import { PdfUpload } from '../components/PdfUpload.jsx';
import { extractSchedules } from '../services/api.js';
import { CalibrationPanel } from '../components/CalibrationPanel.jsx';

export function ImportPage({ courses, selectedCourse, accessToken, onCourseChange, file, onFileChange, onRemoveFile, onContinue, onImportExtracted }) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [calibration, setCalibration] = useState(null);
  const extractedEntries = useMemo(() => Object.entries(result?.schedules || {}), [result]);

  const runExtraction = async () => {
    if (!file || isExtracting) return;
    setIsExtracting(true);
    setError(null);
    try {
      const nextResult = await extractSchedules(file, selectedCourse, accessToken, calibration);
      setResult(nextResult);
      setSelectedKeys(Object.keys(nextResult.schedules || {}));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleKey = (key) => setSelectedKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);

  return (
    <div className="page-stack">
      <section className="page-intro">
        <p className="eyebrow">Etapa 1 de 3</p>
        <h2>Importar horários</h2>
        <p>Selecione o curso e mantenha o PDF original disponível para comparar a conferência manual das turmas.</p>
      </section>
      <section className="panel-card course-panel">
        <CourseSelector courses={courses} value={selectedCourse} onChange={onCourseChange} id="import-course" />
        <p className="helper-text">A seleção do curso organiza as turmas disponíveis na próxima etapa. O PDF permanece somente no navegador.</p>
      </section>
      <PdfUpload file={file} onFileChange={onFileChange} onRemove={onRemoveFile} />
      <PdfPreview file={file} />
      <section className="panel-card extraction-panel">
        <div className="panel-heading"><div><p className="eyebrow">Extração estrutural</p><h2>Processar PDF localmente</h2></div><span className="panel-note">Revisão obrigatória</span></div>
        <p>O backend identifica a estrutura da tabela, recorta cada célula e aplica OCR localmente. O PDF não é enviado a serviços externos e nenhuma publicação é feita.</p>
        <button className="primary-button" type="button" onClick={runExtraction} disabled={!file || isExtracting}>{isExtracting ? 'Processando páginas e células…' : 'Processar PDF'}</button>
        {isExtracting && <p className="helper-text" role="status">A análise pode levar alguns instantes. Não feche esta página.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
      {result && <section className="panel-card extraction-result" aria-live="polite">
        <div className="panel-heading"><div><p className="eyebrow">Resultado provisório</p><h2>{result.classes.length} turma(s) reconhecida(s)</h2></div><span className="status-chip status-chip--pendente">Não revisado</span></div>
        <p>Foram analisadas {result.paginasAnalisadas} página(s) de <strong>{result.arquivo}</strong>. Selecione as turmas que deseja carregar no editor.</p>
        {result.diagnostico && <div className="extraction-diagnostics"><strong>Diagnóstico da cobertura</strong><span>{result.diagnostico.turmasReconhecidas} turma(s) reconhecida(s)</span><span>{result.diagnosticoEstrutural?.diasAnalisados || 0} dia(s) analisado(s)</span><span>{result.diagnostico.posicoesIdentificadas} posição(ões) retornada(s)</span><span>{result.diagnostico.posicoesPreenchidas} preenchida(s)</span><span>{result.diagnostico.posicoesVazias} vazia(s)</span><span>{result.diagnostico.posicoesNaoReconhecidas + result.diagnostico.posicoesParciais} pendente(s)</span><span>{result.diagnostico.posicoesFaltantes} posição(ões) possivelmente omitida(s)</span></div>}
        {extractedEntries.length > 0 ? <div className="extraction-class-list">{extractedEntries.map(([key, schedule]) => <label key={key}><input type="checkbox" checked={selectedKeys.includes(key)} onChange={() => toggleKey(key)} /> <strong>{schedule.turma}</strong> <span>{schedule.curso}</span></label>)}</div> : <p className="form-error">Nenhuma turma reconhecida. A conferência manual continua disponível.</p>}
        {(result.unrecognizedClasses.length > 0 || result.warnings.length > 0) && <ul className="day-warnings">{[...result.unrecognizedClasses.map((item) => `Turma não reconhecida: ${item}`), ...result.warnings].map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>}
        <button className="secondary-button" type="button" disabled={!selectedKeys.length} onClick={() => onImportExtracted(Object.fromEntries(selectedKeys.map((key) => [key, result.schedules[key]])))}>Importar selecionadas para conferência</button>
      </section>}
      {result?.diagnosticoEstrutural && <CalibrationPanel diagnostic={result.diagnosticoEstrutural} classOptions={selectedCourse.classes} calibration={calibration} onChange={setCalibration} />}
      <div className="page-actions">
        <button className="primary-button" type="button" onClick={onContinue}>Ir para conferência manual</button>
      </div>
    </div>
  );
}
