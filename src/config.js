export const profileStorageKey = "otaru-handbook-profile-2026";

export const legacyFavoriteCookieName = "otaru_syllabus_favorites_2026";

export const favoriteStorageKey = "otaru-syllabus-favorites-2026";

export const dayOrder = new Map([
  ["月", 1],
  ["火", 2],
  ["水", 3],
  ["木", 4],
  ["金", 5],
  ["土", 6],
  ["日", 7],
]);

export const dayOptions = ["all", "月", "火", "水", "木", "金", "土", "日"];

export const timetableDays = ["月", "火", "水", "木", "金"];

export const timetablePeriods = [1, 2, 3, 4, 5, 6, 7];

export const recognitionSourceLabels = {
  prior: "入学前の既修得単位",
  exam: "検定等・大学以外の学修",
  interUniversity: "他大学との単位互換",
  studyAbroad: "留学による単位互換",
};

export const recognitionBucketLabels = {
  unallocated: "総単位のみ（区分未確定）",
  knowledge: "知（地）の基礎",
  humanCulture: "人間と文化",
  societyHuman: "社会と人間",
  natureEnvironment: "自然と環境",
  health: "健康科学",
  foreign: "外国語科目",
  commonOther: "その他の共通科目等",
  academicUnassigned: "学科科目（学科未確定）",
  ownCore: "自学科基幹科目",
  ownAdvanced: "自学科発展科目",
  academicFlex: "その他学科・専門共通等",
};

export const externalTermLabels = {
  spring: "前期",
  fall: "後期",
  full: "通年",
  summerIntensive: "夏期集中",
  winterIntensive: "冬季集中",
  otherIntensive: "その他集中・特別日程",
};
