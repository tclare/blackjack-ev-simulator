const ABBREVIATIONS: [threshold: number, suffix: string][] = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/** Formats large counts as e.g. "123.3K", "135.1M", "1.9B", "3.1T"; smaller counts as plain "123". */
export function formatCount(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  for (const [threshold, suffix] of ABBREVIATIONS) {
    if (abs >= threshold) {
      return `${sign}${(abs / threshold).toFixed(1)}${suffix}`;
    }
  }
  return n.toLocaleString("en-US");
}
