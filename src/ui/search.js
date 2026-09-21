import { isCapExempt, isUpperYearProfile, remoteMethodNumber } from '../domain/course-rules.js';
import { dayOptions } from '../config.js';
import { intensiveKind } from '../domain/timetable.js';

export function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function option(value, label) {
  const node = document.createElement("option");
  node.value = value;
  node.textContent = label;
  return node;
}

export function chip(label, value, checked, onChange) {
  const wrapper = document.createElement("label");
  wrapper.className = "chip";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = value;
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked, value));
  const text = document.createElement("span");
  text.textContent = label;
  wrapper.append(input, text);
  return wrapper;
}

export function segment(label, value, checked, onChange) {
  const wrapper = document.createElement("label");
  wrapper.className = "segment";
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "day";
  input.value = value;
  input.checked = checked;
  input.addEventListener("change", () => onChange(value));
  const text = document.createElement("span");
  text.textContent = label;
  wrapper.append(input, text);
  return wrapper;
}

export function renderChipFilters(container, options, selected, onChange) {
  container.replaceChildren();
  for (const value of options ?? []) {
    container.append(
      chip(value, value, selected.has(value), (checked, current) => {
        checked ? selected.add(current) : selected.delete(current);
        onChange();
      })
    );
  }
}

export function renderControls(ctx) {
  const generated = formatDate(ctx.data.meta.generatedAt);
  ctx.el.sourceNote.textContent = `${ctx.data.meta.count ?? ctx.data.courses.length}科目 / データ更新 ${generated || "不明"}`;

  ctx.el.semesterSelect.replaceChildren(option("all", "すべて"));
  for (const semester of ctx.data.meta.semesters ?? []) {
    ctx.el.semesterSelect.append(option(semester, semester === "集中" ? "集中（すべて）" : semester));
  }
  ctx.el.semesterSelect.append(option("__summerIntensive", "夏期集中"));
  ctx.el.semesterSelect.append(option("__winterIntensive", "冬季集中"));
  ctx.el.semesterSelect.append(option("__otherIntensive", "その他集中・特別日程"));
  ctx.el.semesterSelect.value = ctx.state.session.filters.semester;

  renderChipFilters(ctx.el.courseTrackFilters, ctx.data.meta.courseTracks, ctx.state.session.filters.courseTracks, ctx.render);
  renderChipFilters(ctx.el.curriculumGroupFilters, ctx.data.meta.curriculumGroups, ctx.state.session.filters.curriculumGroups, ctx.render);
  const subcategoryOptions = (ctx.data.meta.curriculumSubcategories ?? []).filter((value) => {
    if (ctx.state.persistent.profile.includeSeminarSearch !== true && value === "研究指導（ゼミナール）") return false;
    if (isUpperYearProfile(ctx.domain()) && ctx.state.persistent.profile.includeForeignSearch !== true && value === "外国語科目") return false;
    if (ctx.state.session.filters.excludeTeacherTraining && value === "教職共通科目") return false;
    return true;
  });
  if (ctx.state.persistent.profile.includeSeminarSearch !== true) ctx.state.session.filters.curriculumSubcategories.delete("研究指導（ゼミナール）");
  if (isUpperYearProfile(ctx.domain()) && ctx.state.persistent.profile.includeForeignSearch !== true) ctx.state.session.filters.curriculumSubcategories.delete("外国語科目");
  if (ctx.state.session.filters.excludeTeacherTraining) ctx.state.session.filters.curriculumSubcategories.delete("教職共通科目");
  if (ctx.el.excludeTeacherTrainingToggle) ctx.el.excludeTeacherTrainingToggle.checked = ctx.state.session.filters.excludeTeacherTraining;
  renderChipFilters(ctx.el.subcategoryFilters, subcategoryOptions, ctx.state.session.filters.curriculumSubcategories, ctx.render);
  const commonFieldOptions = (ctx.data.meta.commonFields ?? []).filter((value) => {
    return !(isUpperYearProfile(ctx.domain()) && ctx.state.persistent.profile.includeForeignSearch !== true && value === "外国語科目");
  });
  if (isUpperYearProfile(ctx.domain()) && ctx.state.persistent.profile.includeForeignSearch !== true) ctx.state.session.filters.commonFields.delete("外国語科目");
  renderChipFilters(ctx.el.commonFieldFilters, commonFieldOptions, ctx.state.session.filters.commonFields, ctx.render);
  renderChipFilters(ctx.el.departmentFilters, ctx.data.meta.departmentOptions ?? ctx.data.meta.departments, ctx.state.session.filters.departments, ctx.render);

  ctx.el.dayFilters.replaceChildren();
  for (const day of dayOptions) {
    ctx.el.dayFilters.append(
      segment(day === "all" ? "全日" : day, day, ctx.state.session.filters.day === day, (value) => {
        ctx.state.session.filters.day = value;
        ctx.render();
      })
    );
  }

  ctx.el.periodFilters.replaceChildren();
  for (const period of ctx.periodOptions) {
    ctx.el.periodFilters.append(
      chip(`${period}限`, String(period), ctx.state.session.filters.periods.has(String(period)), (checked, value) => {
        checked ? ctx.state.session.filters.periods.add(value) : ctx.state.session.filters.periods.delete(value);
        ctx.render();
      })
    );
  }

  const methodTagIds = new Set(["remote", "onDemand", "syncOnline", "faceToFace", "hybrid"]);
  const methodTags = (ctx.data.meta.tagDefinitions ?? []).filter((tag) => methodTagIds.has(tag.id));
  const practicalTags = (ctx.data.meta.tagDefinitions ?? []).filter((tag) => !methodTagIds.has(tag.id));

  ctx.el.methodTagFilters.replaceChildren();
  for (const tag of methodTags) {
    ctx.el.methodTagFilters.append(
      chip(tag.label, tag.id, ctx.state.session.filters.tags.has(tag.id), (checked, value) => {
        checked ? ctx.state.session.filters.tags.add(value) : ctx.state.session.filters.tags.delete(value);
        ctx.render();
      })
    );
  }

  ctx.el.tagFilters.replaceChildren();
  for (const tag of practicalTags) {
    ctx.el.tagFilters.append(
      chip(tag.label, tag.id, ctx.state.session.filters.tags.has(tag.id), (checked, value) => {
        checked ? ctx.state.session.filters.tags.add(value) : ctx.state.session.filters.tags.delete(value);
        ctx.render();
      })
    );
  }
}

