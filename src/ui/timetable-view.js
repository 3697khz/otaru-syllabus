import { conflictPairText, conflictText, conflictsForCourse, coursePeriodsText, courseScheduleText, favoriteConflictPairs, hasUnfixedSchedule, intensiveKind, intensiveKindLabel, periodSortValue } from '../domain/timetable.js';
import { text } from './search.js';
import { acquiredCourseIssues, acquiredIssueText } from '../domain/restrictions.js';
import { removeExternalCourse } from './records-view.js';
import { externalTermLabels, recognitionBucketLabels, timetableDays, timetablePeriods } from '../config.js';
import { favoriteCourses, selectedSeminarCourses, seminarProfile, uniquePlannedCourses, virtualSeminarCourse } from '../domain/course-rules.js';
import { externalCourseAsCourse, externalCourseRecords } from '../domain/records.js';
import { courseCredits, formatCredit } from '../domain/values.js';

export function favoriteItem(ctx, course, favorites) {
  const item = document.createElement("div");
  item.className = "favorite-item";

  const main = document.createElement("div");
  main.className = "favorite-item-main";
  const title = document.createElement("a");
  title.href = course.url;
  title.target = "_blank";
  title.rel = "noreferrer";
  title.textContent = course.subject;
  const meta = document.createElement("span");
  meta.textContent = `${course.code} / ${courseScheduleText(course)} / ${text(course.instructor)}`;
  main.append(title, meta);

  const conflicts = conflictsForCourse(ctx.domain(), course, favorites);
  if (conflicts.length) {
    const warning = document.createElement("strong");
    warning.className = "favorite-warning";
    warning.textContent = conflicts.map(conflictText).join("、");
    main.append(warning);
  }
  const acquiredIssues = acquiredCourseIssues(ctx.domain(), course);
  if (acquiredIssues.length) {
    const warning = document.createElement("strong");
    warning.className = "favorite-warning acquired-warning";
    warning.textContent = acquiredIssues.map(acquiredIssueText).join("、");
    main.append(warning);
  }

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "small-button";
  remove.textContent = "解除";
  remove.addEventListener("click", () => ctx.toggleFavorite(course.code));

  item.append(main, remove);
  return item;
}

export function renderFavoriteAlerts(ctx, favorites) {
  ctx.el.favoriteAlerts.replaceChildren();
  const conflicts = favoriteConflictPairs(ctx.domain(), favorites);
  const acquiredConflicts = favorites
    .map((course) => ({ course, issues: acquiredCourseIssues(ctx.domain(), course) }))
    .filter((entry) => entry.issues.length);
  if (!conflicts.length && !acquiredConflicts.length) return;
  const alert = document.createElement("div");
  alert.className = "conflict-alert";
  const title = document.createElement("strong");
  title.textContent = "履修できない／確認が必要な組み合わせがあります";
  const list = document.createElement("ul");
  for (const conflict of conflicts) {
    const item = document.createElement("li");
    item.textContent = conflictPairText(conflict);
    list.append(item);
  }
  for (const entry of acquiredConflicts) {
    const item = document.createElement("li");
    item.textContent = `${entry.course.subject}（${entry.course.code}）: ${entry.issues.map(acquiredIssueText).join("、")}`;
    list.append(item);
  }
  alert.append(title, list);
  ctx.el.favoriteAlerts.append(alert);
}

export function timetableItem(ctx, course, favorites) {
  const item = document.createElement("div");
  item.className = "timetable-item";

  const title = (course._virtualSeminar || course._externalCourse) ? document.createElement("span") : document.createElement("a");
  if (!course._virtualSeminar && !course._externalCourse) {
    title.href = course.url;
    title.target = "_blank";
    title.rel = "noreferrer";
  }
  title.textContent = course.subject;

  const meta = document.createElement("span");
  meta.textContent = course._virtualSeminar
    ? "標準枠・実ゼミ選択で上書き"
    : course._externalCourse
      ? `${course.instructor} / ${course.semester} / ${course.classPeriod || "日程未定"}`
      : `${intensiveKind(course) ? intensiveKindLabel(intensiveKind(course)) : course.semester} / ${course.code}`;
  item.append(title, meta);
  if (course._virtualSeminar) {
    item.classList.add("seminar-auto");
  } else {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "timetable-remove";
    remove.textContent = "×";
    remove.title = "履修を解除";
    remove.setAttribute("aria-label", `${course.subject} の履修を解除`);
    remove.addEventListener("click", () => {
      if (course._externalCourse) removeExternalCourse(ctx, course._externalRecord.id);
      else ctx.toggleFavorite(course.code);
    });
    item.append(remove);
  }

  const conflicts = conflictsForCourse(ctx.domain(), course, favorites);
  const acquiredIssues = acquiredCourseIssues(ctx.domain(), course);
  if (conflicts.length || acquiredIssues.length) {
    const warning = document.createElement("strong");
    warning.textContent = acquiredIssues.length ? "取得済み注意" : conflicts.some((conflict) => conflict.type === "sameCourse") ? "同一授業" : conflicts.some((conflict) => conflict.type === "restriction") ? "履修制限" : "重複";
    warning.title = [...conflicts.map(conflictText), ...acquiredIssues.map(acquiredIssueText)].join("\n");
    item.append(warning);
  }
  return item;
}

