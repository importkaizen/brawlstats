import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/chartScale.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const module = { exports: {} };
runInNewContext(outputText, { exports: module.exports });
const { valueAxis, matchAxis } = module.exports;

for (const values of [[5195], [57186, 57186], [0, 12], [6042, 6553], [4500, 8600], [11250, 15000]]) {
  const scale = valueAxis(values, { minimumSpan: 500 });
  assert.ok(scale.domain[0] >= 0);
  assert.ok(scale.domain[0] <= Math.min(...values), "Minimum value must remain visible");
  assert.ok(scale.domain[1] >= Math.max(...values), "Maximum value must remain visible");
  assert.ok(scale.domain[1] - scale.domain[0] >= 500, "Flat series must not be over-zoomed");
  assert.ok(scale.ticks.length >= 4 && scale.ticks.length <= 7, "Keep the axis readable");
  const step = scale.ticks[1] - scale.ticks[0];
  scale.ticks.slice(1).forEach((tick, i) => assert.equal(tick - scale.ticks[i], step));
}

const full = valueAxis([5195, 5624], { minimumSpan: 500, fromZero: true, fullScaleMinimum: 12000 });
assert.equal(full.domain[0], 0);
assert.ok(full.domain[1] >= 12000);
const fullTrophies = valueAxis([57186], { minimumSpan: 200, fromZero: true });
assert.equal(fullTrophies.domain[1], 60000, "Full trophy scale should not add excessive empty space");

const focusedRanked = valueAxis([5195, 5628], { minimumSpan: 100, paddingRatio: 0.08, intervals: 10 });
assert.ok(focusedRanked.domain[0] <= 5195 && focusedRanked.domain[1] >= 5628);
assert.ok(focusedRanked.domain[1] - focusedRanked.domain[0] <= 550, "The enlarged Ranked graph should use most of its vertical space");
assert.ok(focusedRanked.ticks.every((tick) => tick >= focusedRanked.domain[0] && tick <= focusedRanked.domain[1]));

for (const values of [[5600], [5195, 5628]]) {
  const rankedWithHeadroom = valueAxis(values, { minimumSpan: 100, minimumUpperBound: 6000, paddingRatio: 0.08, intervals: 10 });
  assert.equal(rankedWithHeadroom.domain[1], 6000, "A peak around 5,600 should leave room up to 6,000");
  assert.equal(rankedWithHeadroom.ticks.at(-1), 6000);
  assert.ok(rankedWithHeadroom.domain[0] <= Math.min(...values));
}

const missing = valueAxis([NaN, Infinity], { minimumSpan: 200 });
assert.ok(missing.domain.every(Number.isFinite));
assert.ok(missing.domain[1] > missing.domain[0]);