export function searchableText(course) {
  return [
    course.subject,
    course.code,
    course.instructor,
    course.courseTrack,
    course.category,
    course.curriculumGroup,
    course.curriculumSubcategory,
    course.commonField,
    course.department,
    course.classPeriod,
    course.grading,
    course.remarks,
    course.objectivesMethod,
    course.contents,
    course.preparationReview,
    course.materials,
    course.methodOfClass,
  ]
    .join(" ")
    .toLowerCase();
}

export function isSeminarSearchCourse(course) {
  return course?.curriculumSubcategory === "研究指導（ゼミナール）";
}

export function normalizeTagText(value) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function addDerivedCourseTag(course, id, label, reason) {
  if (!Array.isArray(course.practicalTags)) course.practicalTags = [];
  if (!Array.isArray(course.practicalTagIds)) course.practicalTagIds = [];
  const existing = course.practicalTags.find((tag) => tag.id === id);
  if (existing) {
    existing.label = label;
    if (!existing.reason && reason) existing.reason = reason;
  } else {
    course.practicalTags.push({ id, label, reason });
  }
  if (!course.practicalTagIds.includes(id)) course.practicalTagIds.push(id);
}

export function enrichEvaluationAndUtilityTags(ctx) {
  if (!Array.isArray(ctx.data.meta.tagDefinitions)) ctx.data.meta.tagDefinitions = [];
  const definitions = [
    ["presentation", "発表・プレゼンあり"],
    ["groupWork", "グループワークあり"],
    ["weeklyTasks", "毎週・毎回課題あり"],
    ["midtermExam", "中間試験あり"],
    ["quiz", "小テストあり"],
    ["noExam", "試験なし"],
    ["noReport", "レポートなし"],
    ["evaluation3Plus", "評価要素3種類以上"],
    ["capacityLimit", "人数制限・抽選あり"],
    ["englishTaught", "英語開講"],
    ["pcUse", "PC使用"],
    ["capExempt", "CAP外"],
    ["remoteLimitExempt", "遠隔60単位対象外"],
  ];
  const labelById = new Map(definitions);
  for (const [id, label] of definitions) {
    const existing = ctx.data.meta.tagDefinitions.find((tag) => tag.id === id);
    if (existing) existing.label = label;
    else ctx.data.meta.tagDefinitions.push({ id, label });
  }

  for (const course of ctx.data.courses) {
    for (const tag of course.practicalTags ?? []) {
      if (labelById.has(tag.id)) tag.label = labelById.get(tag.id);
    }

    const grading = normalizeTagText(course.grading);
    const assessmentText = normalizeTagText([course.grading, course.contents].filter(Boolean).join(" "));
    const operationalText = normalizeTagText([
      course.remarks,
      course.objectivesMethod,
      course.contents,
      course.preparationReview,
      course.materials,
      course.grading,
    ].filter(Boolean).join(" "));
    const existingIds = new Set(course.practicalTagIds ?? []);

    if (/(中間(?:試験|テスト)|mid[- ]?term(?: exam| test)?)/i.test(assessmentText)) {
      addDerivedCourseTag(course, "midtermExam", "中間試験あり", "シラバスに中間試験・中間テストの記載があります");
    }
    if (/(小テスト|確認テスト|pop quizzes?|quizzes?|quiz|クイズ)/i.test(assessmentText)) {
      addDerivedCourseTag(course, "quiz", "小テストあり", "シラバスに小テスト・確認テスト等の記載があります");
    }

    const explicitlyNoExam = /(?:^|[。、;；\s])(?:定期試験|試験|テスト)(?:は|を)?(?:実施しない|行わない|課さない|設けない)/.test(grading)
      || /(?:定期試験|試験)なし(?:[。、;；\s]|$)/.test(grading);
    if (existingIds.has("reportOnly") || explicitlyNoExam) {
      addDerivedCourseTag(course, "noExam", "試験なし", existingIds.has("reportOnly") ? "評価方法がレポートのみです" : "成績評価欄に試験を実施しない旨の記載があります");
    }

    const explicitlyNoReport = /(?:^|[。、;；\s])(?:レポート|報告書)(?:は|を)?(?:課さない|求めない|提出不要|設けない)/.test(grading)
      || /(?:レポート|報告書)なし(?:[。、;；\s]|$)/.test(grading);
    if (existingIds.has("finalExamOnly") || explicitlyNoReport) {
      addDerivedCourseTag(course, "noReport", "レポートなし", existingIds.has("finalExamOnly") ? "評価方法が期末試験のみです" : "成績評価欄にレポートを課さない旨の記載があります");
    }

    const evaluationElements = new Set();
    if (/(期末試験|定期試験|筆記試験|最終試験|中間(?:試験|テスト)|oral exam|final exam|mid[- ]?term)/i.test(grading)) evaluationElements.add("試験");
    if (/(小テスト|確認テスト|pop quizzes?|quizzes?|quiz|クイズ)/i.test(grading)) evaluationElements.add("小テスト");
    if (/(レポート|リアクションペーパー|コメントシート|報告書|essay|book report)/i.test(grading)) evaluationElements.add("レポート");
    if (/(出席|欠席|授業参加|参加度|平常点|授業態度|participation|attendance|class contribution)/i.test(grading)) evaluationElements.add("出席・参加");
    if (/(発表|プレゼン|presentation)/i.test(grading)) evaluationElements.add("発表");
    if (/(グループワーク|グループ活動|group work)/i.test(grading)) evaluationElements.add("グループワーク");
    if (/(宿題|homework|assignment|毎回の課題|各回の課題|課題提出)/i.test(grading)) evaluationElements.add("課題");
    if (/(実技|実習|演習成果)/i.test(grading)) evaluationElements.add("実技・実習");
    if (evaluationElements.size >= 3) {
      addDerivedCourseTag(course, "evaluation3Plus", "評価要素3種類以上", `成績評価欄で ${[...evaluationElements].join("・")} を確認`);
    }

    const capacityText = normalizeTagText([course.remarks, course.objectivesMethod, course.materials].filter(Boolean).join(" "));
    if (/(抽選|人数制限|履修制限|受講制限|履修者数.{0,15}(?:上限|制限)|定員(?:[0-9０-９]|は|を|が|:|：)|先着)/.test(capacityText)) {
      addDerivedCourseTag(course, "capacityLimit", "人数制限・抽選あり", "シラバスに定員・抽選・履修人数制限等の記載があります");
    }

    if (/(英語(?:で|による|を用いて|を使用して).{0,15}(?:授業|講義|実施)|(?:授業|講義)(?:は|を).{0,12}英語(?:で|により)|conducted in English|taught in English|English[- ]medium|classes? (?:are|will be) conducted in English)/i.test(operationalText)) {
      addDerivedCourseTag(course, "englishTaught", "英語開講", "授業を英語で実施する旨の記載があります");
    }

    const pcTool = "(?:PC|パソコン|ノートPC|ノートパソコン|Excel|エクセル|Python|RStudio|R言語|表計算ソフト)";
    const pcAction = "(?:使用|利用|持参|必要|操作|演習|用いる|使う|インストール|用意)";
    const pcPattern = new RegExp(`${pcTool}.{0,24}${pcAction}|${pcAction}.{0,24}${pcTool}`, "i");
    if (pcPattern.test(operationalText)) {
      addDerivedCourseTag(course, "pcUse", "PC使用", "PCまたはPC上のソフトウェアを使用・持参する旨の記載があります");
    }
  }
}

