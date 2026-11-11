import { useMemo, useState } from 'react';
import { courses, getAllClasses, totalClasses } from '../config/courses.js';
import { AdminLayout } from '../components/AdminLayout.jsx';
import { createPeriod, createScheduleBook, getSchedule, scheduleKey } from '../services/schedule-model.js';
import { validateDay, validateSchedule } from '../services/schedule-validation.js';
import { replacePeriodWithSplit, updatePeriodRecord } from '../services/schedule-editing.js';
import { Dashboard } from './Dashboard.jsx';
import { ImportPage } from './ImportPage.jsx';
import { ScheduleReviewPage } from './ScheduleReviewPage.jsx';

const initialCourse = courses[0].name;
const initialClass = courses[0].classes[0];

export function AdminApplication({ admin, accessToken, onLogout }) {
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

  const changeDay = (dayKey, nextDay) => updateSchedule((current) => ({
    ...current,
    revisao: 'nao_revisado',
    dias: { ...current.dias, [dayKey]: { ...nextDay, revisao: 'nao_revisado' } },
  }));

  const addPeriod = (dayKey) => updateSchedule((current) => {
    const day = current.dias[dayKey];
    if (day.situacao === 'compartilhado' || day.situacao === 'sem_aulas') {
      if (!window.confirm('Adicionar um período mudará este dia para “Com aulas”. Continuar?')) return current;
    }
    return { ...current, revisao: 'nao_revisado', dias: { ...current.dias, [dayKey]: { ...day, situacao: 'com_aulas', compartilhamento: null, revisao: 'nao_revisado', periodos: [...day.periodos, createPeriod()] } } };
  });

  const removePeriod = (dayKey, periodId) => updateSchedule((current) => {
    if (!window.confirm('Remover este período? A alteração ficará apenas no rascunho local.')) return current;
    const periods = current.dias[dayKey].periodos.filter((period) => period.id !== periodId);
    return { ...current, revisao: 'nao_revisado', dias: { ...current.dias, [dayKey]: { ...current.dias[dayKey], periodos, situacao: periods.length ? 'com_aulas' : 'pendente', revisao: 'nao_revisado' } } };
  });

  const changePeriod = (dayKey, periodId, field, value) => updateSchedule((current) => ({
    ...current,
    revisao: 'nao_revisado',
    dias: { ...current.dias, [dayKey]: { ...current.dias[dayKey], situacao: 'com_aulas', compartilhamento: null, revisao: 'nao_revisado', periodos: current.dias[dayKey].periodos.map((period) => period.id === periodId ? updatePeriodRecord(period, { [field]: value, ...(field === 'inicio' ? { inicioPendente: false } : {}) }) : period) } },
  }));

  const editPeriod = (dayKey, periodId, changes) => {
    let result = { error: '' };
    setSchedules((current) => {
      const key = scheduleKey(selectedCourse, selectedClass);
      const currentDay = current[key].dias[dayKey];
      const period = currentDay.periodos.find((candidate) => candidate.id === periodId);
      if (!period) { result = { error: 'Período não encontrado.' }; return current; }
      const nextPeriod = updatePeriodRecord(period, { ...changes, ...(Object.prototype.hasOwnProperty.call(changes, 'inicio') ? { inicioPendente: false } : {}) });
      const nextDay = { ...currentDay, situacao: 'com_aulas', compartilhamento: null, revisao: 'nao_revisado', periodos: currentDay.periodos.map((candidate) => candidate.id === periodId ? nextPeriod : candidate) };
      const errors = validateDay(nextDay, current, key, dayKey).filter((message) => !(nextPeriod.estado !== 'vazio_documento' && ['nao_reconhecido', 'parcial'].includes(nextPeriod.estado) && message.includes('informe a disciplina')));
      if (errors.length) { result = { error: errors[0] }; return current; }
      setHasChanges(true);
      return { ...current, [key]: { ...current[key], revisao: 'nao_revisado', dias: { ...current[key].dias, [dayKey]: nextDay } } };
    });
    return result;
  };

  const splitPeriod = (dayKey, periodId, slots) => {
    let result = { error: '' };
    setSchedules((current) => {
      const key = scheduleKey(selectedCourse, selectedClass);
      const currentDay = current[key].dias[dayKey];
      try {
        const periods = replacePeriodWithSplit(currentDay.periodos, periodId, slots);
        const nextDay = { ...currentDay, situacao: 'com_aulas', compartilhamento: null, revisao: 'nao_revisado', periodos };
        const errors = validateDay(nextDay, current, key, dayKey).filter((message) => !message.includes('ainda não foi revisado'));
        if (errors.length) { result = { error: errors[0] }; return current; }
        setHasChanges(true);
        return { ...current, [key]: { ...current[key], revisao: 'nao_revisado', dias: { ...current[key].dias, [dayKey]: nextDay } } };
      } catch (error) { result = { error: error.message }; return current; }
    });
    return result;
  };

  const shareDay = (dayKey, source) => {
    const sourceSchedule = getSchedule(schedules, source.course, source.turma);
    const sourceKey = scheduleKey(source.course, source.turma);
    if (sourceSchedule.dias[dayKey].revisao === 'nao_revisado' || sourceSchedule.dias[dayKey].avisos?.some((item) => !item.resolvido)) {
      return { error: 'A turma de origem precisa ter este dia revisado e seus avisos resolvidos.' };
    }
    const sourceErrors = validateDay(sourceSchedule.dias[dayKey], schedules, sourceKey, dayKey);
    if (sourceErrors.length > 0) return { error: 'A turma de origem precisa ter aulas válidas e conferidas neste dia.' };

    const nextDay = { situacao: 'compartilhado', periodos: [], compartilhamento: { curso: source.course, turma: source.turma }, revisao: 'nao_revisado', avisos: [] };
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

  const reviewDay = (dayKey) => {
    const currentDay = schedule.dias[dayKey];
    const errors = validateDay(currentDay, schedules, scheduleKey(selectedCourse, selectedClass), dayKey);
    if (errors.length || currentDay.avisos?.some((item) => !item.resolvido)) return;
    updateSchedule((current) => ({ ...current, revisao: 'revisado', dias: { ...current.dias, [dayKey]: { ...current.dias[dayKey], revisao: 'revisado', periodos: current.dias[dayKey].periodos.map((period) => ({ ...period, revisao: 'revisado' })) } } }));
  };

  const resolveWarning = (dayKey, warningId) => updateSchedule((current) => ({
    ...current,
    revisao: 'nao_revisado',
    dias: { ...current.dias, [dayKey]: { ...current.dias[dayKey], revisao: 'nao_revisado', avisos: current.dias[dayKey].avisos.map((item) => item.id === warningId ? { ...item, resolvido: true } : item) } },
  }));

  const importExtractedSchedules = (selectedSchedules) => {
    const selectedEntries = Object.entries(selectedSchedules);
    const hasExistingData = selectedEntries.some(([key, imported]) => {
      const existing = schedules[key];
      return existing && existing !== imported && Object.values(existing.dias).some((day) => day.situacao !== 'pendente' || day.periodos.length > 0);
    });
    if (hasExistingData && !window.confirm('Uma ou mais turmas já possuem dados. Deseja substituí-las pela extração?')) return false;
    const nextSchedules = { ...schedules, ...selectedSchedules };
    setSchedules(nextSchedules);
    const firstSchedule = selectedEntries[0]?.[1];
    if (firstSchedule) { setSelectedCourse(firstSchedule.curso); setSelectedClass(firstSchedule.turma); setActiveView('review'); }
    setHasChanges(true);
    return true;
  };

  const content = activeView === 'overview'
    ? <Dashboard totalClasses={totalClasses} onNavigate={setActiveView} />
    : activeView === 'import'
      ? <ImportPage courses={courses} selectedCourse={selectedCourse} accessToken={accessToken} onCourseChange={changeCourse} file={selectedFile} onFileChange={setSelectedFile} onRemoveFile={() => setSelectedFile(null)} onContinue={() => setActiveView('review')} onImportExtracted={importExtractedSchedules} />
      : <ScheduleReviewPage courses={courses} classes={selectedCourseData.classes} selectedCourse={selectedCourse} selectedClass={selectedClass} onCourseChange={changeCourse} onClassChange={setSelectedClass} schedule={schedule} schedules={schedules} sources={sources} file={selectedFile} accessToken={accessToken} validation={validation} onDayChange={changeDay} onPeriodChange={changePeriod} onEditPeriod={editPeriod} onSplitPeriod={splitPeriod} onAddPeriod={addPeriod} onRemovePeriod={removePeriod} onShare={shareDay} onRemoveShare={removeShare} onReviewDay={reviewDay} onResolveWarning={resolveWarning} onImportDraft={importDraft} onExported={() => setHasChanges(false)} onImported={() => setHasChanges(true)} hasChanges={hasChanges} />;

  return <AdminLayout admin={admin} activeView={activeView} onNavigate={setActiveView} onLogout={onLogout}>{content}</AdminLayout>;
}
