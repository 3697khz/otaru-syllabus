import { acquiredCourseIssues } from '../domain/restrictions.js';
import { gradingSummary, short, text } from './search.js';
import { courseScheduleText, intensiveKind, intensiveKindLabel } from '../domain/timetable.js';
import { courseCredits, formatCredit } from '../domain/values.js';
import { requirementTagForCourse } from './degree-view.js';

export function comparisonCourses(ctx) {
  return [...ctx.state.session.compareCodes]
    .map((code) => ctx.coursesByCode.get(code))
    .filter(Boolean)
    .slice(0, 4);
}

export function toggleCompare(ctx, code) {
  if (!ctx.coursesByCode.has(code)) return;
  if (ctx.state.session.compareCodes.has(code)) {
    ctx.state.session.compareCodes.delete(code);
  } else {
    if (ctx.state.session.compareCodes.size >= 4) return;
    ctx.state.session.compareCodes.add(code);
  }
  ctx.render();
}

export function compareStatusText(ctx, course) {
  const issues = acquiredCourseIssues(ctx.domain(), course);
  if (issues.some((issue) => issue.type === "acquiredExact")) return "修得済み";
  if (issues.some((issue) => issue.type === "recognizedExact")) return "認定済み";
  if (ctx.state.persistent.favoriteCodes.has(course.code)) return "履修候補に追加済み";
  return "未追加";
}

export function comparisonRows(ctx) {
  return [
    ["担当教員", (course) => text(course.instructor)],
    ["学期", (course) => intensiveKind(course) ? intensiveKindLabel(intensiveKind(course)) : text(course.semester)],
    ["曜限・日程", (course) => courseScheduleText(course)],
    ["単位", (course) => `${formatCredit(courseCredits(course))}単位`],
    ["配当年次", (course) => text(course.years)],
    ["履修体系", (course) => [course.curriculumGroup, course.curriculumSubcategory].filter(Boolean).join(" / ") || "—"],
    ["学科・系", (course) => [course.department, course.commonField].filter(Boolean).join(" / ") || "—"],
    ["授業分類", (course) => text(course.category)],
    ["授業実施", (course) => text(course.methodOfClass)],
    ["成績評価", (course) => gradingSummary(course) || "—"],
    ["評価・実用タグ", (course) => (course.practicalTags || []).map((tag) => tag.label).filter(Boolean).join(" / ") || "—"],
    ["卒業要件上の算入", (course) => requirementTagForCourse(ctx, course)?.label || "要確認"],
    ["履修状態", (course) => compareStatusText(ctx, course)],
    ["対象", (course) => text(course.eligibleFaculty)],
    ["備考・履修上の注意", (course) => short(course.remarks || "", 260) || "—"],
  ];
}

export function renderComparisonControls(ctx) {
  const courses = comparisonCourses(ctx);
  const count = courses.length;
  if (ctx.el.openCompareButton) {
    ctx.el.openCompareButton.textContent = `比較 ${count}/4`;
    ctx.el.openCompareButton.disabled = count < 2;
    ctx.el.openCompareButton.title = count < 2 ? "2科目以上選ぶと比較できます" : `${count}科目を比較`;
  }
  if (ctx.el.clearCompareButton) ctx.el.clearCompareButton.disabled = count === 0;
  if (!ctx.el.compareTray) return;
  ctx.el.compareTray.classList.toggle("is-hidden", count === 0);
  ctx.el.compareTray.replaceChildren();
  if (!count) return;
  const label = document.createElement("strong");
  label.textContent = `比較中 ${count}/4`;
  const list = document.createElement("div");
  list.className = "compare-chip-list";
  for (const course of courses) {
    const chip = document.createElement("span");
    chip.className = "compare-chip";
    const name = document.createElement("span");
    name.textContent = course.subject;
    name.title = `${course.subject}（${course.code}）`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = `${course.subject}を比較から外す`;
    remove.setAttribute("aria-label", `${course.subject}を比較から外す`);
    remove.addEventListener("click", () => toggleCompare(ctx, course.code));
    chip.append(name, remove);
    list.append(chip);
  }
  ctx.el.compareTray.append(label, list);
}

export function renderComparisonDialog(ctx) {
  if (!ctx.el.compareTableWrap) return;
  const courses = comparisonCourses(ctx);
  ctx.el.compareTableWrap.replaceChildren();
  if (courses.length < 2) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "比較する科目を2科目以上選んでください。";
    ctx.el.compareTableWrap.append(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "compare-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.scope = "col";
  corner.textContent = "項目";
  headRow.append(corner);
  for (const course of courses) {
    const th = document.createElement("th");
    th.scope = "col";
    const wrap = document.createElement("div");
    wrap.className = "compare-course-head";
    const link = document.createElement("a");
    link.href = course.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = course.subject;
    const code = document.createElement("span");
    code.textContent = course.code;
    wrap.append(link, code);
    th.append(wrap);
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  for (const [label, getter] of comparisonRows(ctx)) {
    const tr = document.createElement("tr");
    const rowHead = document.createElement("th");
    rowHead.scope = "row";
    rowHead.textContent = label;
    tr.append(rowHead);
    for (const course of courses) {
      const td = document.createElement("td");
      const value = getter(course);
      if (label === "履修状態") {
        const badge = document.createElement("span");
        badge.className = "compare-status";
        badge.textContent = value;
        td.append(badge);
      } else {
        td.textContent = value;
      }
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(tbody);
  ctx.el.compareTableWrap.append(table);
}

export function openComparisonDialog(ctx) {
  if (comparisonCourses(ctx).length < 2 || !ctx.el.compareDialog) return;
  renderComparisonDialog(ctx);
  if (typeof ctx.el.compareDialog.showModal === "function") ctx.el.compareDialog.showModal();
  else ctx.el.compareDialog.setAttribute("open", "");
}
