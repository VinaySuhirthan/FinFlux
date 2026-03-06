import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { analyticsApi } from '../services/api';

interface Summary {
  totalExpense: number;
  totalIncome: number;
  netFlow: number;
  transactionCount: number;
  uncategorizedCount: number;
}

interface CategoryBreakdown {
  category: { id: string; name: string; color?: string; icon?: string } | null;
  total: number;
  count: number;
}

interface MonthlyTrend {
  month: string;
  expense: number;
  income: number;
}

interface TopMerchant {
  name: string;
  total: number;
  count: number;
}

const fmt = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [breakdown, setBreakdown] = useState<CategoryBreakdown[]>([]);
  const [monthly, setMonthly] = useState<MonthlyTrend[]>([]);
  const [merchants, setMerchants] = useState<TopMerchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = async () => {
    setLoading(true);
    const params = {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    };
    try {
      const [s, b, m, t] = await Promise.all([
        analyticsApi.summary(params),
        analyticsApi.categoryBreakdown(params),
        analyticsApi.monthlyTrend(params),
        analyticsApi.topMerchants(params),
      ]);
      setSummary(s);
      setBreakdown(b.filter((r: CategoryBreakdown) => r.total > 0));
      setMonthly(m);
      setMerchants(t);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [dateFrom, dateTo]);

  const statCards = summary
    ? [
        { label: 'Total Income', value: fmt(summary.totalIncome), color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'Total Expense', value: fmt(summary.totalExpense), color: 'text-red-600', bg: 'bg-red-50' },
        { label: 'Net Flow', value: fmt(summary.netFlow), color: summary.netFlow >= 0 ? 'text-green-600' : 'text-red-600', bg: 'bg-gray-50' },
        { label: 'Transactions', value: summary.transactionCount.toString(), color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Uncategorized', value: summary.uncategorizedCount.toString(), color: 'text-orange-600', bg: 'bg-orange-50' },
      ]
    : [];

  if (loading && !summary) {
    return <div className="text-center py-12 text-gray-400">Loading dashboard...</div>;
  }

  if (!summary || summary.transactionCount === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-xl font-semibold text-gray-700">No data yet</h2>
        <p className="text-gray-400 mt-2">Upload a bank statement to see your spending analytics.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2 text-sm">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="From"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="To"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {statCards.map((c) => (
          <div key={c.label} className={`${c.bg} rounded-xl p-4`}>
            <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-600 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Category Pie */}
        {breakdown.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-base font-semibold mb-4">Spend by Category</h2>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={breakdown}
                  dataKey="total"
                  nameKey={(d: CategoryBreakdown) => d.category?.name || 'Unknown'}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {breakdown.map((entry, idx) => (
                    <Cell key={idx} fill={entry.category?.color || COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
              {breakdown.map((b, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: b.category?.color || COLORS[idx % COLORS.length] }}
                    />
                    <span className="text-gray-700">{b.category?.icon} {b.category?.name || 'Unknown'}</span>
                  </div>
                  <span className="text-gray-900 font-medium">{fmt(b.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monthly trend */}
        {monthly.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-base font-semibold mb-4">Monthly Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthly} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top merchants */}
      {merchants.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-base font-semibold mb-4">Top Merchants</h2>
          <div className="space-y-2">
            {merchants.map((m, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-6 text-xs text-gray-400 text-right shrink-0">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm text-gray-800 truncate">{m.name}</span>
                    <span className="text-sm font-medium text-gray-900 ml-2 shrink-0">{fmt(m.total)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full"
                      style={{ width: `${(m.total / merchants[0].total) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{m.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
