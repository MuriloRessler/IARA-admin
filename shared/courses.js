// Turma codes are strings so spaces and letters remain exactly as registered.
export const courses = [
  { name: 'Informática', classes: ['61 1', '61 2', '61 3', '62 1', '62 2', '63 1', '63 2'] },
  { name: 'Eletrônica', classes: ['11A', '11B', '12A', '12B', '13A', '13B'] },
  { name: 'Eletrotécnica', classes: ['21A', '21B', '22 1', '22 2', '23A', '23B'] },
  { name: 'Mecânica', classes: ['31 1', '31 2', '32A', '32B', '33A', '33B'] },
  { name: 'Design de Móveis', classes: ['41A', '41B', '42 1', '42 2', '43A', '43B'] },
  { name: 'Móveis', classes: ['51A', '51B', '52A', '52B', '53A', '53B'] },
  { name: 'Química', classes: ['71A', '71B', '72A', '72B', '73A', '73B'] },
  { name: 'Meio Ambiente', classes: ['81A', '81B', '82A', '82B', '83A', '83B'] },
];

export const totalClasses = courses.reduce((total, course) => total + course.classes.length, 0);

export const getCourse = (courseName) => courses.find((course) => course.name === courseName);

export const getClassCourse = (classCode) => courses.find((course) => course.classes.includes(classCode));

export const getAllClasses = () => courses.flatMap((course) => course.classes.map((classCode) => ({
  course: course.name,
  classCode,
})));
