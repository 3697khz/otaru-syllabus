import { isUpperYearProfile, seminarProfile } from '../domain/course-rules.js';
import { defaultProfile, numberValue } from '../domain/values.js';
import { saveProfile } from '../storage.js';

export function syncUpperYearPresetControls(ctx) {
  const upperYear = isUpperYearProfile(ctx.domain());
  const scheduleOn = ctx.state.persistent.profile.seminarScheduleEnabled !== false;
  const seminarPlanOn = ctx.state.persistent.profile.seminarPlanEnabled !== false;
  const seminarExcluded = ctx.state.persistent.profile.includeSeminarSearch !== true;
  const foreignPlanOn = ctx.state.persistent.profile.foreignPlanEnabled !== false;
  const foreignExcluded = ctx.state.persistent.profile.includeForeignSearch !== true;

  if (ctx.el.upperYearPresetRow) ctx.el.upperYearPresetRow.classList.toggle("is-disabled", !upperYear);
  if (ctx.el.seminarScheduleToggle) { ctx.el.seminarScheduleToggle.checked = upperYear && scheduleOn; ctx.el.seminarScheduleToggle.disabled = !upperYear || ctx.state.persistent.profile.noSeminar; }
  if (ctx.el.seminarPlanToggle) { ctx.el.seminarPlanToggle.checked = upperYear && seminarPlanOn; ctx.el.seminarPlanToggle.disabled = !upperYear || ctx.state.persistent.profile.noSeminar; }
  if (ctx.el.excludeSeminarSearchToggle) { ctx.el.excludeSeminarSearchToggle.checked = upperYear && seminarExcluded; ctx.el.excludeSeminarSearchToggle.disabled = !upperYear; }
  if (ctx.el.includeSeminarSearchToggle) ctx.el.includeSeminarSearchToggle.checked = !seminarExcluded;
  if (ctx.el.foreignPlanToggle) { ctx.el.foreignPlanToggle.checked = upperYear && foreignPlanOn; ctx.el.foreignPlanToggle.disabled = !upperYear; }
  if (ctx.el.excludeForeignSearchToggle) { ctx.el.excludeForeignSearchToggle.checked = upperYear && foreignExcluded; ctx.el.excludeForeignSearchToggle.disabled = !upperYear; }
  if (ctx.el.includeForeignSearchToggle) { ctx.el.includeForeignSearchToggle.checked = !upperYear || !foreignExcluded; ctx.el.includeForeignSearchToggle.disabled = !upperYear; }

  if (ctx.el.upperYearPresetToggle) {
    const values = [scheduleOn, seminarPlanOn, seminarExcluded, foreignPlanOn, foreignExcluded];
    const allOn = values.every(Boolean);
    const anyOn = values.some(Boolean);
    ctx.el.upperYearPresetToggle.checked = upperYear && allOn;
    ctx.el.upperYearPresetToggle.indeterminate = upperYear && anyOn && !allOn;
    ctx.el.upperYearPresetToggle.disabled = !upperYear;
  }
  if (ctx.el.upperYearPresetNote) {
    ctx.el.upperYearPresetNote.textContent = upperYear
      ? (ctx.state.persistent.profile.noSeminar ? "ノンゼミ設定中のため、ゼミ自動履修・履修見込みは停止し、研究指導の検索除外と外国語設定は適用します。" : "3・4年次の標準設定です。必要な項目だけ個別に変更できます。")
      : "3・4年次を選ぶと、ゼミ・研究指導検索・外国語の標準設定をまとめて利用できます。";
  }
}

