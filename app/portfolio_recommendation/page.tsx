"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type RecommendedVideo = {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  url: string;
};

type StoredScan = {
  video?: {
    id?: string;
    categoryId?: string;
    categoryName?: string;
    channelTitle?: string;
  };
  channel?: {
    country?: string | null;
    title?: string;
  } | null;
};

const STORAGE_KEY = "yourisk:lastScan";

type TrainingInsights = {
  globalCategoryMix: { categoryId: number; categoryName: string; count: number; share: number }[];
  categoryTrendingAcrossCountries: {
    categoryId: number;
    categoryName: string;
    countriesWithTop3Presence: number;
  }[];
  topCategoriesByCountry: {
    country: string;
    trendingVideos: number;
    topCategories: { categoryId: number; categoryName: string; count: number; share: number }[];
  }[];
};

const GEO_BUCKETS = [
  { key: "na", label: "North America (US/CA)", codes: ["US", "CA"] as const },
  { key: "eu", label: "Europe (FR/DE/GB)", codes: ["FR", "DE", "GB"] as const },
  { key: "asia", label: "Asia (IN/JP/KR)", codes: ["IN", "JP", "KR"] as const },
  { key: "latam", label: "LATAM (BR/MX/CO)", codes: ["BR", "MX", "CO"] as const },
] as const;

const MIN_W = 0.5;

/*
 * Copy not shown in UI (product / dev notes):
 * - Page purpose: simulate portfolio allocation, diversity metrics, and content risk; category and region weights
 *   initialize from stage1 training aggregates (portfolio_training_insights.json).
 * - Dollar per row: totalBudget * 0.5 * (weight%/100) — half the budget to category sliders, half to geography.
 * - Diversity score: std-dev(category %) + std-dev(region %), scaled vs max-concentration reference so 0–100.
 * - Reset: restores category and geography weights to the original training-derived baselines.
 * - Slider behavior: increasing a weight takes mass from the smallest other weights first; each group sums to 100%.
 *
 * Typography (uniform):
 * - Page title: text-2xl font-bold
 * - Section headings (h2): text-sm font-semibold tracking-wide uppercase
 * - Body / lists / inputs: text-sm (root wrapper sets text-sm)
 * - KPI numerals in navy strip: text-2xl font-bold tabular-nums where shown
 */

/** Renormalize to sum 100 while keeping each slot at least MIN_W (iterative). */
function normalizeHundred(w: number[]): number[] {
  let x = [...w];
  for (let t = 0; t < 12; t++) {
    x = x.map((v) => Math.max(MIN_W, v));
    const s = x.reduce((a, b) => a + b, 0) || 1;
    x = x.map((v) => (v / s) * 100);
    const err = Math.abs(x.reduce((a, b) => a + b, 0) - 100);
    const allOk = x.every((v) => v >= MIN_W - 1e-6);
    if (err < 1e-4 && allOk) break;
  }
  return x;
}

function populationStdPct(weightsPct: number[]): number {
  const vals = weightsPct.map((p) => p / 100);
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  const v = vals.reduce((s, x) => s + (x - m) ** 2, 0) / vals.length;
  return Math.sqrt(v);
}

function maxStdForCount(n: number): number {
  const w = Array(n).fill(0);
  w[0] = 100;
  return populationStdPct(w);
}

const MAX_STD_SUM = maxStdForCount(5) + maxStdForCount(GEO_BUCKETS.length);

function diversityScoreFromWeights(cat: number[], geo: number[]): number {
  const raw = populationStdPct(cat) + populationStdPct(geo);
  const score = 100 * (1 - Math.min(1, raw / MAX_STD_SUM));
  return Math.min(100, Math.max(0, Math.round(score)));
}

function riskFromDiversity(score: number): { label: string; tone: "low" | "med" | "high" } {
  if (score >= 67) return { label: "LOW RISK", tone: "low" };
  if (score >= 34) return { label: "MEDIUM RISK", tone: "med" };
  return { label: "HIGH RISK", tone: "high" };
}

