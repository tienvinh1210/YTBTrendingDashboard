"use client";

import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, ComposedChart, ScatterChart, Scatter,
} from 'recharts';

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

type QuantilePrediction = {
  id: number;
  name: string;
  p10: number;
  p50: number;
  p90: number;
  empP10: number;
  empP50: number;
  empP90: number;
  nVideos: number;
};

type TimeFrequency = {
  value: number | string;
  label: string;
  count: number;
};

type PublishingTimesData = {
  categoryId: number;
  categoryName: string;
  topMonths: TimeFrequency[];
  topDays: TimeFrequency[];
  topHours: TimeFrequency[];
};

type CategoryPerformance = {
  categoryId: number;
  categoryName: string;
  share: number;
  count: number;
};

type RegionalData = {
  countryCode: string;
  categories: CategoryPerformance[];
};

const STORAGE_KEY = "yourisk:lastScan";

export default function PortfolioRecommendation() {
  const [scan, setScan] = useState<StoredScan | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedVideo[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [scanLoaded, setScanLoaded] = useState(false);

  // Quantile data
  const [quantiles, setQuantiles] = useState<QuantilePrediction[]>([]);
  const [quantilesLoading, setQuantilesLoading] = useState(false);
  const [quantilesError, setQuantilesError] = useState<string | null>(null);

  // Publishing times data
  const [publishingTimes, setPublishingTimes] = useState<PublishingTimesData[]>([]);
  const [timesLoading, setTimesLoading] = useState(false);
  const [timesError, setTimesError] = useState<string | null>(null);

  // Regional data
  const [regions, setRegions] = useState<RegionalData[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionsError, setRegionsError] = useState<string | null>(null);

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

  // Fetch recommendations
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

  // Fetch quantile predictions
  useEffect(() => {
    const controller = new AbortController();
    setQuantilesLoading(true);

    fetch(`/api/portfolio/quantile-predictions`, { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as any;
        if (!res.ok) throw new Error(data.error || "Failed to load quantile predictions");
        setQuantiles(data.categories || []);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setQuantilesError(e instanceof Error ? e.message : "Unexpected error");
      })
      .finally(() => setQuantilesLoading(false));

    return () => controller.abort();
  }, []);

  // Fetch publishing times
  useEffect(() => {
    const controller = new AbortController();
    setTimesLoading(true);

    fetch(`/api/portfolio/publishing-times`, { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as any;
        if (!res.ok) throw new Error(data.error || "Failed to load publishing times");
        setPublishingTimes(data.categories || []);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setTimesError(e instanceof Error ? e.message : "Unexpected error");
      })
      .finally(() => setTimesLoading(false));

    return () => controller.abort();
  }, []);

  // Fetch regional performance
  useEffect(() => {
    const controller = new AbortController();
    setRegionsLoading(true);

    fetch(`/api/portfolio/regional-performance`, { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as any;
        if (!res.ok) throw new Error(data.error || "Failed to load regional performance");
        setRegions(data.regions || []);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setRegionsError(e instanceof Error ? e.message : "Unexpected error");
      })
      .finally(() => setRegionsLoading(false));

    return () => controller.abort();
  }, []);

  const currentCategoryId = scan?.video?.categoryId
    ? parseInt(scan.video.categoryId, 10)
    : null;
  const currentPublishingTimes = currentCategoryId
    ? publishingTimes.find((p) => p.categoryId === currentCategoryId)
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Portfolio Insights</h1>
        <p className="text-sm font-medium mt-2 text-slate-600">Trending predictions, publishing strategy, and regional performance.</p>
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

      {/* Days to Trend Confidence Interval */}
      <div className="bg-white/85 border border-slate-300 shadow-sm rounded-2xl p-6">
        <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-2">
          Days to Trend Confidence Interval
        </div>
        <p className="text-xs text-slate-600 mb-4">
          Predicted days to trend (P10/P50/P90) per category. Coverage: 80.8% · Model R²: 0.878
        </p>

        {quantilesError && (
          <div className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {quantilesError}
          </div>
        )}

        {quantilesLoading && (
          <div className="text-sm font-medium text-slate-500">Loading predictions…</div>
        )}

        {!quantilesLoading && !quantilesError && quantiles.length > 0 && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={quantiles}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="p10" fill="#1e3a8a" name="P10 (fast)" />
              <Bar dataKey="p50" fill="#3b82f6" name="P50 (median)" />
              <Bar dataKey="p90" fill="#cbd5e1" name="P90 (slow)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Best Publishing Times */}
      <div className="bg-white/85 border border-slate-300 shadow-sm rounded-2xl p-6">
        <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-4">
          Best Publishing Times
        </div>

        {timesError && (
          <div className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {timesError}
          </div>
        )}

        {timesLoading && (
          <div className="text-sm font-medium text-slate-500">Loading publishing times…</div>
        )}

        {!timesLoading && !timesError && (currentPublishingTimes || publishingTimes.length > 0) && (
          <div className="space-y-6">
            {currentPublishingTimes && (
              <>
                <div className="text-xs text-slate-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  Showing optimal times for <span className="font-bold">{currentPublishingTimes.categoryName}</span>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {/* Months */}
                  <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-3">Top Months</div>
                    <div className="space-y-2">
                      {currentPublishingTimes.topMonths.map((m) => (
                        <div key={m.label} className="flex justify-between items-end">
                          <span className="text-sm font-semibold text-slate-700">{m.label}</span>
                          <span className="text-xs font-bold text-blue-700">{m.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Days */}
                  <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-3">Top Days</div>
                    <div className="space-y-2">
                      {currentPublishingTimes.topDays.map((d) => (
                        <div key={d.label} className="flex justify-between items-end">
                          <span className="text-sm font-semibold text-slate-700">{d.label}</span>
                          <span className="text-xs font-bold text-blue-700">{d.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hours */}
                  <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-3">Top Hours</div>
                    <div className="space-y-2">
                      {currentPublishingTimes.topHours.map((h) => (
                        <div key={h.label} className="flex justify-between items-end">
                          <span className="text-sm font-semibold text-slate-700">{h.label}</span>
                          <span className="text-xs font-bold text-blue-700">{h.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {!currentPublishingTimes && (
              <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                Scan a video first to see optimized publishing times for that category.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Regional Category Performance */}
      <div className="bg-white/85 border border-slate-300 shadow-sm rounded-2xl p-6 overflow-hidden">
        <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-5">
          Regional Category Performance
        </div>

        {regionsError && (
          <div className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {regionsError}
          </div>
        )}

        {regionsLoading && (
          <div className="text-sm font-medium text-slate-500">Loading regional data…</div>
        )}

        {!regionsLoading && !regionsError && regions.length > 0 && (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-slate-500 border-b-2 border-slate-100">
                  <th className="pb-3 font-bold w-20">Country</th>
                  <th className="pb-3 font-bold">Top Categories (% of trending)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {regions.map((region) => {
                  const topCats = region.categories.slice(0, 5);
                  const topCat = region.categories[0];
                  return (
                    <tr key={region.countryCode} className="text-slate-700 hover:bg-slate-50/50">
                      <td className="py-4 font-black text-slate-900 bg-blue-50">{region.countryCode}</td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-2">
                          {topCats.map((cat, idx) => (
                            <span
                              key={cat.categoryId}
                              className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
                                idx === 0
                                  ? 'bg-blue-100 text-blue-900 border-blue-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {cat.categoryName} <span className="font-bold">{cat.share}%</span>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
