import { openComparisonDialog } from './compare.js';
import { saveFavoriteCodes, saveProfile } from '../storage.js';
import { applySharedTimetable, buildShareUrl, buildTimetableShareText, clearSharedHash, copyShareUrl, copyTextValue, downloadShareJson, importShareDataFile, openShareDialog, renderSharedImport, sharedTimetableFromLocation, showShareNotice, updateShareDialogPreview } from './share.js';
import { clearAllLocalUserData, exportLocalBackup, importLocalBackupFile } from './backup.js';
import { addAcquiredCourseFromControls, addExternalCourseFromControls, addRecognitionFromControls, clearEarnedCredits, clearRecognitions, maybeAutofillRecognitionCourse, populateAcquiredCourseDatalist } from './records-view.js';
import { updateProfileFromControls } from './profile.js';
import { isUpperYearProfile } from '../domain/course-rules.js';
import { defaultProfile } from '../domain/values.js';
import { enrichEvaluationAndUtilityTags } from './search.js';

export function bindAndInitialize(ctx) {
ctx.el.openCompareButton?.addEventListener("click", openComparisonDialog.bind(null, ctx));
ctx.el.clearCompareButton?.addEventListener("click", () => {
  ctx.state.session.compareCodes.clear();
  ctx.render();
});
ctx.el.clearCompareDialogButton?.addEventListener("click", () => {
  ctx.state.session.compareCodes.clear();
  if (ctx.el.compareDialog?.open) ctx.el.compareDialog.close();
  ctx.render();
});


ctx.el.tagAndButton.addEventListener("click", () => {
  ctx.state.session.filters.tagLogic = "and";
  ctx.render();
});
ctx.el.tagOrButton.addEventListener("click", () => {
  ctx.state.session.filters.tagLogic = "or";
  ctx.render();
});

ctx.el.keywordInput.addEventListener("input", (event) => {
  ctx.state.session.filters.keyword = event.currentTarget.value.trim();
  ctx.render();
});
ctx.el.semesterSelect.addEventListener("change", (event) => {
  ctx.state.session.filters.semester = event.currentTarget.value;
  ctx.render();
});
ctx.el.sortSelect.addEventListener("change", (event) => {
  ctx.state.session.filters.sort = event.currentTarget.value;
  ctx.render();
});
ctx.el.noPeriodToggle.addEventListener("change", (event) => {
  ctx.state.session.filters.noPeriod = event.currentTarget.checked;
  ctx.render();
});
ctx.el.multiPeriodToggle.addEventListener("change", (event) => {
  ctx.state.session.filters.multiPeriod = event.currentTarget.checked;
  ctx.render();
});
ctx.el.favoriteOnlyToggle.addEventListener("change", (event) => {
  ctx.state.session.filters.favoritesOnly = event.currentTarget.checked;
  ctx.render();
});
ctx.el.clearFavoritesButton.addEventListener("click", () => {
  ctx.state.persistent.favoriteCodes.clear();
  ctx.state.persistent.profile.externalCourses = [];
  saveFavoriteCodes(ctx);
  saveProfile(ctx);
  ctx.render();
});
ctx.el.shareTimetableButton?.addEventListener("click", openShareDialog.bind(null, ctx));
ctx.el.importShareDataButton?.addEventListener("click", () => ctx.el.importShareDataInput?.click());
ctx.el.importShareDataInput?.addEventListener("change", (event) => importShareDataFile(ctx, event.currentTarget.files?.[0]));
for (const input of [ctx.el.shareIncludeTimetable, ctx.el.shareIncludeComparison, ctx.el.shareIncludeFilters, ctx.el.shareIncludeProfile, ctx.el.shareIncludeProgress]) {
  input?.addEventListener("change", updateShareDialogPreview.bind(null, ctx));
}
ctx.el.copyShareUrlButton?.addEventListener("click", copyShareUrl.bind(null, ctx));
ctx.el.copyShareTextButton?.addEventListener("click", () => copyTextValue(ctx, buildTimetableShareText(ctx), "時間割をテキストでコピーしました。"));
ctx.el.downloadShareJsonButton?.addEventListener("click", downloadShareJson.bind(null, ctx));
ctx.el.nativeShareButton?.addEventListener("click", async () => {
  try {
    await navigator.share({
      title: "小樽商大履修支援サイト",
      text: "履修データを共有します。",
      url: ctx.el.shareUrlInput?.value || buildShareUrl(ctx),
    });
  } catch (error) {
    if (error?.name !== "AbortError") showShareNotice(ctx, "共有メニューを開けませんでした。URLをコピーして共有してください。");
  }
});
ctx.el.importSharedReplaceButton?.addEventListener("click", () => applySharedTimetable(ctx, "replace"));
ctx.el.importSharedMergeButton?.addEventListener("click", () => applySharedTimetable(ctx, "merge"));
ctx.el.dismissSharedButton?.addEventListener("click", () => {
  ctx.state.session.pendingSharedTimetable = null;
  renderSharedImport(ctx);
  clearSharedHash();
});
ctx.el.exportLocalDataButton?.addEventListener("click", exportLocalBackup.bind(null, ctx));
ctx.el.importLocalDataButton?.addEventListener("click", () => ctx.el.importLocalDataInput?.click());
ctx.el.importLocalDataInput?.addEventListener("change", (event) => importLocalBackupFile(ctx, event.currentTarget.files?.[0]));
ctx.el.clearLocalDataButton?.addEventListener("click", clearAllLocalUserData.bind(null, ctx));

ctx.el.clearButton.addEventListener("click", () => {
  ctx.state.session.filters.keyword = "";
  ctx.state.session.filters.semester = "all";
  ctx.state.session.filters.courseTracks.clear();
  ctx.state.session.filters.curriculumGroups.clear();
  ctx.state.session.filters.curriculumSubcategories.clear();
  ctx.state.session.filters.commonFields.clear();
  ctx.state.session.filters.departments.clear();
  ctx.state.session.filters.day = "all";
  ctx.state.session.filters.periods.clear();
  ctx.state.session.filters.tags.clear();
  ctx.state.session.filters.tagLogic = "and";
  ctx.state.session.filters.noPeriod = false;
  ctx.state.session.filters.multiPeriod = false;
  ctx.state.session.filters.favoritesOnly = false;
  ctx.state.session.filters.excludeTeacherTraining = true;
  ctx.state.session.filters.sort = "no";
  ctx.el.keywordInput.value = "";
  ctx.el.semesterSelect.value = "all";
  ctx.el.sortSelect.value = "no";
  ctx.el.noPeriodToggle.checked = false;
  ctx.el.multiPeriodToggle.checked = false;
  ctx.el.favoriteOnlyToggle.checked = false;
  if (ctx.el.excludeTeacherTrainingToggle) ctx.el.excludeTeacherTrainingToggle.checked = true;
  ctx.renderControls();
  ctx.render();
});


ctx.el.recognitionSourceInput?.addEventListener("change", ctx.syncRecognitionSourceHelp);
ctx.el.recognitionCourseCodeInput?.addEventListener("change", maybeAutofillRecognitionCourse.bind(null, ctx));
ctx.el.addRecognitionButton?.addEventListener("click", addRecognitionFromControls.bind(null, ctx));
ctx.el.addAcquiredCourseButton?.addEventListener("click", addAcquiredCourseFromControls.bind(null, ctx));
ctx.el.acquiredCourseInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addAcquiredCourseFromControls(ctx);
});
ctx.el.clearEarnedCreditsButton?.addEventListener("click", clearEarnedCredits.bind(null, ctx));
ctx.el.clearRecognitionsButton?.addEventListener("click", clearRecognitions.bind(null, ctx));
ctx.el.addExternalCourseButton?.addEventListener("click", addExternalCourseFromControls.bind(null, ctx));

