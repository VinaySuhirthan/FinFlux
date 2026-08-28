import { useEffect, useState } from 'react';
import { analyticsApi } from '../services/api';

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

export default function Analytics() {
  const [analytics, setAnalytics] = useState<StoredAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    analyticsApi.stored()
      .then((data) => setAnalytics(data))
      .catch((err: any) => setError(err.response?.data?.message || 'Unable to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-gray-400">Loading analytics...</div>;
  }

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  const categories = Object.entries(analytics?.categories || {});
  const incomeVolatility = Number(analytics?.IncomeVolatility ?? analytics?.incomeVolatility ?? 0);
  const incomeReliability = Number(analytics?.IncomeReliability ?? analytics?.incomeReliability ?? 0);
  const downside = Number(analytics?.Downside ?? analytics?.downside ?? 0);
  const averageIncome = Number(analytics?.averageIncome ?? 0);
  const predictedIncome = Number(analytics?.PredictedIncome ?? analytics?.predictedIncome ?? 0);
  const amountSaved = Number(analytics?.amountSaved ?? predictedIncome - averageIncome);

  return (
    <div>
      <div className="mb-6">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-400">Stored insights</p>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Your predicted income and category overview.</p>
      </div>

      {!analytics ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
          No analytics data available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="finflux-panel w-full max-w-[380px] rounded-xl border border-gray-200 bg-white p-5 aspect-square">
            <div className="mb-4 flex items-end justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-base font-semibold">Monthly spending</h2>
                <p className="mt-1 text-xs text-gray-400">Average spend by category</p>
              </div>
              <span className="text-xs font-medium text-gray-400">{categories.length} categories</span>
            </div>
            {categories.length === 0 ? (
              <div className="flex h-[calc(100%-88px)] items-center justify-center text-sm text-gray-400">No category data available.</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {categories.map(([name, amount]) => (
                  <div key={name} className="flex min-h-[58px] flex-col justify-between rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                    <p className="truncate text-xs font-semibold text-gray-700" title={name}>{name}</p>
                    <p className="mt-1 text-base font-bold text-gray-900">{formatAmount(Number(amount))}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="finflux-panel w-full max-w-[380px] rounded-xl border border-gray-200 bg-white p-5 aspect-square">
            <div className="mb-4 flex items-end justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-base font-semibold">Income factors</h2>
                <p className="mt-1 text-xs text-gray-400">Your income health indicators</p>
              </div>
              <span className="text-xs font-medium text-gray-400">Percentage</span>
            </div>
            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Volatility</p>
                  <p className="mt-0.5 text-xs text-gray-500">Monthly variation</p>
                </div>
                <p className="text-2xl font-bold text-indigo-600">{incomeVolatility.toFixed(2)}%</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-green-100 bg-green-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Reliability</p>
                  <p className="mt-0.5 text-xs text-gray-500">Consistency of income</p>
                </div>
                <p className="text-2xl font-bold text-green-600">{incomeReliability.toFixed(2)}%</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Downside risk</p>
                  <p className="mt-0.5 text-xs text-gray-500">Below-normal income risk</p>
                </div>
                <p className="text-2xl font-bold text-red-600">{downside.toFixed(2)}%</p>
              </div>
            </div>
          </section>
          <section className="finflux-panel w-full max-w-[380px] rounded-xl border border-gray-200 bg-white p-5 aspect-square">
            <div className="mb-4 flex items-end justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-base font-semibold">Income outlook</h2>
                <p className="mt-1 text-xs text-gray-400">Historical and predicted comparison</p>
              </div>
              <span className="text-xs font-medium text-gray-400">Amount</span>
            </div>
            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <span className="text-sm font-semibold text-gray-700">Average income</span>
                <span className="text-lg font-bold text-gray-900">{formatAmount(averageIncome)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3">
                <span className="text-sm font-semibold text-gray-700">Predicted income</span>
                <span className="text-lg font-bold text-indigo-600">{formatAmount(predictedIncome)}</span>
              </div>
              <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${amountSaved >= 0 ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'}`}>
                <span className="text-sm font-semibold text-gray-700">Amount saved</span>
                <span className={`text-lg font-bold ${amountSaved >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatAmount(amountSaved)}</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}