function regionWeightsFromTraining(
  blocks: TrainingInsights["topCategoriesByCountry"]
): number[] {
  const totals = GEO_BUCKETS.map((g) => {
    const codes = g.codes as readonly string[];
    let t = 0;
    for (const b of blocks) {
      if (codes.includes(b.country)) t += b.trendingVideos;
    }
    return t;
  });
  const sum = totals.reduce((a, b) => a + b, 0);
  if (sum <= 0) return GEO_BUCKETS.map(() => 100 / GEO_BUCKETS.length);
  return normalizeHundred(totals.map((t) => (100 * t) / sum));
}

function topCategoryWeightsFromTraining(mix: TrainingInsights["globalCategoryMix"]): {
  labels: string[];
  weights: number[];
} {
  const top = mix.slice(0, 5);
  const raw = top.map((r) => r.share * 100);
  return {
    labels: top.map((r) => r.categoryName),
    weights: normalizeHundred(raw),
  };
}

/** When increasing one slot, take mass from smallest other slots first; when decreasing, spread to others proportionally. */
function adjustWeightGroup(prev: number[], changedIndex: number, newVal: number): number[] {
  const n = prev.length;
  let target = Math.max(MIN_W, Math.min(100 - MIN_W * (n - 1), newVal));
  const next = [...prev];
  const old = next[changedIndex];
  const delta = target - old;
  next[changedIndex] = target;

  if (Math.abs(delta) < 1e-9) return normalizeHundred(next);

  const others = prev.map((_, i) => i).filter((i) => i !== changedIndex);

  if (delta > 0) {
    let need = delta;
    const order = [...others].sort((a, b) => next[a] - next[b]);
    for (const j of order) {
      if (need <= 1e-9) break;
      const avail = Math.max(0, next[j] - MIN_W);
      const sub = Math.min(avail, need);
      next[j] -= sub;
      need -= sub;
    }
    if (need > 1e-6) {
      next[changedIndex] -= need;
    }
  } else {
    const give = -delta;
    const s = others.reduce((a, i) => a + next[i], 0) || 1;
    for (const i of others) {
      next[i] += give * (next[i] / s);
    }
  }

  return normalizeHundred(next);
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function parseBudgetInput(raw: string): number {
  const cleaned = raw.replace(/[$,\s]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function PortfolioRecommendation() {
  const [scan, setScan] = useState<StoredScan | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedVideo[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [scanLoaded, setScanLoaded] = useState(false);
  const [trainingInsights, setTrainingInsights] = useState<TrainingInsights | null>(null);
  const [trainingInsightsError, setTrainingInsightsError] = useState<string | null>(null);

  const [categoryLabels, setCategoryLabels] = useState<string[]>([]);
  const [baselineCategory, setBaselineCategory] = useState<number[]>([]);
  const [categoryPct, setCategoryPct] = useState<number[]>([]);

  const [baselineGeo, setBaselineGeo] = useState<number[]>([]);
  const [geoPct, setGeoPct] = useState<number[]>([]);

  const [budgetInput, setBudgetInput] = useState("5000000");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setScan(JSON.parse(raw) as StoredScan);
    } catch {
      // ignore
    } finally {
      setScanLoaded(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/portfolio/training-insights", { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as TrainingInsights | { error: string };
        if (!res.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Failed to load training insights.");
        }
        const slim: TrainingInsights = {
          globalCategoryMix: data.globalCategoryMix,
          categoryTrendingAcrossCountries: data.categoryTrendingAcrossCountries,
          topCategoriesByCountry: data.topCategoriesByCountry,
        };
        setTrainingInsights(slim);
        setTrainingInsightsError(null);

        const { labels, weights: cw } = topCategoryWeightsFromTraining(data.globalCategoryMix);
        const gw = regionWeightsFromTraining(data.topCategoriesByCountry);
        setCategoryLabels(labels);
        setBaselineCategory(cw);
        setCategoryPct(cw);
        setBaselineGeo(gw);
        setGeoPct(gw);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setTrainingInsightsError(e instanceof Error ? e.message : "Unexpected error.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!scan) return;
    const categoryId = scan.video?.categoryId;
    const regionCode = scan.channel?.country;
    if (!categoryId || !regionCode) {
      setRecsError("Scanned video is missing a category or channel country.");
      return;
    }

    const controller = new AbortController();
    setRecsLoading(true);
    setRecsError(null);

    const params = new URLSearchParams({
      categoryId,
      regionCode,
      max: "5",
    });
    if (scan.video?.id) params.set("excludeId", scan.video.id);
    if (scan.video?.categoryName) params.set("categoryName", scan.video.categoryName);

    fetch(`/api/youtube/recommendations?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = (await res.json()) as { items: RecommendedVideo[] } | { error: string };
        if (!res.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Failed to load recommendations.");
        }
        setRecommendations("items" in data ? data.items : []);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setRecsError(e instanceof Error ? e.message : "Unexpected error.");
      })
      .finally(() => setRecsLoading(false));

    return () => controller.abort();
  }, [scan]);

  const totalBudget = useMemo(() => parseBudgetInput(budgetInput), [budgetInput]);

  const diversityScore = useMemo(
    () => diversityScoreFromWeights(categoryPct, geoPct),
    [categoryPct, geoPct]
  );

  const risk = useMemo(() => riskFromDiversity(diversityScore), [diversityScore]);

  /* 0.5 * weight% * budget per row: 50% of budget across category weights, 50% across region weights. */
  const categoryDollars = useMemo(
    () => categoryPct.map((p) => totalBudget * 0.5 * (p / 100)),
    [categoryPct, totalBudget]
  );

  const geoDollars = useMemo(
    () => geoPct.map((p) => totalBudget * 0.5 * (p / 100)),
    [geoPct, totalBudget]
  );

  const resetWeights = useCallback(() => {
    if (baselineCategory.length) setCategoryPct([...baselineCategory]);
    if (baselineGeo.length) setGeoPct([...baselineGeo]);
  }, [baselineCategory, baselineGeo]);

  const onCategorySlider = (i: number, v: number) => {
    setCategoryPct((prev) => adjustWeightGroup(prev, i, v));
  };

  const onGeoSlider = (i: number, v: number) => {
    setGeoPct((prev) => adjustWeightGroup(prev, i, v));
  };

  const riskCardClass =
    risk.tone === "low"
      ? "bg-emerald-100 border-emerald-300 text-emerald-900"
      : risk.tone === "med"
        ? "bg-amber-100 border-amber-300 text-amber-950"
        : "bg-rose-100 border-rose-300 text-rose-950";

  return (
    <div className="font-sans text-sm text-slate-700 space-y-6 animate-in fade-in duration-500 bg-stone-100/80 -mx-4 px-4 py-6 md:-mx-6 md:px-6 rounded-2xl">
      <header className="mb-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Corporate Investment Dashboard</h1>
      </header>

      {/* Top 5 Similar Videos */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
        <div className="flex items-baseline justify-between mb-4 gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
            Top 5 most popular similar videos
          </h2>
          {scan?.video?.categoryName && scan?.channel?.country && (
            <div className="text-sm font-medium text-slate-500 shrink-0">
              {scan.video.categoryName} · {scan.channel.country}
            </div>
          )}
        </div>

        {scanLoaded && !scan && (
          <div className="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            Scan a video on the Video Overview page first to see related recommendations.
          </div>
        )}

        {recsError && (
          <div className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {recsError}
          </div>
        )}

        {recsLoading && <div className="text-sm font-medium text-slate-500">Loading recommendations…</div>}

        {!recsLoading && !recsError && recommendations.length > 0 && (
          <ul className="list-disc pl-6 space-y-2 marker:text-blue-900 text-sm leading-relaxed">
            {recommendations.map((v) => (
              <li key={v.videoId}>
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-900 hover:text-blue-700 underline decoration-blue-300 underline-offset-2"
                >
                  {v.title}
                </a>
                <span className="text-slate-500 font-medium"> — {v.channelTitle}</span>
              </li>
            ))}
          </ul>
        )}

        {!recsLoading && !recsError && scan && recommendations.length === 0 && (
          <div className="text-sm font-medium text-slate-500">
            No similar videos found for this category and region.
          </div>
        )}
      </div>

      {/* Navy summary strip */}
      <div className="rounded-2xl bg-slate-900 text-white p-6 shadow-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-4">
            <h2 className="text-sm font-semibold tracking-wide text-slate-400 uppercase mb-2">Total budget ($)</h2>
            <div className="relative flex items-center rounded-lg border border-slate-600 bg-slate-950/50 overflow-hidden">
              <span className="pl-3 text-slate-300 font-medium select-none text-sm" aria-hidden>
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="w-full min-w-0 bg-transparent py-2.5 pr-3 pl-1 text-white text-sm tabular-nums outline-none"
                placeholder="0"
              />
            </div>
          </div>

          <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-4 flex flex-col justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-slate-400 uppercase mb-2">Diversity score</h2>
            <div className="text-2xl font-bold text-white tabular-nums leading-tight">
              {diversityScore}
              <span className="text-sm font-medium text-slate-400"> / 100</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-950 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${diversityScore}%` }}
              />
            </div>
          </div>

          <div
            className={`rounded-xl border-2 p-4 flex flex-col items-center justify-center text-center min-h-[120px] ${riskCardClass}`}
          >
            <h2 className="text-sm font-semibold tracking-wide uppercase opacity-80 mb-1">Risk classification</h2>
            <div className="text-2xl font-bold leading-tight">{risk.label}</div>
          </div>

          <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-4 flex flex-col justify-center gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-slate-400 uppercase">Reset weights</h2>
            <button
              type="button"
              onClick={resetWeights}
              disabled={!baselineCategory.length || !baselineGeo.length}
              className="w-full rounded-lg bg-white text-slate-900 font-semibold py-2.5 text-xl hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Reset 
            </button>
          </div>
        </div>
      </div>

      {trainingInsightsError && (
        <div className="text-sm font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          {trainingInsightsError}
        </div>
      )}

      {/* Weighting cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase mb-5">Category weighting</h2>
          {!categoryPct.length ? (
            <p className="text-sm font-medium text-slate-500">Loading weights from training data…</p>
          ) : (
            <div className="space-y-5">
              {categoryPct.map((pct, i) => {
                const maxOne = 100 - MIN_W * (categoryPct.length - 1);
                return (
                  <div key={i}>
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{categoryLabels[i] ?? `Category ${i + 1}`}</div>
                        <div className="text-sm font-medium text-slate-500 mt-0.5 tabular-nums">{formatUsd(categoryDollars[i])}</div>
                      </div>
                      <div className="text-sm font-semibold text-slate-700 tabular-nums">{pct.toFixed(1)}%</div>
                    </div>
                    <input
                      type="range"
                      min={MIN_W}
                      max={maxOne}
                      step={0.1}
                      value={Math.min(Math.max(pct, MIN_W), maxOne)}
                      onChange={(e) => onCategorySlider(i, parseFloat(e.target.value))}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer accent-blue-700 bg-slate-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-800"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase mb-5">Geographic weighting</h2>
          {!geoPct.length ? (
            <p className="text-sm font-medium text-slate-500">Loading weights from training data…</p>
          ) : (
            <div className="space-y-5">
              {geoPct.map((pct, i) => {
                const maxOne = 100 - MIN_W * (geoPct.length - 1);
                return (
                  <div key={GEO_BUCKETS[i].key}>
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{GEO_BUCKETS[i].label}</div>
                        <div className="text-sm font-medium text-slate-500 mt-0.5 tabular-nums">{formatUsd(geoDollars[i])}</div>
                      </div>
                      <div className="text-sm font-semibold text-slate-700 tabular-nums">{pct.toFixed(1)}%</div>
                    </div>
                    <input
                      type="range"
                      min={MIN_W}
                      max={maxOne}
                      step={0.1}
                      value={Math.min(Math.max(pct, MIN_W), maxOne)}
                      onChange={(e) => onGeoSlider(i, parseFloat(e.target.value))}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-600 bg-slate-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-600"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
