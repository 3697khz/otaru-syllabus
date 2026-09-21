import { courseCredits, defaultProfile, formatCredit, normalizeSubjectName, numberValue, sameCourseKey } from '../domain/values.js';
import { acquiredCourseBreakdown, acquiredCourseRecords, externalCourseRecords, normalizeExternalCourseRecord, normalizeRecognitionRecord, recognitionBreakdown } from '../domain/records.js';
import { saveFavoriteCodes, saveProfile } from '../storage.js';
import { graduationBucket } from '../domain/course-rules.js';
import { recognitionBucketLabels, recognitionSourceLabels } from '../config.js';

export function resolveAcquiredCourseQuery(ctx, value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (ctx.coursesByCode.has(raw)) return ctx.coursesByCode.get(raw);
  const leadingCode = raw.match(/^([0-9A-Za-z_-]{5,})\b/)?.[1];
  if (leadingCode && ctx.coursesByCode.has(leadingCode)) return ctx.coursesByCode.get(leadingCode);
  const normalized = normalizeSubjectName(raw);
  const exact = ctx.data.courses.filter((course) => normalizeSubjectName(course.subject) === normalized);
  if (exact.length === 1) return exact[0];
  const fuzzy = ctx.data.courses.filter((course) => normalizeSubjectName(course.subject).includes(normalized));
  return fuzzy.length === 1 ? fuzzy[0] : null;
}

export function addAcquiredCourseFromControls(ctx) {
  const course = resolveAcquiredCourseQuery(ctx, ctx.el.acquiredCourseInput?.value);
  if (!course) {
    if (ctx.el.acquiredCourseHelp) ctx.el.acquiredCourseHelp.textContent = "科目を特定できません。科目コードを入力するか、候補から科目を選んでください。";
    return;
  }
  const records = acquiredCourseRecords(ctx.domain());
  if (records.some((record) => record.code === course.code)) {
    if (ctx.el.acquiredCourseHelp) ctx.el.acquiredCourseHelp.textContent = `${course.subject}（${course.code}）はすでに取得済みとして登録されています。`;
    return;
  }
  const sameRecorded = records.map((record) => ctx.coursesByCode.get(record.code)).find((recordedCourse) => recordedCourse && sameCourseKey(recordedCourse) === sameCourseKey(course));
  if (sameRecorded) {
    if (ctx.el.acquiredCourseHelp) ctx.el.acquiredCourseHelp.textContent = `${course.subject} は、登録済みの ${sameRecorded.subject}（${sameRecorded.code}）と同一授業の別枠として扱われるため追加しませんでした。`;
    return;
  }
  const recognizedCodes = new Set((ctx.state.persistent.profile?.recognitions || []).map((record) => String(record.courseCode || "")).filter(Boolean));
  if (recognizedCodes.has(course.code)) {
    if (ctx.el.acquiredCourseHelp) ctx.el.acquiredCourseHelp.textContent = `${course.subject}（${course.code}）は単位認定の読替科目として登録済みです。二重計上を避けるため追加しませんでした。`;
    return;
  }
  ctx.state.persistent.profile.acquiredCourses = [...records, { code: course.code }];
  if (ctx.state.persistent.favoriteCodes.has(course.code)) {
    ctx.state.persistent.favoriteCodes.delete(course.code);
    saveFavoriteCodes(ctx);
  }
  saveProfile(ctx);
  if (ctx.el.acquiredCourseInput) ctx.el.acquiredCourseInput.value = "";
  if (ctx.el.acquiredCourseHelp) ctx.el.acquiredCourseHelp.textContent = `${course.subject}（${course.code}）を取得済みに追加しました。`;
  ctx.render();
}

export function removeAcquiredCourse(ctx, code) {
  ctx.state.persistent.profile.acquiredCourses = acquiredCourseRecords(ctx.domain()).filter((record) => record.code !== code);
  saveProfile(ctx);
  ctx.render();
}

export function populateAcquiredCourseDatalist(ctx) {
  if (!ctx.el.acquiredCourseDatalist) return;
  const fragment = document.createDocumentFragment();
  for (const course of ctx.data.courses) {
    const option = document.createElement("option");
    option.value = `${course.code} ${course.subject}`;
    fragment.append(option);
  }
  ctx.el.acquiredCourseDatalist.replaceChildren(fragment);
}