export function syncDepartmentControl(ctx) {
  if (!ctx.el.profileDepartmentInput) return;
  const firstYear = String(ctx.state.persistent.profile?.currentYear || "1") === "1";
  const blankOption = ctx.el.profileDepartmentInput.querySelector('option[value=""]');
  if (firstYear) {
    ctx.state.persistent.profile.department = "";
    ctx.el.profileDepartmentInput.value = "";
    ctx.el.profileDepartmentInput.disabled = true;
    if (blankOption) blankOption.textContent = "学科未所属（1年次）";
    ctx.el.profileDepartmentField?.classList.add("is-unassigned");
    if (ctx.el.profileDepartmentNote) ctx.el.profileDepartmentNote.textContent = "1年次は学科配属前です。12～1月頃の希望調査と成績基準により、2年次から所属学科が決まります。";
    ctx.el.hypotheticalDepartmentField?.classList.remove("is-hidden");
    if (ctx.el.hypotheticalDepartmentInput) ctx.el.hypotheticalDepartmentInput.value = ctx.state.persistent.profile.hypotheticalDepartment || "";
    ctx.el.academicUnassignedCreditField?.classList.remove("is-hidden");
    for (const field of ctx.el.classifiedAcademicCreditFields || []) field.classList.add("is-hidden");
    if (ctx.el.academicCreditModeNote) ctx.el.academicCreditModeNote.textContent = "1年次は自学科・他学科の区分がまだ確定しないため、取得済みの学科科目は『学科未確定』として入力します。";
  } else {
    ctx.el.profileDepartmentInput.disabled = false;
    if (blankOption) blankOption.textContent = "選択してください";
    ctx.el.profileDepartmentInput.value = ctx.state.persistent.profile.department || "";
    ctx.el.profileDepartmentField?.classList.remove("is-unassigned");
    if (ctx.el.profileDepartmentNote) ctx.el.profileDepartmentNote.textContent = "2年次以降は所属学科を選択してください。学科別の卒業要件判定に使用します。";
    ctx.el.hypotheticalDepartmentField?.classList.add("is-hidden");
    ctx.el.academicUnassignedCreditField?.classList.remove("is-hidden");
    for (const field of ctx.el.classifiedAcademicCreditFields || []) field.classList.remove("is-hidden");
    if (ctx.el.academicCreditModeNote) ctx.el.academicCreditModeNote.textContent = "2年次以降は、所属学科に合わせて1年次の『学科未確定』単位を自学科基幹・発展・その他学科等へ再分類してください。";
  }
}

export function syncProfileControls(ctx) {
  if (!ctx.state.persistent.profile) ctx.state.persistent.profile = defaultProfile();
  ctx.el.admissionYearInput.value = String(ctx.state.persistent.profile.admissionYear || "2026");
  ctx.el.currentYearInput.value = String(ctx.state.persistent.profile.currentYear || "1");
  ctx.syncDepartmentControl();
  if (ctx.el.hypotheticalDepartmentInput) ctx.el.hypotheticalDepartmentInput.value = ctx.state.persistent.profile.hypotheticalDepartment || "";
  ctx.el.failedCarryInput.value = String(Math.min(8, numberValue(ctx.state.persistent.profile.failedCarry)));
  ctx.el.seminarScheduleToggle.checked = ctx.state.persistent.profile.seminarScheduleEnabled !== false;
  ctx.el.noSeminarToggle.checked = Boolean(ctx.state.persistent.profile.noSeminar);
  ctx.el.noSeminarReplacementField.classList.toggle("is-hidden", !ctx.state.persistent.profile.noSeminar);
  if (ctx.el.includeSeminarSearchToggle) ctx.el.includeSeminarSearchToggle.checked = ctx.state.persistent.profile.includeSeminarSearch === true;
  if (ctx.el.excludeSeminarSearchToggle) {
    ctx.el.excludeSeminarSearchToggle.checked = isUpperYearProfile(ctx.domain()) && ctx.state.persistent.profile.includeSeminarSearch !== true;
    ctx.el.excludeSeminarSearchToggle.disabled = !isUpperYearProfile(ctx.domain());
  }
  if (ctx.el.includeForeignSearchToggle) {
    ctx.el.includeForeignSearchToggle.checked = !isUpperYearProfile(ctx.domain()) || ctx.state.persistent.profile.includeForeignSearch === true;
    ctx.el.includeForeignSearchToggle.disabled = !isUpperYearProfile(ctx.domain());
  }
  ctx.syncSeminarControls();
  ctx.syncUpperYearPresetControls();
  for (const input of ctx.el.creditInputs) {
    input.value = String(numberValue(ctx.state.persistent.profile.credits[input.dataset.creditKey]));
  }
}

