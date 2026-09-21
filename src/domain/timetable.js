import { dayOrder } from '../config.js';
import { sameCourseKey } from './values.js';
import { favoriteCourses, isResearchGuidance, virtualSeminarCourse } from './course-rules.js';
import { externalCourseAsCourse, externalCourseRecords } from './records.js';
import { syllabusRestrictionBetween } from './restrictions.js';

export function coursePeriodsText(course) {
  if (course.periods.length) return course.periods.map((period) => period.label).join(" / ");
  return course.classPeriod || "曜限なし";
}

export function courseScheduleText(course) {
  const kind = intensiveKind(course);
  const term = kind ? intensiveKindLabel(kind) : (course.semester || "学期不明");
  return `${term} ${coursePeriodsText(course)}`;
}

export function intensiveKindLabel(kind) {
  return kind === "summer" ? "夏期集中" : kind === "winter" ? "冬季集中" : kind === "other" ? "その他集中" : "";
}

export function courseScheduleCorpus(course) {
  return [course.semester, course.classPeriod, course.subject, course.contents, course.remarks, course.methodOfClass].filter(Boolean).join(" ").normalize("NFKC");
}

export function intensiveKind(course) {
  if (!course) return "";
  if (course._externalCourse) {
    if (course._externalRecord?.term === "summerIntensive") return "summer";
    if (course._externalRecord?.term === "winterIntensive") return "winter";
    if (course._externalRecord?.term === "otherIntensive") return "other";
    return "";
  }
  const corpus = courseScheduleCorpus(course);
  if (/夏(?:季|期)集中|夏休み.*集中|August/.test(corpus)) return "summer";
  if (/冬(?:季|期)集中|December|January|February|March/.test(corpus)) return "winter";
  if (course.semester === "集中" && /スキー/.test(course.subject || "") && /(?:12月|12\/|1月|1\/|2月|2\/|3月|3\/)/.test(corpus)) return "winter";
  if (course.semester === "集中") return "other";
  return "";
}

export function explicitScheduleDates(course) {
  const text = course?._externalCourse ? String(course.classPeriod || "") : courseScheduleCorpus(course);
  const normalized = text.normalize("NFKC");
  const dates = new Set();
  const add = (month, day) => {
    const m = Number(month), d = Number(day);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) dates.add(`${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`);
  };
  for (const match of normalized.matchAll(/(\d{1,2})[/月](\d{1,2})(?:日)?(?:\s*[-~〜～]\s*(?:(\d{1,2})[/月])?(\d{1,2})(?:日)?)?/g)) {
    const month = Number(match[1]);
    const start = Number(match[2]);
    const endMonth = match[3] ? Number(match[3]) : month;
    const end = match[4] ? Number(match[4]) : start;
    if (month === endMonth && end >= start && end - start <= 14) {
      for (let day = start; day <= end; day++) add(month, day);
    } else {
      add(month, start);
      if (match[4]) add(endMonth, end);
    }
  }
  return dates;
}

export function semesterSegments(semester) {
  if (/通年/.test(semester)) return ["spring", "summer", "fall", "winter"];
  if (/春/.test(semester)) return ["spring"];
  if (/夏/.test(semester)) return ["summer"];
  if (/秋/.test(semester)) return ["fall"];
  if (/冬/.test(semester)) return ["winter"];
  if (/前期/.test(semester)) return ["spring", "summer"];
  if (/後期/.test(semester)) return ["fall", "winter"];
  return [];
}

export function semestersOverlap(left, right) {
  const leftKind = intensiveKind(left);
  const rightKind = intensiveKind(right);
  if (left.semester === "集中" || right.semester === "集中") {
    if (leftKind && rightKind) return leftKind === rightKind;
    return false;
  }
  const leftSegments = semesterSegments(left.semester);
  const rightSegments = semesterSegments(right.semester);
  if (!leftSegments.length || !rightSegments.length) return false;
  const rightSet = new Set(rightSegments);
  return leftSegments.some((segment) => rightSet.has(segment));
}

export function hasUnfixedSchedule(course) {
  return (
    course.periods.length === 0 ||
    course.semester === "集中" ||
    /集中|未定|オンデマンド|指定しない|後日|アナウンス|開講時限/.test(course.classPeriod || "")
  );
}

