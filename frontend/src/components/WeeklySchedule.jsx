import { DAYS } from '../services/schedule-model.js';
import { DaySchedule } from './DaySchedule.jsx';

export function WeeklySchedule({ schedule, schedules, sources, onDayChange, onPeriodChange, onEditPeriod, onSplitPeriod, onAddPeriod, onRemovePeriod, onShare, onRemoveShare, onReviewDay, onResolveWarning }) {
  return (
    <section className="weekly-schedule" aria-labelledby="weekly-schedule-title">
      <div className="section-heading section-heading--tight">
        <div>
          <p className="eyebrow">Edição manual</p>
          <h2 id="weekly-schedule-title">Grade semanal</h2>
        </div>
        <span className="panel-note">Segunda a sexta</span>
      </div>
      <div className="day-grid">
        {DAYS.map((dayDefinition) => (
          <DaySchedule
            key={dayDefinition.key}
            dayDefinition={dayDefinition}
            schedule={schedule}
            schedules={schedules}
            sources={sources}
            onDayChange={onDayChange}
            onPeriodChange={onPeriodChange}
            onEditPeriod={onEditPeriod}
            onSplitPeriod={onSplitPeriod}
            onAddPeriod={onAddPeriod}
            onRemovePeriod={onRemovePeriod}
            onShare={onShare}
            onRemoveShare={onRemoveShare}
            onReviewDay={onReviewDay}
            onResolveWarning={onResolveWarning}
          />
        ))}
      </div>
    </section>
  );
}
