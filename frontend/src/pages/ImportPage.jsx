import { useMemo, useState } from 'react';
import { CourseSelector } from '../components/CourseSelector.jsx';
import { PdfPreview } from '../components/PdfPreview.jsx';
import { PdfUpload } from '../components/PdfUpload.jsx';
import { CalibrationPanel } from '../components/CalibrationPanel.jsx';
import { extractSchedules, importHtmlSchedules } from '../services/api.js';

const isHtmlFile = (file) => /\.html?$/i.test(file?.name || '');

export function ImportPage({ courses, selectedCourse, accessToken, onCourseChange, file, onFileChange, onRemoveFile, onContinue, onImportExtracted }) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [calibration, setCalibration] = useState(null);
  const [resultCourseFilter, setResultCourseFilter] = useState('');
  const htmlSelected = isHtmlFile(file);
  const extractedEntries = useMemo(() => Object.entries(result?.schedules || {})
    .filter(([, schedule]) => !resultCourseFilter || schedule.curso === resultCourseFilter), [result, resultCourseFilter]);
  const resultCourses = useMemo(() => [...new Set(Object.values(result?.schedules || {}).map((schedule) => schedule.curso))], [result]);

  const runExtraction = async () => {
    if (!file || isExtracting) return;
    setIsExtracting(true);
    setError(null);
    try {
      const nextResult = htmlSelected
        ? await importHtmlSchedules(file, accessToken)
        : await extractSchedules(file, selectedCourse, accessToken, calibration);
      setResult(nextResult);
      setResultCourseFilter('');
      setSelectedKeys(Object.keys(nextResult.schedules || {}));
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível concluir a importação.');
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleKey = (key) => setSelectedKeys((current) => current.includes(key)
    ? current.filter((item) => item !== key)
    : [...current, key]);

  return (
    <div className="page-stack">
      <section className="page-intro">
        <p className="eyebrow">Etapa 1 de 3</p>
        <h2>Importar horários</h2>
        <p>Use o HTML estruturado como fluxo principal. O PDF permanece disponível como alternativa secundária e ambos exigem conferência humana.</p>
      </section>
      <section className="panel-card course-panel">
        <CourseSelector courses={courses} value={selectedCourse} onChange={onCourseChange} id="import-course" />
        <p className="helper-text">No HTML, todas as turmas reconhecidas do catálogo são importadas em um único arquivo. A seleção abaixo organiza a conferência inicial.</p>
      </section>
      <PdfUpload file={file} onFileChange={onFileChange} onRemove={onRemoveFile} />
      <PdfPreview file={file} />
      <section className="panel-card extraction-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">{htmlSelected ? 'Importação estruturada' : 'Extração secundária'}</p><h2>{htmlSelected ? 'Importar horários' : 'Processar PDF localmente'}</h2></div>
          <span className="panel-note">Revisão obrigatória</span>
        </div>
        <p>{htmlSelected
          ? 'O backend lê a tabela HTML em memória, preserva as dez posições de cada dia e usa somente o catálogo oficial para identificar as turmas. O documento não é renderizado nem executado no navegador.'
          : 'O backend identifica a estrutura do PDF, recorta as células e aplica OCR localmente. O PDF não é enviado a serviços externos e nenhuma publicação é feita.'}</p>
        <button className="primary-button" type="button" onClick={runExtraction} disabled={!file || isExtracting}>
          {isExtracting ? 'Processando arquivo…' : htmlSelected ? 'Importar horários' : 'Processar PDF'}
        </button>
        {isExtracting && <p className="helper-text" role="status">A análise pode levar alguns instantes. Não feche esta página.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
      {result && <section className="panel-card extraction-result" aria-live="polite">
        <div className="panel-heading">
          <div><p className="eyebrow">Resultado provisório · {result.origem === 'html' ? 'HTML estruturado' : 'PDF'}</p><h2>{result.classes.length} turma(s) reconhecida(s)</h2></div>
          <span className="status-chip status-chip--pendente">Não revisado</span>
        </div>
        <p>Foi analisado <strong>{result.arquivo}</strong>. Selecione as turmas que deseja carregar no editor; os dados existentes só serão substituídos após confirmação.</p>
        {resultCourses.length > 1 && <label className="field-label" htmlFor="import-result-course">Filtrar por curso
          <select id="import-result-course" value={resultCourseFilter} onChange={(event) => setResultCourseFilter(event.target.value)}>
            <option value="">Todos os cursos</option>
            {resultCourses.map((course) => <option key={course} value={course}>{course}</option>)}
          </select>
        </label>}
        {result.diagnostico && <div className="extraction-diagnostics">
          <strong>Cobertura da importação</strong>
          <span>{result.diagnostico.cursosDetectados || 1} curso(s)</span>
          <span>{result.diagnostico.turmasReconhecidas || 0} turma(s) reconhecida(s)</span>
          <span>{result.diagnostico.posicoesIdentificadas || 0} posição(ões) preservada(s)</span>
          <span>{result.diagnostico.posicoesPreenchidas || 0} preenchida(s)</span>
          <span>{result.diagnostico.posicoesVazias || 0} vazia(s)</span>
          <span>{result.diagnostico.diasPendentes || 0} dia(s) pendente(s)</span>
          <span>{(result.diagnostico.turmasAusentes || []).length} turma(s) ausente(s) no documento</span>
        </div>}
        {extractedEntries.length > 0 ? <div className="extraction-class-list">
          {extractedEntries.map(([key, schedule]) => <label key={key}><input type="checkbox" checked={selectedKeys.includes(key)} onChange={() => toggleKey(key)} /> <strong>{schedule.turma}</strong> <span>{schedule.curso}</span></label>)}
        </div> : <p className="form-error">Nenhuma turma reconhecida neste filtro. A conferência manual continua disponível.</p>}
        {(result.unrecognizedClasses?.length > 0 || result.warnings?.length > 0) && <ul className="day-warnings">
          {[...(result.unrecognizedClasses || []).map((item) => `Turma não reconhecida: ${item}`), ...(result.warnings || [])].map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
        </ul>}
        <button className="secondary-button" type="button" disabled={!selectedKeys.length} onClick={() => onImportExtracted(Object.fromEntries(selectedKeys.map((key) => [key, result.schedules[key]])))}>Importar selecionadas para conferência</button>
      </section>}
      {!htmlSelected && result?.diagnosticoEstrutural && <CalibrationPanel diagnostic={result.diagnosticoEstrutural} classOptions={courses.find((course) => course.name === selectedCourse)?.classes || []} calibration={calibration} onChange={setCalibration} />}
      <div className="page-actions">
        <button className="primary-button" type="button" onClick={onContinue}>Ir para conferência manual</button>
      </div>
    </div>
  );
}
