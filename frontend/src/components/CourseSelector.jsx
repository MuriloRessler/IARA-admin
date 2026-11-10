export function CourseSelector({ courses, value, onChange, id = 'course' }) {
  return (
    <label className="field-label" htmlFor={id}>
      Curso
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {courses.map((course) => <option key={course.name} value={course.name}>{course.name}</option>)}
      </select>
    </label>
  );
}
