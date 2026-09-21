import { favoriteStorageKey, legacyFavoriteCookieName, profileStorageKey } from '../config.js';
import { readProfile } from '../storage.js';
import { defaultProfile } from '../domain/values.js';

export function setLocalDataStatus(ctx, message) {
  if (ctx.el.localDataStatus) ctx.el.localDataStatus.textContent = message || "";
}

export function buildLocalBackup(ctx) {
  return {
    schema: "otaru-syllabus-local-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    favoriteCodes: [...ctx.state.persistent.favoriteCodes].filter((code) => ctx.coursesByCode.has(code)).sort(),
    profile: ctx.state.persistent.profile,
  };
}

export function exportLocalBackup(ctx) {
  try {
    const payload = JSON.stringify(buildLocalBackup(ctx), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `otaru-rishu-backup-${date}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setLocalDataStatus(ctx, "バックアップJSONを書き出しました。このファイルには個人の履修情報が含まれるため、他人と共有しないでください。");
  } catch {
    setLocalDataStatus(ctx, "バックアップを書き出せませんでした。");
  }
}

export async function importLocalBackupFile(ctx, file) {
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    if (raw?.schema !== "otaru-syllabus-local-backup" || raw?.version !== 1 || !raw.profile || typeof raw.profile !== "object") {
      throw new Error("invalid backup");
    }
    const favoriteCodes = Array.isArray(raw.favoriteCodes)
      ? [...new Set(raw.favoriteCodes.filter((code) => typeof code === "string" && ctx.coursesByCode.has(code)))]
      : [];
    localStorage.setItem(favoriteStorageKey, favoriteCodes.join(","));
    localStorage.setItem(profileStorageKey, JSON.stringify(raw.profile));
    ctx.state.persistent.favoriteCodes = new Set(favoriteCodes);
    ctx.state.persistent.profile = readProfile(ctx);
    ctx.syncProfileControls();
    ctx.renderControls();
    ctx.render();
    setLocalDataStatus(ctx, `バックアップを読み込みました（履修候補 ${favoriteCodes.length}件）。`);
  } catch {
    setLocalDataStatus(ctx, "このファイルは読み込めません。履修支援サイトから書き出したバックアップJSONを選んでください。");
  } finally {
    if (ctx.el.importLocalDataInput) ctx.el.importLocalDataInput.value = "";
  }
}

export function clearAllLocalUserData(ctx) {
  const confirmed = globalThis.confirm?.("この端末に保存した履修候補・時間割・取得済み単位・単位認定・設定をすべて削除します。元に戻せません。続けますか？") ?? false;
  if (!confirmed) return;
  try {
    localStorage.removeItem(favoriteStorageKey);
    localStorage.removeItem(profileStorageKey);
    document.cookie = `${legacyFavoriteCookieName}=; max-age=0; path=/; SameSite=Lax`;
  } catch {
    // 画面上の状態は続けて初期化する。
  }
  ctx.state.persistent.favoriteCodes = new Set();
  ctx.state.persistent.profile = defaultProfile();
  ctx.state.session.filters.keyword = "";
  ctx.state.session.filters.favoritesOnly = false;
  ctx.syncProfileControls();
  ctx.renderControls();
  ctx.render();
  setLocalDataStatus(ctx, "この端末に保存していた個人の履修情報を削除しました。");
}
