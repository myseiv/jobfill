// shared/normalise.js
const LEGAL_SUFFIXES = /\b(ltd|limited|plc|llp|inc|corp|group)\b/gi;

export function normalise(name) {
  return name
    .toLowerCase()
    .replace(LEGAL_SUFFIXES, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function lookup(name, entries) {
  const key = normalise(name);
  if (entries[key]) return { ...entries[key] };
  for (const [entryKey, value] of Object.entries(entries)) {
    if (levenshtein(key, entryKey) <= 2) return { ...value };
  }
  return null;
}
