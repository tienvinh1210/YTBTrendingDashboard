"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type TooltipPayloadEntry = {
  value?: number | string;
  name?: string;
  stroke?: string;
  payload?: RecentVideo;
};
type TooltipRenderProps = {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
};

type ChannelInfo = {
  id: string;
  title: string;
  country: string | null;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
};

type StoredScan = {
  video: { channelTitle: string };
  channel: ChannelInfo | null;
};

type RecentVideo = {
  videoId: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
};

const STORAGE_KEY = "yourisk:lastScan";
const numberFmt = new Intl.NumberFormat("en-US");
const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const shortDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const CHART_LEFT = 50;
const CHART_RIGHT = 16;
const THUMB_W = 96;
const THUMB_H = 54;
const X_PADDING = THUMB_W / 2;

const METRICS = [
  { key: "viewCount", name: "Views", color: "#1e3a8a" },
  { key: "likeCount", name: "Likes", color: "#2563eb" },
  { key: "commentCount", name: "Comments", color: "#60a5fa" },
] as const;

let regionNames: Intl.DisplayNames | null = null;
function getCountryName(code: string | null): string {
  if (!code) return "Unknown";
  if (typeof Intl !== "undefined" && "DisplayNames" in Intl) {
    if (!regionNames) {
      try {
        regionNames = new Intl.DisplayNames(["en"], { type: "region" });
      } catch {
        regionNames = null;
      }
    }
    if (regionNames) {
      try {
        return regionNames.of(code) ?? code;
      } catch {
        return code;
      }
    }
  }
  return code;
}

