import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'YouRisk | Media Valuation',
  description: 'The enterprise standard for digital media asset valuation.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const navItems = [
    { id: '/video_overview', label: 'Video Overview' },
    { id: '/channel_analysis', label: 'Channel Analysis' },
    { id: '/portfolio_recommendation', label: 'Portfolio Recommendation' },
  ];

  return (
    <html lang="en">
      <body
        className="min-h-screen font-sans flex text-slate-900"
        style={{ background: 'linear-gradient(145deg, #fdfbf7 0%, #f0ede6 40%, #e2e8f0 100%)' }}
      >
        {/* Soft orb decorations */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '420px', height: '420px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, transparent 70%)' }} />
          <div style={{ position: 'absolute', bottom: '5%', right: '-8%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(217, 204, 185, 0.3) 0%, transparent 70%)' }} />
        </div>

        {/* STATIC SIDEBAR (No active highlight) */}
        <aside className="w-64 min-h-screen flex flex-col p-6 shrink-0 relative shadow-sm" style={{ zIndex: 1, background: 'rgba(255,255,255,0.65)', borderRight: '1px solid rgba(148, 163, 184, 0.25)', backdropFilter: 'blur(16px)' }}>
          <div className="mb-10">
            <div className="text-2xl font-black tracking-tight" style={{ color: '#1e3a8a' }}>YouRisk</div>
            <div className="text-xs font-bold tracking-[0.2em] uppercase mt-1" style={{ color: '#475569' }}>Media Valuation</div>
          </div>

          <nav className="flex flex-col gap-2">
            {navItems.map(({ id, label }) => (
              <Link
                key={id}
                href={id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-white/50 text-slate-700 hover:text-blue-600"
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 p-10 overflow-y-auto relative" style={{ zIndex: 1 }}>
          <div className="max-w-4xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}