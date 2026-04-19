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
      ? "vo-risk-low"
      : risk.tone === "med"
        ? "vo-risk-med"
        : "vo-risk-high";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

        .vo-root {
          font-family: 'DM Sans', sans-serif;
          background: #f5f4f0;
          min-height: 100vh;
          padding: 40px;
          color: #1e293b;
        }

        /* Header */
        .vo-header {
          margin-bottom: 36px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
        }

        .vo-title {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.03em;
          color: #0f172a;
          line-height: 1;
          margin: 0 0 6px;
        }

        .vo-subtitle {
          font-size: 13px;
          color: #64748b;
          font-weight: 400;
          margin: 0;
        }

        /* Dashboard Strip */
        .vo-dash-strip {
          background: #0f172a; /* Navy background */
          border-radius: 16px;
          padding: 24px;
          display: grid;
          /* Changed from auto-fit minmax to strictly 4 columns for desktop */
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
          box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.3);
        }

        .vo-dash-item {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .vo-dash-label {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 12px;
          font-weight: 600;
        }

        .vo-dash-value {
          font-family: 'DM Sans', sans-serif;
          font-size: 26px;
          font-weight: 700;
          color: #fff;
          line-height: 1.1;
        }

        .vo-budget-wrap {
          display: flex;
          align-items: center;
          background: rgba(2, 6, 23, 0.5);
          border: 1px solid #475569;
          border-radius: 8px;
          overflow: hidden;
          margin-top: 4px;
        }

        .vo-budget-input {
          background: transparent;
          border: none;
          color: #fff;
          font-family: 'DM Mono', monospace;
          font-size: 14px;
          padding: 12px 12px 12px 6px;
          width: 100%;
          outline: none;
        }

        .vo-progress-track {
          height: 8px;
          background: #020617;
          border-radius: 99px;
          margin-top: 14px;
          overflow: hidden;
        }

        .vo-progress-fill {
          height: 100%;
          background: #10b981;
          border-radius: 99px;
          transition: width 0.5s ease;
        }

        .vo-risk-card {
          border: 2px solid;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .vo-risk-low { background: #d1fae5; border-color: #6ee7b7; color: #064e3b; }
        .vo-risk-med { background: #fef3c7; border-color: #fcd34d; color: #451a03; }
        .vo-risk-high { background: #ffe4e6; border-color: #fda4af; color: #881337; }

        .vo-btn-reset {
          width: 100%;
          background: #fff;
          color: #0f172a;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          padding: 12px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: background 0.15s;
          margin-top: auto;
        }

        .vo-btn-reset:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .vo-btn-reset:hover:not(:disabled) {
          background: #f1f5f9;
        }

        /* Cards Row */
        .vo-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .vo-card {
          background: #fff;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 26px;
        }

        .vo-card-title {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #64748b;
          margin: 0 0 24px;
          display: flex;
          justify-content: space-between;
        }

        /* Sliders */
        .vo-slider-row {
          margin-bottom: 24px;
        }

        .vo-slider-row:last-child {
          margin-bottom: 0;
        }

        .vo-slider-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }

        .vo-slider-name {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          line-height: 1.2;
        }

        .vo-slider-sub {
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
        }

        .vo-slider-val {
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }

        .vo-slider {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: #e2e8f0;
          outline: none;
          -webkit-appearance: none;
        }

        .vo-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          cursor: pointer;
        }

        .vo-slider.cat-slider::-webkit-slider-thumb { background: #1e3a8a; } /* Navy */
        .vo-slider.geo-slider::-webkit-slider-thumb { background: #7c3aed; } /* Violet */

        /* Video List */
        .vo-video-list {
          margin: 0;
          padding: 0 0 0 20px;
          color: #1e3a8a;
        }

        .vo-video-item {
          margin-bottom: 10px;
          line-height: 1.5;
        }

        .vo-video-link {
          font-weight: 600;
          color: #1e3a8a;
          text-decoration: underline;
          text-decoration-color: #93c5fd;
          text-underline-offset: 3px;
        }

        .vo-video-link:hover {
          color: #1d4ed8;
        }

        .vo-video-meta {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
        }

        /* Helpers */
        .vo-alert {
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 16px;
        }

        .vo-alert-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .vo-alert-warn {
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #92400e;
        }

        /* Fade-in */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .vo-reveal {
          animation: fadeUp 0.4s ease forwards;
        }

        .vo-reveal-1 { animation-delay: 0.05s; opacity: 0; }
        .vo-reveal-2 { animation-delay: 0.12s; opacity: 0; }
        .vo-reveal-3 { animation-delay: 0.19s; opacity: 0; }

        @media (max-width: 1024px) {
          .vo-dash-strip {
            /* Stack 2x2 on tablets */
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .vo-cards {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .vo-dash-strip {
            /* Full stack on phones */
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="vo-root">
        {/* Header */}
        <div className="vo-header">
          <div>
            <h1 className="vo-title">Corporate Investment Dashboard</h1>
          </div>
        </div>

        {/* Training Insights Error */}
        {trainingInsightsError && (
          <div className="vo-alert vo-alert-warn vo-reveal">
            {trainingInsightsError}
          </div>
        )}

        {/* Dashboard Strip */}
        <div className="vo-dash-strip vo-reveal vo-reveal-1">
          <div className="vo-dash-item">
            <div className="vo-dash-label">Total budget ($)</div>
            <div className="vo-budget-wrap">
              <span style={{ color: '#94a3b8', paddingLeft: '12px', fontSize: '14px', fontFamily: 'DM Mono, monospace' }}>$</span>
              <input
                type="text"
                inputMode="decimal"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="vo-budget-input"
                placeholder="0"
              />
            </div>
          </div>

          <div className="vo-dash-item">
            <div className="vo-dash-label">Diversity score</div>
            <div>
              <span className="vo-dash-value">{diversityScore}</span>
              <span style={{ fontSize: '14px', color: '#94a3b8', marginLeft: '6px' }}>/ 100</span>
            </div>
            <div className="vo-progress-track">
              <div
                className="vo-progress-fill"
                style={{ width: `${diversityScore}%` }}
              />
            </div>
          </div>

          <div className={`vo-risk-card ${riskCardClass}`}>
            <div className="vo-dash-label" style={{ color: 'inherit', opacity: 0.8, marginBottom: '6px' }}>
              Risk classification
            </div>
            <div className="vo-dash-value" style={{ color: 'inherit' }}>
              {risk.label}
            </div>
          </div>

          <div className="vo-dash-item">
            <div className="vo-dash-label">Reset weights</div>
            <button
              type="button"
              onClick={resetWeights}
              disabled={!baselineCategory.length || !baselineGeo.length}
              className="vo-btn-reset"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Weighting Cards */}
        <div className="vo-cards vo-reveal vo-reveal-2">
          {/* Category Weighting */}
          <div className="vo-card">
            <h2 className="vo-card-title">Category weighting</h2>
            {!categoryPct.length ? (
              <p style={{ fontSize: '13px', color: '#64748b' }}>Loading weights from training data…</p>
            ) : (
              <div>
                {categoryPct.map((pct, i) => {
                  const maxOne = 100 - MIN_W * (categoryPct.length - 1);
                  return (
                    <div key={i} className="vo-slider-row">
                      <div className="vo-slider-header">
                        <div>
                          <div className="vo-slider-name">{categoryLabels[i] ?? `Category ${i + 1}`}</div>
                          <div className="vo-slider-sub">{formatUsd(categoryDollars[i])}</div>
                        </div>
                        <div className="vo-slider-val">{pct.toFixed(1)}%</div>
                      </div>
                      <input
                        type="range"
                        min={MIN_W}
                        max={maxOne}
                        step={0.1}
                        value={Math.min(Math.max(pct, MIN_W), maxOne)}
                        onChange={(e) => onCategorySlider(i, parseFloat(e.target.value))}
                        className="vo-slider cat-slider"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Geographic Weighting */}
          <div className="vo-card">
            <h2 className="vo-card-title">Geographic weighting</h2>
            {!geoPct.length ? (
              <p style={{ fontSize: '13px', color: '#64748b' }}>Loading weights from training data…</p>
            ) : (
              <div>
                {geoPct.map((pct, i) => {
                  const maxOne = 100 - MIN_W * (geoPct.length - 1);
                  return (
                    <div key={GEO_BUCKETS[i].key} className="vo-slider-row">
                      <div className="vo-slider-header">
                        <div>
                          <div className="vo-slider-name">{GEO_BUCKETS[i].label}</div>
                          <div className="vo-slider-sub">{formatUsd(geoDollars[i])}</div>
                        </div>
                        <div className="vo-slider-val">{pct.toFixed(1)}%</div>
                      </div>
                      <input
                        type="range"
                        min={MIN_W}
                        max={maxOne}
                        step={0.1}
                        value={Math.min(Math.max(pct, MIN_W), maxOne)}
                        onChange={(e) => onGeoSlider(i, parseFloat(e.target.value))}
                        className="vo-slider geo-slider"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Top 5 Similar Videos (Moved to Bottom) */}
        <div className="vo-card vo-reveal vo-reveal-3">
          <h2 className="vo-card-title">
            <span>Top 5 most popular similar videos</span>
            {scan?.video?.categoryName && scan?.channel?.country && (
              <span style={{ textTransform: 'none', color: '#64748b' }}>
                {scan.video.categoryName} · {scan.channel.country}
              </span>
            )}
          </h2>

          {scanLoaded && !scan && (
            <div className="vo-alert vo-alert-warn">
              Scan a video on the Video Overview page first to see related recommendations.
            </div>
          )}

          {recsError && (
            <div className="vo-alert vo-alert-error">
              {recsError}
            </div>
          )}

          {recsLoading && (
            <p style={{ fontSize: '13px', color: '#64748b' }}>Loading recommendations…</p>
          )}

          {!recsLoading && !recsError && recommendations.length > 0 && (
            <ul className="vo-video-list">
              {recommendations.map((v) => (
                <li key={v.videoId} className="vo-video-item">
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vo-video-link"
                  >
                    {v.title}
                  </a>
                  <span className="vo-video-meta"> — {v.channelTitle}</span>
                </li>
              ))}
            </ul>
          )}

          {!recsLoading && !recsError && scan && recommendations.length === 0 && (
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              No similar videos found for this category and region.
            </p>
          )}
        </div>
      </div>
    </>
  );
}