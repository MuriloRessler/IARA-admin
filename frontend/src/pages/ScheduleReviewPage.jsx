import { ClassSelector } from '../components/ClassSelector.jsx';
import { CourseSelector } from '../components/CourseSelector.jsx';
import { DraftControls } from '../components/DraftControls.jsx';
import { PdfPreview } from '../components/PdfPreview.jsx';
import { ScheduleTextPreview } from '../components/ScheduleTextPreview.jsx';
import { ValidationSummary } from '../components/ValidationSummary.jsx';
import { WeeklySchedule } from '../components/WeeklySchedule.jsx';

export function ScheduleReviewPage({
  courses, classes, selectedCourse, selectedClass, onCourseChange, onClassChange,
  schedule, schedules, sources, file, validation, onDayChange, onPeriodChange,
  onAddPeriod, onRemovePeriod, onShare, onRemoveShare, onImportDraft,
  onExported, onImported, hasChanges,
}) {
  return (
    <div className="page-stack">
      <section className="page-intro">
        <p className="eyebrow">Etapa 2 de 3</p>
        <h2>Conferir horários</h2>
        <p>Monte ou revise uma grade por vez. Dias vazios permanecem pendentes até uma decisão explícita.</p>
      </section>
      <section className="panel-card selector-panel">
        <CourseSelector courses={courses} value={selectedCourse} onChange={onCourseChange} id="review-course" />
        <ClassSelector classes={classes} value={selectedClass} onChange={onClassChange} id="review-class" />
        <div className="selected-class-note"><strong>{selectedClass}</strong><span>{selectedCourse}</span></div>
      </section>
      <div className="review-layout">
        <div className="review-main">
          <ValidationSummary validation={validation} schedule={schedule} />
          <WeeklySchedule schedule={schedule} schedules={schedules} sources={sources} onDayChange={onDayChange} onPeriodChange={onPeriodChange} onAddPeriod={onAddPeriod} onRemovePeriod={onRemovePeriod} onShare={onShare} onRemoveShare={onRemoveShare} />
        </div>
        <aside className="review-aside">
          <PdfPreview file={file} />
          <ScheduleTextPreview schedule={schedule} schedules={schedules} />
        </aside>
      </div>
      <DraftControls schedules={schedules} onImport={onImportDraft} hasChanges={hasChanges} onExported={onExported} onImported={onImported} />
      <div className="future-callout"><strong>Publicação no Supabase · Em desenvolvimento</strong><span>A prévia acima é local e não altera a tabela `horarios`.</span></div>
    </div>
  );
}
