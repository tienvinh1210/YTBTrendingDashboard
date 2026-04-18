"use client";

import React, { useState } from "react";

export default function VideoOverview() {
  const [url, setUrl] = useState("");
  const [hasData, setHasData] = useState(false);

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

        .vo-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #64748b;
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
          color: #0f172a; /* Dark Navy Text */
          line-height: 1;
          margin: 0 0 6px;
        }

        .vo-subtitle {
          font-size: 13px;
          color: #64748b;
          font-weight: 400;
          margin: 0;
        }

        .vo-badge {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          padding: 5px 10px;
          border-radius: 4px;
          background: #e2e8f0;
          color: #475569;
          letter-spacing: 0.05em;
        }

        /* Input Row */
        .vo-input-row {
          display: flex;
          gap: 12px;
          margin-bottom: 28px;
          align-items: stretch;
        }

        .vo-input {
          flex: 1;
          padding: 14px 18px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #0f172a;
          background: #fff;
          border: 1.5px solid #cbd5e1;
          border-radius: 10px;
          outline: none;
          transition: border-color 0.15s;
        }

        .vo-input::placeholder { color: #64748b; }
        .vo-input:focus { border-color: #1e3a8a; } /* Navy Blue focus */

        .vo-btn {
          padding: 14px 28px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #fff;
          background: #1e3a8a; /* Primary Navy Blue */
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          white-space: nowrap;
        }

        .vo-btn:hover { background: #172554; } /* Darker Navy on hover */
        .vo-btn:active { transform: scale(0.98); }

        /* Divider */
        .vo-divider {
          height: 1px;
          background: #cbd5e1;
          margin-bottom: 28px;
        }

        /* Stats Strip */
        .vo-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: #cbd5e1;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 20px;
        }

        .vo-stat {
          background: #fff;
          padding: 20px 24px;
        }

        .vo-stat-value {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.03em;
          color: #0f172a;
          margin-top: 8px;
          line-height: 1;
        }

        /* Cards Row */
        .vo-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .vo-card {
          background: #fff;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 26px;
        }

        .vo-card-title {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          margin: 0 0 4px;
        }

        .vo-card-sub {
          font-size: 12px;
          color: #64748b;
          margin: 0 0 24px;
        }

        /* Probability Row */
        .vo-prob-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .vo-prob-value {
          font-family: 'DM Mono', monospace;
          font-size: 28px;
          font-weight: 500;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .vo-pill {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 20px;
          background: #e0e7ff; /* Light Navy tint */
          color: #1e3a8a; /* Navy Blue text */
          letter-spacing: 0.04em;
        }

        .vo-track {
          height: 5px;
          border-radius: 99px;
          background: #f1f5f9;
          overflow: hidden;
        }

        .vo-fill {
          height: 100%;
          border-radius: 99px;
          background: #1e3a8a; /* Primary Navy Blue */
          width: 88%;
          transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Days Card */
        .vo-days-number {
          font-size: 60px;
          font-weight: 700;
          letter-spacing: -0.05em;
          color: #0f172a;
          line-height: 1;
          margin: 8px 0 4px;
        }

        .vo-days-unit {
          font-size: 14px;
          font-weight: 500;
          color: #64748b;
          display: block;
          margin-bottom: 20px;
        }

        .vo-peak-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-top: 18px;
          border-top: 1px solid #f1f5f9;
        }

        .vo-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #1e3a8a; /* Primary Navy Blue */
          flex-shrink: 0;
        }

        .vo-peak-label {
          font-size: 12px;
          color: #64748b;
        }

        .vo-peak-date {
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          color: #0f172a;
          font-weight: 500;
          margin-left: auto;
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
      `}</style>

      <div className="vo-root">
        {/* Header */}
        <div className="vo-header">
          <div>
            <h1 className="vo-title">Video Asset Overview</h1>
            <p className="vo-subtitle">Analyze a video's trajectory and viral risk profile.</p>
          </div>
        </div>

        {/* Input Row */}
        <div className="vo-input-row">
          <input
            type="text"
            className="vo-input"
            placeholder="Paste YouTube video URL…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setHasData(true)}
          />
          <button className="vo-btn" onClick={() => setHasData(true)}>
            Scan Asset →
          </button>
        </div>

        {hasData && (
          <>
            <div className="vo-divider" />

            {/* Stats Strip */}
            <div className="vo-stats vo-reveal vo-reveal-1">
              <div className="vo-stat">
                <div className="vo-label">Current Views</div>
                <div className="vo-stat-value">4,500,000</div>
              </div>
              <div className="vo-stat">
                <div className="vo-label">Publish Date</div>
                <div className="vo-stat-value">Apr 18, 2026</div>
              </div>
              <div className="vo-stat">
                <div className="vo-label">Primary Category</div>
                <div className="vo-stat-value">Science & Tech</div>
              </div>
            </div>

            {/* Cards */}
            <div className="vo-cards vo-reveal vo-reveal-2">
              {/* Trending Prediction */}
              <div className="vo-card">
                <p className="vo-card-title">Trending Prediction</p>
                <p className="vo-card-sub">Viral probability based on active link graph</p>
                <div className="vo-prob-row">
                  <span className="vo-prob-value">88%</span>
                  <span className="vo-pill">HIGH</span>
                </div>
                <div className="vo-track">
                  <div className="vo-fill" />
                </div>
              </div>

              {/* Viral Span Prediction */}
              <div className="vo-card vo-reveal vo-reveal-3">
                <p className="vo-card-title">Viral Span Prediction</p>
                <p className="vo-card-sub">Estimated days to reach viral peak</p>
                <div className="vo-days-number">14</div>
                <span className="vo-days-unit">days to peak velocity</span>
                <div className="vo-peak-row">
                  <div className="vo-dot" />
                  <span className="vo-peak-label">Expected peak date</span>
                  <span className="vo-peak-date">2026-05-02</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}