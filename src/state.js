import { defaultProfile } from './domain/values.js';
export function createState() {
  return {
    persistent: { profile: defaultProfile(), favoriteCodes: new Set() },
    session: { filters: {
  keyword: "",
  semester: "all",
  courseTracks: new Set(),
  curriculumGroups: new Set(),
  curriculumSubcategories: new Set(),
  commonFields: new Set(),
  departments: new Set(),
  day: "all",
  periods: new Set(),
  tags: new Set(),
  tagLogic: "and",
  noPeriod: false,
  multiPeriod: false,
  favoritesOnly: false,
  excludeTeacherTraining: true,
  sort: "no",
}, compareCodes: new Set(), pendingSharedTimetable: null }
  };
}
// Derived values are computed from a fresh snapshot and are never persisted.
export function domainInput(state, data, handbook, coursesByCode) {
  return { profile: state.persistent.profile, data, handbook, coursesByCode,
    plannedCourses: [...state.persistent.favoriteCodes].map(code => coursesByCode.get(code)).filter(Boolean) };
}