export function periodSortValue(course) {
  const first = course.periods[0];
  if (!first) return 999;
  return (dayOrder.get(first.dayJa) ?? 90) * 10 + first.period;
}

export function overlapLabels(left, right) {
  const leftDates = explicitScheduleDates(left);
  const rightDates = explicitScheduleDates(right);
  if (leftDates.size && rightDates.size) {
    const sharedDates = [...leftDates].filter((date) => rightDates.has(date));
    if (sharedDates.length) return sharedDates.map((date) => `${date}（特別日程）`);
  }
  if (hasUnfixedSchedule(left) || hasUnfixedSchedule(right)) return [];
  if (!semestersOverlap(left, right)) return [];
  const rightKeys = new Set(right.periodKeys);
  return left.periods.filter((period) => rightKeys.has(period.key)).map((period) => period.label);
}

export function sameCourseConflict(left, right) {
  if (!semestersOverlap(left, right)) return false;
  const leftKey = sameCourseKey(left);
  return leftKey && leftKey === sameCourseKey(right);
}

export function conflictsForCourse(ctx, course, favorites = favoriteCourses(ctx)) {
  const comparison = [...favorites, ...externalCourseRecords(ctx).map(externalCourseAsCourse)];
  const virtualSeminar = virtualSeminarCourse(ctx, favorites);
  if (virtualSeminar && !isResearchGuidance(course)) comparison.push(virtualSeminar);
  return comparison
    .filter((favorite) => favorite.code !== course.code)
    .map((favorite) => {
      if (sameCourseConflict(course, favorite)) return { course: favorite, type: "sameCourse", periods: [] };
      if (syllabusRestrictionBetween(course, favorite)) return { course: favorite, type: "restriction", periods: [] };
      const periods = overlapLabels(course, favorite);
      return periods.length > 0 ? { course: favorite, type: "time", periods } : null;
    })
    .filter(Boolean);
}

export function favoriteConflictPairs(ctx, favorites = favoriteCourses(ctx)) {
  const comparison = [...favorites, ...externalCourseRecords(ctx).map(externalCourseAsCourse)];
  const virtualSeminar = virtualSeminarCourse(ctx, favorites);
  if (virtualSeminar) comparison.push(virtualSeminar);
  const pairs = [];
  for (let i = 0; i < comparison.length; i++) {
    for (let j = i + 1; j < comparison.length; j++) {
      if (sameCourseConflict(comparison[i], comparison[j])) {
        pairs.push({ left: comparison[i], right: comparison[j], type: "sameCourse", periods: [] });
        continue;
      }
      if (syllabusRestrictionBetween(comparison[i], comparison[j])) {
        pairs.push({ left: comparison[i], right: comparison[j], type: "restriction", periods: [] });
        continue;
      }
      const periods = overlapLabels(comparison[i], comparison[j]);
      if (periods.length > 0) pairs.push({ left: comparison[i], right: comparison[j], type: "time", periods });
    }
  }
  return pairs;
}

export function conflictText(conflict) {
  if (conflict.type === "sameCourse") {
    return `同一授業の別枠: ${conflict.course.subject} (${conflict.course.code})`;
  }
  if (conflict.type === "restriction") {
    return `シラバス上の履修制限: ${conflict.course.subject} (${conflict.course.code})`;
  }
  return `${conflict.course.semester} ${conflict.periods.join(" / ")} ${conflict.course.subject} (${conflict.course.code})`;
}

export function conflictPairText(conflict) {
  if (conflict.type === "sameCourse") {
    return `同一授業の別枠: ${conflict.left.subject} (${conflict.left.code}) と ${conflict.right.subject} (${conflict.right.code})`;
  }
  if (conflict.type === "restriction") {
    return `シラバス上で併履修不可・履修制限: ${conflict.left.subject} (${conflict.left.code}) と ${conflict.right.subject} (${conflict.right.code})`;
  }
  return `${conflict.left.semester} ${conflict.periods.join(" / ")}: ${conflict.left.subject} (${conflict.left.code}) と ${conflict.right.subject} (${conflict.right.code})`;
}