ctx.el.currentYearInput.addEventListener("change", () => {
  const nextYear = ctx.el.currentYearInput.value;
  const upperYear = nextYear === "3" || nextYear === "4";
  ctx.state.persistent.profile.currentYear = nextYear;
  if (nextYear === "1") ctx.state.persistent.profile.department = "";
  ctx.state.persistent.profile.seminarScheduleEnabled = upperYear;
  ctx.state.persistent.profile.seminarPlanEnabled = upperYear;
  ctx.state.persistent.profile.foreignPlanEnabled = upperYear;
  ctx.state.persistent.profile.includeForeignSearch = !upperYear;
  if (upperYear) ctx.state.persistent.profile.includeSeminarSearch = false;
  ctx.syncDepartmentControl();
  ctx.syncSeminarControls();
  ctx.syncUpperYearPresetControls();
  saveProfile(ctx);
  ctx.renderControls();
  ctx.render();
});

for (const input of [ctx.el.admissionYearInput, ctx.el.profileDepartmentInput, ctx.el.hypotheticalDepartmentInput, ctx.el.failedCarryInput, ctx.el.seminarScheduleToggle, ctx.el.seminarPlanToggle, ctx.el.foreignPlanToggle, ctx.el.noSeminarToggle, ...ctx.el.creditInputs].filter(Boolean)) {
  const eventName = input.tagName === "SELECT" || input.type === "checkbox" ? "change" : "input";
  input.addEventListener(eventName, () => {
    updateProfileFromControls(ctx);
    ctx.syncUpperYearPresetControls();
    ctx.render();
  });
}

