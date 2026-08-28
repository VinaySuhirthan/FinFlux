import { useEffect, useRef, useState } from 'react';
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

const fmt = (n: number) => {
  const isNegative = n < 0;
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return isNegative ? `₹-${formatted}` : `₹${formatted}`;
};

const shortDate = (date: string) => {
  const parts = date.split('-');
  if (parts.length >= 3) {
    const [, month, day] = parts;
    return `${day}/${month}`;
  }
  return date;
};

// Colors matching the screenshot donut chart
const DONUT_COLORS = [
  '#334155', // Dark slate/navy (dominant category)
  '#f59e0b', // Amber/Orange
  '#3b82f6', // Blue
  '#0d9488', // Teal
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#64748b', // Slate
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
  const props = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (type === 'income') return (
    <svg {...props}>
      <path d="M12 15V3m0 0l-4 4m4-4l4 4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
  if (type === 'expense') return (
    <svg {...props}>
      <path d="M12 9v12m0 0l4-4m-4 4l-4-4" />
      <path d="M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
    </svg>
  );
  if (type === 'flow') return (
    <svg {...props}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  );
  if (type === 'transactions') return (
    <svg {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="7" x2="12" y2="12" />
    </svg>
  );
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
  const requestId = useRef(0);

  const load = async () => {
    const currentRequest = ++requestId.current;
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setSummary(null);
      setBreakdown([]);
      setMonthly([]);
      setMerchants([]);
      setDailySpend([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo ? `${dateTo}T23:59:59.999Z` : undefined,
    };
    try {
      const [s, b, m, t, d] = await Promise.all([
        analyticsApi.summary(params),
        analyticsApi.categoryBreakdown(params),
        analyticsApi.monthlyTrend(params),
        analyticsApi.topMerchants(params),
        loadDailySpend(params),
      ]);
      if (currentRequest !== requestId.current) return;
      setSummary(s);
      setBreakdown(b.filter((r: CategoryBreakdown) => r.total > 0));
      setMonthly(m);
      setMerchants(t);
      setDailySpend(d);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  };

  useEffect(() => { load(); }, [dateFrom, dateTo]);

  const statCards = summary
    ? [
        {
          label: 'Total Income',
          value: fmt(summary.totalIncome),
          textColor: 'text-[#0ea57a]',
          iconBoxStyle: 'border-[#a7f3d0] bg-[#ecfdf5] text-[#059669]',
          icon: 'income',
        },
        {
          label: 'Total Expense',
          value: fmt(summary.totalExpense),
          textColor: 'text-[#e11d48]',
          iconBoxStyle: 'border-[#fecdd3] bg-[#fff1f2] text-[#e11d48]',
          icon: 'expense',
        },
        {
          label: 'Net Flow',
          value: fmt(summary.netFlow),
          textColor: summary.netFlow >= 0 ? 'text-[#0ea57a]' : 'text-[#e11d48]',
          iconBoxStyle: summary.netFlow >= 0
            ? 'border-[#a7f3d0] bg-[#ecfdf5] text-[#059669]'
            : 'border-[#fecdd3] bg-[#fff1f2] text-[#e11d48]',
          icon: 'flow',
        },
        {
          label: 'Transactions',
          value: summary.transactionCount.toString(),
          textColor: 'text-[#0d9488]',
          iconBoxStyle: 'border-[#99f6e4] bg-[#f0fdfa] text-[#0d9488]',
          icon: 'transactions',
        },
        {
          label: 'Uncategorized',
          value: summary.uncategorizedCount.toString(),
          textColor: 'text-[#c2410c]',
          iconBoxStyle: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]',
          icon: 'warning',
        },
      ]
    : [];

  const totalSpend = breakdown.reduce((total, entry) => total + entry.total, 0);
  const topCategories = breakdown.slice(0, 5);
  const remainingCategoriesCount = breakdown.length - topCategories.length;

  if (loading) {
    return <div className="text-center py-12 text-[#94a3b8]">Loading dashboard...</div>;
  }

  if (!summary || summary.transactionCount === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-xl font-semibold text-[#334155]">No data yet</h2>
        <p className="text-[#94a3b8] mt-2">Upload a bank statement to see your spending analytics.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#4f6bf5] mb-1">
            FINANCIAL COMMAND CENTRE
          </p>
          <h1 className="text-2xl font-bold text-[#182231] tracking-tight">Dashboard</h1>
          <p className="text-xs text-[#7d8c9e] mt-1">A clear view of your cash flow, spending, and activity.</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-white border border-[#e2e8f0] rounded-lg px-3 py-1.5 text-xs text-[#334155] focus:outline-none focus:border-[#4f6bf5] shadow-none"
            placeholder="dd-mm-yyyy"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-white border border-[#e2e8f0] rounded-lg px-3 py-1.5 text-xs text-[#334155] focus:outline-none focus:border-[#4f6bf5] shadow-none"
            placeholder="dd-mm-yyyy"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-[#86a39a] hover:text-[#182231] ml-1 font-medium transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {dateFrom && dateTo && dateFrom > dateTo && (
        <p className="text-sm text-red-600 mb-4">The start date must be before the end date.</p>
      )}

      {/* KPI Cards (5 cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
        {statCards.map((c) => (
          <div
            key={c.label}
            className="finflux-kpi bg-white rounded-2xl p-4 border border-[#e8eff5] shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative overflow-hidden flex flex-col justify-between min-h-[92px]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`text-xl font-bold tracking-tight ${c.textColor}`}>
                {c.value}
              </div>
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${c.iconBoxStyle}`}>
                <MetricIcon type={c.icon} />
              </div>
            </div>
            <div className="text-xs text-[#7d8c9e] font-medium mt-2">
              {c.label}
            </div>
          </div>
        ))}
      </div>

      {/* Middle Row (Spend by Category & Monthly Trend) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5">
        {/* Spend by Category Card (5 cols on lg) */}
        <div className="lg:col-span-5 finflux-panel bg-white border border-[#e8eff5] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-[#182231]">Spend by Category</h2>
            <span className="text-[10px] font-bold tracking-widest text-[#5d87a8] uppercase">BREAKDOWN</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center flex-1">
            {/* Donut Chart */}
            <div className="sm:col-span-6 relative flex items-center justify-center h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdown}
                    dataKey="total"
                    nameKey={(d: CategoryBreakdown) => d.category?.name || 'Unknown'}
                    cx="50%"
                    cy="50%"
                    innerRadius="64%"
                    outerRadius="86%"
                    paddingAngle={2}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {breakdown.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.category?.color || DONUT_COLORS[idx % DONUT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#ffffff', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center donut label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[9px] font-bold tracking-wider text-[#94a3b8] uppercase">TOTAL SPEND</span>
                <span className="text-base font-bold text-[#182231] leading-tight my-0.5">{fmt(totalSpend)}</span>
                <span className="text-[10px] text-[#94a3b8]">{breakdown.length} categories</span>
              </div>
            </div>

            {/* Category List */}
            <div className="sm:col-span-6 flex flex-col justify-center">
              <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-[#94a3b8] uppercase pb-2 border-b border-[#f1f5f9]">
                <span>TOP CATEGORIES</span>
                <span>SPEND</span>
              </div>
              <div className="divide-y divide-[#f8fafc]">
                {topCategories.map((b, idx) => {
                  const color = b.category?.color || DONUT_COLORS[idx % DONUT_COLORS.length];
                  const percentage = totalSpend ? ((b.total / totalSpend) * 100).toFixed(0) : '0';
                  return (
                    <div key={idx} className="py-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                        <span className="text-xs font-semibold text-[#334155] truncate">
                          {b.category?.icon ? `${b.category.icon} ` : ''}{b.category?.name || 'Unknown'}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-[#182231]">{fmt(b.total)}</div>
                        <div className="text-[10px] text-[#94a3b8] leading-none">{percentage}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {remainingCategoriesCount > 0 && (
                <p className="text-[10px] text-[#94a3b8] pt-2 text-left font-medium">
                  +{remainingCategoriesCount} smaller categories
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Monthly Trend Card (7 cols on lg) */}
        <div className="lg:col-span-7 finflux-panel bg-white border border-[#e8eff5] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="text-base font-bold text-[#182231]">Monthly Trend</h2>
              <p className="text-xs text-[#94a3b8] mt-0.5">Income compared with expenses</p>
            </div>
            <span className="text-[10px] font-bold tracking-widest text-[#5d87a8] uppercase">MONTHLY</span>
          </div>

          <div className="h-[230px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthly}
                margin={{ top: 15, right: 10, left: -20, bottom: 0 }}
                barGap={4}
                barCategoryGap="28%"
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  dy={6}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }}
                  formatter={(v: number) => fmt(v)}
                  contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#ffffff', fontSize: 12 }}
                />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ paddingTop: 10, fontSize: 11, color: '#64748b' }}
                />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row (Daily Spend & Top Merchants) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Daily Spend Card (7 cols on lg) */}
        <div className="lg:col-span-7 finflux-panel bg-white border border-[#e8eff5] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="text-base font-bold text-[#182231]">Daily Spend</h2>
              <p className="text-xs text-[#94a3b8] mt-0.5">Your spending pattern over time</p>
            </div>
            <span className="text-[10px] font-bold tracking-widest text-[#5d87a8] uppercase">
              {dailySpend.length} DAYS
            </span>
          </div>

          <div className="h-[220px] w-full mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySpend} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dailySpendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  dy={6}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  labelFormatter={(label) => `Date: ${label}`}
                  formatter={(v: number) => fmt(v)}
                  contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#ffffff', fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="Spend"
                  stroke="#5d5fef"
                  strokeWidth={2}
                  fill="url(#dailySpendGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#5d5fef', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Merchants Card (5 cols on lg) */}
        <div className="lg:col-span-5 finflux-panel bg-white border border-[#e8eff5] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="text-base font-bold text-[#182231]">Top Merchants</h2>
              <p className="text-xs text-[#94a3b8] mt-0.5">Where your spending is concentrated</p>
            </div>
            <span className="text-[10px] font-bold tracking-widest text-[#5d87a8] uppercase">RANKED BY SPEND</span>
          </div>

          <div className="space-y-3.5 max-h-[225px] overflow-y-auto pr-1 mt-3">
            {merchants.map((m, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-semibold text-[#64748b] flex items-center justify-center shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold text-[#334155] uppercase truncate" title={m.name}>
                      {m.name.replace(/^UPI-/i, '')}
                    </span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs font-bold text-[#182231]">{fmt(m.total)}</span>
                      <span className="text-[10px] text-[#94a3b8] w-6 text-right">{m.count}x</span>
                    </div>
                  </div>
                  <div className="w-full bg-[#f1f5f9] rounded-full h-1 mt-1 overflow-hidden">
                    <div
                      className="bg-[#14b8a6] h-full rounded-full"
                      style={{ width: `${merchants[0]?.total ? (m.total / merchants[0].total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}