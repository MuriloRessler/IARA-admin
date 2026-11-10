import assert from 'node:assert/strict';
import test from 'node:test';
import { courses } from '../src/config/courses.js';

test('shared course catalog contains eight courses and 49 classes', () => {
  assert.equal(courses.length, 8);
  assert.equal(courses.reduce((total, course) => total + course.classes.length, 0), 49);
  assert.ok(courses.find((course) => course.name === 'Informática').classes.includes('61 1'));
  assert.ok(courses.find((course) => course.name === 'Design de Móveis').classes.includes('42 1'));
});
