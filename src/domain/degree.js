import { actualDepartment, graduationBucket, isCapExempt, isFirstYearPlacementCoreCourse, isFirstYearProfile, isHypotheticalDepartmentSelection, isRemoteForLimit, isResearchGuidance, isUpperYearProfile, isYearEligible, minimumEligibleYear, selectedDepartment, selectedSeminarCourses, seminarProfile, seminarYearForCourse, uniquePlannedCourses } from './course-rules.js';
import { acquiredCourseBreakdown, externalPlannedBreakdown, recognitionBreakdown } from './records.js';
import { courseCredits, defaultProfile, formatCredit, numberValue, sameCourseKey } from './values.js';
import { acquiredCourseIssues, acquiredIssueText } from './restrictions.js';

export function plannedCreditBreakdown(ctx) {
  const totals = {
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
    remote: 0,
    cap: 0,
    graduationCountable: 0,
  };
  const manual = [];
  const yearWarnings = [];
  const trackWarnings = [];
  const courses = uniquePlannedCourses(ctx);
  const external = externalPlannedBreakdown(ctx);
  const seminar = seminarProfile(ctx);
  const selectedSeminars = selectedSeminarCourses(ctx, courses);

  for (const course of courses) {
    const credits = courseCredits(course);
    if (!isYearEligible(ctx, course)) {
      yearWarnings.push(course);
      continue;
    }
    if (course.courseTrack !== "昼間コース") trackWarnings.push(course);

    const currentYearSeminar = isResearchGuidance(course) && seminarYearForCourse(course) === seminar.year;
    if (!isCapExempt(ctx, course) && !(seminar.enrolled && currentYearSeminar && seminar.year === 4)) totals.cap += credits;

    const classified = graduationBucket(ctx, course);
    if (classified.bucket === "manual") {
      if (credits > 0) manual.push({ course, reason: classified.reason });
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(totals, classified.bucket)) {
      totals[classified.bucket] += credits;
      totals.graduationCountable += credits;
      if (isRemoteForLimit(course)) totals.remote += credits;
    }
  }
  for (const key of ["knowledge","humanCulture","societyHuman","natureEnvironment","health","foreign","commonOther","academicUnassigned","ownCore","ownAdvanced","academicFlex"]) {
    totals[key] += numberValue(external.totals[key]);
  }
  totals.cap += numberValue(external.totals.cap);
  totals.remote += numberValue(external.totals.remote);
  totals.unallocated = numberValue(external.totals.unallocated);
  totals.graduationCountable += numberValue(external.totals.recognized);

  // ゼミ所属者は研究指導12単位を「今後履修可能」とみなし、卒業見込みへ自動反映する。
  // 取得済み研究指導単位や実際の4年ゼミ科目を候補に入れた場合は12単位を上限に正規化し、二重計上しない。
  let seminarAssumedCredits = 0;
  if (seminar.enrolled && seminar.planEnabled) {
    const currentResearch = numberValue(ctx.profile?.credits?.research) + numberValue(acquiredCourseBreakdown(ctx).totals.research);
    const remainingResearch = Math.max(0, 12 - currentResearch);
    const researchFromSelectedCourses = totals.research;
    seminarAssumedCredits = Math.max(0, remainingResearch - researchFromSelectedCourses);
    totals.graduationCountable += remainingResearch - researchFromSelectedCourses;
    totals.research = remainingResearch;
  }

  // 研究指導12単位は4年次のCAPに全量算入。実ゼミ科目が候補にある場合も二重計上しない。
  if (seminar.enrolled && seminar.planEnabled && seminar.year === 4) totals.cap += 12;
  return { totals, manual, yearWarnings, trackWarnings, courses, external, seminar, selectedSeminars, seminarAssumedCredits };
}

