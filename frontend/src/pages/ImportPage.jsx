import { CourseSelector } from '../components/CourseSelector.jsx';
import { PdfPreview } from '../components/PdfPreview.jsx';
import { PdfUpload } from '../components/PdfUpload.jsx';

export function ImportPage({ courses, selectedCourse, onCourseChange, file, onFileChange, onRemoveFile, onContinue }) {
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
      <div className="page-actions">
        <button className="primary-button" type="button" onClick={onContinue}>Ir para conferência manual</button>
      </div>
    </div>
  );
}
