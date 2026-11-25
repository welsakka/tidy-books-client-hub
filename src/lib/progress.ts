export type StageLike = { weight: number | string; percent: number };

/** Overall close percent = weighted sum of stage percents. */
export function overallPercent(stages: StageLike[]): number {
  const totalW = stages.reduce((s, x) => s + Number(x.weight), 0);
  if (!totalW) return 0;
  const sum = stages.reduce((s, x) => s + Number(x.weight) * x.percent, 0);
  return Math.round(sum / totalW);
}
