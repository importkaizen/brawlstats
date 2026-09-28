import { valueAxis } from "./chartScale";
import { getSubTier, nextSubTier } from "./rankedTiers";

/** Include the points on both sides of each visible line segment. */
export function visibleMatchRange(
  domain: [number, number],
  { scrollLeft, viewportWidth, canvasWidth }: { scrollLeft: number; viewportWidth: number; canvasWidth: number },
): [number, number] {
  if (viewportWidth <= 0 || canvasWidth <= viewportWidth || domain[0] === domain[1]) return domain;
  const offset = Math.max(0, Math.min(scrollLeft, canvasWidth - viewportWidth));
  // XAxis has 8px padding on each side; the chart also has a 20px right margin.
  const plotWidth = Math.max(1, canvasWidth - 36);
  const span = domain[1] - domain[0];
  return [
    Math.max(domain[0], Math.floor(domain[0] + (offset - 8) / plotWidth * span)),
    Math.min(domain[1], Math.ceil(domain[0] + (offset + viewportWidth - 8) / plotWidth * span)),
  ];
}

/** Follow the viewed matches and leave room toward their next rank threshold. */
export function rankedValueAxis(values: number[], fromZero = false, visibleValues = values) {
  const ratings = values.filter(Number.isFinite);
  const visible = visibleValues.filter(Number.isFinite);
  const viewedRatings = visible.length ? visible : ratings;
  const latest = viewedRatings[viewedRatings.length - 1] ?? 0;
  const currentTier = getSubTier(latest);
  const startingTier = getSubTier(ratings[0] ?? 0);
  const peak = viewedRatings.length ? Math.max(...viewedRatings) : 0;
  const nextThreshold = nextSubTier(peak)?.threshold ?? (Math.floor(peak / 1000) + 1) * 1000;
  const axisOptions = {
    minimumSpan: 100,
    fromZero,
    fullScaleMinimum: 12000,
    minimumUpperBound: Math.min(nextThreshold, peak + 150),
    paddingRatio: 0.08,
    intervals: fromZero ? 5 : 10,
  };
  const historyScale = valueAxis(ratings, axisOptions);

  if (fromZero) {
    return { ...historyScale, focusTier: null };
  }
  if (currentTier.threshold <= startingTier.threshold) {
    const viewedScale = valueAxis(viewedRatings, axisOptions);
    return { ...viewedScale, min: historyScale.min, max: historyScale.max, focusTier: currentTier };
  }

  const next = nextSubTier(latest);
  // Pro has no further divisions; advance its window in 1,000-point steps.
  const floor = next ? currentTier.threshold : Math.max(currentTier.threshold, Math.floor(latest / 1000) * 1000);
  const ceiling = next?.threshold ?? floor + 1000;
  const context = Math.min(300, (ceiling - floor) * 0.4);
  const focused = valueAxis([...viewedRatings, Math.max(0, floor - context), ceiling], {
    minimumSpan: 100,
    paddingRatio: 0,
    intervals: 10,
  });

  return { ...historyScale, domain: focused.domain, ticks: focused.ticks, focusTier: currentTier };
}
