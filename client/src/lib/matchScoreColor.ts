/**
 * Existing match-score bands used by the matches page score bars.
 * 0–25, 26–50, 51–75, 76–100. Thresholds are inclusive on the low end of each cut
 * (`<= 25`, `<= 50`, `<= 75`, otherwise 76–100).
 */

export const MATCH_SCORE_BANDS = [
  { label: '76-100', hex: '#3A7AFE' },
  { label: '51-75', hex: '#5C8AFF' },
  { label: '26-50', hex: '#85AAFF' },
  { label: '0-25', hex: '#BAD1FF' },
] as const

export function matchScoreHex(pct: number): string {
  const score = Number.isFinite(pct) ? pct : 0
  if (score <= 25) return '#BAD1FF'
  if (score <= 50) return '#85AAFF'
  if (score <= 75) return '#5C8AFF'
  return '#3A7AFE'
}

export function scoreBarColor(pct: number): { bg: string; border: string } {
  if (pct <= 25) return { bg: 'bg-[#BAD1FF]', border: 'border-[#BAD1FF]' }
  if (pct <= 50) return { bg: 'bg-[#85AAFF]', border: 'border-[#85AAFF]' }
  if (pct <= 75) return { bg: 'bg-[#5C8AFF]', border: 'border-[#5C8AFF]' }
  return { bg: 'bg-[#3A7AFE]', border: 'border-[#3A7AFE]' }
}
