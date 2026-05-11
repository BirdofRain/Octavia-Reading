/** @param {number} activeLevel 1–4: include content at this level or easier */
export function filterByMaxLevel(items, activeLevel, getLevel = (x) => x.level) {
  const cap = Math.min(4, Math.max(1, Number(activeLevel) || 1));
  const filtered = items.filter((x) => getLevel(x) <= cap);
  if (filtered.length === 0) {
    return items.filter((x) => getLevel(x) <= 1);
  }
  return filtered;
}