export default function ChannelAnalysis() {
  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [channelTitle, setChannelTitle] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredScan;
        setChannel(parsed.channel ?? null);
        setChannelTitle(parsed.video?.channelTitle ?? null);
      }
    } catch {
      // ignore corrupted storage
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!channel?.id) return;
    const controller = new AbortController();
    setRecentLoading(true);
    setRecentError(null);

    fetch(`/api/youtube/channel-videos?channelId=${encodeURIComponent(channel.id)}&max=5`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = (await res.json()) as
          | { items: RecentVideo[] }
          | { error: string };
        if (!res.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Failed to load videos.");
        }
        setRecentVideos(data.items);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setRecentError(e instanceof Error ? e.message : "Unexpected error.");
      })
      .finally(() => setRecentLoading(false));

    return () => controller.abort();
  }, [channel?.id]);

  const countryCode = channel?.country ?? null;
  const countryDisplay = getCountryName(countryCode);

  // Sort chronologically (oldest left → newest right) for time-series charts.
  const chartData = useMemo(
    () =>
      [...recentVideos].sort(
        (a, b) =>
          new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
      ),
    [recentVideos]
  );

  const ChartTooltip = (props: TooltipRenderProps) => {
    const { active, payload } = props;
    if (!active || !payload || payload.length === 0) return null;
    const p = payload[0];
    const datum = p.payload;
    if (!datum) return null;
    return (
      <div className="bg-white/95 border border-slate-200 rounded-lg p-2.5 shadow-md text-xs max-w-[280px]">
        <div className="font-bold text-slate-900 mb-1 line-clamp-2">{datum.title}</div>
        <div className="text-slate-700">
          <span className="font-semibold" style={{ color: p.stroke }}>
            {p.name}
          </span>
          <span>: {numberFmt.format(Number(p.value ?? 0))}</span>
        </div>
        <div className="text-slate-400 text-[10px] mt-1">
          {shortDateFmt.format(new Date(datum.publishedAt))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">

      {/* Header - Base Fade In */}
      <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Channel Analysis</h1>
        <p className="text-sm font-medium mt-2 text-slate-600">
          {channelTitle
            ? `High-level integrity and global viral footprint for ${channelTitle}.`
            : "High-level channel integrity and global viral footprint."}
        </p>
      </div>

      {loaded && !channel && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm font-medium text-amber-800 animate-in fade-in duration-500">
          Scan a video on the Video Overview page first to populate channel data here.
        </div>
      )}

      {/* Top Stats Grid - Delay 150ms */}
      <div className="grid grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
        <div className="bg-white/85 border border-slate-300 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Channel Origin</div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-black text-slate-900">{countryCode ?? "—"}</div>
            <div className="text-sm font-bold text-slate-400">{countryDisplay}</div>
          </div>
        </div>
        <div className="bg-white/85 border border-slate-300 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Total Subscribers</div>
          <div className="text-2xl font-black text-slate-900">
            {channel ? numberFmt.format(channel.subscriberCount) : "—"}
          </div>
        </div>
        <div className="bg-white/85 border border-slate-300 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Total Views</div>
          <div className="text-2xl font-black text-slate-900">
            {channel ? numberFmt.format(channel.viewCount) : "—"}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Reliability Score Donut Chart - Delay 300ms */}
        <div className="bg-white/85 border border-slate-300 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center col-span-1 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
          <div className="w-full text-left mb-6">
            <div className="text-lg font-bold text-slate-900 mb-1">Reliability Score</div>
            <div className="text-sm font-medium text-slate-500">Overall creator trust tier</div>
          </div>

          <div className="relative flex items-center justify-center w-40 h-40 mb-4">
            {/* Donut Background */}
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#e2e8f0" strokeWidth="12" />
              {/* Donut Fill (92.4% -> Stroke Dashoffset calculation) */}
              <circle
                cx="50" cy="50" r="40"
                fill="transparent"
                stroke="#2563eb"
                strokeWidth="12"
                strokeDasharray="251.2"
                strokeDashoffset="19.1"
                strokeLinecap="round"
                className="drop-shadow-sm"
              />
            </svg>
            {/* Center Text */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-4xl font-black text-slate-900 tracking-tighter">92</span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">/ 100</span>
            </div>
          </div>

          <div className="text-sm font-bold rounded-xl px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 w-full text-center">
            High Trust Tier — AAA
          </div>
        </div>

        {/* Recent Videos Bar Chart - Delay 500ms */}
        <div className="bg-white/85 border border-slate-300 rounded-2xl p-6 shadow-sm col-span-2 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500 fill-mode-both">
          <div>
            <div className="text-lg font-bold text-slate-900 mb-1">5 Most Recent Videos</div>
            <div className="text-sm font-medium text-slate-500 mb-6">
              Views, likes, and comments per video
            </div>
          </div>

          {recentLoading && (
            <div className="text-sm font-medium text-slate-500">Loading recent videos…</div>
          )}

          {recentError && (
            <div className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {recentError}
            </div>
          )}

          {!recentLoading && !recentError && !channel && (
            <div className="text-sm font-medium text-slate-500">
              Scan a video on the Video Overview page first to load this channel's videos.
            </div>
          )}

          {!recentLoading && !recentError && channel && recentVideos.length === 0 && (
            <div className="text-sm font-medium text-slate-500">
              No recent videos found for this channel.
            </div>
          )}

          {!recentLoading && !recentError && chartData.length > 0 && (
            <div className="space-y-4">
              {METRICS.map((cfg) => (
                <div key={cfg.key}>
                  <div
                    className="text-xs font-bold tracking-wider uppercase mb-1"
                    style={{ color: cfg.color, marginLeft: CHART_LEFT }}
                  >
                    {cfg.name}
                  </div>
                  <div style={{ width: "100%", height: 130 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{
                          top: 6,
                          right: CHART_RIGHT,
                          left: 0,
                          bottom: 0,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#e2e8f0"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="videoId"
                          tick={false}
                          axisLine={{ stroke: "#cbd5e1" }}
                          tickLine={false}
                          padding={{ left: X_PADDING, right: X_PADDING }}
                        />
                        <YAxis
                          width={CHART_LEFT}
                          tickFormatter={(v: number) => compactFmt.format(v)}
                          tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          content={<ChartTooltip />}
                          cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }}
                        />
                        <Line
                          type="monotone"
                          dataKey={cfg.key}
                          name={cfg.name}
                          stroke={cfg.color}
                          strokeWidth={2.5}
                          dot={{ r: 4, strokeWidth: 2, fill: "#fff", stroke: cfg.color }}
                          activeDot={{ r: 6 }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}

              {/* Thumbnail row aligned with chart x positions */}
              <div
                className="flex justify-between pt-2"
                style={{ paddingLeft: CHART_LEFT, paddingRight: CHART_RIGHT }}
              >
                {chartData.map((v) => (
                  <a
                    key={v.videoId}
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col items-center gap-1.5"
                    style={{ width: THUMB_W }}
                    title={v.title}
                  >
                    <img
                      src={v.thumbnailUrl}
                      alt={v.title}
                      className="rounded-md border border-slate-200 group-hover:border-blue-500 shadow-sm transition-colors"
                      style={{
                        width: THUMB_W,
                        height: THUMB_H,
                        objectFit: "cover",
                      }}
                    />
                    <span className="text-[10px] font-bold text-slate-500 group-hover:text-blue-700 transition-colors">
                      {shortDateFmt.format(new Date(v.publishedAt))}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}