export function hasOtherSchedule(ctx, course) {
  return (
    hasUnfixedSchedule(course) ||
    Boolean(intensiveKind(course)) ||
    /(?:^|[,、\s])他(?:$|[,、\s])/.test(course.classPeriod || "") ||
    course.periods.some((period) => !timetableDays.includes(period.dayJa) || !timetablePeriods.includes(period.period))
  );
}

export function renderFavoriteSchedule(ctx, favorites) {
  ctx.el.favoriteScheduleList.replaceChildren();
  const virtualSeminar = virtualSeminarCourse(ctx.domain(), favorites);
  const externalRecords = externalCourseRecords(ctx.domain());
  if (!favorites.length && !virtualSeminar && !externalRecords.length) {
    const empty = document.createElement("div");
    empty.className = "favorite-empty";
    empty.textContent = "まだ登録がありません。";
    ctx.el.favoriteScheduleList.append(empty);
    return;
  }

  const table = document.createElement("div");
  table.className = "timetable-grid";

  const corner = document.createElement("div");
  corner.className = "timetable-corner";
  table.append(corner);

  for (const day of timetableDays) {
    const heading = document.createElement("div");
    heading.className = "timetable-heading";
    heading.textContent = day;
    table.append(heading);
  }

  const cellMap = new Map();
  for (const period of timetablePeriods) {
    const periodLabel = document.createElement("div");
    periodLabel.className = "timetable-period";
    periodLabel.textContent = String(period);
    table.append(periodLabel);

    for (const day of timetableDays) {
      const cell = document.createElement("div");
      cell.className = "timetable-cell";
      cell.dataset.slot = `${day}-${period}`;
      cellMap.set(`${day}-${period}`, cell);
      table.append(cell);
    }
  }

  const specialGroups = { summer: new Set(), winter: new Set(), other: new Set(), unscheduled: new Set(), external: new Set() };
  const externalCourses = externalRecords.map(externalCourseAsCourse);
  const scheduleCourses = virtualSeminar ? [virtualSeminar, ...favorites, ...externalCourses] : [...favorites, ...externalCourses];
  for (const course of scheduleCourses) {
    const kind = intensiveKind(course);
    let placed = false;
    if (!hasUnfixedSchedule(course)) {
      for (const period of course.periods) {
        const cell = cellMap.get(period.key);
        if (!cell) continue;
        cell.append(timetableItem(ctx, course, favorites));
        placed = true;
      }
    }
    if (course._externalCourse) {
      specialGroups.external.add(course);
      continue;
    }
    if (kind) specialGroups[kind].add(course);
    else if (!placed || hasOtherSchedule(ctx, course)) specialGroups.unscheduled.add(course);
  }

  ctx.el.favoriteScheduleList.append(table);

  const appendSpecialBlock = (label, items) => {
    if (!items.size) return;
    const block = document.createElement("section");
    block.className = "favorite-other special-schedule-block";
    const heading = document.createElement("h4");
    heading.textContent = label;
    block.append(heading);
    for (const course of [...items].sort((a, b) => String(a.code).localeCompare(String(b.code)))) {
      if (course._externalCourse) block.append(externalCourseItem(ctx, course._externalRecord));
      else block.append(favoriteItem(ctx, course, favorites));
    }
    ctx.el.favoriteScheduleList.append(block);
  };
  appendSpecialBlock("夏期集中", specialGroups.summer);
  appendSpecialBlock("冬季集中", specialGroups.winter);
  appendSpecialBlock("その他集中・特別日程", specialGroups.other);
  appendSpecialBlock("他大学授業", specialGroups.external);
  appendSpecialBlock("曜限なし・日程未定", specialGroups.unscheduled);
}

