import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { transactionsApi, classificationApi } from '../services/api';
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

interface EditState {
  [txnId: string]: {
    editing: boolean;
    description: string;
    amount: string;
    txnDate: string;
    type: 'CR' | 'DR';
  };
}

export default function Transactions() {
  const { id: statementId } = useParams<{ id: string }>();
  const [result, setResult] = useState<PaginatedResult | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState('');
  const [reprocessing, setReprocessing] = useState(false);
  const [editState, setEditState] = useState<EditState>({});

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!statementId) return;
    setLoading(true);
    try {
      const [txns, cats] = await Promise.all([
        transactionsApi.list(statementId, {
          search: search || undefined,
          categoryId: filterCategory || undefined,
          page,
          limit: 50,
        }),
        transactionsApi.getCategories(),
      ]);
      setResult(txns);
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  }, [statementId, search, filterCategory, page]);

  useEffect(() => { load(); }, [load]);

  const handleCategoryChange = async (txnId: string, categoryId: string) => {
    await transactionsApi.updateCategory(txnId, categoryId);
    setResult((prev) =>
      prev
        ? {
            ...prev,
            transactions: prev.transactions.map((t) =>
              t.id === txnId
                ? { ...t, category: categories.find((c) => c.id === categoryId), isManualOverride: true }
                : t,
            ),
          }
        : prev,
    );
  };

  const handleBulkCategorize = async () => {
    if (!bulkCategory || selected.size === 0) return;
    await transactionsApi.bulkCategorize([...selected], bulkCategory);
    setSelected(new Set());
    load();
  };

  const handleReprocess = async () => {
    if (!statementId) return;
    setReprocessing(true);
    try {
      await classificationApi.reprocess(statementId);
      load();
    } finally {
      setReprocessing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!result) return;
    if (selected.size === result.transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(result.transactions.map((t) => t.id)));
    }
  };

  const reasonLabel: Record<string, string> = {
    EXACT_KEYWORD: 'keyword',
    REGEX_MATCH: 'regex',
    MANUAL_OVERRIDE: 'manual',
    FALLBACK_UNCATEGORIZED: 'auto',
  };

  const startEdit = (txn: Transaction) => {
    setEditState((prev) => ({
      ...prev,
      [txn.id]: {
        editing: true,
        description: txn.description,
        amount: txn.debitAmount || txn.creditAmount || '',
        txnDate: txn.txnDate.slice(0, 10),
        type: txn.direction === 'CREDIT' ? 'CR' : 'DR',
      },
    }));
  };

  const cancelEdit = (txnId: string) => {
    setEditState((prev) => ({ ...prev, [txnId]: { ...prev[txnId], editing: false } }));
  };

  const saveEdit = async (txn: Transaction) => {
    const state = editState[txn.id];
    await transactionsApi.update(txn.id, {
      description: state.description,
      amount: Number(state.amount),
      txnDate: state.txnDate,
      type: state.type,
      // Set categoryId if present in txn
      categoryId: txn.category?.id,
    });
    setEditState((prev) => ({ ...prev, [txn.id]: { ...prev[txn.id], editing: false } }));
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <button
          onClick={handleReprocess}
          disabled={reprocessing}
          className="text-sm text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
        >
          {reprocessing ? 'Reprocessing...' : 'Re-run Classification'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
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
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <span className="text-sm font-medium text-indigo-700">{selected.size} selected</span>
          <select
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            className="border border-indigo-300 rounded-lg px-2 py-1 text-sm"
          >
            <option value="">Pick category...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          <button
            onClick={handleBulkCategorize}
            disabled={!bulkCategory}
            className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm disabled:opacity-50 hover:bg-indigo-700"
          >
            Apply
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading transactions...</div>
      ) : !result || result.transactions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No transactions found.</p>
          {result?.total === 0 && (
            <p className="text-gray-400 text-sm mt-1">
              The statement may still be processing. Refresh in a moment.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-10 p-3 text-left">
                    <input
                      type="checkbox"
                      checked={selected.size === result.transactions.length}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="p-3 text-left text-gray-600 font-medium">Date</th>
                  <th className="p-3 text-left text-gray-600 font-medium">Description</th>
                  <th className="p-3 text-right text-gray-600 font-medium">Debit</th>
                  <th className="p-3 text-right text-gray-600 font-medium">Credit</th>
                  <th className="p-3 text-left text-gray-600 font-medium">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.transactions.map((txn) => {
                  const edit = editState[txn.id];
                  return edit && edit.editing ? (
                    <tr key={txn.id} className={`hover:bg-gray-50 ${selected.has(txn.id) ? 'bg-indigo-50' : ''}`}>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected.has(txn.id)}
                          onChange={() => toggleSelect(txn.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-3 text-gray-600 whitespace-nowrap">
                        <input
                          type="date"
                          value={edit.txnDate}
                          onChange={e => setEditState(prev => ({ ...prev, [txn.id]: { ...prev[txn.id], txnDate: e.target.value } }))}
                          className="border rounded px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="p-3 max-w-xs">
                        <input
                          type="text"
                          value={edit.description}
                          onChange={e => setEditState(prev => ({ ...prev, [txn.id]: { ...prev[txn.id], description: e.target.value } }))}
                          className="border rounded px-2 py-1 text-xs w-full"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          value={edit.type === 'DR' ? edit.amount : ''}
                          onChange={e => setEditState(prev => ({ ...prev, [txn.id]: { ...prev[txn.id], amount: e.target.value, type: 'DR' } }))}
                          className="border rounded px-2 py-1 text-xs w-20 text-right"
                          placeholder="Debit"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          value={edit.type === 'CR' ? edit.amount : ''}
                          onChange={e => setEditState(prev => ({ ...prev, [txn.id]: { ...prev[txn.id], amount: e.target.value, type: 'CR' } }))}
                          className="border rounded px-2 py-1 text-xs w-20 text-right"
                          placeholder="Credit"
                        />
                      </td>
                      <td className="p-3 flex gap-1">
                        <button onClick={() => saveEdit(txn)} className="text-green-600 text-xs px-2 py-1 border rounded hover:bg-green-50">Save</button>
                        <button onClick={() => cancelEdit(txn.id)} className="text-gray-500 text-xs px-2 py-1 border rounded hover:bg-gray-50">Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={txn.id} className={`hover:bg-gray-50 ${selected.has(txn.id) ? 'bg-indigo-50' : ''}`}>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected.has(txn.id)}
                          onChange={() => toggleSelect(txn.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-3 text-gray-600 whitespace-nowrap">
                        {format(new Date(txn.txnDate), 'dd MMM yyyy')}
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="truncate text-gray-900" title={txn.description}>
                          {txn.description}
                        </div>
                        <div className="flex gap-1 mt-0.5">
                          {txn.isManualOverride && (
                            <span className="text-xs text-indigo-500 bg-indigo-50 px-1 rounded">manual</span>
                          )}
                          <span className="text-xs text-gray-400">
                            {reasonLabel[txn.classificationReason] || ''}
                          </span>
                        </div>
                        <button onClick={() => startEdit(txn)} className="text-xs text-blue-500 underline mt-1">Edit</button>
                      </td>
                      <td className="p-3 text-right text-red-600 font-mono">
                        {txn.debitAmount ? `₹${Number(txn.debitAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''}
                      </td>
                      <td className="p-3 text-right text-green-600 font-mono">
                        {txn.creditAmount ? `₹${Number(txn.creditAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''}
                      </td>
                      <td className="p-3">
                        <select
                          value={txn.category?.id || ''}
                          onChange={(e) => handleCategoryChange(txn.id, e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1 text-xs max-w-[160px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">Uncategorized</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.icon} {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
            <span>{result.total} transactions total</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-3 py-1">
                Page {page} of {result.totalPages}
              </span>
              <button
                disabled={page >= result.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
