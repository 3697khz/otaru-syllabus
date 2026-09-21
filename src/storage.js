import { favoriteStorageKey, legacyFavoriteCookieName, profileStorageKey } from './config.js';
import { defaultProfile } from './domain/values.js';
import { normalizeAcquiredCourseRecord, normalizeExternalCourseRecord, normalizeRecognitionRecord } from './domain/records.js';

export function parseFavoriteValue(ctx, value) {
  return new Set(
    decodeURIComponent(value || "")
      .split(",")
      .map((code) => code.trim())
      .filter((code) => ctx.coursesByCode.has(code))
  );
}

export function cookieValue(name) {
  return document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? "";
}

export function migrateAndClearLegacyFavoriteCookie() {
  try {
    const legacy = cookieValue(legacyFavoriteCookieName);
    if (legacy && !localStorage.getItem(favoriteStorageKey)) {
      localStorage.setItem(favoriteStorageKey, decodeURIComponent(legacy));
    }
    document.cookie = `${legacyFavoriteCookieName}=; max-age=0; path=/; SameSite=Lax`;
  } catch {
    // 旧版Cookieの移行・削除に失敗しても、現行版はCookieを保存先として利用しない。
  }
}

export function readFavoriteCodes(ctx) {
  try {
    return parseFavoriteValue(ctx, localStorage.getItem(favoriteStorageKey) ?? "");
  } catch {
    return new Set();
  }
}

export function saveFavoriteCodes(ctx) {
  const value = [...ctx.state.persistent.favoriteCodes].sort().join(",");
  try {
    localStorage.setItem(favoriteStorageKey, value);
  } catch {
    // 保存できなくても、現在のタブ内では履修計画を利用できる。
  }
}

export function readProfile(ctx) {
  const fallback = defaultProfile();
  try {
    const parsed = JSON.parse(localStorage.getItem(profileStorageKey) || "null");
    if (!parsed || typeof parsed !== "object") return fallback;
    const currentYear = String(parsed.currentYear || fallback.currentYear);
    const upperYear = currentYear === "3" || currentYear === "4";
    const department = currentYear === "1" ? "" : String(parsed.department || "");
    const allowedDepartments = new Set(["経済学科", "商学科", "商学科（英語専修）", "企業法学科", "社会情報学科"]);
    const hypotheticalDepartment = allowedDepartments.has(String(parsed.hypotheticalDepartment || "")) ? String(parsed.hypotheticalDepartment || "") : "";
    return {
      ...fallback,
      ...parsed,
      currentYear,
      department,
      hypotheticalDepartment,
      seminarPlanEnabled: typeof parsed.seminarPlanEnabled === "boolean" ? parsed.seminarPlanEnabled : upperYear,
      foreignPlanEnabled: typeof parsed.foreignPlanEnabled === "boolean" ? parsed.foreignPlanEnabled : upperYear,
      includeForeignSearch: typeof parsed.includeForeignSearch === "boolean" ? parsed.includeForeignSearch : !upperYear,
      includeSeminarSearch: typeof parsed.includeSeminarSearch === "boolean" ? parsed.includeSeminarSearch : false,
      credits: { ...fallback.credits, ...(parsed.credits || {}) },
      acquiredCourses: Array.isArray(parsed.acquiredCourses) ? parsed.acquiredCourses.map(normalizeAcquiredCourseRecord.bind(null, ctx.domain())).filter(Boolean) : [],
      recognitions: Array.isArray(parsed.recognitions) ? parsed.recognitions.map(normalizeRecognitionRecord).filter(Boolean) : [],
      externalCourses: Array.isArray(parsed.externalCourses) ? parsed.externalCourses.map(normalizeExternalCourseRecord).filter(Boolean) : [],
    };
  } catch {
    return fallback;
  }
}

export function saveProfile(ctx) {
  try {
    localStorage.setItem(profileStorageKey, JSON.stringify(ctx.state.persistent.profile));
  } catch {
    // Local browser storage is only a convenience; calculations still work without it.
  }
}
