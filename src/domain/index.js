import { defaultProfile } from './values.js';
import { calculateDegreeModel } from './degree.js';
export function calculateDegree({ profile = {}, acquiredCourses, recognizedCredits, plannedCourses = [], courses = [], handbook }) {
  const defaults = defaultProfile();
  const input = { ...defaults, ...profile, credits: { ...defaults.credits, ...profile.credits } };
  if (acquiredCourses !== undefined) input.acquiredCourses = acquiredCourses;
  if (recognizedCredits !== undefined) input.recognitions = recognizedCredits;
  const coursesByCode = new Map(courses.map(course => [course.code, course]));
  return calculateDegreeModel({ profile: input, plannedCourses, coursesByCode, handbook, data: { courses } });
}
