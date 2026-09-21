import { acquiredCourseIssues, acquiredIssueText } from '../domain/restrictions.js';
import { toggleCompare } from './compare.js';
import { gradingSummary, short, tagPill, text } from './search.js';
import { conflictText, conflictsForCourse, intensiveKind, intensiveKindLabel } from '../domain/timetable.js';
import { requirementTagForCourse } from './degree-view.js';
import { isCapExempt, isRemoteForLimit, isYearEligible, minimumEligibleYear } from '../domain/course-rules.js';

export function courseCard(ctx, course) {
  const card = document.createElement("article");
  card.className = "course-card";

  const main = document.createElement("div");
  main.className = "course-main";

  const title = document.createElement("h3");
  title.className = "course-title";
  const link = document.createElement("a");
  link.href = course.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = course.subject;
  const code = document.createElement("span");
  code.className = "code";
  code.textContent = course.code;
  const favoriteButton = document.createElement("button");
  favoriteButton.type = "button";
  favoriteButton.className = `favorite-button ${ctx.state.persistent.favoriteCodes.has(course.code) ? "active" : ""}`;
  favoriteButton.setAttribute("aria-pressed", String(ctx.state.persistent.favoriteCodes.has(course.code)));
  favoriteButton.dataset.code = course.code;
  const acquiredIssues = acquiredCourseIssues(ctx.domain(), course);
  const isAcquiredExact = acquiredIssues.some((issue) => issue.type === "acquiredExact");
  const isRecognizedExact = acquiredIssues.some((issue) => issue.type === "recognizedExact");
  const isCompletedExact = isAcquiredExact || isRecognizedExact;
  if (isCompletedExact && !ctx.state.persistent.favoriteCodes.has(course.code)) {
    favoriteButton.textContent = isRecognizedExact ? "認定済み" : "修得済み";
    favoriteButton.disabled = true;
    favoriteButton.title = "取得済み科目として登録されています";
  } else {
    favoriteButton.textContent = ctx.state.persistent.favoriteCodes.has(course.code) ? (isCompletedExact ? "候補から外す" : "追加済み") : "候補に追加";
    favoriteButton.addEventListener("click", () => ctx.toggleFavorite(course.code));
  }
  const compareButton = document.createElement("button");
  compareButton.type = "button";
  const isCompared = ctx.state.session.compareCodes.has(course.code);
  compareButton.className = `compare-button ${isCompared ? "active" : ""}`;
  compareButton.setAttribute("aria-pressed", String(isCompared));
  compareButton.textContent = isCompared ? "比較中" : "比較";
  compareButton.title = isCompared ? "比較から外す" : (ctx.state.session.compareCodes.size >= 4 ? "比較は最大4科目までです" : "比較に追加");
  compareButton.disabled = !isCompared && ctx.state.session.compareCodes.size >= 4;
  compareButton.addEventListener("click", () => toggleCompare(ctx, course.code));
  title.append(link, code, favoriteButton, compareButton);

  const meta = document.createElement("p");
  meta.className = "meta-line";
  meta.append(text(course.instructor), " / ", intensiveKind(course) ? intensiveKindLabel(intensiveKind(course)) : text(course.semester), " / ", text(course.credits, "?"), "単位");

  const pills = document.createElement("div");
  pills.className = "pill-row";
  for (const value of [course.courseTrack, course.curriculumGroup, course.curriculumSubcategory, course.commonField, course.department]) {
    if (!value) continue;
    const node = document.createElement("span");
    node.className = "pill";
    node.textContent = value;
    pills.append(node);
  }
  if (course.periods.length) {
    for (const period of course.periods) {
      const node = document.createElement("span");
      node.className = "pill time";
      node.textContent = period.label;
      pills.append(node);
    }
  } else {
    const node = document.createElement("span");
    node.className = "pill time";
    node.textContent = intensiveKind(course) ? intensiveKindLabel(intensiveKind(course)) : (course.semester === "集中" ? "集中" : "曜限なし");
    pills.append(node);
  }
  for (const tag of course.practicalTags) {
    pills.append(tagPill(tag));
  }
  const requirementTag = requirementTagForCourse(ctx, course);
  if (requirementTag) pills.append(tagPill(requirementTag));
  const specialKind = intensiveKind(course);
  if (specialKind) {
    const node = document.createElement("span");
    node.className = "pill info";
    node.textContent = intensiveKindLabel(specialKind);
    pills.append(node);
  }
  if (!isYearEligible(ctx.domain(), course)) {
    const node = document.createElement("span");
    node.className = "pill danger";
    node.textContent = `${minimumEligibleYear(course)}年次以上`;
    node.title = "履修の手引きでは上位年次配当科目の履修は認められていません。";
    pills.append(node);
  }
  if (isRemoteForLimit(course)) {
    const node = document.createElement("span");
    node.className = "pill warn";
    node.textContent = "遠隔60単位枠";
    pills.append(node);
  }
  if (isCapExempt(ctx.domain(), course)) {
    const node = document.createElement("span");
    node.className = "pill";
    node.textContent = "CAP外";
    pills.append(node);
  }
  const favoriteConflicts = conflictsForCourse(ctx.domain(), course);
  if (favoriteConflicts.length) {
    const node = document.createElement("span");
    node.className = "pill danger";
    node.textContent = favoriteConflicts.some((conflict) => conflict.type === "sameCourse")
      ? "同一授業の別枠"
      : favoriteConflicts.some((conflict) => conflict.type === "restriction")
        ? "履修制限の組み合わせ"
        : ctx.state.persistent.favoriteCodes.has(course.code)
          ? "お気に入り内で重複"
          : "お気に入りと重複";
    node.title = favoriteConflicts.map(conflictText).join("\n");
    pills.append(node);
  }

  if (acquiredIssues.length) {
    card.classList.add("has-acquired-conflict");
    const exact = acquiredIssues.some((issue) => issue.type === "acquiredExact");
    const recognized = acquiredIssues.some((issue) => issue.type === "recognizedExact");
    const same = acquiredIssues.some((issue) => issue.type === "acquiredSameCourse");
    const node = document.createElement("span");
    node.className = "pill danger";
    node.textContent = exact ? "修得済み" : recognized ? "認定済み" : same ? "取得済みと同一授業" : "既修得の履修制限";
    node.title = acquiredIssues.map(acquiredIssueText).join("\n");
    pills.append(node);
  }

  const excerpt = document.createElement("p");
  excerpt.className = "excerpt";
  const label = document.createElement("span");
  label.textContent = "成績評価の方法";
  const value = document.createElement("strong");
  value.textContent = short(gradingSummary(course), 180);
  excerpt.append(label, value);

  main.append(title, meta, pills, excerpt);

  const side = document.createElement("dl");
  side.className = "course-side";
  const rows = [
    ["コース", course.courseTrack],
    ["体系", [course.curriculumGroup, course.curriculumSubcategory].filter(Boolean).join(" / ")],
    ["学科・系", [course.department, course.commonField].filter(Boolean).join(" / ")],
    ["授業分類", text(course.category)],
    ["開講曜限", text(course.classPeriod)],
    ["授業実施", text(course.methodOfClass)],
    ["対象", short(course.eligibleFaculty, 90)],
  ].filter((row) => row[1]);
  for (const [term, description] of rows) {
    const row = document.createElement("div");
    row.className = "side-row";
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = description;
    row.append(dt, dd);
    side.append(row);
  }

  card.append(main, side);
  return card;
}

export function renderResults(ctx, courses) {
  ctx.el.results.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (const course of courses.slice(0, 250)) {
    fragment.append(courseCard(ctx, course));
  }
  if (courses.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "条件に合う科目がありません。";
    fragment.append(empty);
  } else if (courses.length > 250) {
    const more = document.createElement("div");
    more.className = "empty";
    more.textContent = `表示は先頭250件です。検索条件を足すと絞れます。`;
    fragment.append(more);
  }
  ctx.el.results.append(fragment);
}