for (const [start, end] of [[0, 0], [1, 1], [0, 3], [1, 25], [0, 250]]) {
  const axis = matchAxis(start, end, 3);
  assert.ok(axis.domain[0] <= start && axis.domain[1] >= end);
  assert.ok(axis.domain[1] > axis.domain[0], "A single point needs a visible horizontal range");
  assert.equal(axis.ticks[0], start);
  assert.equal(axis.ticks.at(-1), end);
  assert.ok(axis.ticks.every(Number.isInteger));
  assert.equal(new Set(axis.ticks).size, axis.ticks.length);
  assert.ok(axis.ticks.length <= 5);
}
const libraries = new Map([["./chartScale", module.exports]]);
function loadLibrary(name) {
  if (libraries.has(name)) return libraries.get(name);
  const source = readFileSync(new URL(`../src/lib/${name.replace(/^\.\//, "")}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  libraries.set(name, exports);
  runInNewContext(outputText, { exports, require: loadLibrary });
  return exports;
}

const { rankedValueAxis, visibleMatchRange } = loadLibrary("./rankedChartScale");
const climb = [5195, 5495, 5682, 5780, 5866, 5963];
const beforePromotion = rankedValueAxis(climb, false, climb.slice(-2));
const promotion = rankedValueAxis([...climb, 6045], false, [5963, 6045]);
assert.equal(promotion.focusTier.name, "Legendary I");
assert.ok(promotion.domain[0] > beforePromotion.domain[0], "Promotion should move the bottom of the focused view upward");
assert.ok(promotion.domain[1] > beforePromotion.domain[1], "Promotion should leave room in the new division");
assert.ok(promotion.domain[0] < 6000 && promotion.domain[1] >= 6750, "Show the promotion boundary and the next target");
assert.ok(promotion.domain[0] <= 5963, "The game before promotion should remain visible");
const relativeRating = (6045 - promotion.domain[0]) / (promotion.domain[1] - promotion.domain[0]);
assert.ok(relativeRating > 0.25 && relativeRating < 0.75, "The promoted rating should sit away from the graph edges");
assert.equal(promotion.min, 5195, "The recorded range should retain historical lows");
assert.equal(promotion.max, 6045);

const nextDivision = rankedValueAxis([...climb, 6045, 6790], false, [6045, 6790]);
assert.equal(nextDivision.focusTier.name, "Legendary II");
assert.ok(nextDivision.domain[0] > promotion.domain[0], "Further division promotions should move the view upward again");
assert.ok(nextDivision.domain[1] >= 7500);
const demotion = rankedValueAxis([...climb, 6045, 6790, 5980], false, [5980]);
assert.equal(demotion.focusTier.name, "Mythic III");
assert.ok(demotion.domain[0] <= 5980 && demotion.domain[1] >= 5980, "Follow the current rating after a demotion");
assert.ok(demotion.domain[1] < nextDivision.domain[1], "An older peak should not pin the focused view upward");

const entireHistory = rankedValueAxis([...climb, 6045], true);
assert.equal(entireHistory.focusTier, null);
assert.equal(entireHistory.domain[0], 0);
assert.ok(entireHistory.domain[1] >= 12000, "Full scale must retain all ranks and historical ratings");
const pro = rankedValueAxis([5195, 11250, 15180], false, [15180]);
assert.equal(pro.focusTier.name, "Pro");
assert.ok(pro.domain[0] > 14000 && pro.domain[1] > 15180, "Pro should keep following ratings beyond the final threshold");
for (const ratings of [[5195], [], [NaN, Infinity]]) {
  const scale = rankedValueAxis(ratings);
  assert.ok(scale.domain.every(Number.isFinite));
  assert.ok(scale.domain[1] > scale.domain[0]);
}

const scrollHistory = [5195, 5203, 5203, 5303, 5411, 5496, 5628, 5551, 5551, 5474, 5474, 5388, 5486, 5581, 5495, 5588, 5684, 5764, 5652, 5732, 5682, 5780, 5866, 5963, 6045];
for (const viewportWidth of [237, 1165]) {
  const canvasWidth = 2440;
  const scales = [];
  for (const fraction of [0, 0.25, 0.5, 0.75, 1, 0.5, 0]) {
    const range = visibleMatchRange([0, 24], { scrollLeft: fraction * (canvasWidth - viewportWidth), viewportWidth, canvasWidth });
    const visible = scrollHistory.slice(range[0], range[1] + 1);
    const scale = rankedValueAxis(scrollHistory, false, visible);
    assert.ok(scale.domain[0] <= Math.min(...visible), "Every viewed match must remain above the lower bound while panning");
    assert.ok(scale.domain[1] >= Math.max(...visible), "Every viewed match must remain below the upper bound while panning");
    assert.equal(scale.min, 5195, "Panning must preserve the overall recorded range");
    assert.equal(scale.max, 6045);
    const full = rankedValueAxis(scrollHistory, true, visible);
    assert.equal(full.domain[0], entireHistory.domain[0]);
    assert.equal(full.domain[1], entireHistory.domain[1], "Full scale must stay fixed during horizontal scrolling");
    scales.push(scale);
  }
  assert.ok(scales[0].domain[0] < scales[4].domain[0], "Scrolling from first to latest games must raise the axis");
  assert.equal(scales[0].domain[0], scales.at(-1).domain[0], "Returning to the first games must restore their scale");
  assert.equal(scales[0].domain[1], scales.at(-1).domain[1]);
}
const betweenPoints = visibleMatchRange([0, 24], { scrollLeft: 1000, viewportWidth: 237, canvasWidth: 2440 });
assert.equal(betweenPoints[0], 9, "Include the offscreen point connected to the left edge");
assert.equal(betweenPoints[1], 13, "Include the offscreen point connected to the right edge");
const unscrolled = visibleMatchRange([0, 24], { scrollLeft: 0, viewportWidth: 2440, canvasWidth: 2440 });
assert.deepEqual(Array.from(unscrolled), [0, 24], "Show all matches when the canvas fits the viewport");

console.log("Chart scale checks passed: promotions, demotions, Pro progression, desktop/mobile panning, visible segments, and fixed full scale.");