ctx.el.excludeSeminarSearchToggle?.addEventListener("change", () => {
  if (!isUpperYearProfile(ctx.domain())) return;
  ctx.state.persistent.profile.includeSeminarSearch = !ctx.el.excludeSeminarSearchToggle.checked;
  if (ctx.el.includeSeminarSearchToggle) ctx.el.includeSeminarSearchToggle.checked = ctx.state.persistent.profile.includeSeminarSearch;
  saveProfile(ctx);
  ctx.syncUpperYearPresetControls();
  ctx.renderControls();
  ctx.render();
});

ctx.el.includeSeminarSearchToggle?.addEventListener("change", () => {
  ctx.state.persistent.profile.includeSeminarSearch = Boolean(ctx.el.includeSeminarSearchToggle.checked);
  if (ctx.el.excludeSeminarSearchToggle && isUpperYearProfile(ctx.domain())) ctx.el.excludeSeminarSearchToggle.checked = !ctx.state.persistent.profile.includeSeminarSearch;
  saveProfile(ctx);
  ctx.syncUpperYearPresetControls();
  ctx.renderControls();
  ctx.render();
});

ctx.el.excludeForeignSearchToggle?.addEventListener("change", () => {
  ctx.state.persistent.profile.includeForeignSearch = isUpperYearProfile(ctx.domain()) ? !ctx.el.excludeForeignSearchToggle.checked : true;
  if (ctx.el.includeForeignSearchToggle) ctx.el.includeForeignSearchToggle.checked = ctx.state.persistent.profile.includeForeignSearch;
  saveProfile(ctx);
  ctx.syncUpperYearPresetControls();
  ctx.renderControls();
  ctx.render();
});

ctx.el.includeForeignSearchToggle?.addEventListener("change", () => {
  if (!isUpperYearProfile(ctx.domain())) {
    ctx.el.includeForeignSearchToggle.checked = true;
    return;
  }
  ctx.state.persistent.profile.includeForeignSearch = Boolean(ctx.el.includeForeignSearchToggle.checked);
  if (ctx.el.excludeForeignSearchToggle) ctx.el.excludeForeignSearchToggle.checked = !ctx.state.persistent.profile.includeForeignSearch;
  saveProfile(ctx);
  ctx.syncUpperYearPresetControls();
  ctx.renderControls();
  ctx.render();
});

ctx.el.excludeTeacherTrainingToggle?.addEventListener("change", () => {
  ctx.state.session.filters.excludeTeacherTraining = Boolean(ctx.el.excludeTeacherTrainingToggle.checked);
  ctx.renderControls();
  ctx.render();
});


ctx.el.upperYearPresetToggle?.addEventListener("change", () => {
  if (!isUpperYearProfile(ctx.domain())) return;
  const enabled = ctx.el.upperYearPresetToggle.checked;
  ctx.state.persistent.profile.seminarScheduleEnabled = enabled;
  ctx.state.persistent.profile.seminarPlanEnabled = enabled;
  ctx.state.persistent.profile.foreignPlanEnabled = enabled;
  ctx.state.persistent.profile.includeSeminarSearch = !enabled;
  ctx.state.persistent.profile.includeForeignSearch = !enabled;
  saveProfile(ctx);
  ctx.syncSeminarControls();
  ctx.syncUpperYearPresetControls();
  ctx.renderControls();
  ctx.render();
});

ctx.el.resetProfileButton.addEventListener("click", () => {
  ctx.state.persistent.profile = defaultProfile();
  saveProfile(ctx);
  ctx.syncProfileControls();
  ctx.render();
});

enrichEvaluationAndUtilityTags(ctx);
populateAcquiredCourseDatalist(ctx);
ctx.syncProfileControls();
ctx.syncRecognitionSourceHelp();
ctx.state.session.pendingSharedTimetable = sharedTimetableFromLocation(ctx);
renderSharedImport(ctx);
ctx.renderControls();
ctx.render();

    
}
