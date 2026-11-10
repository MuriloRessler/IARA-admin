export function ClassSelector({ classes, value, onChange, id = 'class' }) {
  return (
    <label className="field-label" htmlFor={id}>
      Turma
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {classes.map((classCode) => <option key={classCode} value={classCode}>{classCode}</option>)}
      </select>
    </label>
  );
}