export function courseFilterTagIds(ctx, course) {
  const ids = new Set(course.practicalTagIds ?? []);
  if (isCapExempt(ctx.domain(), course)) ids.add("capExempt");
  const method = remoteMethodNumber(course);
  if (["①", "②"].includes(method)) ids.add("remoteLimitExempt");
  return ids;
}

export function matchesTime(ctx, course) {
  const hasSlotFilter = ctx.state.session.filters.day !== "all" || ctx.state.session.filters.periods.size > 0;
  const dayMatches = ctx.state.session.filters.day === "all" || course.periods.some((period) => period.dayJa === ctx.state.session.filters.day);
  const periodMatches =
    ctx.state.session.filters.periods.size === 0 || course.periods.some((period) => ctx.state.session.filters.periods.has(String(period.period)));
  const slotMatches = course.periods.length > 0 && dayMatches && periodMatches;
  const noPeriodMatches = ctx.state.session.filters.noPeriod && course.hasNoPeriod && !intensiveKind(course);
  const multiPeriodMatches = ctx.state.session.filters.multiPeriod && course.hasMultiplePeriods && (!hasSlotFilter || slotMatches);
  if (ctx.state.session.filters.noPeriod || ctx.state.session.filters.multiPeriod) return noPeriodMatches || multiPeriodMatches;
  if (!hasSlotFilter) return true;
  return slotMatches;
}

