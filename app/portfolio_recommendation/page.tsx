"use client";

import React from 'react';

export default function PortfolioRecommendation() {
  const categoryAllocations = [
    { label: 'Tech Reviews', percentage: 40, color: 'bg-blue-900' },
    { label: 'How-to / Tutorials', percentage: 30, color: 'bg-blue-600' },
    { label: 'Entertainment', percentage: 20, color: 'bg-indigo-400' },
    { label: 'Gaming', percentage: 10, color: 'bg-slate-400' },
  ];

  const creators = [
    { name: 'MKBHD', category: 'Tech Reviews', countryCode: 'us', country: 'US', risk: 'Low', ltv: '$2.4M', allocation: '25%' },
    { name: 'Dave2D', category: 'Tech Reviews', countryCode: 'us', country: 'US', risk: 'Low', ltv: '$1.8M', allocation: '15%' },
    { name: 'Linus Tech', category: 'How-to', countryCode: 'ca', country: 'CA', risk: 'Medium', ltv: '$2.1M', allocation: '20%' },
    { name: 'iJustine', category: 'Entertainment', countryCode: 'us', country: 'US', risk: 'Low', ltv: '$1.2M', allocation: '15%' },
    { name: 'MrMobile', category: 'Tech Reviews', countryCode: 'gb', country: 'GB', risk: 'Medium', ltv: '$0.9M', allocation: '10%' },
    { name: 'GadgetsBoy', category: 'How-to', countryCode: 'gb', country: 'GB', risk: 'Medium', ltv: '$0.8M', allocation: '10%' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Industry Portfolio Recommendation</h1>
        <p className="text-sm font-medium mt-2 text-slate-600">Configure and analyze creator mix diversification.</p>
      </div>

      {/* Portfolio Config */}
      <div className="bg-white/70 backdrop-blur-md border border-slate-300 shadow-sm rounded-2xl p-6">
        <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-5">Portfolio Config</div>
        <div className="grid grid-cols-4 gap-4 mb-5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Industry</label>
            <select className="w-full bg-white/80 border-2 border-slate-200 text-sm font-medium text-slate-900 rounded-lg px-4 py-2.5 outline-none focus:border-blue-900 transition-colors appearance-none">
              <option>Consumer Electronics</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Target markets</label>
            <select className="w-full bg-white/80 border-2 border-slate-200 text-sm font-medium text-slate-900 rounded-lg px-4 py-2.5 outline-none focus:border-blue-900 transition-colors appearance-none">
              <option>US + GB + CA</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Total budget</label>
            <select className="w-full bg-white/80 border-2 border-slate-200 text-sm font-medium text-slate-900 rounded-lg px-4 py-2.5 outline-none focus:border-blue-900 transition-colors appearance-none">
              <option>$500K</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Risk appetite</label>
            <select className="w-full bg-white/80 border-2 border-slate-200 text-sm font-medium text-slate-900 rounded-lg px-4 py-2.5 outline-none focus:border-blue-900 transition-colors appearance-none">
              <option>Balanced</option>
            </select>
          </div>
        </div>
        <button className="w-full py-3.5 bg-gradient-to-br from-blue-900 to-blue-700 hover:from-blue-800 hover:to-blue-600 shadow-md transition-all rounded-xl text-sm text-white font-bold flex items-center justify-center gap-2">
          Generate portfolio recommendation <span>→</span>
        </button>
      </div>

      {/* 2-Column Section */}
      <div className="grid grid-cols-2 gap-6">
        {/* Category Allocation */}
        <div className="bg-white/85 border border-slate-300 shadow-sm rounded-2xl p-6">
          <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-6">Category Allocation</div>
          <div className="space-y-5">
            {categoryAllocations.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-bold text-slate-900">{item.label}</span>
                  <span className="text-xs font-bold text-slate-500">{item.percentage}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden shadow-inner">
                  <div className={`${item.color} h-full rounded-full`} style={{ width: `${item.percentage}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Diversification Score */}
        <div className="bg-white/85 border border-slate-300 shadow-sm rounded-2xl p-6">
          <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-5">Diversification Score</div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50/50 rounded-xl p-4 flex flex-col items-center justify-center border border-blue-100">
              <div className="text-4xl font-black text-blue-900 mb-1">84</div>
              <div className="text-xs font-bold tracking-wide text-blue-700 uppercase">Overall score</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 flex flex-col items-center justify-center border border-slate-200">
              <div className="text-4xl font-black text-slate-800 mb-1">6</div>
              <div className="text-xs font-bold tracking-wide text-slate-500 uppercase">Creators in mix</div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-bold text-slate-900">Category spread</span>
                <span className="text-xs font-bold text-blue-700">4 categories</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-blue-900 to-blue-700 h-full w-[85%] rounded-full"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-bold text-slate-900">Country spread</span>
                <span className="text-xs font-bold text-blue-700">3 markets</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-blue-900 to-blue-700 h-full w-[75%] rounded-full"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-bold text-slate-900">Risk tier spread</span>
                <span className="text-xs font-bold text-slate-500">Mixed</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden shadow-inner">
                <div className="bg-slate-400 h-full w-[60%] rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Creator Mix */}
      <div className="bg-white/85 border border-slate-300 shadow-sm rounded-2xl p-6 overflow-hidden">
        <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-5">Recommended Creator Mix</div>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-slate-500 border-b-2 border-slate-100">
                <th className="pb-3 font-bold w-1/4">Creator</th>
                <th className="pb-3 font-bold w-1/5">Category</th>
                <th className="pb-3 font-bold w-1/6">Market</th>
                <th className="pb-3 font-bold w-1/6">Risk</th>
                <th className="pb-3 font-bold w-1/6">LTV Est.</th>
                <th className="pb-3 font-bold text-right w-[10%]">Allocation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {creators.map((creator, i) => (
                <tr key={i} className="text-slate-700 transition-colors hover:bg-slate-50/50">
                  <td className="py-4 font-black text-slate-900">{creator.name}</td>
                  <td className="py-4 font-medium">{creator.category}</td>
                  <td className="py-4 flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 text-[10px] font-black uppercase tracking-wider">
                      {creator.countryCode}
                    </span>
                    <span className="font-bold">{creator.country}</span>
                  </td>
                  <td className="py-4">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${
                      creator.risk === 'Low'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {creator.risk}
                    </span>
                  </td>
                  <td className="py-4 font-bold text-slate-500">{creator.ltv}</td>
                  <td className="py-4 text-right font-black text-slate-900">{creator.allocation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}