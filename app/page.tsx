"use client";

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center h-[75vh] animate-in fade-in duration-1000 slide-in-from-bottom-4">
      <div className="text-center space-y-6 max-w-xl">

        {/* Welcome Text */}
        <h1 className="text-5xl font-black tracking-tight text-slate-900">
          Welcome to YouRisk
        </h1>
        <p className="text-lg font-medium text-slate-500 leading-relaxed px-4">
          The enterprise standard for digital media asset valuation. Stop guessing on sponsorships and start calculating true, long-term ROI.
        </p>

        {/* Launch Button */}
        <div className="pt-8">
          <Link
            href="/channel_overview"
            className="inline-flex items-center gap-2 px-10 py-4 text-lg font-bold rounded-xl text-white shadow-md bg-gradient-to-br from-blue-900 to-blue-600 hover:shadow-lg transition-all hover:-translate-y-1"
          >
            Launch Platform
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

      </div>
    </div>
  );
}