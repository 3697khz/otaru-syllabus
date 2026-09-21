import { courseCredits, numberValue, stableRecordId } from './values.js';
import { graduationBucket } from './course-rules.js';
import { externalTermLabels, recognitionBucketLabels, recognitionSourceLabels } from '../config.js';

export function normalizeAcquiredCourseRecord(ctx, record) {
  if (typeof record === "string") record = { code: record };
  if (!record || typeof record !== "object") return null;
  const code = String(record.code || "").trim();
  if (!ctx.coursesByCode.has(code)) return null;
  return { code };
}

export function acquiredCourseRecords(ctx) {
  const seen = new Set();
  const records = [];
  for (const raw of ctx.profile?.acquiredCourses || []) {
    const record = normalizeAcquiredCourseRecord(ctx, raw);
    if (!record || seen.has(record.code)) continue;
    seen.add(record.code);
    records.push(record);
  }
  return records;
}

export function acquiredCourseBreakdown(ctx) {
  const totals = {
    knowledge: 0, humanCulture: 0, societyHuman: 0, natureEnvironment: 0, health: 0, foreign: 0,
    commonOther: 0, academicUnassigned: 0, ownCore: 0, ownAdvanced: 0, academicFlex: 0, research: 0,
    graduationCountable: 0,
  };
  const records = acquiredCourseRecords(ctx);
  const manual = [];
  for (const record of records) {
    const course = ctx.coursesByCode.get(record.code);
    if (!course) continue;
    const credits = courseCredits(course);
    const classified = graduationBucket(ctx, course);
    if (classified.bucket === "manual" || !Object.prototype.hasOwnProperty.call(totals, classified.bucket)) {
      manual.push({ course, reason: classified.reason || "算入区分を自動判定できません" });
      continue;
    }
    totals[classified.bucket] += credits;
    totals.graduationCountable += credits;
  }
  return { totals, records, manual };
}

export function normalizeExternalCourseRecord(record) {
  if (!record || typeof record !== "object") return null;
  const credits = Number.parseFloat(record.credits);
  if (!Number.isFinite(credits) || credits <= 0) return null;
  const term = Object.prototype.hasOwnProperty.call(externalTermLabels, record.term) ? record.term : "spring";
  const bucket = Object.prototype.hasOwnProperty.call(recognitionBucketLabels, record.bucket) ? record.bucket : "unallocated";
  const subject = String(record.subject || "").trim();
  if (!subject) return null;
  return {
    id: String(record.id || stableRecordId(record, "x")),
    university: String(record.university || "他大学").trim() || "他大学",
    subject,
    credits: Math.min(12, credits),
    term,
    schedule: String(record.schedule || "").trim(),
    bucket,
    capIncluded: Boolean(record.capIncluded),
    remoteIncluded: Boolean(record.remoteIncluded),
  };
}

export function externalCourseRecords(ctx) {
  return (ctx.profile?.externalCourses || []).map(normalizeExternalCourseRecord).filter(Boolean);
}

export function externalPlannedBreakdown(ctx) {
  const totals = {
    knowledge: 0, humanCulture: 0, societyHuman: 0, natureEnvironment: 0, health: 0, foreign: 0,
    commonOther: 0, academicUnassigned: 0, ownCore: 0, ownAdvanced: 0, academicFlex: 0, unallocated: 0,
    recognized: 0, cap: 0, remote: 0,
  };
  const records = externalCourseRecords(ctx);
  for (const record of records) {
    totals.recognized += record.credits;
    totals[record.bucket] = numberValue(totals[record.bucket]) + record.credits;
    if (record.capIncluded) totals.cap += record.credits;
    if (record.remoteIncluded) totals.remote += record.credits;
  }
  return { totals, records };
}

export function parseExternalPeriods(schedule) {
  const normalized = String(schedule || "").normalize("NFKC");
  const periods = [];
  const seen = new Set();
  const regex = /(月|火|水|木|金|土|日)(?:曜)?\s*([1-7])(?:限)?/g;
  let match;
  while ((match = regex.exec(normalized))) {
    const dayJa = match[1];
    const period = Number(match[2]);
    const key = `${dayJa}-${period}`;
    if (seen.has(key)) continue;
    seen.add(key);
    periods.push({ dayJa, period, label: `${dayJa}${period}`, key });
  }
  return periods;
}

export function externalCourseAsCourse(record) {
  const periods = ["summerIntensive", "winterIntensive", "otherIntensive"].includes(record.term) ? [] : parseExternalPeriods(record.schedule);
  return {
    code: `EXT-${record.id}`,
    subject: record.subject,
    semester: externalTermLabels[record.term],
    credits: String(record.credits),
    periods,
    periodKeys: periods.map((period) => period.key),
    classPeriod: record.schedule || externalTermLabels[record.term],
    courseTrack: "他大学単位互換",
    curriculumSubcategory: "他大学単位互換",
    instructor: record.university,
    url: "",
    _externalCourse: true,
    _externalRecord: record,
  };
}

export function normalizeRecognitionRecord(record) {
  if (!record || typeof record !== "object") return null;
  const source = Object.prototype.hasOwnProperty.call(recognitionSourceLabels, record.source) ? record.source : "prior";
  const bucket = Object.prototype.hasOwnProperty.call(recognitionBucketLabels, record.bucket) ? record.bucket : "unallocated";
  const credits = Number.parseFloat(record.credits);
  if (!Number.isFinite(credits) || credits <= 0) return null;
  return {
    id: String(record.id || stableRecordId(record, "r")),
    source,
    label: String(record.label || recognitionSourceLabels[source]).trim(),
    credits: Math.min(60, credits),
    bucket,
    courseCode: String(record.courseCode || "").trim(),
    capIncluded: Boolean(record.capIncluded),
    remoteIncluded: Boolean(record.remoteIncluded),
  };
}

export function recognitionBreakdown(ctx) {
  const totals = {
    knowledge: 0,
    humanCulture: 0,
    societyHuman: 0,
    natureEnvironment: 0,
    health: 0,
    foreign: 0,
    commonOther: 0,
    academicUnassigned: 0,
    ownCore: 0,
    ownAdvanced: 0,
    academicFlex: 0,
    unallocated: 0,
    recognized: 0,
    cap: 0,
    remote: 0,
  };
  const records = (ctx.profile?.recognitions || []).map(normalizeRecognitionRecord).filter(Boolean);
  for (const record of records) {
    const credits = record.credits;
    totals.recognized += credits;
    if (Object.prototype.hasOwnProperty.call(totals, record.bucket)) totals[record.bucket] += credits;
    else totals.unallocated += credits;
    if (record.capIncluded) totals.cap += credits;
    if (record.remoteIncluded) totals.remote += credits;
  }
  return { totals, records };
}
