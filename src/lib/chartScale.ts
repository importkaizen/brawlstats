/** Keep chart bounds and tick spacing predictable for flat, short, and wide histories. */
function niceStep(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, value)));
  const fraction = value / magnitude;
  const multiplier = [1, 2, 2.5, 5, 10].find((n) => n >= fraction) ?? 10;
  return Math.max(1, multiplier * magnitude);
}

export function valueAxis(
  values: number[],
  { minimumSpan, fromZero = false, fullScaleMinimum = 0, minimumUpperBound = 0, paddingRatio = 0.2, intervals = 5 }: {
    minimumSpan: number;
    fromZero?: boolean;
    fullScaleMinimum?: number;
    /** Reserve space above the data for a target such as the next rank threshold. */
    minimumUpperBound?: number;
    paddingRatio?: number;
    intervals?: number;
  },
): { domain: [number, number]; ticks: number[]; min: number; max: number } {
  const finite = values.filter(Number.isFinite);
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : 0;
  const span = Math.max(minimumSpan, (max - min) * (1 + paddingRatio));
  const midpoint = (min + max) / 2;
  const lower = fromZero ? 0 : Math.max(0, midpoint - span / 2);
  const upper = fromZero
    ? Math.max(fullScaleMinimum, max, minimumSpan)
    : Math.max(midpoint + span / 2, lower + span, minimumUpperBound);
  const step = niceStep((upper - lower) / intervals);
  const start = Math.max(0, Math.floor(lower / step) * step);
  const end = Math.ceil(upper / step) * step;
  const ticks = Array.from(
    { length: Math.round((end - start) / step) + 1 },
    (_, index) => start + index * step,
  );
  return { domain: [start, end], ticks, min, max };
}

export function matchAxis(start: number, end: number, intervals = 5): {
  domain: [number, number];
  ticks: number[];
} {
  if (start === end) {
    return { domain: [Math.max(0, start - 1), end + 1], ticks: [start] };
  }
  if (end - start <= intervals) {
    return { domain: [start, end], ticks: Array.from({ length: end - start + 1 }, (_, i) => start + i) };
  }
  const step = Math.ceil(niceStep((end - start) / intervals));
  const interior: number[] = [];
  for (let tick = Math.ceil(start / step) * step; tick < end; tick += step) {
    if (tick - start >= step * 0.5 && end - tick >= step * 0.5) interior.push(tick);
  }
  return { domain: [start, end], ticks: [start, ...interior, end] };
}

export function formatChartValue(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
