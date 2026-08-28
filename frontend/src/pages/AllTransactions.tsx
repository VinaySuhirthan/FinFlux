import { useEffect, useState, useCallback } from 'react';
import { transactionsApi } from '../services/api';
import { format } from 'date-fns';

interface Category {
  id: string;
  name: string;
  type: string;
  color?: string;
  icon?: string;
}

interface Transaction {
  id: string;
  txnDate: string;
  description: string;
  debitAmount?: string;
  creditAmount?: string;
  balance?: string;
  direction: 'DEBIT' | 'CREDIT';
  isManualOverride: boolean;
  classificationReason: string;
  category?: Category;
}

interface PaginatedResult {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AllTransactions() {
  const [result, setResult] = useState<PaginatedResult | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDirection, setFilterDirection] = useState<"DEBIT" | "CREDIT" | "">("");
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('txnDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [txns, cats] = await Promise.all([
        transactionsApi.listAll({
          search: search || undefined,
          categoryId: filterCategory || undefined,
          direction: filterDirection || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          page,
          limit: 50,
          sortBy,
          sortOrder,
        }),
        transactionsApi.getCategories(),
      ]);
      setResult(txns);
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  }, [search, filterCategory, filterDirection, dateFrom, dateTo, page, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  // Sorting helpers
  function handleSort(field: string) {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  }
  function renderSortArrow(field: string) {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? <span>▲</span> : <span>▼</span>;
  }

  async function handleDelete(txnId: string) {
    setDeleting(true);
    try {
      await transactionsApi.delete(txnId);
      setDeleteConfirm(null);
      await load();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    } finally {
      setDeleting(false);
    }
  }

  function handleResetFilters() {
    setSearch('');
    setFilterCategory('');
    setFilterDirection('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    setSortBy('txnDate');
    setSortOrder('desc');
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">All Transactions</h1>
      </div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search description..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <select
          value={filterDirection}
          onChange={(e) => { setFilterDirection(e.target.value as "" | "DEBIT" | "CREDIT"); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All</option>
          <option value="CREDIT">Credit</option>
          <option value="DEBIT">Debit</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={handleResetFilters}
          className="px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg font-medium transition-colors"
        >
          Reset Filters
        </button>
      </div>
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading transactions...</div>
      ) : !result || result.transactions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No transactions found.</p>
        </div>
      ) : (
        <div className="finflux-panel finflux-table-wrap bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-3 text-left text-gray-600 font-medium cursor-pointer select-none" onClick={() => handleSort('txnDate')}>
                  Date {renderSortArrow('txnDate')}
                </th>
                <th className="p-3 text-left text-gray-600 font-medium cursor-pointer select-none" onClick={() => handleSort('description')}>
                  Description {renderSortArrow('description')}
                </th>
                <th className="p-3 text-right text-gray-600 font-medium cursor-pointer select-none" onClick={() => handleSort('debitAmount')}>
                  Debit {renderSortArrow('debitAmount')}
                </th>
                <th className="p-3 text-right text-gray-600 font-medium cursor-pointer select-none" onClick={() => handleSort('creditAmount')}>
                  Credit {renderSortArrow('creditAmount')}
                </th>
                <th className="p-3 text-left text-gray-600 font-medium">Category</th>
                <th className="p-3 text-center text-gray-600 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.transactions.map((txn) => (
                <tr key={txn.id}>
                  <td className="p-3 text-gray-600 whitespace-nowrap">{format(new Date(txn.txnDate), 'yyyy-MM-dd')}</td>
                  <td className="p-3">{txn.description}</td>
                  <td className="p-3 text-right">{txn.debitAmount || ''}</td>
                  <td className="p-3 text-right">{txn.creditAmount || ''}</td>
                  <td className="p-3">{txn.category?.icon} {txn.category?.name}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => setDeleteConfirm(txn.id)}
                      className="text-red-500 hover:text-red-700 font-medium text-sm transition-colors"
                      disabled={deleting}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Delete Transaction?</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this transaction? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 text-white bg-red-500 hover:bg-red-600 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
