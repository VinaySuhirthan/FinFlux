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

interface UserSettings {
  currency: string;
  monthlyBudget: number;
  defaultTimeframe: '1M' | '6M' | '1Y' | 'All';
  highlightLargeExpenses: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  currency: '₹',
  monthlyBudget: 0,
  defaultTimeframe: 'All',
  highlightLargeExpenses: true,
};

const shortDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    }
  }
  return dateStr;
};

// Colors matching donut chart
const DONUT_COLORS = [
  '#334155', // Dark slate/navy
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

function getTimeframeParams(timeframe: '1M' | '6M' | '1Y' | 'All', globalFrom?: string, globalTo?: string) {
  if (timeframe === 'All') {
    return {
      dateFrom: globalFrom || undefined,
      dateTo: globalTo ? `${globalTo}T23:59:59.999Z` : undefined,
    };
  }
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const endStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59:59.999Z`;

  let start: Date;
  if (timeframe === '1M') {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (timeframe === '6M') {
    start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  } else {
    // 1Y
    start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }
  const startStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  return { dateFrom: startStr, dateTo: endStr };
}

async function loadDailySpend(params: { dateFrom?: string; dateTo?: string }) {
  try {
    const firstPage = await transactionsApi.listAll({ ...params, page: 1, limit: 50 });
    const transactions = [...(firstPage?.transactions || [])];

    if (firstPage?.totalPages > 1) {
      const remainingPages = await Promise.all(
        Array.from({ length: Math.min(firstPage.totalPages - 1, 10) }, (_, index) =>
          transactionsApi.listAll({ ...params, page: index + 2, limit: 50 }),
        ),
      );
      remainingPages.forEach((page) => {
        if (page?.transactions) transactions.push(...page.transactions);
      });
    }

    const dailyMap = new Map<string, DailySpend>();
    transactions.forEach((transaction) => {
      if (!transaction?.txnDate) return;
      const d = new Date(transaction.txnDate);
      const date = isNaN(d.getTime())
        ? String(transaction.txnDate).slice(0, 10)
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const entry = dailyMap.get(date) || { date, expense: 0, income: 0 };
      if (transaction.direction === 'DEBIT') {
        entry.expense += Number(transaction.debitAmount || 0);
      } else {
        entry.income += Number(transaction.creditAmount || 0);
      }
      dailyMap.set(date, entry);
    });

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

function MetricIcon({ type, size = 18 }: { type: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (type === 'income') return (
    <svg {...p}>
      <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
      <path d="M5 20h14" strokeWidth={1.4} strokeOpacity={0.5}/>
    </svg>
  );
  if (type === 'expense') return (
    <svg {...p}>
      <path d="M12 5v14" /><path d="m19 12-7 7-7-7" />
      <path d="M5 4h14" strokeWidth={1.4} strokeOpacity={0.5}/>
    </svg>
  );
  if (type === 'flow') return (
    <svg {...p}>
      <path d="M2 16s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M2 21h20" strokeWidth={1.4} strokeOpacity={0.5}/>
    </svg>
  );
  if (type === 'transactions') return (
    <svg {...p}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M7 15h.01" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M11 15h6" strokeWidth={1.4} />
    </svg>
  );
  // warning / uncategorized
  return (
    <svg {...p}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" /><path d="M12 17h.01" strokeWidth={2.5} />
    </svg>
  );
}
function TimeframeSelector({
  value,
  onChange,
  onCustomDate,
  customRange,
}: {
  value: '1M' | '6M' | '1Y' | 'All' | 'Custom';
  onChange: (v: '1M' | '6M' | '1Y' | 'All') => void;
  onCustomDate: (from: string, to: string) => void;
  customRange?: { from: string; to: string };
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(customRange?.from || '');
  const [tempTo, setTempTo] = useState(customRange?.to || '');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleApply = () => {
    onCustomDate(tempFrom, tempTo);
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempFrom('');
    setTempTo('');
    onChange('All');
    setIsOpen(false);
  };

  return (
    <div className="relative flex items-center gap-0" style={{ userSelect: 'none' }}>
      {/* Segmented pill group */}
      <div
        className="flex items-center rounded-lg overflow-hidden"
        style={{
          background: 'rgba(15,23,42,0.06)',
          border: '1px solid rgba(15,23,42,0.09)',
          padding: '2px',
          gap: '1px',
        }}
      >
        {(['1M', '6M', '1Y', 'All'] as const).map((t) => {
          const isActive = value === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => { setIsOpen(false); onChange(t); }}
              style={{
                padding: '3px 9px',
                fontSize: '10px',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.04em',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 180ms cubic-bezier(0.4,0,0.2,1)',
                background: isActive
                  ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)'
                  : 'transparent',
                color: isActive ? '#fff' : '#64748b',
                boxShadow: isActive ? '0 1px 6px rgba(79,70,229,0.28)' : 'none',
                transform: isActive ? 'scale(1)' : 'scale(0.97)',
              }}
            >
              {t}
            </button>
          );
        })}

        {/* Divider */}
        <div style={{ width: '1px', height: '14px', background: 'rgba(15,23,42,0.1)', margin: '0 2px', flexShrink: 0 }} />

        {/* Calendar / custom range icon button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Custom date range"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 180ms ease',
            background: value === 'Custom' || isOpen
              ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)'
              : 'transparent',
            color: value === 'Custom' || isOpen ? '#fff' : '#94a3b8',
            boxShadow: value === 'Custom' || isOpen ? '0 1px 6px rgba(79,70,229,0.28)' : 'none',
          }}
        >
          {/* Calendar icon */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </button>
      </div>

      {/* Premium popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            zIndex: 50,
            width: '232px',
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: '14px',
            boxShadow: '0 8px 32px rgba(15,23,42,0.12), 0 2px 8px rgba(79,70,229,0.08)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', letterSpacing: '0.02em' }}>Custom Range</span>
            {(tempFrom || tempTo) && (
              <button
                type="button"
                onClick={handleClear}
                style={{ fontSize: '10px', fontWeight: 600, color: '#f43f5e', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}
              >
                Reset
              </button>
            )}
          </div>

          {/* From */}
          <div>
            <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>From</label>
            <input
              type="date"
              value={tempFrom}
              onChange={(e) => setTempFrom(e.target.value)}
              style={{
                width: '100%',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '11px',
                color: '#1e293b',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* To */}
          <div>
            <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>To</label>
            <input
              type="date"
              value={tempTo}
              onChange={(e) => setTempTo(e.target.value)}
              style={{
                width: '100%',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '11px',
                color: '#1e293b',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Apply */}
          <button
            type="button"
            onClick={handleApply}
            disabled={!tempFrom && !tempTo}
            style={{
              width: '100%',
              padding: '7px',
              background: (!tempFrom && !tempTo) ? '#e2e8f0' : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              color: (!tempFrom && !tempTo) ? '#94a3b8' : '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: (!tempFrom && !tempTo) ? 'not-allowed' : 'pointer',
              transition: 'all 180ms ease',
              boxShadow: (!tempFrom && !tempTo) ? 'none' : '0 2px 8px rgba(79,70,229,0.3)',
              letterSpacing: '0.02em',
              fontFamily: 'inherit',
            }}
          >
            Apply Range
          </button>
        </div>
      )}
    </div>
  );
}

function CustomDatePopover({
  dateFrom,
  dateTo,
  activePreset,
  onApply,
  onClear,
}: {
  dateFrom: string;
  dateTo: string;
  activePreset: string;
  onApply: (from: string, to: string) => void;
  onClear: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(dateFrom);
  const [tempTo, setTempTo] = useState(dateTo);
  const ref = useRef<HTMLDivElement>(null);

  // Sync temp state when external values change (e.g. preset clears them)
  useEffect(() => { setTempFrom(dateFrom); }, [dateFrom]);
  useEffect(() => { setTempTo(dateTo); }, [dateTo]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const hasCustom = activePreset === 'custom' && (dateFrom || dateTo);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Set custom date range"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          border: `1px solid ${hasCustom || isOpen ? 'rgba(99,102,241,0.4)' : '#e2e8f0'}`,
          background: hasCustom || isOpen
            ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)'
            : '#ffffff',
          color: hasCustom || isOpen ? '#fff' : '#94a3b8',
          cursor: 'pointer',
          boxShadow: hasCustom || isOpen ? '0 2px 8px rgba(79,70,229,0.25)' : '0 1px 3px rgba(0,0,0,0.06)',
          transition: 'all 180ms ease',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            zIndex: 50,
            width: '236px',
            background: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: '14px',
            boxShadow: '0 8px 32px rgba(15,23,42,0.12), 0 2px 8px rgba(79,70,229,0.08)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', letterSpacing: '0.02em' }}>Custom Range</span>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { onClear(); setTempFrom(''); setTempTo(''); setIsOpen(false); }}
                style={{ fontSize: '10px', fontWeight: 600, color: '#f43f5e', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', fontFamily: 'inherit' }}
              >
                Reset
              </button>
            )}
          </div>

          {/* From */}
          <div>
            <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>From</label>
            <input
              type="date"
              value={tempFrom}
              onChange={(e) => setTempFrom(e.target.value)}
              style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', color: '#1e293b', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          {/* To */}
          <div>
            <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>To</label>
            <input
              type="date"
              value={tempTo}
              onChange={(e) => setTempTo(e.target.value)}
              style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', color: '#1e293b', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          {/* Apply */}
          <button
            type="button"
            onClick={() => { onApply(tempFrom, tempTo); setIsOpen(false); }}
            disabled={!tempFrom && !tempTo}
            style={{
              width: '100%',
              padding: '7px',
              background: (!tempFrom && !tempTo) ? '#e2e8f0' : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              color: (!tempFrom && !tempTo) ? '#94a3b8' : '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: (!tempFrom && !tempTo) ? 'not-allowed' : 'pointer',
              transition: 'all 180ms ease',
              boxShadow: (!tempFrom && !tempTo) ? 'none' : '0 2px 8px rgba(79,70,229,0.3)',
              letterSpacing: '0.02em',
              fontFamily: 'inherit',
            }}
          >
            Apply Range
          </button>
        </div>
      )}
    </div>
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
  const [activePreset, setActivePreset] = useState<'all' | 'this_month' | 'last_30' | 'last_90' | 'this_year' | 'custom'>('all');



  const fmt = (n: number) => {
    const isNegative = n < 0;
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return isNegative ? `₹-${formatted}` : `₹${formatted}`;
  };

  const setPreset = (preset: 'all' | 'this_month' | 'last_30' | 'last_90' | 'this_year') => {
    setActivePreset(preset);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');

    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
      return;
    }

    if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDateFrom(`${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`);
      setDateTo(`${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`);
      return;
    }

    if (preset === 'last_30') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setDateFrom(`${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`);
      setDateTo(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
      return;
    }

    if (preset === 'last_90') {
      const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      setDateFrom(`${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`);
      setDateTo(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
      return;
    }

    if (preset === 'this_year') {
      setDateFrom(`${now.getFullYear()}-01-01`);
      setDateTo(`${now.getFullYear()}-12-31`);
      return;
    }
  };

  const loadAll = async () => {
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
      setSummary(s);
      setBreakdown(b.filter((r: CategoryBreakdown) => r.total > 0));
      setMonthly(m);
      setMerchants(t);
      setDailySpend(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [dateFrom, dateTo]);



  // Use a zeroed-out summary if the selected period has no transactions
  const displaySummary = summary ?? { totalIncome: 0, totalExpense: 0, netFlow: 0, transactionCount: 0, uncategorizedCount: 0 };

  const statCards = [
        {
          label: 'Total Income',
          sublabel: 'Credited this period',
          value: fmt(displaySummary.totalIncome),
          icon: 'income',
          gradient: 'linear-gradient(145deg, #f0fdf7 0%, #dcfce7 60%, #d1fae5 100%)',
          glowColor: 'rgba(16,185,129,0.10)',
          iconBg: 'rgba(16,185,129,0.12)',
          iconColor: '#059669',
          accentColor: '#10b981',
          textColor: '#065f46',
          labelColor: '#047857',
          sublabelColor: '#6ee7b7',
          badge: '+',
        },
        {
          label: 'Total Expense',
          sublabel: 'Debited this period',
          value: fmt(displaySummary.totalExpense),
          icon: 'expense',
          gradient: 'linear-gradient(145deg, #fff1f2 0%, #ffe4e6 60%, #fecdd3 100%)',
          glowColor: 'rgba(244,63,94,0.10)',
          iconBg: 'rgba(244,63,94,0.10)',
          iconColor: '#be123c',
          accentColor: '#f43f5e',
          textColor: '#881337',
          labelColor: '#be123c',
          sublabelColor: '#fda4af',
          badge: '−',
        },
        {
          label: 'Net Flow',
          sublabel: displaySummary.netFlow >= 0 ? 'Surplus' : 'Deficit',
          value: fmt(displaySummary.netFlow),
          icon: 'flow',
          gradient: 'linear-gradient(145deg, #eff6ff 0%, #dbeafe 60%, #bfdbfe 100%)',
          glowColor: 'rgba(59,130,246,0.10)',
          iconBg: 'rgba(59,130,246,0.10)',
          iconColor: '#1d4ed8',
          accentColor: '#3b82f6',
          textColor: '#1e3a8a',
          labelColor: '#1d4ed8',
          sublabelColor: '#93c5fd',
          badge: displaySummary.netFlow >= 0 ? '↑' : '↓',
        },
        {
          label: 'Transactions',
          sublabel: 'Total entries',
          value: displaySummary.transactionCount.toLocaleString('en-IN'),
          icon: 'transactions',
          gradient: 'linear-gradient(145deg, #fffbeb 0%, #fef3c7 60%, #fde68a 100%)',
          glowColor: 'rgba(245,158,11,0.12)',
          iconBg: 'rgba(245,158,11,0.14)',
          iconColor: '#b45309',
          accentColor: '#f59e0b',
          textColor: '#78350f',
          labelColor: '#b45309',
          sublabelColor: '#fcd34d',
          badge: '#',
        },
        {
          label: 'Uncategorized',
          sublabel: 'Needs review',
          value: displaySummary.uncategorizedCount.toLocaleString('en-IN'),
          icon: 'warning',
          gradient: 'linear-gradient(145deg, #fff7ed 0%, #ffedd5 60%, #fed7aa 100%)',
          glowColor: 'rgba(251,146,60,0.10)',
          iconBg: 'rgba(251,146,60,0.12)',
          iconColor: '#c2410c',
          accentColor: '#f97316',
          textColor: '#7c2d12',
          labelColor: '#c2410c',
          sublabelColor: '#fdba74',
          badge: '!',
        },
      ];

  const totalSpend = breakdown.reduce((total, entry) => total + entry.total, 0);
  const topCategories = breakdown.slice(0, 5);
  const remainingCategoriesCount = breakdown.length - topCategories.length;

  if (loading && !summary) {
    return <div className="text-center py-12 text-[#94a3b8]">Loading dashboard...</div>;
  }

  if (!summary && !loading) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-xl font-semibold text-[#334155]">No data yet</h2>
        <p className="text-[#94a3b8] mt-2">Upload a bank statement to see your spending analytics.</p>
      </div>
    );
  }



  return (
    <div className="relative">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#4f6bf5] mb-1">
            FINANCIAL COMMAND CENTRE
          </p>
          <h1 className="text-2xl font-bold text-[#182231] tracking-tight">Dashboard</h1>
          <p className="text-xs text-[#7d8c9e] mt-1">A clear view of your cash flow, spending, and activity.</p>
        </div>

        {/* Date Filter & Presets */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center bg-white border border-[#e2e8f0] p-0.5 rounded-lg shadow-sm">
            <button
              type="button"
              onClick={() => setPreset('all')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                activePreset === 'all' && !dateFrom && !dateTo
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setPreset('this_month')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                activePreset === 'this_month'
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setPreset('last_30')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                activePreset === 'last_30'
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 Days
            </button>
            <button
              type="button"
              onClick={() => setPreset('last_90')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                activePreset === 'last_90'
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              90 Days
            </button>
          </div>

          {/* Custom Date Range — calendar icon + popover */}
          <CustomDatePopover
            dateFrom={dateFrom}
            dateTo={dateTo}
            activePreset={activePreset}
            onApply={(from, to) => {
              setDateFrom(from);
              setDateTo(to);
              setActivePreset('custom');
            }}
            onClear={() => setPreset('all')}
          />
        </div>
      </div>

      {dateFrom && dateTo && dateFrom > dateTo && (
        <p className="text-xs text-red-600 font-medium mb-4">The start date must be before or equal to the end date.</p>
      )}

      {/* KPI Cards (5 cards) — Premium */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
        {statCards.map((c) => (
          <div
            key={c.label}
            className="kpi-premium-card group relative overflow-hidden rounded-2xl flex flex-col justify-between min-h-[118px] p-4 cursor-default"
            style={{
              background: c.gradient,
              boxShadow: `0 2px 16px ${c.glowColor}, 0 1px 3px rgba(0,0,0,0.06)`,
              border: `1px solid ${c.accentColor}22`,
            }}
          >
            {/* Decorative radial glow orb top-right */}
            <div
              className="absolute -top-5 -right-5 w-24 h-24 rounded-full opacity-30 pointer-events-none"
              style={{ background: `radial-gradient(circle, ${c.accentColor} 0%, transparent 70%)` }}
            />
{/* no grid on light cards */}

            {/* Top row: badge pill + icon orb */}
            <div className="flex items-start justify-between gap-2 relative z-10">
              {/* Small accent badge */}
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[11px] font-black leading-none"
                style={{ background: c.iconBg, color: c.iconColor }}
              >
                {c.badge}
              </span>

              {/* Icon orb */}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
                style={{ background: c.iconBg, color: c.iconColor, boxShadow: `0 0 16px ${c.glowColor}` }}
              >
                <MetricIcon type={c.icon} size={17} />
              </div>
            </div>

            {/* Value */}
            <div className="relative z-10 mt-3">
              <div
                className="text-[1.35rem] font-bold tracking-tight leading-none"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: c.textColor }}
              >
                {c.value}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] font-semibold tracking-wide" style={{ color: c.labelColor }}>
                  {c.label.toUpperCase()}
                </span>
              </div>
              <div className="text-[9px] mt-0.5" style={{ color: c.sublabelColor, opacity: 0.7 }}>
                {c.sublabel}
              </div>
            </div>

            {/* Bottom accent line */}
            <div
              className="absolute bottom-0 left-0 right-0 h-[2px] opacity-60"
              style={{ background: `linear-gradient(90deg, transparent, ${c.accentColor}, transparent)` }}
            />
          </div>
        ))}
      </div>

      {/* Middle Row (Spend by Category & Monthly Trend) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5">
        {/* Spend by Category Card (5 cols on lg) */}
        <div className="lg:col-span-5 finflux-panel bg-white border border-[#e8eff5] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-[#182231]">Spend by Category</h2>
              <span className="text-[10px] font-bold tracking-widest text-[#5d87a8] uppercase">BREAKDOWN</span>
            </div>
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
          </div>

          <div className="space-y-3.5 max-h-[225px] overflow-y-auto pr-1 mt-3">
            {merchants.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">No merchant activity recorded in this period.</div>
            ) : (
              merchants.map((m, idx) => (
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
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}