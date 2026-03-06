import { useEffect, useState } from 'react';
import { rulesApi, transactionsApi } from '../services/api';

interface Category {
  id: string;
  name: string;
  icon?: string;
}

interface Rule {
  id: string;
  pattern: string;
  patternType: 'KEYWORD' | 'REGEX';
  priority: number;
  isActive: boolean;
  isSystem: boolean;
  category: Category;
}

export default function Rules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    pattern: '',
    patternType: 'KEYWORD' as 'KEYWORD' | 'REGEX',
    categoryId: '',
    priority: '50',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([rulesApi.list(), transactionsApi.getCategories()]);
      setRules(r);
      setCategories(c);
      if (c.length > 0 && !form.categoryId) setForm((f) => ({ ...f, categoryId: c[0].id }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await rulesApi.create({
        pattern: form.pattern,
        patternType: form.patternType,
        categoryId: form.categoryId,
        priority: parseInt(form.priority),
      });
      setForm({ pattern: '', patternType: 'KEYWORD', categoryId: categories[0]?.id || '', priority: '50' });
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create rule');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: Rule) => {
    await rulesApi.update(rule.id, { isActive: !rule.isActive });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    await rulesApi.delete(id);
    load();
  };

  const userRules = rules.filter((r) => !r.isSystem);
  const systemRules = rules.filter((r) => r.isSystem);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Classification Rules</h1>
      <p className="text-gray-500 text-sm mb-6">
        Rules are matched in descending priority order. Higher priority = matched first.
      </p>

      {/* Create rule form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold mb-4">Add Custom Rule</h2>
        {error && <div className="mb-3 p-2 bg-red-50 text-red-600 rounded text-sm">{error}</div>}
        <form onSubmit={handleCreate} className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-gray-500 mb-1">Pattern</label>
            <input
              type="text"
              value={form.pattern}
              onChange={(e) => setForm({ ...form, pattern: e.target.value })}
              required
              placeholder="e.g. swiggy"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <select
              value={form.patternType}
              onChange={(e) => setForm({ ...form, patternType: e.target.value as 'KEYWORD' | 'REGEX' })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="KEYWORD">Keyword</option>
              <option value="REGEX">Regex</option>
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>
          <div className="w-20">
            <label className="block text-xs text-gray-500 mb-1">Priority</label>
            <input
              type="number"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              min="0"
              max="200"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add Rule'}
          </button>
        </form>
      </div>

      {/* User rules */}
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-3">Your Rules ({userRules.length})</h2>
        {loading ? (
          <div className="text-gray-400 text-sm">Loading...</div>
        ) : userRules.length === 0 ? (
          <div className="text-gray-400 text-sm py-4 text-center border border-dashed border-gray-200 rounded-xl">
            No custom rules yet. Add one above.
          </div>
        ) : (
          <RuleTable rules={userRules} onToggle={handleToggle} onDelete={handleDelete} showDelete />
        )}
      </div>

      {/* System rules (read-only) */}
      <div>
        <h2 className="text-base font-semibold mb-3">Built-in Rules ({systemRules.length})</h2>
        <p className="text-xs text-gray-400 mb-2">These are system rules and cannot be deleted.</p>
        <RuleTable rules={systemRules} />
      </div>
    </div>
  );
}

function RuleTable({
  rules,
  onToggle,
  onDelete,
  showDelete,
}: {
  rules: Rule[];
  onToggle?: (rule: Rule) => void;
  onDelete?: (id: string) => void;
  showDelete?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="p-3 text-left text-gray-600 font-medium">Pattern</th>
            <th className="p-3 text-left text-gray-600 font-medium">Type</th>
            <th className="p-3 text-left text-gray-600 font-medium">Category</th>
            <th className="p-3 text-right text-gray-600 font-medium">Priority</th>
            <th className="p-3 text-left text-gray-600 font-medium">Status</th>
            {showDelete && <th className="p-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rules.map((rule) => (
            <tr key={rule.id} className={`hover:bg-gray-50 ${!rule.isActive ? 'opacity-50' : ''}`}>
              <td className="p-3 font-mono text-xs">{rule.pattern}</td>
              <td className="p-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  rule.patternType === 'KEYWORD'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-purple-50 text-purple-700'
                }`}>
                  {rule.patternType}
                </span>
              </td>
              <td className="p-3">{rule.category.icon} {rule.category.name}</td>
              <td className="p-3 text-right text-gray-600">{rule.priority}</td>
              <td className="p-3">
                {onToggle ? (
                  <button
                    onClick={() => onToggle(rule)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      rule.isActive
                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {rule.isActive ? 'Active' : 'Disabled'}
                  </button>
                ) : (
                  <span className="text-xs text-gray-500">{rule.isActive ? 'Active' : 'Disabled'}</span>
                )}
              </td>
              {showDelete && onDelete && (
                <td className="p-3 text-right">
                  <button
                    onClick={() => onDelete(rule.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