export function updateProfileFromControls(ctx) {
  ctx.state.persistent.profile.admissionYear = ctx.el.admissionYearInput.value;
  ctx.state.persistent.profile.currentYear = ctx.el.currentYearInput.value;
  ctx.state.persistent.profile.department = ctx.state.persistent.profile.currentYear === "1" ? "" : ctx.el.profileDepartmentInput.value;
  if (ctx.state.persistent.profile.currentYear === "1" && ctx.el.hypotheticalDepartmentInput) ctx.state.persistent.profile.hypotheticalDepartment = ctx.el.hypotheticalDepartmentInput.value;
  ctx.state.persistent.profile.failedCarry = Math.min(8, numberValue(ctx.el.failedCarryInput.value));
  ctx.state.persistent.profile.noSeminar = ctx.el.noSeminarToggle.checked;
  ctx.state.persistent.profile.seminarScheduleEnabled = isUpperYearProfile(ctx.domain()) ? Boolean(ctx.el.seminarScheduleToggle?.checked) : false;
  ctx.state.persistent.profile.seminarPlanEnabled = isUpperYearProfile(ctx.domain()) ? Boolean(ctx.el.seminarPlanToggle?.checked) : false;
  ctx.state.persistent.profile.foreignPlanEnabled = isUpperYearProfile(ctx.domain()) ? Boolean(ctx.el.foreignPlanToggle?.checked) : false;
  ctx.state.persistent.profile.includeForeignSearch = isUpperYearProfile(ctx.domain()) ? !ctx.el.excludeForeignSearchToggle?.checked : true;
  ctx.state.persistent.profile.includeSeminarSearch = isUpperYearProfile(ctx.domain()) ? !ctx.el.excludeSeminarSearchToggle?.checked : Boolean(ctx.el.includeSeminarSearchToggle?.checked);
  for (const input of ctx.el.creditInputs) {
    ctx.state.persistent.profile.credits[input.dataset.creditKey] = numberValue(input.value);
  }
  ctx.el.noSeminarReplacementField.classList.toggle("is-hidden", !ctx.state.persistent.profile.noSeminar);
  ctx.syncSeminarControls();
  ctx.syncUpperYearPresetControls();
  saveProfile(ctx);
}

export function syncSeminarControls(ctx) {
  if (!ctx.el.seminarScheduleToggle) return;
  const seminar = seminarProfile(ctx.domain());
  const activeYear = seminar.year === 3 || seminar.year === 4;
  ctx.el.seminarScheduleToggle.disabled = !activeYear || ctx.state.persistent.profile.noSeminar;
  if (!activeYear) {
    if (ctx.el.seminarScheduleNote) ctx.el.seminarScheduleNote.textContent = "3・4年次でゼミ所属の場合に標準枠を自動反映します。";
    return;
  }
  if (ctx.state.persistent.profile.noSeminar) {
    if (ctx.el.seminarScheduleNote) ctx.el.seminarScheduleNote.textContent = "ノンゼミ設定のため標準ゼミ枠は反映しません。";
    return;
  }
  const slots = seminar.defaultSlots.map((period) => period.label).join("・");
  const cap = seminar.year === 4 ? "。4年次は研究指導12単位をCAPに算入します" : "。3年次は研究指導をCAPに算入しません";
  if (ctx.el.seminarScheduleNote) ctx.el.seminarScheduleNote.textContent = `${seminar.year}年次の標準枠は${slots}${cap}。実際のゼミ科目を履修候補に入れた場合は、その曜限を優先します。`;
}