export function acquiredCourseMeta(ctx, course) {
  const bucket = graduationBucket(ctx.domain(), course);
  const labels = {
    knowledge: "知（地）の基礎", humanCulture: "人間と文化", societyHuman: "社会と人間",
    natureEnvironment: "自然と環境", health: "健康科学", foreign: "外国語", commonOther: "共通科目",
    academicUnassigned: "学科未確定", ownCore: "自学科基幹", ownAdvanced: "自学科発展",
    academicFlex: "学科等20単位枠", research: "研究指導",
  };
  const allocation = labels[bucket.bucket] || "区分要確認";
  return `${course.code} / ${formatCredit(courseCredits(course))}単位 / ${allocation}`;
}

export function renderAcquiredCourses(ctx) {
  if (!ctx.el.acquiredCourseList || !ctx.el.acquiredCourseStats) return;
  const breakdown = acquiredCourseBreakdown(ctx.domain());
  const records = breakdown.records;
  const totalCredits = records.reduce((sum, record) => sum + courseCredits(ctx.coursesByCode.get(record.code)), 0);
  ctx.el.acquiredCourseStats.replaceChildren();
  for (const [label, value] of [["登録科目", `${records.length}科目`], ["登録単位", `${formatCredit(totalCredits)}単位`], ["自動算入", `${formatCredit(breakdown.totals.graduationCountable)}単位`]]) {
    const stat = document.createElement("span");
    stat.className = "acquired-course-stat";
    const small = document.createElement("span"); small.textContent = label;
    const strong = document.createElement("strong"); strong.textContent = value;
    stat.append(small, strong);
    ctx.el.acquiredCourseStats.append(stat);
  }
  ctx.el.acquiredCourseList.replaceChildren();
  if (!records.length) {
    const empty = document.createElement("div");
    empty.className = "acquired-course-empty";
    empty.textContent = "取得済み科目はまだ登録されていません。";
    ctx.el.acquiredCourseList.append(empty);
    return;
  }
  for (const record of records) {
    const course = ctx.coursesByCode.get(record.code);
    if (!course) continue;
    const item = document.createElement("div");
    item.className = "acquired-course-item";
    const main = document.createElement("div");
    main.className = "acquired-course-main";
    const title = document.createElement("strong"); title.textContent = course.subject;
    const meta = document.createElement("span"); meta.textContent = acquiredCourseMeta(ctx, course);
    main.append(title, meta);
    const remove = document.createElement("button");
    remove.type = "button"; remove.className = "small-button"; remove.textContent = "削除";
    remove.addEventListener("click", () => removeAcquiredCourse(ctx, course.code));
    item.append(main, remove);
    ctx.el.acquiredCourseList.append(item);
  }
}

