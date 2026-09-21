

export function defaultProfile() {
  return {
    admissionYear: "2026",
    currentYear: "1",
    department: "",
    hypotheticalDepartment: "",
    failedCarry: 0,
    seminarScheduleEnabled: true,
    seminarPlanEnabled: false,
    foreignPlanEnabled: false,
    includeForeignSearch: true,
    includeSeminarSearch: false,
    noSeminar: false,
    acquiredCourses: [],
    recognitions: [],
    externalCourses: [],
    credits: {
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
      research: 0,
      noSeminarReplacement: 0,
      remotePost2022: 0,
    },
  };
}

export function numberValue(value) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function courseCredits(course) {
  return numberValue(course?.credits);
}

export function sameCourseKey(course) {
  return (course.subject || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/\([A-Za-z]*[0-9][A-Za-z0-9-]*[A-Za-z]\)/g, "")
    .replace(/\([A-Za-z]\)/g, "")
    .trim();
}

export function normalizeSubjectName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/（昼間コース）|\(昼間コース\)/g, "")
    .replace(/\s+/g, "")
    .trim();
}

export function formatCredit(value) {
  const n = numberValue(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function stableRecordId(record, prefix) {
  const text = JSON.stringify(record);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return prefix + "-legacy-" + (hash >>> 0).toString(36);
}
