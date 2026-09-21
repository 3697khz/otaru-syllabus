import { createState, domainInput } from './state.js';
import { getElements } from './ui/elements.js';
import { migrateAndClearLegacyFavoriteCookie, readFavoriteCodes, readProfile } from './storage.js';
import { render, toggleFavorite } from './app.js';
import { renderControls } from './ui/search.js';
import { syncProfileControls, syncUpperYearPresetControls, syncDepartmentControl, syncSeminarControls } from './ui/profile.js';
import { syncRecognitionSourceHelp } from './ui/records-view.js';
import { bindAndInitialize } from './ui/events.js';
async function loadData(name) {
  const response = await fetch(new URL('../data/' + name + '.json', import.meta.url));
  if (!response.ok) throw new Error(name + ': HTTP ' + response.status);
  return response.json();
}
async function start() {
  const [data, handbook] = await Promise.all([loadData('syllabus-2026'), loadData('handbook-rules-2026')]);
  if (!Array.isArray(data.courses) || !data.courses.length || !handbook.requirements) throw new Error('公開データの形式が不正です。');
  const state = createState();
  const coursesByCode = new Map(data.courses.map(course => [course.code, course]));
  const ctx = { state, data, handbook, coursesByCode, el: getElements(),
    periodOptions: [...new Set(data.meta.periods?.map(period => period.period).filter(Boolean) ?? [])].sort((a,b) => a-b),
    domain: () => domainInput(state, data, handbook, coursesByCode) };
  for (const [name, fn] of Object.entries({ render, toggleFavorite, renderControls, syncProfileControls, syncUpperYearPresetControls, syncDepartmentControl, syncSeminarControls, syncRecognitionSourceHelp })) ctx[name] = (...args) => fn(ctx, ...args);
  migrateAndClearLegacyFavoriteCookie();
  state.persistent.favoriteCodes = new Set(readFavoriteCodes(ctx));
  state.persistent.profile = readProfile(ctx);
  bindAndInitialize(ctx);
}
start().catch(error => {
  console.error(error);
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = '科目データまたは履修ルールを読み込めませんでした。公開ファイル一式が配置されているか確認してください。';
  document.body.prepend(message);
});
