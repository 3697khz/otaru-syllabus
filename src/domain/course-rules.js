import { normalizeSubjectName, sameCourseKey } from './values.js';

export function isUpperYearProfile(ctx) {
  const year = Number(ctx.profile?.currentYear || 1);
  return year === 3 || year === 4;
}

export function favoriteCourses(ctx) { return ctx.plannedCourses; }

export function isFirstYearProfile(ctx) {
  return String(ctx.profile?.currentYear || "1") === "1";
}

export function actualDepartment(ctx) {
  return isFirstYearProfile(ctx) ? "" : (ctx.profile?.department || "");
}

export function selectedDepartment(ctx) {
  if (isFirstYearProfile(ctx)) return ctx.profile?.hypotheticalDepartment || "";
  return ctx.profile?.department || "";
}

export function isHypotheticalDepartmentSelection(ctx) {
  return isFirstYearProfile(ctx) && Boolean(ctx.profile?.hypotheticalDepartment);
}

export function dataDepartmentForProfile(ctx) {
  return ctx.handbook?.departmentDataNames?.[selectedDepartment(ctx)] || "";
}

export function codeSetFor(ctx, department, level) {
  return new Set(ctx.handbook?.majorCourseCodes?.[department]?.[level] || []);
}

export function ownMajorLevel(ctx, course, department = selectedDepartment(ctx)) {
  if (!ctx.handbook || !department) return "";
  if (codeSetFor(ctx, department, "core").has(course.code)) return "core";
  if (codeSetFor(ctx, department, "advanced").has(course.code)) return "advanced";
  if ((ctx.handbook.crossMajorAdvanced?.[course.code] || []).includes(department)) return "advanced";
  return "";
}

export function academicOwners(ctx, course) {
  if (!ctx.handbook) return [];
  const owners = [];
  for (const department of Object.keys(ctx.handbook.majorCourseCodes || {})) {
    if (ownMajorLevel(ctx, course, department)) owners.push(department);
  }
  return owners;
}

export function isFirstYearPlacementCoreCourse(ctx, course) {
  if (!course || course.courseTrack !== "昼間コース") return false;
  if (minimumEligibleYear(course) !== 1) return false;
  if (/^135/.test(course.code || "")) return false; // 商学科英語専修の基幹科目は学科所属成績基準の対象外
  return Object.entries(ctx.handbook?.majorCourseCodes || {}).some(([department, sets]) => {
    if (department === "商学科（英語専修）") return false;
    return (sets?.core || []).includes(course.code);
  });
}

export function isAllowedFreeSubject(ctx, course) {
  const subject = normalizeSubjectName(course.subject);
  return (ctx.handbook?.allowedFreeSubjects || []).some((name) => normalizeSubjectName(name) === subject);
}

export function fieldCreditKey(course) {
  const map = {
    "知（地）の基礎系": "knowledge",
    "人間と文化系": "humanCulture",
    "社会と人間系": "societyHuman",
    "自然と環境系": "natureEnvironment",
    "健康科学系": "health",
  };
  return map[course.commonField] || "";
}

export function isResearchGuidance(course) {
  return course.curriculumSubcategory === "研究指導（ゼミナール）" && /^170/.test(course.code);
}

export function seminarYearForCourse(course) {
  if (!isResearchGuidance(course)) return 0;
  if (/3年ゼミ/.test(course.subject || "")) return 3;
  if (/4年ゼミ/.test(course.subject || "")) return 4;
  return 0;
}

export function seminarProfile(ctx) {
  const year = Number(ctx.profile?.currentYear || 1);
  const enrolled = !ctx.profile?.noSeminar && (year === 3 || year === 4);
  const scheduleEnabled = ctx.profile?.seminarScheduleEnabled !== false;
  const planEnabled = ctx.profile?.seminarPlanEnabled !== false;
  return {
    year,
    enrolled,
    scheduleEnabled,
    planEnabled,
    capCredits: enrolled && planEnabled && year === 4 ? 12 : 0,
    defaultSlots: year === 3
      ? [{ dayJa: "木", dayEn: "Thu", period: 4, label: "木4", key: "木-4" }, { dayJa: "木", dayEn: "Thu", period: 5, label: "木5", key: "木-5" }]
      : year === 4
        ? [{ dayJa: "火", dayEn: "Tue", period: 4, label: "火4", key: "火-4" }, { dayJa: "火", dayEn: "Tue", period: 5, label: "火5", key: "火-5" }]
        : [],
  };
}

export function selectedSeminarCourses(ctx, favorites = favoriteCourses(ctx)) {
  const year = Number(ctx.profile?.currentYear || 1);
  return favorites.filter((course) => isResearchGuidance(course) && seminarYearForCourse(course) === year);
}

