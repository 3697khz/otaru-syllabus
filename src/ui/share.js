import { defaultProfile, formatCredit, numberValue } from '../domain/values.js';
import { acquiredCourseRecords, externalCourseRecords, normalizeExternalCourseRecord, normalizeRecognitionRecord } from '../domain/records.js';
import { dayOptions, externalTermLabels } from '../config.js';
import { saveFavoriteCodes, saveProfile } from '../storage.js';
import { favoriteCourses } from '../domain/course-rules.js';
import { courseScheduleText, periodSortValue } from '../domain/timetable.js';

export function encodeBase64Url(text) {
  const bytes = new TextEncoder().encode(String(text));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function currentShareOptions(ctx) {
  return {
    timetable: ctx.el.shareIncludeTimetable?.checked !== false,
    comparison: Boolean(ctx.el.shareIncludeComparison?.checked),
    filters: Boolean(ctx.el.shareIncludeFilters?.checked),
    profile: Boolean(ctx.el.shareIncludeProfile?.checked),
    progress: Boolean(ctx.el.shareIncludeProgress?.checked),
  };
}

export function buildSharedFilterPayload(ctx) {
  return {
    k: ctx.state.session.filters.keyword || "",
    s: ctx.state.session.filters.semester || "all",
    ct: [...ctx.state.session.filters.courseTracks], cg: [...ctx.state.session.filters.curriculumGroups], cs: [...ctx.state.session.filters.curriculumSubcategories],
    cf: [...ctx.state.session.filters.commonFields], dp: [...ctx.state.session.filters.departments], d: ctx.state.session.filters.day || "all", p: [...ctx.state.session.filters.periods],
    tg: [...ctx.state.session.filters.tags], tl: ctx.state.session.filters.tagLogic || "and", np: ctx.state.session.filters.noPeriod ? 1 : 0, mp: ctx.state.session.filters.multiPeriod ? 1 : 0,
    fo: ctx.state.session.filters.favoritesOnly ? 1 : 0, et: ctx.state.session.filters.excludeTeacherTraining ? 1 : 0, so: ctx.state.session.filters.sort || "no",
  };
}

export function buildSharedProfilePayload(ctx) {
  return {
    a: String(ctx.state.persistent.profile?.admissionYear || "2026"), y: String(ctx.state.persistent.profile?.currentYear || "1"),
    d: String(ctx.state.persistent.profile?.department || ""), h: String(ctx.state.persistent.profile?.hypotheticalDepartment || ""),
    fc: numberValue(ctx.state.persistent.profile?.failedCarry), n: ctx.state.persistent.profile?.noSeminar ? 1 : 0,
    ss: ctx.state.persistent.profile?.seminarScheduleEnabled !== false ? 1 : 0,
    sp: ctx.state.persistent.profile?.seminarPlanEnabled !== false ? 1 : 0,
    fp: ctx.state.persistent.profile?.foreignPlanEnabled !== false ? 1 : 0,
    fs: ctx.state.persistent.profile?.includeForeignSearch === true ? 1 : 0,
    zs: ctx.state.persistent.profile?.includeSeminarSearch === true ? 1 : 0,
  };
}

export function buildSharedProgressPayload(ctx) {
  return {
    a: acquiredCourseRecords(ctx.domain()).map((record) => record.code),
    r: (ctx.state.persistent.profile?.recognitions || []).map(normalizeRecognitionRecord).filter(Boolean).map((record) => ({
      s: record.source, l: record.label, c: record.credits, b: record.bucket, q: record.courseCode,
      a: record.capIncluded ? 1 : 0, m: record.remoteIncluded ? 1 : 0,
    })),
    c: { ...(ctx.state.persistent.profile?.credits || {}) },
  };
}

export function buildSharePayload(ctx, options = currentShareOptions(ctx)) {
  const payload = { v: 6 };
  if (options.timetable) {
    payload.c = [...ctx.state.persistent.favoriteCodes].filter((code) => ctx.coursesByCode.has(code)).sort();
    payload.x = externalCourseRecords(ctx.domain()).map((record) => ({
      u: record.university, s: record.subject, c: record.credits, t: record.term, d: record.schedule,
      b: record.bucket, a: record.capIncluded ? 1 : 0, r: record.remoteIncluded ? 1 : 0,
    }));
  }
  if (options.comparison) payload.q = [...ctx.state.session.compareCodes].filter((code) => ctx.coursesByCode.has(code)).slice(0, 4);
  if (options.filters) payload.f = buildSharedFilterPayload(ctx);
  if (options.profile) payload.p = buildSharedProfilePayload(ctx);
  if (options.progress) payload.g = buildSharedProgressPayload(ctx);
  return payload;
}

export function encodeSharePayload(ctx, payload = buildSharePayload(ctx)) {
  return encodeBase64Url(JSON.stringify(payload));
}

export function normalizeSharedFilters(ctx, raw) {
  if (!raw || typeof raw !== "object") return null;
  const pick = (values, allowed) => [...new Set((Array.isArray(values) ? values : []).filter((value) => allowed.has(String(value))).map(String))];
  const semesterAllowed = new Set(["all", ...(ctx.data.meta.semesters || []), "__summerIntensive", "__winterIntensive", "__otherIntensive"]);
  const dayAllowed = new Set(dayOptions);
  const sortAllowed = new Set(["no", "subject", "category", "period"]);
  const tagAllowed = new Set((ctx.data.meta.tagDefinitions || []).map((tag) => String(tag.id)));
  return {
    keyword: String(raw.k || "").slice(0, 200),
    semester: semesterAllowed.has(String(raw.s)) ? String(raw.s) : "all",
    courseTracks: pick(raw.ct, new Set((ctx.data.meta.courseTracks || []).map(String))),
    curriculumGroups: pick(raw.cg, new Set((ctx.data.meta.curriculumGroups || []).map(String))),
    curriculumSubcategories: pick(raw.cs, new Set((ctx.data.meta.curriculumSubcategories || []).map(String))),
    commonFields: pick(raw.cf, new Set((ctx.data.meta.commonFields || []).map(String))),
    departments: pick(raw.dp, new Set((ctx.data.meta.departmentOptions || ctx.data.meta.departments || []).map(String))),
    day: dayAllowed.has(String(raw.d)) ? String(raw.d) : "all",
    periods: pick(raw.p, new Set(ctx.periodOptions.map(String))), tags: pick(raw.tg, tagAllowed),
    tagLogic: raw.tl === "or" ? "or" : "and", noPeriod: Boolean(raw.np), multiPeriod: Boolean(raw.mp),
    favoritesOnly: Boolean(raw.fo), excludeTeacherTraining: raw.et !== 0,
    sort: sortAllowed.has(String(raw.so)) ? String(raw.so) : "no",
  };
}

export function normalizeSharedProfile(ctx, raw) {
  if (!raw || typeof raw !== "object") return null;
  const validDepartments = new Set(["", "経済学科", "商学科", "商学科（英語専修）", "企業法学科", "社会情報学科"]);
  const currentYear = ["1", "2", "3", "4"].includes(String(raw.y)) ? String(raw.y) : "1";
  let department = validDepartments.has(String(raw.d || "")) ? String(raw.d || "") : "";
  if (currentYear === "1") department = "";
  return {
    admissionYear: /^20\d{2}$/.test(String(raw.a || "")) ? String(raw.a) : "2026",
    currentYear, department,
    hypotheticalDepartment: validDepartments.has(String(raw.h || "")) ? String(raw.h || "") : "",
    failedCarry: Math.min(8, numberValue(raw.fc)), noSeminar: Boolean(raw.n),
    seminarScheduleEnabled: raw.ss !== 0, seminarPlanEnabled: raw.sp !== 0,
    foreignPlanEnabled: raw.fp !== 0, includeForeignSearch: raw.fs === 1, includeSeminarSearch: raw.zs === 1,
  };
}

export function normalizeSharedProgress(ctx, raw) {
  if (!raw || typeof raw !== "object") return null;
  const acquiredCourses = [...new Set((Array.isArray(raw.a) ? raw.a : []).filter((code) => typeof code === "string" && ctx.coursesByCode.has(code)))].map((code) => ({ code }));
  const recognitions = (Array.isArray(raw.r) ? raw.r : []).map((item, index) => normalizeRecognitionRecord({
    id: `shared-r-${index}-${String(item?.q || item?.l || "").slice(0, 12)}`, source: item?.s, label: item?.l,
    credits: item?.c, bucket: item?.b, courseCode: item?.q, capIncluded: Boolean(item?.a), remoteIncluded: Boolean(item?.m),
  })).filter(Boolean);
  const fallbackCredits = defaultProfile().credits;
  const credits = { ...fallbackCredits };
  if (raw.c && typeof raw.c === "object") {
    for (const key of Object.keys(fallbackCredits)) credits[key] = numberValue(raw.c[key]);
  }
  return { acquiredCourses, recognitions, credits };
}

export function decodeSharePayload(ctx, encoded) {
  try {
    const raw = JSON.parse(decodeBase64Url(encoded));
    if (!raw || ![1, 2, 3, 4, 5, 6].includes(raw.v)) return null;
    if (raw.v === 6) {
      const hasTimetable = Array.isArray(raw.c) || Array.isArray(raw.x);
      const codes = [...new Set((Array.isArray(raw.c) ? raw.c : []).filter((code) => typeof code === "string" && ctx.coursesByCode.has(code)))];
      const externalCourses = Array.isArray(raw.x) ? raw.x.map((item, index) => normalizeExternalCourseRecord({
        id: `shared-${index}-${String(item?.s || "").slice(0, 12)}`, university: item?.u, subject: item?.s, credits: item?.c,
        term: item?.t, schedule: item?.d, bucket: item?.b, capIncluded: Boolean(item?.a), remoteIncluded: Boolean(item?.r),
      })).filter(Boolean) : [];
      const compareCodes = [...new Set((Array.isArray(raw.q) ? raw.q : []).filter((code) => typeof code === "string" && ctx.coursesByCode.has(code)))].slice(0, 4);
      return {
        codes, externalCourses, compareCodes,
        filters: normalizeSharedFilters(ctx, raw.f), profile: normalizeSharedProfile(ctx, raw.p), progress: normalizeSharedProgress(ctx, raw.g),
        included: { timetable: hasTimetable, comparison: Array.isArray(raw.q), filters: Boolean(raw.f), profile: Boolean(raw.p), progress: Boolean(raw.g) },
      };
    }
    if (!Array.isArray(raw.c)) return null;
    const codes = [...new Set(raw.c.filter((code) => typeof code === "string" && ctx.coursesByCode.has(code)))];
    const externalCourses = raw.v >= 2 && Array.isArray(raw.x)
      ? raw.x.map((item, index) => normalizeExternalCourseRecord({
          id: `shared-${index}-${String(item?.s || "").slice(0, 12)}`, university: item?.u, subject: item?.s, credits: item?.c,
          term: item?.t, schedule: item?.d, bucket: item?.b, capIncluded: Boolean(item?.a), remoteIncluded: Boolean(item?.r),
        })).filter(Boolean)
      : [];
    if (raw.v >= 5) return { codes, externalCourses, compareCodes: [], filters: null, profile: null, progress: null, included: { timetable: true, comparison: false, filters: false, profile: false, progress: false } };

    const profile = raw.p && typeof raw.p === "object" ? raw.p : {};
    const currentYear = ["1", "2", "3", "4"].includes(String(profile.y)) ? String(profile.y) : "1";
    const validDepartments = new Set(["", "経済学科", "商学科", "商学科（英語専修）", "企業法学科", "社会情報学科"]);
    const department = validDepartments.has(String(profile.d || "")) ? String(profile.d || "") : "";
    const upperYear = currentYear === "3" || currentYear === "4";
    return {
      codes, externalCourses, compareCodes: [], filters: null, progress: null,
      profile: {
        currentYear, department,
        seminarScheduleEnabled: profile.z !== 0,
        seminarPlanEnabled: raw.v >= 3 ? profile.q !== 0 : upperYear,
        foreignPlanEnabled: raw.v >= 3 ? profile.f !== 0 : upperYear,
        includeForeignSearch: raw.v >= 3 ? profile.e === 0 : !upperYear,
        includeSeminarSearch: raw.v >= 4 ? profile.s === 1 : false,
        noSeminar: Boolean(profile.n),
      },
      included: { timetable: true, comparison: false, filters: false, profile: true, progress: false },
      legacy: true,
    };
  } catch {
    return null;
  }
}

export function sharedTimetableFromLocation(ctx) {
  try {
    const hash = window.location?.hash || "";
    if (!hash) return null;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const token = params.get("tt");
    return token ? decodeSharePayload(ctx, token) : null;
  } catch {
    return null;
  }
}

export function buildShareUrl(ctx, options = currentShareOptions(ctx)) {
  const href = window.location?.href;
  const token = encodeSharePayload(ctx, buildSharePayload(ctx, options));
  if (!href) return `#tt=${token}`;
  const url = new URL(href);
  url.hash = `tt=${token}`;
  return url.href;
}

export function sharedTimetableSummary(shared) {
  if (!shared) return "";
  const parts = [];
  if (shared.included?.timetable) parts.push(`時間割 ${shared.codes.length}科目${shared.externalCourses?.length ? `＋他大学${shared.externalCourses.length}科目` : ""}`);
  if (shared.included?.comparison) parts.push(`比較 ${shared.compareCodes?.length || 0}科目`);
  if (shared.included?.filters) parts.push("検索条件");
  if (shared.included?.profile) parts.push("学年・学科設定");
  if (shared.included?.progress) parts.push(`取得状況 ${shared.progress?.acquiredCourses?.length || 0}科目・認定${shared.progress?.recognitions?.length || 0}件`);
  if (shared.legacy) parts.push("旧形式");
  return parts.join(" / ") || "共有データ";
}

export function renderSharedImport(ctx) {
  if (!ctx.el.shareImportPanel) return;
  ctx.el.shareImportPanel.classList.toggle("is-hidden", !ctx.state.session.pendingSharedTimetable);
  if (ctx.state.session.pendingSharedTimetable && ctx.el.shareImportSummary) ctx.el.shareImportSummary.textContent = sharedTimetableSummary(ctx.state.session.pendingSharedTimetable);
}

export function clearSharedHash() {
  try {
    if (!window.location?.href || !globalThis.history?.replaceState) return;
    const url = new URL(window.location.href);
    url.hash = "";
    history.replaceState(null, "", url.href);
  } catch { /* Keep the existing fallback available when browser APIs are unavailable. */ }
}

export function showShareNotice(ctx, message) {
  if (!ctx.el.shareNotice) return;
  ctx.el.shareNotice.textContent = message;
  ctx.el.shareNotice.classList.remove("is-hidden");
  clearTimeout(ctx.state.session.shareNoticeTimer);
  ctx.state.session.shareNoticeTimer = setTimeout(() => ctx.el.shareNotice?.classList.add("is-hidden"), 5000);
}

export function applySharedFilters(ctx, filters) {
  if (!filters) return;
  ctx.state.session.filters.keyword = filters.keyword;
  ctx.state.session.filters.semester = filters.semester;
  ctx.state.session.filters.courseTracks = new Set(filters.courseTracks);
  ctx.state.session.filters.curriculumGroups = new Set(filters.curriculumGroups);
  ctx.state.session.filters.curriculumSubcategories = new Set(filters.curriculumSubcategories);
  ctx.state.session.filters.commonFields = new Set(filters.commonFields);
  ctx.state.session.filters.departments = new Set(filters.departments);
  ctx.state.session.filters.day = filters.day;
  ctx.state.session.filters.periods = new Set(filters.periods);
  ctx.state.session.filters.tags = new Set(filters.tags);
  ctx.state.session.filters.tagLogic = filters.tagLogic;
  ctx.state.session.filters.noPeriod = filters.noPeriod;
  ctx.state.session.filters.multiPeriod = filters.multiPeriod;
  ctx.state.session.filters.favoritesOnly = filters.favoritesOnly;
  ctx.state.session.filters.excludeTeacherTraining = filters.excludeTeacherTraining;
  ctx.state.session.filters.sort = filters.sort;
  if (ctx.el.keywordInput) ctx.el.keywordInput.value = ctx.state.session.filters.keyword;
  if (ctx.el.semesterSelect) ctx.el.semesterSelect.value = ctx.state.session.filters.semester;
  if (ctx.el.sortSelect) ctx.el.sortSelect.value = ctx.state.session.filters.sort;
  if (ctx.el.noPeriodToggle) ctx.el.noPeriodToggle.checked = ctx.state.session.filters.noPeriod;
  if (ctx.el.multiPeriodToggle) ctx.el.multiPeriodToggle.checked = ctx.state.session.filters.multiPeriod;
  if (ctx.el.favoriteOnlyToggle) ctx.el.favoriteOnlyToggle.checked = ctx.state.session.filters.favoritesOnly;
  if (ctx.el.excludeTeacherTrainingToggle) ctx.el.excludeTeacherTrainingToggle.checked = ctx.state.session.filters.excludeTeacherTraining;
}

export function mergeRecognitionRecords(current, incoming) {
  const out = [...current];
  const keyOf = (record) => [record.source, record.label, record.credits, record.bucket, record.courseCode, record.capIncluded ? 1 : 0, record.remoteIncluded ? 1 : 0].join("|");
  const seen = new Set(out.map(keyOf));
  for (const record of incoming) {
    const key = keyOf(record);
    if (seen.has(key)) continue;
    out.push({ ...record, id: `r-${Date.now()}-${out.length}` });
    seen.add(key);
  }
  return out;
}

export function applySharedTimetable(ctx, mode = "replace") {
  if (!ctx.state.session.pendingSharedTimetable) return;
  const shared = ctx.state.session.pendingSharedTimetable;
  const included = shared.included || { timetable: true };
  const skippedOnMerge = [];

  if (included.timetable) {
    if (mode === "replace") {
      ctx.state.persistent.favoriteCodes = new Set(shared.codes || []);
      ctx.state.persistent.profile.externalCourses = shared.externalCourses || [];
    } else {
      for (const code of shared.codes || []) ctx.state.persistent.favoriteCodes.add(code);
      const existing = externalCourseRecords(ctx.domain());
      const keys = new Set(existing.map((record) => `${record.university}|${record.subject}|${record.term}|${record.schedule}`));
      for (const record of shared.externalCourses || []) {
        const key = `${record.university}|${record.subject}|${record.term}|${record.schedule}`;
        if (!keys.has(key)) { existing.push(record); keys.add(key); }
      }
      ctx.state.persistent.profile.externalCourses = existing;
    }
  }
  if (included.comparison) {
    if (mode === "replace") ctx.state.session.compareCodes = new Set((shared.compareCodes || []).slice(0, 4));
    else for (const code of shared.compareCodes || []) { if (ctx.state.session.compareCodes.size < 4) ctx.state.session.compareCodes.add(code); }
  }
  if (included.filters) {
    if (mode === "replace") applySharedFilters(ctx, shared.filters);
    else skippedOnMerge.push("検索条件");
  }
  if (included.profile && shared.profile) {
    if (mode === "replace") Object.assign(ctx.state.persistent.profile, shared.profile);
    else skippedOnMerge.push("学年・学科設定");
  }
  if (included.progress && shared.progress) {
    if (mode === "replace") {
      ctx.state.persistent.profile.acquiredCourses = shared.progress.acquiredCourses;
      ctx.state.persistent.profile.recognitions = shared.progress.recognitions;
      ctx.state.persistent.profile.credits = { ...defaultProfile().credits, ...shared.progress.credits };
    } else {
      const acquired = new Set(acquiredCourseRecords(ctx.domain()).map((record) => record.code));
      for (const record of shared.progress.acquiredCourses) acquired.add(record.code);
      ctx.state.persistent.profile.acquiredCourses = [...acquired].map((code) => ({ code }));
      ctx.state.persistent.profile.recognitions = mergeRecognitionRecords((ctx.state.persistent.profile.recognitions || []).map(normalizeRecognitionRecord).filter(Boolean), shared.progress.recognitions || []);
      skippedOnMerge.push("取得済み単位の集計値");
    }
  }

  saveFavoriteCodes(ctx);
  saveProfile(ctx);
  ctx.state.session.pendingSharedTimetable = null;
  ctx.syncProfileControls();
  ctx.renderControls();
  renderSharedImport(ctx);
  clearSharedHash();
  ctx.render();
  const skipped = skippedOnMerge.length ? ` ${skippedOnMerge.join("・")}は上書きせず維持しました。` : "";
  showShareNotice(ctx, mode === "replace" ? "共有データを読み込みました。" : `共有データを現在の内容へ追加しました。${skipped}`);
}

export async function copyTextValue(ctx, value, successMessage) {
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      showShareNotice(ctx, successMessage);
      return true;
    }
  } catch { /* Keep the existing fallback available when browser APIs are unavailable. */ }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const ok = document.execCommand?.("copy");
    textarea.remove();
    if (ok) { showShareNotice(ctx, successMessage); return true; }
  } catch { /* Keep the existing fallback available when browser APIs are unavailable. */ }
  showShareNotice(ctx, "自動コピーできませんでした。手動でコピーしてください。");
  return false;
}

