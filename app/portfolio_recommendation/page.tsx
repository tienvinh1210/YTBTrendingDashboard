"use client";

import { useEffect, useState } from 'react';

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

export default function PortfolioRecommendation() {
  const [scan, setScan] = useState<StoredScan | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedVideo[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [scanLoaded, setScanLoaded] = useState(false);
  const [trainingInsights, setTrainingInsights] = useState<TrainingInsights | null>(null);
  const [trainingInsightsError, setTrainingInsightsError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setScan(JSON.parse(raw) as StoredScan);
    } catch {
      // ignore corrupt storage
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
        const data = (await res.json()) as
          | { items: RecommendedVideo[] }
          | { error: string };
        if (!res.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Failed to load recommendations.");
        }
        setRecommendations(data.items);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setRecsError(e instanceof Error ? e.message : "Unexpected error.");
      })
      .finally(() => setRecsLoading(false));

    return () => controller.abort();
  }, [scan]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Industry Portfolio Recommendation</h1>
        <p className="text-sm font-medium mt-2 text-slate-600">
          Similar videos use the live chart; training panels summarize{" "}
          <code className="text-xs bg-slate-100 px-1 rounded">stage1_training_data.csv</code>.
        </p>
      </div>

      {/* Top 5 Similar Videos */}
      <div className="bg-white/70 backdrop-blur-md border border-slate-300 shadow-sm rounded-2xl p-6">
        <div className="flex items-baseline justify-between mb-4">
          <div className="text-xs font-bold tracking-wider text-slate-500 uppercase">
            Top 5 most popular similar videos
          </div>
          {scan?.video?.categoryName && scan?.channel?.country && (
            <div className="text-xs font-semibold text-slate-500">
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

        {recsLoading && (
          <div className="text-sm font-medium text-slate-500">Loading recommendations…</div>
        )}

        {!recsLoading && !recsError && recommendations.length > 0 && (
          <ul className="list-disc pl-6 space-y-2 marker:text-blue-900">
            {recommendations.map((v) => (
              <li key={v.videoId} className="text-sm text-slate-700 leading-relaxed">
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-blue-900 hover:text-blue-700 underline decoration-blue-300 underline-offset-2 hover:decoration-blue-700 transition-colors"
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

      {/* Training-backed category context (kept sections only) */}
      <div className="bg-white/70 backdrop-blur-md border border-slate-300 shadow-sm rounded-2xl p-6 space-y-6">
        {trainingInsightsError && (
          <div className="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            {trainingInsightsError}
          </div>
        )}

        {trainingInsights && (
          <>
            <div>
              <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-3">
                Dominant global categories (share of trending training rows)
              </div>
              <ul className="space-y-2 text-sm text-slate-700">
                {trainingInsights.globalCategoryMix.slice(0, 5).map((row) => (
                  <li key={row.categoryId} className="flex items-center gap-3">
                    <span className="w-44 font-bold text-slate-900 shrink-0">{row.categoryName}</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-800 rounded-full" style={{ width: `${row.share * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-500 w-14 text-right">
                      {(row.share * 100).toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-blue-50/60 p-4">
              <div className="text-xs font-bold text-blue-900 uppercase mb-2">Cross-market signal</div>
              {trainingInsights.categoryTrendingAcrossCountries.length > 0 ? (
                <p className="text-sm font-medium text-slate-800 leading-relaxed">
                  <span className="font-black">{trainingInsights.categoryTrendingAcrossCountries[0].categoryName}</span>{" "}
                  appears in the top-three category mix in{" "}
                  <span className="font-black">
                    {trainingInsights.categoryTrendingAcrossCountries[0].countriesWithTop3Presence}
                  </span>{" "}
                  country buckets
                  {trainingInsights.categoryTrendingAcrossCountries[1] ? (
                    <>
                      , followed by{" "}
                      <span className="font-black">
                        {trainingInsights.categoryTrendingAcrossCountries[1].categoryName}
                      </span>{" "}
                      ({trainingInsights.categoryTrendingAcrossCountries[1].countriesWithTop3Presence})
                    </>
                  ) : null}
                  . Overweight these if you want exposure aligned with charts that show up across many markets.
                </p>
              ) : (
                <p className="text-sm text-slate-600">Not enough regional coverage to rank cross-market categories.</p>
              )}
            </div>

            <div>
              <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-3">
                Per-country top category (first slot only, where country is known)
              </div>
              <div className="flex flex-wrap gap-2">
                {trainingInsights.topCategoriesByCountry.slice(0, 16).map((block) => {
                  const top = block.topCategories[0];
                  if (!top) return null;
                  return (
                    <span
                      key={block.country}
                      className="inline-flex items-center gap-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700"
                    >
                      <span className="font-black text-slate-900">{block.country}</span>
                      <span className="text-slate-400">→</span>
                      <span>{top.categoryName}</span>
                      <span className="text-slate-400">({(top.share * 100).toFixed(0)}%)</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
}