export function virtualSeminarCourse(ctx, favorites = favoriteCourses(ctx)) {
  const seminar = seminarProfile(ctx);
  if (!seminar.enrolled || !seminar.scheduleEnabled || !seminar.defaultSlots.length) return null;
  if (selectedSeminarCourses(ctx, favorites).length) return null;
  const periodKeys = seminar.defaultSlots.map((period) => period.key);
  return {
    code: `SEMINAR-AUTO-${seminar.year}`,
    subject: `研究指導（${seminar.year}年次・標準ゼミ枠）`,
    semester: "通年",
    credits: seminar.year === 4 ? "12" : "0",
    periods: seminar.defaultSlots,
    periodKeys,
    classPeriod: seminar.defaultSlots.map((period) => period.label).join(" / "),
    courseTrack: "昼間コース",
    curriculumSubcategory: "研究指導（ゼミナール）",
    instructor: "ゼミにより異なる",
    url: "",
    _virtualSeminar: true,
  };
}

export function graduationBucket(ctx, course) {
  if (!ctx.handbook || course.courseTrack !== "昼間コース") return { bucket: "manual", reason: "昼間コースの自動判定対象外" };

  if (course.curriculumSubcategory === "基礎科目") {
    const key = fieldCreditKey(course);
    if (key) return { bucket: key };
    return { bucket: "commonOther" };
  }
  if (course.curriculumSubcategory === "外国語科目") return { bucket: "foreign" };
  if (course.curriculumSubcategory === "日本語科目") {
    return { bucket: "manual", reason: "日本語科目は留学生要件により扱いが異なる" };
  }

  if (isResearchGuidance(course)) {
    const profileDept = dataDepartmentForProfile(ctx);
    if (!selectedDepartment(ctx)) return { bucket: "manual", reason: Number(ctx.profile.currentYear) === 1 ? "1年次は学科配属前のため、研究指導の学科判定対象外" : "所属学科を選択してください" };
    if (course.department === profileDept || course.department === "学科横断") return { bucket: "research" };
    return { bucket: "manual", reason: "他学科ゼミは個別確認が必要" };
  }

  if (course.curriculumSubcategory === "学科専門科目" && !selectedDepartment(ctx)) {
    if (isFirstYearProfile(ctx)) return { bucket: "academicUnassigned", reason: "1年次は学科配属前のため、学科未確定として総単位へ暫定反映" };
    return { bucket: "manual", reason: "所属学科を選択すると算入区分を判定できます" };
  }

  const ownLevel = ownMajorLevel(ctx, course);
  if (ownLevel === "core") return { bucket: "ownCore" };
  if (ownLevel === "advanced") return { bucket: "ownAdvanced" };

  if (course.curriculumSubcategory === "専門共通科目" || course.curriculumGroup === "専門共通科目") {
    return { bucket: "academicFlex" };
  }

  if (isAllowedFreeSubject(ctx, course)) return { bucket: "academicFlex" };

  const owners = academicOwners(ctx, course);
  if (owners.length) {
    if (isFirstYearProfile(ctx) && !selectedDepartment(ctx)) return { bucket: "academicUnassigned", reason: "1年次は学科配属前のため、学科未確定として総単位へ暫定反映" };
    if (/^135/.test(course.code) && selectedDepartment(ctx) !== "商学科（英語専修）") {
      return { bucket: "manual", reason: "英語専修科目は卒業所要単位への算入科目が限定される" };
    }
    return { bucket: "academicFlex" };
  }

  if (course.curriculumSubcategory === "学科専門科目") {
    return { bucket: "manual", reason: "学科科目の算入区分を自動特定できません" };
  }

  return { bucket: "manual", reason: "卒業所要単位への自動算入対象を特定できません" };
}

export function remoteMethodNumber(course) {
  const match = String(course.methodOfClass || "").match(/^([①②③④⑤⑥])/);
  return match?.[1] || "";
}

export function isRemoteForLimit(course) {
  return ["③", "④", "⑤", "⑥"].includes(remoteMethodNumber(course));
}

export function isCapExempt(ctx, course) {
  if (course.curriculumSubcategory === "教職共通科目") return true;
  const subject = normalizeSubjectName(course.subject);
  if (/^社会連携実践[ⅠⅡIIIⅢ]/.test(subject)) return true;
  if ((ctx.handbook?.capExemptExactSubjects || []).some((name) => subject.startsWith(normalizeSubjectName(name)))) return true;
  if (/^【課外】/.test(course.subject || "")) return true;
  if (/^410/.test(course.code || "")) return true;
  if (isResearchGuidance(course) && Number(ctx.profile.currentYear) === 3) return true;
  return false;
}

export function minimumEligibleYear(course) {
  const values = String(course.years || "").match(/[1-4]/g)?.map(Number) || [];
  return values.length ? Math.min(...values) : 1;
}

export function isYearEligible(ctx, course) {
  return Number(ctx.profile.currentYear || 1) >= minimumEligibleYear(course);
}

export function uniquePlannedCourses(ctx, favorites = favoriteCourses(ctx)) {
  const seen = new Set();
  const unique = [];
  for (const course of favorites) {
    const key = `${sameCourseKey(course)}|${course.semester || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(course);
  }
  return unique;
}