export function creditState(ctx) {
  const current = { ...defaultProfile().credits, ...(ctx.profile.credits || {}) };
  for (const key of Object.keys(current)) current[key] = numberValue(current[key]);
  const acquired = acquiredCourseBreakdown(ctx);
  for (const key of ["knowledge","humanCulture","societyHuman","natureEnvironment","health","foreign","commonOther","academicUnassigned","ownCore","ownAdvanced","academicFlex","research"]) {
    current[key] = numberValue(current[key]) + numberValue(acquired.totals[key]);
  }
  const recognition = recognitionBreakdown(ctx);
  for (const key of ["knowledge","humanCulture","societyHuman","natureEnvironment","health","foreign","commonOther","academicUnassigned","ownCore","ownAdvanced","academicFlex"]) {
    current[key] = numberValue(current[key]) + numberValue(recognition.totals[key]);
  }
  if (isFirstYearProfile(ctx)) {
    current.academicUnassigned = numberValue(current.academicUnassigned) + numberValue(current.ownCore) + numberValue(current.ownAdvanced) + numberValue(current.academicFlex) + numberValue(current.research);
    current.ownCore = 0;
    current.ownAdvanced = 0;
    current.academicFlex = 0;
    current.research = 0;
    current.noSeminarReplacement = 0;
  }
  current.remotePost2022 = numberValue(current.remotePost2022) + numberValue(recognition.totals.remote);
  const plan = plannedCreditBreakdown(ctx);
  const projected = { ...current };
  for (const key of ["knowledge","humanCulture","societyHuman","natureEnvironment","health","foreign","commonOther","academicUnassigned","ownCore","ownAdvanced","academicFlex","research"]) {
    projected[key] = numberValue(current[key]) + numberValue(plan.totals[key]);
  }
  projected.remotePost2022 = numberValue(current.remotePost2022) + plan.totals.remote;
  let foreignAssumedCredits = 0;
  if (isUpperYearProfile(ctx) && ctx.profile.foreignPlanEnabled !== false) {
    const foreignRequirement = numberValue(ctx.handbook?.requirements?.foreignLanguage || 14);
    foreignAssumedCredits = Math.max(0, foreignRequirement - numberValue(projected.foreign));
    projected.foreign = numberValue(projected.foreign) + foreignAssumedCredits;
  }
  return { current, projected, plan, recognition, acquired, foreignAssumedCredits };
}

export function commonTotal(credits) {
  return ["knowledge","humanCulture","societyHuman","natureEnvironment","health","foreign","commonOther"]
    .reduce((sum, key) => sum + numberValue(credits[key]), 0);
}

export function academicAllocation(ctx, credits) {
  const core = numberValue(credits.ownCore);
  const advanced = numberValue(credits.ownAdvanced);
  const flexBase = numberValue(credits.academicFlex);
  const research = ctx.profile.noSeminar ? numberValue(credits.noSeminarReplacement) : numberValue(credits.research);
  const coreUsed = Math.min(12, core);
  const advancedPool = advanced + Math.max(0, core - 12);
  const advancedUsed = Math.min(28, advancedPool);
  const flexPool = flexBase + Math.max(0, advancedPool - 28);
  const flexUsed = Math.min(20, flexPool);
  const researchUsed = Math.min(12, research);
  const total = core + advanced + flexBase + (ctx.profile.noSeminar ? 0 : numberValue(credits.research));
  return { core, advancedPool, flexPool, research, coreUsed, advancedUsed, flexUsed, researchUsed, total };
}

