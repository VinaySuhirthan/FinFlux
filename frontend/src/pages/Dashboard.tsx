import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { analyticsApi, transactionsApi } from '../services/api';

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

interface DailySpend {
  date: string;
  expense: number;
  income: number;
}

const fmt = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const shortDate = (date: string) => {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
};

const COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

async function loadDailySpend(params: { dateFrom?: string; dateTo?: string }) {
  const firstPage = await transactionsApi.listAll({ ...params, page: 1, limit: 50 });
  const transactions = [...firstPage.transactions];

  if (firstPage.totalPages > 1) {
    const remainingPages = await Promise.all(
      Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
        transactionsApi.listAll({ ...params, page: index + 2, limit: 50 }),
      ),
    );
    remainingPages.forEach((page) => transactions.push(...page.transactions));
  }

  const dailyMap = new Map<string, DailySpend>();
  transactions.forEach((transaction) => {
    const date = transaction.txnDate.slice(0, 10);
    const entry = dailyMap.get(date) || { date, expense: 0, income: 0 };
    if (transaction.direction === 'DEBIT') {
      entry.expense += Number(transaction.debitAmount || 0);
    } else {
      entry.income += Number(transaction.creditAmount || 0);
    }
    dailyMap.set(date, entry);
  });

  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function MetricIcon({ type }: { type: string }) {
  const props = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (type === 'income') return <svg {...props}><path d="M12 19V5M7 10l5-5 5 5" /><path d="M4 21h16" /></svg>;
  if (type === 'expense') return <svg {...props}><path d="M12 5v14M7 14l5 5 5-5" /><path d="M4 3h16" /></svg>;
  if (type === 'flow') return <svg {...props}><path d="M5 16 9 12l3 3 7-8" /><path d="M15 7h4v4" /></svg>;
  if (type === 'transactions') return <svg {...props}><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h4" /></svg>;
  return <svg {...props}><path d="M12 4v9M12 17.5v.5" /><circle cx="12" cy="12" r="9" /></svg>;
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [breakdown, setBreakdown] = useState<CategoryBreakdown[]>([]);
  const [monthly, setMonthly] = useState<MonthlyTrend[]>([]);
  const [merchants, setMerchants] = useState<TopMerchant[]>([]);
  const [dailySpend, setDailySpend] = useState<DailySpend[]>([]);
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
      const [s, b, m, t, d] = await Promise.all([
        analyticsApi.summary(params),
        analyticsApi.categoryBreakdown(params),
        analyticsApi.monthlyTrend(params),
        analyticsApi.topMerchants(params),
        loadDailySpend(params),
      ]);
      setSummary(s);
      setBreakdown(b.filter((r: CategoryBreakdown) => r.total > 0));
      setMonthly(m);
      setMerchants(t);
      setDailySpend(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [dateFrom, dateTo]);

  const statCards = summary
    ? [
        { label: 'Total Income', value: fmt(summary.totalIncome), color: 'text-green-600', bg: 'bg-green-50', icon: 'income' },
        { label: 'Total Expense', value: fmt(summary.totalExpense), color: 'text-red-600', bg: 'bg-red-50', icon: 'expense' },
        { label: 'Net Flow', value: fmt(summary.netFlow), color: summary.netFlow >= 0 ? 'text-green-600' : 'text-red-600', bg: 'bg-gray-50', icon: 'flow' },
        { label: 'Transactions', value: summary.transactionCount.toString(), color: 'text-indigo-600', bg: 'bg-indigo-50', icon: 'transactions' },
        { label: 'Uncategorized', value: summary.uncategorizedCount.toString(), color: 'text-orange-600', bg: 'bg-orange-50', icon: 'warning' },
      ]
    : [];
  const totalSpend = breakdown.reduce((total, entry) => total + entry.total, 0);

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
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-400 mb-1">Overview</p>
          <h1 className="text-2xl font-bold">Dashboard</h1>
        </div>
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
          <div key={c.label} className={`finflux-kpi metric-${c.icon} ${c.bg} rounded-xl p-4 border border-gray-200`}>
            <div className={`metric-icon ${c.color}`}><MetricIcon type={c.icon} /></div>
            <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-600 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Category Pie */}
        {breakdown.length > 0 && (
          <div className="finflux-panel bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold">Spend by Category</h2>
              <span className="text-[10px] uppercase tracking-widest text-gray-400">Breakdown</span>
            </div>
            <ResponsiveContainer width="100%" height={290}>
              <PieChart>
                <Pie
                  data={breakdown}
                  dataKey="total"
                  nameKey={(d: CategoryBreakdown) => d.category?.name || 'Unknown'}
                  cx="50%"
                  cy="50%"
                  outerRadius="74%"
                  innerRadius="55%"
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={2}
                  label={false}
                >
                  {breakdown.map((entry, idx) => (
                    <Cell key={idx} fill={entry.category?.color || COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="donut-total-label">
                  {fmt(totalSpend)}
                </text>
                <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" className="donut-caption">
                  total spend
                </text>
                <Tooltip
                  formatter={(v: number) => fmt(v)}
                  contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 10, background: 'rgba(255,255,255,0.96)', boxShadow: '0 10px 24px rgba(37,50,72,0.1)' }}
                  labelStyle={{ color: '#182231', fontWeight: 600 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="category-legend mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {breakdown.map((b, idx) => (
                <div key={idx} className="category-legend-row text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: b.category?.color || COLORS[idx % COLORS.length] }}
                      />
                      <span className="text-gray-700 truncate">{b.category?.icon} {b.category?.name || 'Unknown'}</span>
                    </div>
                    <span className="text-gray-900 font-medium shrink-0">{fmt(b.total)}</span>
                  </div>
                  <div className="category-legend-meta">
                    <div className="category-legend-track">
                      <div
                        className="category-legend-fill"
                        style={{ width: `${totalSpend ? (b.total / totalSpend) * 100 : 0}%`, background: b.category?.color || COLORS[idx % COLORS.length] }}
                      />
                    </div>
                    <span>{totalSpend ? ((b.total / totalSpend) * 100).toFixed(0) : 0}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monthly trend */}
        {monthly.length > 0 && (
          <div className="finflux-panel bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-end justify-between mb-1">
              <div>
                <h2 className="text-base font-semibold">Monthly Trend</h2>
                <p className="text-xs text-gray-400 mt-1">Income compared with expenses</p>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-gray-400">Monthly</span>
            </div>
            <ResponsiveContainer width="100%" height={310}>
              <BarChart data={monthly} margin={{ top: 18, right: 4, left: -10, bottom: 4 }} barGap={8} barCategoryGap="24%">
                <CartesianGrid vertical={false} strokeDasharray="3 5" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} dy={8} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} width={38} />
                <Tooltip
                  cursor={{ fill: 'rgba(98, 105, 217, 0.05)' }}
                  formatter={(v: number) => fmt(v)}
                  contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 10, background: 'rgba(255,255,255,0.96)', boxShadow: '0 10px 24px rgba(37,50,72,0.1)' }}
                  labelStyle={{ color: '#182231', fontWeight: 600, marginBottom: 4 }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />
                <Bar dataKey="income" name="Income" fill="#2dbd7d" radius={[6, 6, 2, 2]} maxBarSize={34} />
                <Bar dataKey="expense" name="Expense" fill="#e96a73" radius={[6, 6, 2, 2]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {dailySpend.length > 0 && (
        <div className="finflux-panel daily-spend-panel bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <div className="flex items-end justify-between mb-1">
            <div>
              <h2 className="text-base font-semibold">Daily Spend</h2>
              <p className="text-xs text-gray-400 mt-1">Your spending pattern over time</p>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-gray-400">{dailySpend.length} days</span>
          </div>
          <ResponsiveContainer width="100%" height={270}>
            <AreaChart data={dailySpend} margin={{ top: 20, right: 6, left: -10, bottom: 4 }}>
              <defs>
                <linearGradient id="dailySpendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6269d9" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#6269d9" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 5" />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} dy={8} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} width={38} />
              <Tooltip
                labelFormatter={(label) => `Date: ${label}`}
                formatter={(v: number) => fmt(v)}
                contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 10, background: 'rgba(255,255,255,0.96)', boxShadow: 'none' }}
                labelStyle={{ color: '#182231', fontWeight: 600, marginBottom: 4 }}
              />
              <Area type="monotone" dataKey="expense" name="Spend" stroke="#6269d9" strokeWidth={2.5} fill="url(#dailySpendFill)" dot={false} activeDot={{ r: 5, fill: '#6269d9', stroke: '#fff', strokeWidth: 2 }} animationDuration={900} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top merchants */}
      {merchants.length > 0 && (
        <div className="finflux-panel top-merchants-panel bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold">Top Merchants</h2>
              <p className="text-xs text-gray-400 mt-1">Where your spending is concentrated</p>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-gray-400">Ranked by spend</span>
          </div>
          <div className="space-y-4">
            {merchants.map((m, idx) => (
              <div key={idx} className="merchant-row flex items-center gap-3">
                <div className="merchant-rank w-6 h-6 text-xs text-gray-500 shrink-0">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="merchant-name text-sm text-gray-800 truncate" title={m.name}>{m.name.replace(/^UPI-/i, '')}</span>
                    <span className="text-sm font-medium text-gray-900 ml-2 shrink-0">{fmt(m.total)}</span>
                  </div>
                  <div className="merchant-track w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="merchant-fill bg-indigo-500 h-1.5 rounded-full"
                      style={{ width: `${(m.total / merchants[0].total) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="merchant-count text-[11px] text-gray-400 shrink-0">{m.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