export function externalCourseItem(ctx, record) {
  const item = document.createElement("div");
  item.className = "favorite-item external-course-item";
  const main = document.createElement("div");
  main.className = "favorite-item-main";
  const title = document.createElement("strong");
  title.textContent = record.subject;
  const meta = document.createElement("span");
  meta.textContent = `${record.university} / ${externalTermLabels[record.term]} / ${formatCredit(record.credits)}単位 / ${record.schedule || "日程未定"}`;
  const badges = document.createElement("span");
  badges.className = "external-course-meta";
  badges.textContent = `認定見込: ${recognitionBucketLabels[record.bucket]}${record.capIncluded ? " / CAP算入" : ""}${record.remoteIncluded ? " / 遠隔枠" : ""}`;
  main.append(title, meta, badges);
  const conflicts = conflictsForCourse(ctx.domain(), externalCourseAsCourse(record));
  if (conflicts.length) {
    const warning = document.createElement("strong");
    warning.className = "favorite-warning";
    warning.textContent = conflicts.map(conflictText).join("、");
    main.append(warning);
  }
  const remove = document.createElement("button");
  remove.type = "button"; remove.className = "small-button"; remove.textContent = "解除";
  remove.addEventListener("click", () => removeExternalCourse(ctx, record.id));
  item.append(main, remove);
  return item;
}

export function renderExternalCourses(ctx) {
  if (!ctx.el.externalCourseList) return;
  ctx.el.externalCourseList.replaceChildren();
  const records = externalCourseRecords(ctx.domain());
  if (!records.length) {
    const empty = document.createElement("div");
    empty.className = "recognition-empty";
    empty.textContent = "他大学授業はまだ追加されていません。";
    ctx.el.externalCourseList.append(empty);
    return;
  }
  for (const record of records) ctx.el.externalCourseList.append(externalCourseItem(ctx, record));
}

export function renderFavoriteCodeList(ctx, favorites) {
  ctx.el.favoriteCodeList.replaceChildren();
  if (!favorites.length) {
    const empty = document.createElement("div");
    empty.className = "favorite-empty";
    empty.textContent = "コード順の一覧もここに出ます。";
    ctx.el.favoriteCodeList.append(empty);
    return;
  }
  for (const course of [...favorites].sort((a, b) => a.code.localeCompare(b.code))) {
    ctx.el.favoriteCodeList.append(favoriteItem(ctx, course, favorites));
  }
}

export function renderFavorites(ctx) {
  const favorites = favoriteCourses(ctx.domain()).sort((a, b) => periodSortValue(a) - periodSortValue(b) || a.code.localeCompare(b.code));
  const external = externalCourseRecords(ctx.domain());
  // 同一授業の別クラスを複数入れても、履修計画上の単位数を二重計上しない。
  const creditCourses = uniquePlannedCourses(ctx.domain(), favorites);
  const totalCredits = creditCourses.reduce((sum, course) => sum + courseCredits(course), 0);
  const duplicateNote = creditCourses.length < favorites.length ? " / 同一授業の別枠は単位重複除外" : "";
  const seminar = seminarProfile(ctx.domain());
  const selectedSeminars = selectedSeminarCourses(ctx.domain(), favorites);
  const seminarNote = seminar.enrolled
    ? selectedSeminars.length
      ? ` / ゼミ: ${selectedSeminars.map((course) => coursePeriodsText(course)).join("・")}`
      : seminar.scheduleEnabled
        ? ` / ゼミ標準枠: ${seminar.defaultSlots.map((period) => period.label).join("・")}`
        : " / ゼミ標準枠: 非表示"
    : "";
  const capNote = seminar.capCredits ? " / 4年ゼミ12単位はCAP算入" : "";
  const externalCredits = external.reduce((sum, record) => sum + record.credits, 0);
  const externalNote = external.length ? ` / 他大学 ${external.length}件・${formatCredit(externalCredits)}単位` : "";
  ctx.el.favoriteSummary.textContent = `${favorites.length + external.length}件 / 本学科目 ${formatCredit(totalCredits)}単位${externalNote}${duplicateNote}${seminarNote}${capNote} / この端末内に保存`;
  ctx.el.clearFavoritesButton.disabled = favorites.length === 0 && external.length === 0;
  if (ctx.el.shareTimetableButton) ctx.el.shareTimetableButton.disabled = false;
  renderFavoriteAlerts(ctx, favorites);
  renderFavoriteSchedule(ctx, favorites);
  renderFavoriteCodeList(ctx, favorites);
  renderExternalCourses(ctx);
}
