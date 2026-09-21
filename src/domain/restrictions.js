import { normalizeSubjectName, sameCourseKey } from './values.js';
import { acquiredCourseRecords, normalizeRecognitionRecord } from './records.js';

export function compactRestrictionText(value) {
  return String(value || "").normalize("NFKC").replace(/&ne;|&rarr;/g, " ").replace(/\s+/g, " ").trim();
}

export function subjectMentionedNearRestriction(text, subject) {
  const normalizedText = compactRestrictionText(text).replace(/\s+/g, "");
  if (!normalizedText) return false;
  const forms = [normalizeSubjectName(subject), sameCourseKey({ subject })]
    .map((value) => String(value || "").replace(/\s+/g, ""))
    .filter((value, index, array) => value.length >= 4 && array.indexOf(value) === index);
  const directRestriction = /(単位既修得者|単位を?取得した者は履修できません|取得済みの人は履修できません|既修得者.{0,30}履修できません|両方.{0,20}履修.{0,15}できません|履修する場合は.{0,50}履修できません|単位を取得済み.{0,30}履修できません|単位修得済み.{0,30}履修できません)/;
  const prerequisiteOnly = /(修得済みでなければ履修できません|単位未修得.{0,30}履修.{0,15}できません|不合格.{0,30}履修.{0,15}できません)/;
  for (const form of forms) {
    let index = normalizedText.indexOf(form);
    while (index >= 0) {
      const window = normalizedText.slice(Math.max(0, index - 100), Math.min(normalizedText.length, index + form.length + 150));
      if (directRestriction.test(window)) return true;
      if (prerequisiteOnly.test(window)) {
        index = normalizedText.indexOf(form, index + form.length);
        continue;
      }
      index = normalizedText.indexOf(form, index + form.length);
    }
  }
  return false;
}

export function syllabusRestrictionBetween(left, right) {
  if (!left || !right || left._externalCourse || right._externalCourse || left._virtualSeminar || right._virtualSeminar) return false;
  return subjectMentionedNearRestriction(left.remarks, right.subject) || subjectMentionedNearRestriction(right.remarks, left.subject);
}

export function acquiredCourseIssues(ctx, course) {
  if (!course || course._externalCourse || course._virtualSeminar) return [];
  const issues = [];
  for (const record of (ctx.profile?.recognitions || []).map(normalizeRecognitionRecord).filter(Boolean)) {
    if (record.courseCode && record.courseCode === course.code) {
      issues.push({ type: "recognizedExact", acquired: course, message: `単位認定済み: ${course.subject}（${course.code}）` });
    }
  }
  for (const record of acquiredCourseRecords(ctx)) {
    const acquired = ctx.coursesByCode.get(record.code);
    if (!acquired) continue;
    if (course.code === acquired.code) {
      issues.push({ type: "acquiredExact", acquired, message: `取得済み: ${acquired.subject}（${acquired.code}）` });
      continue;
    }
    if (sameCourseKey(course) && sameCourseKey(course) === sameCourseKey(acquired)) {
      issues.push({ type: "acquiredSameCourse", acquired, message: `取得済みの同一授業・別枠: ${acquired.subject}（${acquired.code}）` });
      continue;
    }
    const candidateRestricts = subjectMentionedNearRestriction(course.remarks, acquired.subject);
    const acquiredRestricts = subjectMentionedNearRestriction(acquired.remarks, course.subject);
    if (candidateRestricts || acquiredRestricts) {
      issues.push({ type: "acquiredRestriction", acquired, message: `既修得による履修制限を確認: ${acquired.subject}（${acquired.code}）` });
    }
  }
  const unique = [];
  const seen = new Set();
  for (const issue of issues) {
    const key = `${issue.type}|${issue.acquired.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(issue);
  }
  return unique;
}

export function acquiredIssueText(issue) {
  return issue?.message || "取得済み科目との関係を確認してください";
}