export function matches(ctx, course) {
  if (ctx.state.persistent.profile.includeSeminarSearch !== true && isSeminarSearchCourse(course)) return false;
  if (isUpperYearProfile(ctx.domain()) && ctx.state.persistent.profile.includeForeignSearch !== true && course.curriculumSubcategory === "外国語科目") return false;
  if (ctx.state.session.filters.excludeTeacherTraining && course.curriculumSubcategory === "教職共通科目") return false;
  if (ctx.state.session.filters.favoritesOnly && !ctx.state.persistent.favoriteCodes.has(course.code)) return false;
  if (ctx.state.session.filters.keyword) {
    const words = ctx.state.session.filters.keyword.toLowerCase().split(/\s+/).filter(Boolean);
    const haystack = searchableText(course);
    if (!words.every((word) => haystack.includes(word))) return false;
  }
  if (ctx.state.session.filters.semester !== "all") {
    if (ctx.state.session.filters.semester === "__summerIntensive" && intensiveKind(course) !== "summer") return false;
    else if (ctx.state.session.filters.semester === "__winterIntensive" && intensiveKind(course) !== "winter") return false;
    else if (ctx.state.session.filters.semester === "__otherIntensive" && intensiveKind(course) !== "other") return false;
    else if (!ctx.state.session.filters.semester.startsWith("__") && course.semester !== ctx.state.session.filters.semester) return false;
  }
  if (ctx.state.session.filters.courseTracks.size > 0 && !ctx.state.session.filters.courseTracks.has(course.courseTrack)) return false;
  if (ctx.state.session.filters.curriculumGroups.size > 0 && !ctx.state.session.filters.curriculumGroups.has(course.curriculumGroup)) return false;
  if (ctx.state.session.filters.curriculumSubcategories.size > 0 && !ctx.state.session.filters.curriculumSubcategories.has(course.curriculumSubcategory)) {
    return false;
  }
  if (ctx.state.session.filters.commonFields.size > 0 && !ctx.state.session.filters.commonFields.has(course.commonField)) return false;
  if (ctx.state.session.filters.departments.size > 0 && !ctx.state.session.filters.departments.has(course.department)) return false;
  if (!matchesTime(ctx, course)) return false;
  if (ctx.state.session.filters.tags.size > 0) {
    const selectedTags = [...ctx.state.session.filters.tags];
    const availableTags = courseFilterTagIds(ctx, course);
    const tagMatches = ctx.state.session.filters.tagLogic === "or"
      ? selectedTags.some((tag) => availableTags.has(tag))
      : selectedTags.every((tag) => availableTags.has(tag));
    if (!tagMatches) return false;
  }
  return true;
}

