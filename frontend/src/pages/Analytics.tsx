import { useEffect, useState } from 'react';
import { analyticsApi } from '../services/api';
import FinancialChatbot from '../components/FinancialChatbot';
import botLogo from '../../image1.png';

interface StoredAnalytics {
  categories?: Record<string, number>;
  averageIncome?: number | string | null;
  amountSaved?: number | string | null;
  PredictedIncome?: number | string | null;
  predictedIncome?: number | string | null;
  IncomeVolatility?: number | string | null;
  incomeVolatility?: number | string | null;
  IncomeReliability?: number | string | null;
  incomeReliability?: number | string | null;
  Downside?: number | string | null;
  downside?: number | string | null;
}

const formatAmount = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function renderCategoryIcon(name: string) {
  const category = name.toLowerCase();

  if (category.includes('rent') || category.includes('housing') || category.includes('home')) {
    return (
      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </div>
    );
  }

  if (category.includes('health') || category.includes('medical') || category.includes('doctor')) {
    return (
      <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors duration-200">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
    );
  }

  if (category.includes('travel') || category.includes('flight') || category.includes('hotel') || category.includes('vacation')) {
    return (
      <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-colors duration-200">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
      </div>
    );
  }

  if (category.includes('shop') || category.includes('grocery') || category.includes('store') || category.includes('mart')) {
    return (
      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors duration-200">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      </div>
    );
  }

  if (category.includes('transfer') || category.includes('send') || category.includes('remit')) {
    return (
      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-200">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      </div>
    );
  }

  if (category.includes('transport') || category.includes('fuel') || category.includes('cab') || category.includes('auto') || category.includes('car')) {
    return (
      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      </div>
    );
  }

  if (category.includes('entertain') || category.includes('movie') || category.includes('stream') || category.includes('game')) {
    return (
      <div className="w-8 h-8 rounded-lg bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100 flex items-center justify-center shrink-0 group-hover:bg-fuchsia-600 group-hover:text-white transition-colors duration-200">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
          <line x1="7" y1="2" x2="7" y2="22" />
          <line x1="17" y1="2" x2="17" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
        </svg>
      </div>
    );
  }

  if (category.includes('fee') || category.includes('charge') || category.includes('card') || category.includes('tax')) {
    return (
      <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 border border-orange-100 flex items-center justify-center shrink-0 group-hover:bg-orange-600 group-hover:text-white transition-colors duration-200">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      </div>
    );
  }

  if (category.includes('bill') || category.includes('utilit') || category.includes('power') || category.includes('water') || category.includes('gas')) {
    return (
      <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0 group-hover:bg-teal-600 group-hover:text-white transition-colors duration-200">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0 group-hover:bg-slate-700 group-hover:text-white transition-colors duration-200">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
        <path d="M7 7h.01" />
      </svg>
    </div>
  );
}

export default function Analytics() {
  const [analytics, setAnalytics] = useState<StoredAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatMode, setChatMode] = useState<'compact' | 'popup' | 'bubble'>('compact');

  useEffect(() => {
    analyticsApi.stored()
      .then((data) => setAnalytics(data))
      .catch((err: any) => setError(err.response?.data?.message || 'Unable to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  const categories = Object.entries(analytics?.categories || {});
  const incomeVolatility = Number(analytics?.IncomeVolatility ?? analytics?.incomeVolatility ?? 0);
  const incomeReliability = Number(analytics?.IncomeReliability ?? analytics?.incomeReliability ?? 0);
  const downside = Number(analytics?.Downside ?? analytics?.downside ?? 0);
  const averageIncome = Number(analytics?.averageIncome ?? 0);
  const predictedIncome = Number(analytics?.PredictedIncome ?? analytics?.predictedIncome ?? 0);
  const amountSaved = Number(analytics?.amountSaved ?? predictedIncome - averageIncome);

  const renderPanels = () => {
    if (loading) {
      return (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium">Loading financial analytics…</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/70 backdrop-blur-md p-5 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      );
    }
    if (!analytics) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300/80 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
          No analytics data available yet.
        </div>
      );
    }

    return (
      <div className="analytics-panels-full space-y-5">
        {/* Next month spending prediction */}
        <section className="finflux-panel analytics-reveal rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-xl p-5 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05),0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100/90 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 flex items-center justify-center shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-3 3" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                  Next month spending prediction
                </h2>
                <p className="text-xs text-slate-500">Estimated average expenditure by category</p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-semibold text-slate-600 bg-slate-100/80 border border-slate-200/60 px-2.5 py-1 rounded-lg">
              {categories.length} categories
            </span>
          </div>
          {categories.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-slate-400">No category data available.</div>
          ) : (
            <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categories.map(([name, amount]) => (
                <div
                  key={name}
                  className="group flex min-h-[56px] items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/70 backdrop-blur-md px-3.5 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-md cursor-default"
                >
                  <div className="flex min-w-0 items-center gap-2.5 truncate">
                    {renderCategoryIcon(name)}
                    <span className="truncate text-xs font-semibold text-slate-800 tracking-tight" title={name}>
                      {name}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-slate-900 font-mono tracking-tight">
                    {formatAmount(Number(amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Bottom row metrics */}
        <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
          {/* Income factors */}
          <section className="finflux-panel analytics-reveal rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-xl p-5 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05),0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(15,23,42,0.08)]">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100/90 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/80 flex items-center justify-center shadow-sm">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m4.93 4.93 4.24 4.24" />
                    <path d="m14.83 9.17 4.24-4.24" />
                    <path d="m14.83 14.83 4.24 4.24" />
                    <path d="m9.17 14.83-4.24 4.24" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                    Income health indicators
                  </h2>
                  <p className="text-xs text-slate-500">Income stability and downside safety metrics</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100/80 border border-slate-200/60 px-2.5 py-1 rounded-lg">
                Percentage
              </span>
            </div>
            <div className="grid gap-3">
              <div className="analytics-metric flex items-center justify-between rounded-xl border border-indigo-100/80 bg-gradient-to-r from-indigo-50/70 via-white/80 to-indigo-50/40 backdrop-blur-md px-4 py-3 hover:border-indigo-300 hover:shadow-sm transition-all duration-200">
                <div>
                  <p className="text-sm font-semibold text-slate-800 tracking-tight">Volatility</p>
                  <p className="text-xs text-slate-500">Monthly variation coefficient</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="analytics-bars text-indigo-500" aria-hidden="true"><i /><i /><i /></span>
                  <p className="text-lg font-bold text-indigo-600 font-mono">{incomeVolatility.toFixed(2)}%</p>
                </div>
              </div>

              <div className="analytics-metric flex items-center justify-between rounded-xl border border-emerald-100/80 bg-gradient-to-r from-emerald-50/70 via-white/80 to-emerald-50/40 backdrop-blur-md px-4 py-3 hover:border-emerald-300 hover:shadow-sm transition-all duration-200">
                <div>
                  <p className="text-sm font-semibold text-slate-800 tracking-tight">Reliability</p>
                  <p className="text-xs text-slate-500">Consistency of earning stream</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="analytics-bars text-emerald-500" aria-hidden="true"><i /><i /><i /></span>
                  <p className="text-lg font-bold text-emerald-600 font-mono">{incomeReliability.toFixed(2)}%</p>
                </div>
              </div>

              <div className="analytics-metric flex items-center justify-between rounded-xl border border-rose-100/80 bg-gradient-to-r from-rose-50/70 via-white/80 to-rose-50/40 backdrop-blur-md px-4 py-3 hover:border-rose-300 hover:shadow-sm transition-all duration-200">
                <div>
                  <p className="text-sm font-semibold text-slate-800 tracking-tight">Downside risk</p>
                  <p className="text-xs text-slate-500">Probability of below-target income</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="analytics-bars text-rose-500" aria-hidden="true"><i /><i /><i /></span>
                  <p className="text-lg font-bold text-rose-600 font-mono">{downside.toFixed(2)}%</p>
                </div>
              </div>
            </div>
          </section>

          {/* Income outlook */}
          <section className="finflux-panel analytics-reveal rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-xl p-5 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05),0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(15,23,42,0.08)]">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100/90 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-100/80 flex items-center justify-center shadow-sm">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                    Income outlook & savings
                  </h2>
                  <p className="text-xs text-slate-500">Historical performance vs projected earnings</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100/80 border border-slate-200/60 px-2.5 py-1 rounded-lg">
                Amount
              </span>
            </div>
            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/70 backdrop-blur-md px-4 py-3 transition-all duration-200 hover:bg-white hover:border-slate-300">
                <div>
                  <span className="text-sm font-semibold text-slate-800 tracking-tight">Average income</span>
                  <p className="text-xs text-slate-400">Baseline historical average</p>
                </div>
                <span className="text-base font-bold text-slate-900 font-mono">{formatAmount(averageIncome)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-indigo-100/80 bg-gradient-to-r from-indigo-50/60 via-white/80 to-indigo-50/30 backdrop-blur-md px-4 py-3 transition-all duration-200 hover:border-indigo-300">
                <div>
                  <span className="text-sm font-semibold text-slate-800 tracking-tight">Predicted income</span>
                  <p className="text-xs text-indigo-500/80">Machine-learning forecast</p>
                </div>
                <span className="text-base font-bold text-indigo-600 font-mono">{formatAmount(predictedIncome)}</span>
              </div>

              <div className={`flex items-center justify-between rounded-xl border px-4 py-3 backdrop-blur-md transition-all duration-200 ${
                amountSaved >= 0
                  ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-50/70 via-white/80 to-emerald-50/30 hover:border-emerald-300'
                  : 'border-rose-200/80 bg-gradient-to-r from-rose-50/70 via-white/80 to-rose-50/30 hover:border-rose-300'
              }`}>
                <div>
                  <span className="text-sm font-semibold text-slate-800 tracking-tight">Projected net surplus</span>
                  <p className="text-xs text-slate-500">Savings potential for next period</p>
                </div>
                <span className={`text-base font-bold font-mono ${amountSaved >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatAmount(amountSaved)}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  };

  return (
    <div className="analytics-page-root relative min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="mb-5 analytics-reveal">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-500">Stored insights</p>
        <h1 className="text-2xl font-bold text-gray-900">
          Analytics
        </h1>
        <p className="mt-1 text-sm text-gray-500">Your predicted income, category overview & AI financial analyst.</p>
      </div>

      {/* Main Content Area — Always Full Width Dashboard */}
      <div className="analytics-layout-full">
        {renderPanels()}
      </div>

      {/* Bottom-Right Compact Mini-Bar Mode (Default) */}
      {chatMode === 'compact' && (
        <FinancialChatbot mode={chatMode} onModeChange={setChatMode} />
      )}

      {/* Bottom-Right Floating Full Popup Mode */}
      {chatMode === 'popup' && (
        <FinancialChatbot mode={chatMode} onModeChange={setChatMode} />
      )}

      {/* Bottom-Right Minimized Floating Avatar Bubble Mode */}
      {chatMode === 'bubble' && (
        <button
          type="button"
          onClick={() => setChatMode('compact')}
          className="chatbot-float-robot-bubble"
          title="Open FinFlux AI Financial Analyst"
          aria-label="Open FinFlux AI Financial Analyst"
        >
          <img src={botLogo} alt="FinFlux AI" className="w-full h-full object-cover rounded-full" />
          <span className="chatbot-robot-pulse-ring" />
          <span className="chatbot-robot-online-dot" />
        </button>
      )}
    </div>
  );
}