export function calculateDegreeModel(ctx) {
  if (!ctx.handbook) throw new Error("履修ルールを読み込めませんでした。");
  const rows = [];
  const informationalRequirement = (...values) => ({ kind: "information", values });
  const addWarning = (kind, title, body) => warnings.push({ kind, title, body });
  const warnings = [];
  const { current, projected, plan, recognition, acquired, foreignAssumedCredits } = creditState(ctx);
  const requirements = ctx.handbook.requirements;
  const currentAcademic = academicAllocation(ctx, current);
  const projectedAcademic = academicAllocation(ctx, projected);
  const currentCommon = commonTotal(current);
  const projectedCommon = commonTotal(projected);
  const currentAcademicUnassigned = numberValue(current.academicUnassigned);
  const projectedAcademicUnassigned = numberValue(projected.academicUnassigned);
  const currentTotal = currentCommon + currentAcademic.total + currentAcademicUnassigned + recognition.totals.unallocated;
  const projectedTotal = projectedCommon + projectedAcademic.total + projectedAcademicUnassigned + recognition.totals.unallocated + numberValue(plan.totals.unallocated);
  const capLimit = requirements.annualCap + Math.min(requirements.annualCapCarryMax, numberValue(ctx.profile.failedCarry));
  const capUsed = plan.totals.cap + recognition.totals.cap;
  const remoteProjected = numberValue(projected.remotePost2022);

  const summaryCards = [
    [isFirstYearProfile(ctx) && !selectedDepartment(ctx) ? "卒業所要単位（暫定）" : "卒業所要単位", `${formatCredit(currentTotal)} → ${formatCredit(projectedTotal)} / ${requirements.graduationTotal}`],
    ["今年度CAP", `${formatCredit(capUsed)} / ${formatCredit(capLimit)}${plan.seminar?.capCredits ? "（ゼミ12含む）" : ""}`],
    ["遠隔授業上限", `${formatCredit(remoteProjected)} / ${requirements.remoteGraduationMax}`],
    ["履修候補", `${plan.courses.length + plan.external.records.length}科目 / 自動算入 ${formatCredit(plan.totals.graduationCountable)}単位`],
    ["単位認定", `${formatCredit(recognition.totals.recognized)}取得済 / ${formatCredit(recognition.totals.recognized + plan.external.totals.recognized)}見込 / ${formatCredit(requirements.recognizedGraduationMax ?? 60)}上限`],
  ];

  const fourBasicCurrent = current.humanCulture + current.societyHuman + current.natureEnvironment + current.health;
  const fourBasicProjected = projected.humanCulture + projected.societyHuman + projected.natureEnvironment + projected.health;
  const basicCurrent = current.knowledge + fourBasicCurrent;
  const basicProjected = projected.knowledge + fourBasicProjected;
  const commonFreeCurrent = current.commonOther + Math.max(0, current.knowledge - requirements.basicMinimums["知（地）の基礎"]) + Math.max(0, fourBasicCurrent - requirements.basicFourFieldsTotal) + Math.max(0, current.foreign - requirements.foreignLanguage);
  const commonFreeProjected = projected.commonOther + Math.max(0, projected.knowledge - requirements.basicMinimums["知（地）の基礎"]) + Math.max(0, fourBasicProjected - requirements.basicFourFieldsTotal) + Math.max(0, projected.foreign - requirements.foreignLanguage);
  const commonRows = [
    ["卒業所要単位 合計", requirements.graduationTotal, currentTotal, projectedTotal],
    ["共通科目・外国語 合計", requirements.commonTotal, currentCommon, projectedCommon],
    ["基礎科目 合計", requirements.basicTotal, basicCurrent, basicProjected],
    ["　知（地）の基礎", requirements.basicMinimums["知（地）の基礎"], current.knowledge, projected.knowledge],
    ["　人間・社会・自然・健康 合計", requirements.basicFourFieldsTotal, fourBasicCurrent, fourBasicProjected],
    ["　人間と文化", requirements.basicMinimums["人間と文化"], current.humanCulture, projected.humanCulture],
    ["　社会と人間", requirements.basicMinimums["社会と人間"], current.societyHuman, projected.societyHuman],
    ["　自然と環境", requirements.basicMinimums["自然と環境"], current.natureEnvironment, projected.natureEnvironment],
    ["　健康科学", requirements.basicMinimums["健康科学"], current.health, projected.health],
    ["外国語科目", requirements.foreignLanguage, current.foreign, projected.foreign, { note: ctx.handbook.notes.foreignLanguage }],
    ["共通科目の自由選択相当", 12, commonFreeCurrent, commonFreeProjected],
  ];
  for (const row of commonRows) rows.push({ kind: "requirement", values: row });

  if (isFirstYearProfile(ctx) && !selectedDepartment(ctx)) {
    if (projectedAcademic.total > 0) {
      rows.push(informationalRequirement(
        "専門共通等（学科未所属でも判定可能）",
        currentAcademic.total,
        projectedAcademic.total,
        "72単位枠へ算入",
        "専門共通科目など、所属学科が未確定でも算入先を判定できる単位です。"
      ));
    }
    rows.push(informationalRequirement(
      "学科科目（学科未確定）",
      currentAcademicUnassigned,
      projectedAcademicUnassigned,
      "配属後に再分類",
      "1年次は自学科・他学科が未確定のため、学科別の72単位要件への割当を保留します。"
    ));
  } else {
    const academicPrefix = isHypotheticalDepartmentSelection(ctx) ? `想定：${selectedDepartment(ctx)} / ` : "";
    const academicRows = [
      [`${academicPrefix}学科科目 合計`, requirements.academicTotal, currentAcademic.total, projectedAcademic.total],
      ["　自学科基幹", requirements.ownCore, currentAcademic.core, projectedAcademic.core],
      ["　自学科発展（基幹超過分を含む）", requirements.ownAdvanced, currentAcademic.advancedPool, projectedAcademic.advancedPool],
      ["　自他学科・専門共通等", requirements.academicFlex, currentAcademic.flexPool, projectedAcademic.flexPool],
      [ctx.profile.noSeminar ? "　ノンゼミ代替自学科科目" : "　研究指導", requirements.research, currentAcademic.research, projectedAcademic.research],
    ];
    for (const row of academicRows) rows.push({ kind: "requirement", values: row });
    if (projectedAcademicUnassigned > 0) {
      rows.push(informationalRequirement(
        "学科科目（未再分類）",
        currentAcademicUnassigned,
        projectedAcademicUnassigned,
        "要再分類",
        "この単位は総単位には暫定反映しますが、学科別の基幹・発展・20単位枠には充当していません。"
      ));
    }
  }

  if (isFirstYearProfile(ctx)) {
    if (isHypotheticalDepartmentSelection(ctx)) {
      addWarning("info", "1年次：想定学科で卒業要件を仮計算", `実際の所属学科はまだ未確定です。現在は「${selectedDepartment(ctx)}に所属した場合」として、履修候補の学科科目を基幹・発展・その他へ仮分類しています。`);
    } else {
      addWarning("info", "1年次は学科未所属として計算", "共通科目は通常どおり判定し、学科科目は『学科未確定』として総単位へ暫定反映します。想定学科を選ぶと、その学科に進んだ場合の基幹・発展・20単位枠を仮計算できます。");
    }

    const basicPlacementCredits = numberValue(projected.knowledge) + numberValue(projected.humanCulture) + numberValue(projected.societyHuman) + numberValue(projected.natureEnvironment) + numberValue(projected.health);
    const basicPlannedCourses = plan.courses.filter((course) => isYearEligible(ctx, course) && course.courseTrack === "昼間コース" && course.curriculumSubcategory === "基礎科目");
    if (basicPlacementCredits < 8) {
      addWarning("warn", "学科所属準備：基礎科目が8単位未満", `学科所属の成績基準では、基礎科目は成績の高い順に4科目以上・8単位を使います。現在確認できる取得済み＋履修候補は ${formatCredit(basicPlacementCredits)} 単位です。履修候補を見直してください。`);
    } else if (numberValue(current.knowledge) + numberValue(current.humanCulture) + numberValue(current.societyHuman) + numberValue(current.natureEnvironment) + numberValue(current.health) === 0 && basicPlannedCourses.length < 4) {
      addWarning("warn", "学科所属準備：基礎科目の科目数を確認", `履修候補では基礎科目が ${basicPlannedCourses.length} 科目です。公式基準は4科目以上・8単位なので、4科目以上になっているか確認してください。`);
    } else {
      addWarning("ok", "学科所属準備：基礎科目8単位を確保", `現在確認できる取得済み＋履修候補は ${formatCredit(basicPlacementCredits)} 単位です。公式基準では、この中から成績上位の4科目以上・8単位が序列計算に使われます。`);
    }

    const placementCoreSubjects = new Set();
    for (const course of plan.courses) {
      if (isYearEligible(ctx, course) && isFirstYearPlacementCoreCourse(ctx, course)) placementCoreSubjects.add(sameCourseKey(course));
    }
    for (const record of acquired.records) {
      const course = ctx.coursesByCode.get(record.code);
      if (course && isFirstYearPlacementCoreCourse(ctx, course)) placementCoreSubjects.add(sameCourseKey(course));
    }
    for (const record of recognition.records) {
      if (!record.courseCode) continue;
      const course = ctx.coursesByCode.get(record.courseCode);
      if (course && isFirstYearPlacementCoreCourse(ctx, course)) placementCoreSubjects.add(sameCourseKey(course));
    }
    const placementCoreCount = placementCoreSubjects.size;
    if (placementCoreCount < 3) {
      addWarning("warn", "学科所属準備：学科基幹科目が3科目未満", `履修候補と読替コードから確認できる1年次配当の学科基幹科目は ${placementCoreCount} 科目です。学科所属の成績基準では成績上位3科目を使うため、このままでは序列計算で使用できる科目が不足し、不利になる可能性があります。`);
    } else {
      addWarning("ok", "学科所属準備：学科基幹3科目を確保", `履修候補と読替コードから ${placementCoreCount} 科目を確認できました。学科所属ではこのうち成績上位3科目が序列計算に使われます。`);
    }
    addWarning("info", "外国語3科目は不足警告の対象外", "外国語は大学側の指定履修を前提として、この履修計画チェックでは不足警告を出しません。学科所属の成績基準自体には、英語または日本語2科目＋英語以外の外国語1科目が含まれます。");
  } else if (!actualDepartment(ctx)) {
    addWarning("warn", "所属学科が未選択です", "学科科目の基幹・発展・その他への自動振り分けには所属学科を選択してください。");
  }
  if (!isFirstYearProfile(ctx) && projectedAcademicUnassigned > 0) {
    addWarning("warn", "1年次の学科未確定単位を再分類してください", `${formatCredit(projectedAcademicUnassigned)}単位が『学科未確定』のまま残っています。所属学科決定後は、成績表に合わせて自学科基幹・自学科発展・その他学科等へ振り替え、学科未確定欄を0にしてください。`);
  }
  if (ctx.profile.noSeminar) {
    addWarning("warn", "ノンゼミの代替12単位を確認", "入力欄の『ノンゼミ代替』は、自学科基幹・発展等として既に入力した単位のうち、代替要件に充てる12単位を示す確認欄です。総単位には二重加算しません。");
  } else if (Number(ctx.profile.currentYear) === 4) {
    addWarning("info", "4年次ゼミは12単位取得見込み・CAP算入", "ゼミ所属として計算しているため、研究指導12単位を卒業見込みへ自動反映し、今年度CAPにも12単位を加算しています。実際の4年ゼミ科目を履修候補に入れても二重計上しません。");
  } else if (Number(ctx.profile.currentYear) === 3) {
    addWarning("info", "3年次ゼミは研究指導12単位を取得見込み", "ゼミ所属として計算しているため、研究指導12単位を将来履修可能として卒業見込みへ自動反映します。3年次のCAPには加算しません。標準時間割は木4・5限として扱い、実際のゼミ科目を登録した場合はその曜限を優先します。");

    const graduationRemainingAfterYear3Plan = Math.max(0, requirements.graduationTotal - projectedTotal);
    if (graduationRemainingAfterYear3Plan >= 29) {
      addWarning(
        "danger",
        "3年終了時に29単位以上残る見込みです",
        `現在の取得済み単位と3年次の履修候補をすべて修得し、研究指導12単位を将来取得すると仮定しても、卒業まで ${formatCredit(graduationRemainingAfterYear3Plan)} 単位残る見込みです。4年次は研究指導12単位がCAP40に含まれるため、通常のCAP対象科目で追加できるのは28単位までです。CAP外科目や不可単位の翌年度繰越などに該当しない限り、4年間で卒業要件を満たせない可能性があります。`
      );
    }
  }
  if (selectedDepartment(ctx) === "商学科（英語専修）") {
    addWarning("warn", isFirstYearProfile(ctx) ? "英語専修を想定した仮計算です" : "英語専修は一部手動確認が必要です", "英語専修は商学科への所属決定に加えて1年次の学科所属希望調査で希望する必要があり、教職要件もあります。基幹・発展以外は履修の手引きで確認してください。");
  }
  if (capUsed > capLimit) {
    addWarning("danger", "CAP超過", `履修候補と今年度CAP算入の認定単位の合計が ${formatCredit(capUsed)} 単位で、今年度の上限 ${formatCredit(capLimit)} 単位を超えています。`);
  }
  if (recognition.totals.recognized + plan.external.totals.recognized > (requirements.recognizedGraduationMax ?? 60)) {
    addWarning("danger", "認定単位60単位上限を超過する見込み", `認定済み ${formatCredit(recognition.totals.recognized)} 単位と他大学授業の認定見込み ${formatCredit(plan.external.totals.recognized)} 単位の合計が上限を超えます。`);
  }
  if (recognition.totals.unallocated > 0 || plan.external.totals.unallocated > 0) {
    addWarning("warn", "算入区分が未確定の認定単位があります", `${formatCredit(recognition.totals.unallocated + plan.external.totals.unallocated)}単位を卒業所要単位の合計にだけ仮算入しています。Campus Squareの認定結果に合わせて、共通・外国語・学科等の算入先を設定してください。`);
  }
  if (plan.external.records.length) {
    addWarning("info", "他大学授業は認定見込みとして試算", `${plan.external.records.length}科目・${formatCredit(plan.external.totals.recognized)}単位を履修候補に含めています。正式な単位認定前なので、大学の認定結果を優先してください。`);
  }
  if (acquired.manual.length) {
    addWarning("warn", "取得済み科目の算入区分を自動判定できないものがあります", acquired.manual.map(({ course, reason }) => `${course.subject}: ${reason}`).join(" / ") + "。必要な単位は下の数値入力で補ってください。");
  }
  const acquiredCodes = new Set(acquired.records.map((record) => record.code));
  const duplicateAcquiredCourses = plan.courses.filter((course) => acquiredCodes.has(course.code));
  if (duplicateAcquiredCourses.length) {
    addWarning("danger", "取得済み科目が履修候補にも入っています", duplicateAcquiredCourses.map((course) => `${course.subject}（${course.code}）`).join("、") + "。取得済み科目は履修候補から外してください。");
  }
  const acquiredRestrictionCourses = plan.courses.map((course) => ({ course, issues: acquiredCourseIssues(ctx, course).filter((issue) => !["acquiredExact", "recognizedExact"].includes(issue.type)) })).filter((entry) => entry.issues.length);
  if (acquiredRestrictionCourses.length) {
    addWarning("danger", "取得済み科目との重複・履修制限があります", acquiredRestrictionCourses.map(({ course, issues }) => `${course.subject}: ${issues.map(acquiredIssueText).join("・")}`).join(" / "));
  }
  const recognizedCodes = new Set(recognition.records.map((record) => record.courseCode).filter(Boolean));
  const duplicateRecognizedCourses = plan.courses.filter((course) => recognizedCodes.has(course.code));
  if (duplicateRecognizedCourses.length) {
    addWarning("danger", "認定済み科目が履修候補にも入っています", duplicateRecognizedCourses.map((course) => `${course.subject}（${course.code}）`).join("、") + "。読替認定された科目は原則として再履修できないため、履修候補から外してください。");
  }
  if (remoteProjected > requirements.remoteGraduationMax) {
    addWarning("danger", "遠隔授業60単位上限を超過", `取得済み＋履修候補で ${formatCredit(remoteProjected)} 単位です。2022年度までの遠隔単位を誤って入力していないかも確認してください。`);
  }
  if (Number(ctx.profile.currentYear) === 2) {
    const projectedBeforeThird = projectedTotal;
    if (projectedBeforeThird < requirements.progressionToThirdYear) {
      addWarning("warn", "3年次進級要件まで未達", `2年次終了までに卒業所要単位へ算入される46単位が必要です。現在の入力と候補では ${formatCredit(projectedBeforeThird)} 単位です。`);
    } else {
      addWarning("ok", "3年次進級要件の単位数を満たす見込み", `候補をすべて修得すると ${formatCredit(projectedBeforeThird)} 単位です。個別の算入可否は最終確認してください。`);
    }
  }
  if (plan.yearWarnings.length) {
    addWarning("danger", "上位年次配当の科目があります", plan.yearWarnings.map((course) => `${course.subject}（${minimumEligibleYear(course)}年次以上）`).join("、"));
  }
  if (plan.trackWarnings.length) {
    addWarning("warn", "昼間コース以外の候補があります", plan.trackWarnings.map((course) => `${course.subject}（${course.courseTrack || "区分不明"}）`).join("、"));
  }
  if (plan.manual.length) {
    addWarning("warn", "卒業所要単位への自動算入を保留した科目", plan.manual.map(({ course, reason }) => `${course.subject}: ${reason}`).join(" / "));
  }
  if (foreignAssumedCredits > 0) {
    addWarning("info", "外国語は履修見込みを含む試算です", `3・4年次設定のため、外国語の不足 ${formatCredit(foreignAssumedCredits)} 単位を卒業までに履修する見込みとして試算しています。取得済み単位には加えていません。${ctx.handbook.notes.foreignLanguage}`);
  } else if (projected.foreign >= requirements.foreignLanguage) {
    addWarning("info", "外国語は単位数だけでは完結しません", ctx.handbook.notes.foreignLanguage);
  }
  return { current, projected, plan, recognition, acquired, foreignAssumedCredits, currentTotal, projectedTotal, totalCredits: projectedTotal, remainingCredits: Math.max(0, requirements.graduationTotal - projectedTotal), capUsed, capLimit, currentAcademic, projectedAcademic, summaryCards, requirements: rows, warnings };
}
