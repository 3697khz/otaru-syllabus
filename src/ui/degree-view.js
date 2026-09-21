import { formatCredit } from '../domain/values.js';
import { calculateDegreeModel } from '../domain/degree.js';
import { graduationBucket } from '../domain/course-rules.js';

export function requirementRow(ctx, label, required, current, projected, options = {}) {
  const tr = document.createElement("tr");
  const remaining = Math.max(0, required - projected);
  const currentRemaining = Math.max(0, required - current);
  if (remaining === 0) tr.classList.add("requirement-ok");
  const cells = [
    label,
    `${formatCredit(required)}単位`,
    `${formatCredit(current)}単位`,
    `${formatCredit(projected)}単位`,
    remaining === 0 ? "充足" : `${formatCredit(remaining)}単位`,
  ];
  cells.forEach((value, index) => {
    const cell = document.createElement(index === 0 ? "th" : "td");
    cell.textContent = value;
    if (index === 4 && remaining > 0) cell.className = "remaining";
    tr.append(cell);
  });
  if (options.note) tr.title = options.note;
  if (currentRemaining === 0 && remaining === 0) tr.classList.add("already-ok");
  return tr;
}

export function informationalRequirementRow(ctx, label, current, projected, status, note = "") {
  const tr = document.createElement("tr");
  tr.classList.add("requirement-info");
  const cells = [label, "—", `${formatCredit(current)}単位`, `${formatCredit(projected)}単位`, status];
  cells.forEach((value, index) => {
    const cell = document.createElement(index === 0 ? "th" : "td");
    cell.textContent = value;
    tr.append(cell);
  });
  if (note) tr.title = note;
  return tr;
}

export function addDegreeAlert(ctx, kind, title, body) {
  const box = document.createElement("div");
  box.className = `degree-alert ${kind}`;
  const strong = document.createElement("strong");
  strong.textContent = title;
  const text = document.createElement("span");
  text.textContent = body;
  box.append(strong, text);
  ctx.el.degreeAlerts.append(box);
}

export function renderDegreeCheck(ctx) {
  const result = calculateDegreeModel(ctx.domain());
  ctx.el.degreeSummary.replaceChildren();
  for (const [label, value] of result.summaryCards) {
    const card = document.createElement("div");
    card.className = "degree-stat";
    const small = document.createElement("span"); small.textContent = label;
    const strong = document.createElement("strong"); strong.textContent = value;
    card.append(small, strong); ctx.el.degreeSummary.append(card);
  }
  ctx.el.requirementRows.replaceChildren(...result.requirements.map(row => row.kind === "information" ? informationalRequirementRow(ctx, ...row.values) : requirementRow(ctx, ...row.values)));
  ctx.el.degreeAlerts.replaceChildren();
  for (const warning of result.warnings) addDegreeAlert(ctx, warning.kind, warning.title, warning.body);
}

export function requirementTagForCourse(ctx, course) {
  if (!ctx.handbook) return null;
  const bucket = graduationBucket(ctx.domain(), course);
  const labels = {
    knowledge: "知の基礎",
    humanCulture: "人間と文化",
    societyHuman: "社会と人間",
    natureEnvironment: "自然と環境",
    health: "健康科学",
    foreign: "外国語",
    commonOther: "共通科目",
    academicUnassigned: "学科未確定",
    ownCore: "自学科基幹",
    ownAdvanced: "自学科発展",
    academicFlex: "学科等20単位枠",
    research: "研究指導",
  };
  if (!labels[bucket.bucket]) return null;
  return { id: "requirement", label: labels[bucket.bucket], reason: "2026年度履修の手引きに基づく試算上の算入先" };
}