export function addExternalCourseFromControls(ctx) {
  const record = normalizeExternalCourseRecord({
    id: `x-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    university: ctx.el.externalUniversityInput?.value,
    subject: ctx.el.externalSubjectInput?.value,
    credits: ctx.el.externalCreditsInput?.value,
    term: ctx.el.externalTermInput?.value,
    schedule: ctx.el.externalScheduleInput?.value,
    bucket: ctx.el.externalBucketInput?.value,
    capIncluded: Boolean(ctx.el.externalCapInput?.checked),
    remoteIncluded: Boolean(ctx.el.externalRemoteInput?.checked),
  });
  if (!record) {
    if (ctx.el.externalCourseHelp) ctx.el.externalCourseHelp.textContent = "大学名・科目名・単位数を確認してください。";
    return;
  }
  ctx.state.persistent.profile.externalCourses = [...externalCourseRecords(ctx.domain()), record];
  saveProfile(ctx);
  if (ctx.el.externalSubjectInput) ctx.el.externalSubjectInput.value = "";
  if (ctx.el.externalScheduleInput) ctx.el.externalScheduleInput.value = "";
  if (ctx.el.externalCourseHelp) ctx.el.externalCourseHelp.textContent = "他大学との単位互換は、正式に認定された単位と合わせて60単位上限の対象です。CAP対象かどうかは当該年度の案内に合わせて設定してください。";
  ctx.render();
}

export function removeExternalCourse(ctx, id) {
  ctx.state.persistent.profile.externalCourses = externalCourseRecords(ctx.domain()).filter((record) => record.id !== id);
  saveProfile(ctx);
  ctx.render();
}

export function recognitionSourceHelpText(source) {
  if (source === "prior") return "入学前既修得単位はCAP外です。本学科目へ読替えられた認定結果に合わせて算入先を選んでください。";
  if (source === "exam") return "検定等の認定は、申請時点で対象科目を履修中ならCAPに含まれる場合があります。検定等による認定科目は面接授業として扱われ、遠隔授業単位には数えません。";
  if (source === "interUniversity") return "他大学との単位互換も認定単位60単位上限の対象です。今年度CAPに入るかは実際の履修登録・科目の扱いに合わせて設定してください。";
  if (source === "studyAbroad") return "留学単位は原則として読替えなしで算入される場合があり、必要に応じて基礎・外国語・学科・専門共通科目へ読替えられます。認定通知に合わせて入力してください。";
  return "大学の認定結果に合わせて入力してください。";
}

export function syncRecognitionSourceHelp(ctx) {
  if (!ctx.el.recognitionSourceHelp || !ctx.el.recognitionSourceInput) return;
  const source = ctx.el.recognitionSourceInput.value;
  ctx.el.recognitionSourceHelp.textContent = recognitionSourceHelpText(source);
  const capLockedOut = source === "prior" || source === "studyAbroad";
  if (capLockedOut) ctx.el.recognitionCapInput.checked = false;
  ctx.el.recognitionCapInput.disabled = capLockedOut;
  const remoteLockedOut = source === "exam";
  if (remoteLockedOut) ctx.el.recognitionRemoteInput.checked = false;
  ctx.el.recognitionRemoteInput.disabled = remoteLockedOut;
}

export function addRecognitionFromControls(ctx) {
  const credits = numberValue(ctx.el.recognitionCreditsInput?.value);
  if (!credits) {
    if (ctx.el.recognitionSourceHelp) ctx.el.recognitionSourceHelp.textContent = "認定単位数を入力してください。";
    return;
  }
  const source = ctx.el.recognitionSourceInput?.value || "prior";
  const record = normalizeRecognitionRecord({
    id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source,
    label: ctx.el.recognitionLabelInput?.value?.trim() || recognitionSourceLabels[source],
    credits,
    bucket: ctx.el.recognitionBucketInput?.value || "unallocated",
    courseCode: ctx.el.recognitionCourseCodeInput?.value?.trim() || "",
    capIncluded: Boolean(ctx.el.recognitionCapInput?.checked),
    remoteIncluded: Boolean(ctx.el.recognitionRemoteInput?.checked),
  });
  if (!record) return;
  ctx.state.persistent.profile.recognitions = [...(ctx.state.persistent.profile.recognitions || []), record];
  saveProfile(ctx);
  if (ctx.el.recognitionLabelInput) ctx.el.recognitionLabelInput.value = "";
  if (ctx.el.recognitionCourseCodeInput) ctx.el.recognitionCourseCodeInput.value = "";
  ctx.render();
}

export function removeRecognition(ctx, id) {
  ctx.state.persistent.profile.recognitions = (ctx.state.persistent.profile.recognitions || []).filter((record) => record.id !== id);
  saveProfile(ctx);
  ctx.render();
}

export function clearEarnedCredits(ctx) {
  const hasCredits = Object.values(ctx.state.persistent.profile?.credits || {}).some((value) => numberValue(value) > 0);
  const hasCourses = acquiredCourseRecords(ctx.domain()).length > 0;
  if (!hasCredits && !hasCourses) return;
  const confirmed = globalThis.confirm?.("登録した取得済み科目と、入力した取得済み単位をすべて解除します。単位認定・時間割・お気に入り・学年/学科設定は削除しません。元に戻せません。続けますか？") ?? false;
  if (!confirmed) return;
  ctx.state.persistent.profile.credits = { ...defaultProfile().credits };
  ctx.state.persistent.profile.acquiredCourses = [];
  saveProfile(ctx);
  ctx.syncProfileControls();
  ctx.render();
}

export function clearRecognitions(ctx) {
  if (!(ctx.state.persistent.profile?.recognitions || []).length) return;
  const confirmed = globalThis.confirm?.("登録した単位認定をすべて削除します。取得済み単位・時間割・お気に入り・学年/学科設定は削除しません。元に戻せません。続けますか？") ?? false;
  if (!confirmed) return;
  ctx.state.persistent.profile.recognitions = [];
  saveProfile(ctx);
  ctx.render();
}

export function recognitionMetaText(ctx, record) {
  const parts = [recognitionSourceLabels[record.source], `${formatCredit(record.credits)}単位`, recognitionBucketLabels[record.bucket]];
  if (record.courseCode) {
    const course = ctx.coursesByCode.get(record.courseCode);
    parts.push(course ? `${record.courseCode} ${course.subject}` : `読替コード ${record.courseCode}`);
  }
  return parts.join(" / ");
}

export function renderRecognitions(ctx) {
  if (!ctx.el.recognitionList || !ctx.el.recognitionStats) return;
  const { totals, records } = recognitionBreakdown(ctx.domain());
  const limit = ctx.handbook?.requirements?.recognizedGraduationMax ?? 60;
  ctx.el.recognitionStats.replaceChildren();
  const stats = [
    ["認定単位", `${formatCredit(totals.recognized)} / ${formatCredit(limit)}`],
    ["今年度CAP加算", `${formatCredit(totals.cap)}単位`],
    ["区分未確定", `${formatCredit(totals.unallocated)}単位`],
    ["学科未確定", `${formatCredit(totals.academicUnassigned)}単位`],
  ];
  for (const [label, value] of stats) {
    const item = document.createElement("span");
    item.className = "recognition-stat";
    const textNode = document.createElement("span");
    textNode.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    item.append(textNode, strong);
    ctx.el.recognitionStats.append(item);
  }
  ctx.el.recognitionList.replaceChildren();
  if (!records.length) {
    const empty = document.createElement("div");
    empty.className = "recognition-empty";
    empty.textContent = "登録された認定単位はありません。";
    ctx.el.recognitionList.append(empty);
    return;
  }
  for (const record of records) {
    const item = document.createElement("div");
    item.className = "recognition-item";
    const main = document.createElement("div");
    main.className = "recognition-item-main";
    const title = document.createElement("strong");
    title.textContent = record.label;
    const meta = document.createElement("span");
    meta.textContent = recognitionMetaText(ctx, record);
    const badges = document.createElement("div");
    badges.className = "recognition-item-badges";
    if (record.capIncluded) {
      const badge = document.createElement("span"); badge.className = "recognition-badge warn"; badge.textContent = "今年度CAP算入"; badges.append(badge);
    }
    if (record.remoteIncluded) {
      const badge = document.createElement("span"); badge.className = "recognition-badge info"; badge.textContent = "遠隔60単位枠"; badges.append(badge);
    }
    if (record.bucket === "unallocated") {
      const badge = document.createElement("span"); badge.className = "recognition-badge warn"; badge.textContent = "区分未確定"; badges.append(badge);
    }
    if (record.bucket === "academicUnassigned") {
      const badge = document.createElement("span"); badge.className = "recognition-badge info"; badge.textContent = "学科未確定"; badges.append(badge);
    }
    main.append(title, meta, badges);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "small-button";
    remove.textContent = "削除";
    remove.addEventListener("click", () => removeRecognition(ctx, record.id));
    item.append(main, remove);
    ctx.el.recognitionList.append(item);
  }
}

export function maybeAutofillRecognitionCourse(ctx) {
  const code = String(ctx.el.recognitionCourseCodeInput?.value || "").trim();
  if (!code) return;
  const course = ctx.coursesByCode.get(code);
  if (!course) return;
  if (ctx.el.recognitionLabelInput && !ctx.el.recognitionLabelInput.value.trim()) ctx.el.recognitionLabelInput.value = course.subject;
  const classified = graduationBucket(ctx.domain(), course);
  if (classified.bucket && classified.bucket !== "manual" && Object.prototype.hasOwnProperty.call(recognitionBucketLabels, classified.bucket)) {
    ctx.el.recognitionBucketInput.value = classified.bucket;
  }
}