export function sortCourses(ctx, courses) {
  return [...courses].sort((a, b) => {
    if (ctx.state.session.filters.sort === "subject") return a.subject.localeCompare(b.subject, "ja") || a.no - b.no;
    if (ctx.state.session.filters.sort === "category") {
      const left = `${a.courseTrack ?? ""}${a.curriculumGroup ?? ""}${a.curriculumSubcategory ?? ""}${a.department ?? ""}`;
      const right = `${b.courseTrack ?? ""}${b.curriculumGroup ?? ""}${b.curriculumSubcategory ?? ""}${b.department ?? ""}`;
      return left.localeCompare(right, "ja") || a.no - b.no;
    }
    if (ctx.state.session.filters.sort === "period") {
      const left = a.periods[0] ? `${a.periods[0].dayJa}${a.periods[0].period}` : "zz";
      const right = b.periods[0] ? `${b.periods[0].dayJa}${b.periods[0].period}` : "zz";
      return left.localeCompare(right, "ja") || a.no - b.no;
    }
    return a.no - b.no;
  });
}

export function activeFilters(ctx) {
  const labels = [];
  if (ctx.state.session.filters.favoritesOnly) labels.push("お気に入りのみ");
  if (ctx.state.persistent.profile.includeSeminarSearch !== true) labels.push("研究指導を除外");
  if (isUpperYearProfile(ctx.domain()) && ctx.state.persistent.profile.includeForeignSearch !== true) labels.push("外国語科目を除外");
  if (ctx.state.session.filters.excludeTeacherTraining) labels.push("教職共通科目を除外");
  if (ctx.state.session.filters.keyword) labels.push(`検索: ${ctx.state.session.filters.keyword}`);
  if (ctx.state.session.filters.semester !== "all") {
    const semesterLabels = { __summerIntensive: "夏期集中", __winterIntensive: "冬季集中", __otherIntensive: "その他集中・特別日程" };
    labels.push(semesterLabels[ctx.state.session.filters.semester] || ctx.state.session.filters.semester);
  }
  labels.push(...ctx.state.session.filters.courseTracks);
  labels.push(...ctx.state.session.filters.curriculumGroups);
  labels.push(...ctx.state.session.filters.curriculumSubcategories);
  labels.push(...ctx.state.session.filters.commonFields);
  labels.push(...ctx.state.session.filters.departments);
  if (ctx.state.session.filters.day !== "all") labels.push(`${ctx.state.session.filters.day}曜`);
  if (ctx.state.session.filters.periods.size) labels.push(`${[...ctx.state.session.filters.periods].join(",")}限`);
  if (ctx.state.session.filters.noPeriod) labels.push("曜限なし・日程未定");
  if (ctx.state.session.filters.multiPeriod) labels.push("複数曜限");
  const tagLabels = new Map((ctx.data.meta.tagDefinitions ?? []).map((tag) => [tag.id, tag.label]));
  if (ctx.state.session.filters.tags.size) labels.push(`タグ${ctx.state.session.filters.tagLogic.toUpperCase()}`);
  labels.push(...[...ctx.state.session.filters.tags].map((tag) => tagLabels.get(tag) ?? tag));
  return labels;
}

export function text(value, fallback = "未記載") {
  return value && String(value).trim() ? value : fallback;
}

export function short(value, max = 150) {
  const compact = text(value, "").replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max)}...` : compact;
}

export function gradingSummary(course) {
  const grading = text(course.grading, "").replace(/\s+/g, " ").trim();
  if (!grading) return "詳細不明";
  const hasSpecificEvaluation = /(％|%|点|試験|テスト|レポート|課題|発表|出席|欠席|平常点|参加|小テスト|リアクションペーパー|コメントシート)/.test(
    grading
  );
  const saysLater = /(初回|第1回|最初|授業内|講義内|ガイダンス|オリエンテーション|manaba|別途|後日|追って|未定).{0,30}(説明|伝え|連絡|指示|提示|掲載|知らせ)|詳細.{0,20}(説明|連絡|指示|提示)|未定/.test(
    grading
  ) || /(説明|伝え|連絡|指示|提示|掲載|知らせ)/.test(grading);
  return saysLater && !hasSpecificEvaluation ? "詳細不明" : grading;
}

export function tagPill(tag) {
  const pill = document.createElement("span");
  pill.className = `pill ${["restriction", "capacityLimit"].includes(tag.id) ? "danger" : ["reportOnly", "finalExamOnly", "noExam", "noReport"].includes(tag.id) ? "warn" : ""}`;
  pill.textContent = tag.label;
  if (tag.reason) pill.title = tag.reason;
  return pill;
}
