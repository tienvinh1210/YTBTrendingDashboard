"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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

  // Sort ascending by publish date so the time series reads left → right (oldest → newest).
  const chartData = useMemo(
    () =>
      [...recentVideos].sort(
        (a, b) =>
          new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
      ),
    [recentVideos]
  );
  const thumbnailByVideoId = useMemo(() => {
    const m = new Map<string, RecentVideo>();
    recentVideos.forEach((v) => m.set(v.videoId, v));
    return m;
  }, [recentVideos]);

  type AxisTickProps = {
    x?: number;
    y?: number;
    payload?: { value: string };
  };
  const formatDDMMYY = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  const ThumbnailXTick = (props: AxisTickProps) => {
    const { x = 0, y = 0, payload } = props;
    const v = payload ? thumbnailByVideoId.get(payload.value) : undefined;
    if (!v) return null;
    const w = 84;
    const h = 47;
    return (
      <g transform={`translate(${x - w / 2}, ${y + 8})`}>
        <a href={v.url} target="_blank" rel="noopener noreferrer">
          <image
            href={v.thumbnailUrl}
            width={w}
            height={h}
            preserveAspectRatio="xMidYMid slice"
            style={{ borderRadius: 6 }}
          />
        </a>
        <text
          x={w / 2}
          y={h + 14}
          textAnchor="middle"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize={10}
          fontWeight={600}
          fill="#475569"
        >
          {formatDDMMYY(v.publishedAt)}
        </text>
      </g>
    );
  };

  const seriesMeta = [
    { key: "viewCount", label: "Views", color: "#1e3a8a" },
    { key: "likeCount", label: "Likes", color: "#2563eb" },
    { key: "commentCount", label: "Comments", color: "#60a5fa" },
  ] as const;

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

        {/* Recent Videos Time Series - Delay 500ms */}
        <div className="bg-white/85 border border-slate-300 rounded-2xl p-6 shadow-sm col-span-2 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500 fill-mode-both">
          <div>
            <div className="text-lg font-bold text-slate-900 mb-1">5 Most Recent Videos</div>
            <div className="text-sm font-medium text-slate-500 mb-6">
              Views, likes, and comments over time (oldest → newest)
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
            <div className="space-y-2">
              {seriesMeta.map((s, i) => {
                const isLast = i === seriesMeta.length - 1;
                return (
                  <div key={s.key}>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-2 mb-1">
                      {s.label}
                    </div>
                    <div
                      className="w-full"
                      style={{ height: isLast ? 220 : 130 }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          margin={{
                            top: 8,
                            right: 24,
                            left: 8,
                            bottom: isLast ? 80 : 4,
                          }}
                          barCategoryGap="25%"
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e2e8f0"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="videoId"
                            interval={0}
                            tickLine={false}
                            axisLine={{ stroke: "#cbd5e1" }}
                            tick={isLast ? <ThumbnailXTick /> : false}
                            height={isLast ? 80 : 8}
                          />
                          <YAxis
                            tickFormatter={(v: number) => compactFmt.format(v)}
                            tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }}
                            axisLine={{ stroke: "#cbd5e1" }}
                            tickLine={{ stroke: "#cbd5e1" }}
                            width={56}
                          />
                          <Tooltip
                            cursor={{ fill: "rgba(30, 58, 138, 0.05)" }}
                            labelFormatter={(label) => {
                              const id =
                                typeof label === "string" ? label : String(label);
                              return thumbnailByVideoId.get(id)?.title ?? id;
                            }}
                            formatter={(value) => [
                              numberFmt.format(Number(value ?? 0)),
                              s.label,
                            ]}
                            contentStyle={{
                              background: "rgba(255,255,255,0.95)",
                              border: "1px solid #cbd5e1",
                              borderRadius: 10,
                              fontSize: 12,
                              maxWidth: 320,
                            }}
                            labelStyle={{ fontWeight: 700, color: "#0f172a" }}
                          />
                          <Bar
                            dataKey={s.key}
                            fill={s.color}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={60}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
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