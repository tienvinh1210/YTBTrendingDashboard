"use client";

import React from 'react';

export default function ChannelAnalysis() {
  const getHeatmapColor = (val: number) => {
    if (val >= 80) return 'bg-blue-600 text-white shadow-sm';
    if (val >= 60) return 'bg-blue-400 text-white shadow-sm';
    if (val >= 40) return 'bg-blue-200 text-blue-900';
    return 'bg-slate-100 text-slate-500';
  };

  const heatmapData = [
    { category: 'Tech Reviews', scores: [95, 82, 78, 61, 40] },
    { category: 'How-to / Tutorials', scores: [88, 75, 72, 80, 52] },
    { category: 'Entertainment', scores: [60, 58, 55, 72, 66] },
    { category: 'Gaming', scores: [42, 38, 40, 55, 78] },
  ];

  const regions = ['US', 'GB', 'CA', 'IN', 'JP'];

  return (
    <div className="space-y-6">

      {/* Header - Base Fade In */}
      <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Channel Analysis</h1>
        <p className="text-sm font-medium mt-2 text-slate-600">High-level channel integrity and global viral footprint.</p>
      </div>

      {/* Top Stats Grid - Delay 150ms */}
      <div className="grid grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
        <div className="bg-white/85 border border-slate-300 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Channel Origin</div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-black text-slate-900">US</div>
            <div className="text-sm font-bold text-slate-400">United States</div>
          </div>
        </div>
        <div className="bg-white/85 border border-slate-300 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Total Subscribers</div>
          <div className="text-2xl font-black text-slate-900">18,400,000</div>
        </div>
        <div className="bg-white/85 border border-slate-300 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Total Views</div>
          <div className="text-2xl font-black text-slate-900">4,200,000,000</div>
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

        {/* Global Viral Heatmap - Delay 500ms */}
        <div className="bg-white/85 border border-slate-300 rounded-2xl p-6 shadow-sm col-span-2 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500 fill-mode-both">
          <div>
            <div className="text-lg font-bold text-slate-900 mb-1">Viral Footprint Heatmap</div>
            <div className="text-sm font-medium text-slate-500 mb-6">Trending category strength across top regions</div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm text-left border-separate border-spacing-2">
              <thead>
                <tr>
                  <th className="pb-2"></th>
                  {regions.map((reg) => (
                    <th key={reg} className="pb-2 text-center w-[15%]">
                      <span className="font-bold text-slate-700">{reg}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-2 font-bold text-slate-800 whitespace-nowrap w-[25%]">{row.category}</td>
                    {row.scores.map((score, j) => (
                      <td key={j} className="p-0">
                        <div className={`h-10 w-full rounded-lg flex items-center justify-center font-bold text-sm transition-all hover:scale-[1.02] ${getHeatmapColor(score)}`}>
                          {score}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Low Penetration</span>
            <div className="flex gap-1">
              <div className="w-8 h-2 rounded-full bg-slate-100"></div>
              <div className="w-8 h-2 rounded-full bg-blue-200"></div>
              <div className="w-8 h-2 rounded-full bg-blue-400"></div>
              <div className="w-8 h-2 rounded-full bg-blue-600"></div>
            </div>
            <span>High Virality</span>
          </div>
        </div>

      </div>
    </div>
  );
}