export async function copyShareUrl(ctx) {
  return copyTextValue(ctx, ctx.el.shareUrlInput?.value || buildShareUrl(ctx), "共有URLをコピーしました。");
}

export function buildTimetableShareText(ctx) {
  const favorites = favoriteCourses(ctx.domain()).sort((a, b) => periodSortValue(a) - periodSortValue(b) || a.subject.localeCompare(b.subject, "ja"));
  const external = externalCourseRecords(ctx.domain());
  const lines = ["小樽商大履修支援サイト｜履修候補", `本学 ${favorites.length}科目${external.length ? ` / 他大学 ${external.length}科目` : ""}`];
  for (const course of favorites) lines.push(`${courseScheduleText(course)}｜${course.subject}｜${course.instructor || "担当不明"}｜${course.code}`);
  for (const record of external) lines.push(`${externalTermLabels[record.term]} ${record.schedule || "日程未定"}｜${record.subject}｜${record.university}｜${formatCredit(record.credits)}単位`);
  if (window.location?.protocol !== "file:") lines.push("", buildShareUrl(ctx, { timetable: true, comparison: false, filters: false, profile: false, progress: false }));
  return lines.join("\n");
}

export function downloadShareJson(ctx) {
  try {
    const payload = { schema: "otaru-syllabus-share", version: 1, exportedAt: new Date().toISOString(), payload: buildSharePayload(ctx) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `otaru-rishu-share-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showShareNotice(ctx, "共有JSONを書き出しました。");
  } catch {
    showShareNotice(ctx, "共有JSONを書き出せませんでした。");
  }
}

export async function importShareDataFile(ctx, file) {
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    if (raw?.schema !== "otaru-syllabus-share" || raw?.version !== 1 || !raw.payload) throw new Error("invalid share file");
    const shared = decodeSharePayload(ctx, encodeSharePayload(ctx, raw.payload));
    if (!shared) throw new Error("invalid payload");
    ctx.state.session.pendingSharedTimetable = shared;
    renderSharedImport(ctx);
    showShareNotice(ctx, "共有JSONを読み込みました。内容を確認して反映方法を選んでください。");
  } catch {
    showShareNotice(ctx, "この共有JSONは読み込めません。");
  } finally {
    if (ctx.el.importShareDataInput) ctx.el.importShareDataInput.value = "";
  }
}

export function updateShareDialogPreview(ctx) {
  const options = currentShareOptions(ctx);
  const selected = [];
  if (options.timetable) selected.push(`時間割 ${ctx.state.persistent.favoriteCodes.size}科目${externalCourseRecords(ctx.domain()).length ? `＋他大学${externalCourseRecords(ctx.domain()).length}科目` : ""}`);
  if (options.comparison) selected.push(`比較 ${ctx.state.session.compareCodes.size}科目`);
  if (options.filters) selected.push("検索条件");
  if (options.profile) selected.push("学年・学科・履修設定");
  if (options.progress) selected.push(`取得状況 ${acquiredCourseRecords(ctx.domain()).length}科目・認定${(ctx.state.persistent.profile?.recognitions || []).length}件`);
  const hasAny = selected.length > 0;
  const url = hasAny ? buildShareUrl(ctx, options) : "";
  if (ctx.el.shareUrlInput) ctx.el.shareUrlInput.value = url;
  const sensitive = options.profile || options.progress;
  if (ctx.el.shareSelectionSummary) {
    const lengthNote = url.length > 8000 ? ` / URLが長めです（${url.length.toLocaleString()}文字）。JSON共有を推奨します。` : "";
    ctx.el.shareSelectionSummary.textContent = hasAny ? `共有内容: ${selected.join(" / ")}${lengthNote}` : "共有する項目を1つ以上選んでください。";
    ctx.el.shareSelectionSummary.classList.toggle("warn", sensitive || url.length > 8000);
  }
  if (ctx.el.sharePrivacyNote) {
    ctx.el.sharePrivacyNote.textContent = sensitive
      ? "学年・学科や取得状況を含める設定です。共有URL・共有JSONを知る人はその内容を確認できます。必要な相手にだけ送ってください。URLの共有データは # 以降に格納され、通常のHTTPリクエストではサーバーへ送られません。"
      : "既定では時間割・履修候補だけを共有します。共有URLのデータは # 以降に格納され、通常のHTTPリクエストではサーバーへ送られません。";
  }
  if (ctx.el.copyShareUrlButton) ctx.el.copyShareUrlButton.disabled = !hasAny;
  if (ctx.el.downloadShareJsonButton) ctx.el.downloadShareJsonButton.disabled = !hasAny;
  if (ctx.el.nativeShareButton) ctx.el.nativeShareButton.disabled = !hasAny;
  if (ctx.el.copyShareTextButton) ctx.el.copyShareTextButton.disabled = !options.timetable || (ctx.state.persistent.favoriteCodes.size === 0 && externalCourseRecords(ctx.domain()).length === 0);
}

export function openShareDialog(ctx) {
  const isLocal = window.location?.protocol === "file:";
  if (ctx.el.shareDialogDescription) {
    ctx.el.shareDialogDescription.textContent = isLocal
      ? "共有する内容を選べます。ローカルプレビューのURL自体は他端末で開けないため、今は共有JSONか時間割テキストが確実です。Web公開後はURL共有も利用できます。"
      : "共有する内容を選んでURL・テキスト・JSONを作成できます。個人性の高い項目は初期状態では含めません。";
  }
  updateShareDialogPreview(ctx);
  if (ctx.el.nativeShareButton) {
    const canNativeShare = !isLocal && typeof globalThis.navigator?.share === "function";
    ctx.el.nativeShareButton.classList.toggle("is-hidden", !canNativeShare);
  }
  if (typeof ctx.el.shareDialog?.showModal === "function") ctx.el.shareDialog.showModal();
  else ctx.el.shareDialog?.setAttribute?.("open", "");
}
