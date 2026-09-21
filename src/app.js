import { saveFavoriteCodes } from './storage.js';
import { activeFilters, matches, sortCourses } from './ui/search.js';
import { renderFavorites } from './ui/timetable-view.js';
import { renderAcquiredCourses, renderRecognitions } from './ui/records-view.js';
import { numberValue } from './domain/values.js';
import { acquiredCourseRecords } from './domain/records.js';
import { renderDegreeCheck } from './ui/degree-view.js';
import { renderComparisonControls } from './ui/compare.js';
import { renderResults } from './ui/results.js';

export function toggleFavorite(ctx, code) {
  if (ctx.state.persistent.favoriteCodes.has(code)) {
    ctx.state.persistent.favoriteCodes.delete(code);
  } else {
    ctx.state.persistent.favoriteCodes.add(code);
  }
  saveFavoriteCodes(ctx);
  ctx.render();
}

export function render(ctx) {
  ctx.el.tagAndButton.classList.toggle("active", ctx.state.session.filters.tagLogic === "and");
  ctx.el.tagOrButton.classList.toggle("active", ctx.state.session.filters.tagLogic === "or");
  const filtered = sortCourses(ctx, ctx.data.courses.filter(matches.bind(null, ctx)));
  ctx.el.resultCount.textContent = `${filtered.length}件`;
  const filters = activeFilters(ctx);
  ctx.el.activeSummary.textContent = filters.length ? ` / ${filters.join(" / ")}` : "";
  renderFavorites(ctx);
  renderAcquiredCourses(ctx);
  renderRecognitions(ctx);
  if (ctx.el.clearEarnedCreditsButton) {
    const hasManualCredits = Object.values(ctx.state.persistent.profile?.credits || {}).some((value) => numberValue(value) > 0);
    ctx.el.clearEarnedCreditsButton.disabled = !hasManualCredits && acquiredCourseRecords(ctx.domain()).length === 0;
  }
  if (ctx.el.clearRecognitionsButton) {
    ctx.el.clearRecognitionsButton.disabled = !(ctx.state.persistent.profile?.recognitions || []).length;
  }
  renderDegreeCheck(ctx);
  renderComparisonControls(ctx);
  renderResults(ctx, filtered);
}
