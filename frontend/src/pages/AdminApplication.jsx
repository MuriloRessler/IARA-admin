import { useMemo, useState } from 'react';
import { courses, getAllClasses, totalClasses } from '../config/courses.js';
import { AdminLayout } from '../components/AdminLayout.jsx';
import { createPeriod, createScheduleBook, getSchedule, scheduleKey } from '../services/schedule-model.js';
import { validateDay, validateSchedule } from '../services/schedule-validation.js';
import { Dashboard } from './Dashboard.jsx';
import { ImportPage } from './ImportPage.jsx';
import { ScheduleReviewPage } from './ScheduleReviewPage.jsx';

const initialCourse = courses[0].name;
const initialClass = courses[0].classes[0];

export function AdminApplication({ admin, onLogout }) {
  const [activeView, setActiveView] = useState('overview');
  const [selectedCourse, setSelectedCourse] = useState(initialCourse);
  const [selectedClass, setSelectedClass] = useState(initialClass);
  const [selectedFile, setSelectedFile] = useState(null);
  const [schedules, setSchedules] = useState(() => createScheduleBook());
  const [hasChanges, setHasChanges] = useState(false);

  const schedule = getSchedule(schedules, selectedCourse, selectedClass);
  const validation = useMemo(() => validateSchedule(schedule, schedules), [schedule, schedules]);
  const selectedCourseData = courses.find((course) => course.name === selectedCourse);
  const sources = useMemo(() => getAllClasses()
    .filter(({ course, classCode }) => !(course === selectedCourse && classCode === selectedClass))
    .map(({ course, classCode }) => ({ course, turma: classCode, key: scheduleKey(course, classCode) })), [selectedCourse, selectedClass]);

  const updateSchedule = (updater) => {
    setSchedules((current) => {
      const key = scheduleKey(selectedCourse, selectedClass);
      return { ...current, [key]: updater(current[key]) };
    });
    setHasChanges(true);
  };

  const changeCourse = (courseName) => {
    const course = courses.find((candidate) => candidate.name === courseName);
    setSelectedCourse(courseName);
    setSelectedClass(course.classes[0]);
  };

  const changeDay = (dayKey, nextDay) => updateSchedule((current) => ({ ...current, dias: { ...current.dias, [dayKey]: nextDay } }));

  const addPeriod = (dayKey) => updateSchedule((current) => {
    const day = current.dias[dayKey];
    if (day.situacao === 'compartilhado' || day.situacao === 'sem_aulas') {
      if (!window.confirm('Adicionar um período mudará este dia para “Com aulas”. Continuar?')) return current;
    }
    return { ...current, dias: { ...current.dias, [dayKey]: { situacao: 'com_aulas', compartilhamento: null, periodos: [...day.periodos, createPeriod()] } } };
  });

  const removePeriod = (dayKey, periodId) => updateSchedule((current) => {
    if (!window.confirm('Remover este período? A alteração ficará apenas no rascunho local.')) return current;
    const periods = current.dias[dayKey].periodos.filter((period) => period.id !== periodId);
    return { ...current, dias: { ...current.dias, [dayKey]: { ...current.dias[dayKey], periodos, situacao: periods.length ? 'com_aulas' : 'pendente' } } };
  });

  const changePeriod = (dayKey, periodId, field, value) => updateSchedule((current) => ({
    ...current,
    dias: { ...current.dias, [dayKey]: { ...current.dias[dayKey], situacao: 'com_aulas', compartilhamento: null, periodos: current.dias[dayKey].periodos.map((period) => period.id === periodId ? { ...period, [field]: value } : period) } },
  }));

  const shareDay = (dayKey, source) => {
    const sourceSchedule = getSchedule(schedules, source.course, source.turma);
    const sourceKey = scheduleKey(source.course, source.turma);
    const sourceErrors = validateDay(sourceSchedule.dias[dayKey], schedules, sourceKey, dayKey);
    if (sourceErrors.length > 0) return { error: 'A turma de origem precisa ter aulas válidas e conferidas neste dia.' };

    const nextDay = { situacao: 'compartilhado', periodos: [], compartilhamento: { curso: source.course, turma: source.turma } };
    const currentKey = scheduleKey(selectedCourse, selectedClass);
    const nextSchedules = { ...schedules, [currentKey]: { ...schedule, dias: { ...schedule.dias, [dayKey]: nextDay } } };
    const targetErrors = validateDay(nextDay, nextSchedules, currentKey, dayKey);
    if (targetErrors.length > 0) return { error: targetErrors[0] };
    changeDay(dayKey, nextDay);
    return { error: '' };
  };

  const removeShare = (dayKey) => changeDay(dayKey, { situacao: 'pendente', periodos: [], compartilhamento: null });

  const importDraft = (nextSchedules) => {
    setSchedules(nextSchedules);
    const firstSchedule = Object.values(nextSchedules)[0];
    if (firstSchedule) { setSelectedCourse(firstSchedule.curso); setSelectedClass(firstSchedule.turma); }
    setHasChanges(true);
  };

  const content = activeView === 'overview'
    ? <Dashboard totalClasses={totalClasses} onNavigate={setActiveView} />
    : activeView === 'import'
      ? <ImportPage courses={courses} selectedCourse={selectedCourse} onCourseChange={changeCourse} file={selectedFile} onFileChange={setSelectedFile} onRemoveFile={() => setSelectedFile(null)} onContinue={() => setActiveView('review')} />
      : <ScheduleReviewPage courses={courses} classes={selectedCourseData.classes} selectedCourse={selectedCourse} selectedClass={selectedClass} onCourseChange={changeCourse} onClassChange={setSelectedClass} schedule={schedule} schedules={schedules} sources={sources} file={selectedFile} validation={validation} onDayChange={changeDay} onPeriodChange={changePeriod} onAddPeriod={addPeriod} onRemovePeriod={removePeriod} onShare={shareDay} onRemoveShare={removeShare} onImportDraft={importDraft} onExported={() => setHasChanges(false)} onImported={() => setHasChanges(true)} hasChanges={hasChanges} />;

  return <AdminLayout admin={admin} activeView={activeView} onNavigate={setActiveView} onLogout={onLogout}>{content}</AdminLayout>;
}
