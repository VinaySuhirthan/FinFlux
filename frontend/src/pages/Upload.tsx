import { useEffect, useState, useRef, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { rulesApi, statementsApi, transactionsApi } from '../services/api';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

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

export default function Upload() {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState('');
  const [uploadedId, setUploadedId] = useState('');
  const [dragging, setDragging] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleError, setRuleError] = useState('');
  const [showAllBuiltInRules, setShowAllBuiltInRules] = useState(false);
  const [form, setForm] = useState({
    pattern: '',
    patternType: 'KEYWORD' as 'KEYWORD' | 'REGEX',
    categoryId: '',
    priority: '50',
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const loadRules = async () => {
    setRulesLoading(true);
    try {
      const [loadedRules, loadedCategories] = await Promise.all([rulesApi.list(), transactionsApi.getCategories()]);
      setRules(loadedRules);
      setCategories(loadedCategories);
      if (loadedCategories.length > 0 && !form.categoryId) {
        setForm((current) => ({ ...current, categoryId: loadedCategories[0].id }));
      }
    } catch (err: any) {
      setRuleError(err.response?.data?.message || 'Failed to load rules');
    } finally {
      setRulesLoading(false);
    }
  };

  useEffect(() => { loadRules(); }, []);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleError('');
    setSavingRule(true);
    try {
      await rulesApi.create({
        pattern: form.pattern,
        patternType: form.patternType,
        categoryId: form.categoryId,
        priority: parseInt(form.priority),
      });
      setForm({ pattern: '', patternType: 'KEYWORD', categoryId: categories[0]?.id || '', priority: '50' });
      await loadRules();
    } catch (err: any) {
      setRuleError(err.response?.data?.message || 'Failed to create rule');
    } finally {
      setSavingRule(false);
    }
  };

  const handleToggleRule = async (rule: Rule) => {
    await rulesApi.update(rule.id, { isActive: !rule.isActive });
    loadRules();
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    await rulesApi.delete(id);
    loadRules();
  };

  const upload = async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    if (!isPdf && !isXlsx) {
      setError('Only PDF or XLSX files are accepted.');
      setStatus('error');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('File must be smaller than 20 MB.');
      setStatus('error');
      return;
    }

    setStatus('uploading');
    setError('');
    try {
      const result = await statementsApi.upload(file);
      setUploadedId(result.id);
      setStatus('success');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Upload failed');
      setStatus('error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-400 mb-1">Data intake</p>
      <h1 className="text-2xl font-bold mb-2">Rules &amp; Upload</h1>
      <p className="text-gray-500 mb-6">Set your classification rules first, then upload a bank statement.</p>

      {status === 'success' ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-lg font-semibold text-green-800 mb-1">Upload successful!</h2>
          <p className="text-green-700 text-sm mb-4">
            Your statement is being processed. This may take a moment.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate(`/statements/${uploadedId}/transactions`)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              View Transactions
            </button>
            <button
              onClick={() => { setStatus('idle'); setUploadedId(''); }}
              className="bg-white text-green-700 border border-green-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors"
            >
              Upload Another
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <section className="finflux-panel h-full bg-white border border-gray-200 rounded-xl p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold">Custom classification rules</h2>
              <p className="text-xs text-gray-500 mt-1">These rules are applied when your statement is processed.</p>
            </div>
            {ruleError && <div className="mb-3 p-2 bg-red-50 text-red-600 rounded text-sm">{ruleError}</div>}
            <form onSubmit={handleCreateRule} className="flex gap-3 flex-wrap items-end">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs text-gray-500 mb-1">Pattern</label>
                <input type="text" value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} required placeholder="e.g. swiggy" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select value={form.patternType} onChange={(e) => setForm({ ...form, patternType: e.target.value as 'KEYWORD' | 'REGEX' })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="KEYWORD">Keyword</option>
                  <option value="REGEX">Regex</option>
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.icon} {category.name}</option>)}
                </select>
              </div>
              <div className="w-20">
                <label className="block text-xs text-gray-500 mb-1">Priority</label>
                <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} min="0" max="200" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <button type="submit" disabled={savingRule || rulesLoading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {savingRule ? 'Adding...' : 'Add Rule'}
              </button>
            </form>
            <div className="mt-5 border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold mb-3">Your rules ({rules.filter((rule) => !rule.isSystem).length})</h3>
              {rulesLoading ? <div className="text-gray-400 text-sm">Loading rules...</div> : rules.filter((rule) => !rule.isSystem).length === 0 ? <div className="text-gray-400 text-sm py-3 text-center border border-dashed border-gray-200 rounded-lg">No custom rules yet.</div> : <RuleTable rules={rules.filter((rule) => !rule.isSystem)} onToggle={handleToggleRule} onDelete={handleDeleteRule} showDelete />}
            </div>
            <div className="mt-5 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold">Built-in rules ({rules.filter((rule) => rule.isSystem).length})</h3>
                {!rulesLoading && rules.filter((rule) => rule.isSystem).length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllBuiltInRules((visible) => !visible)}
                    className="inline-flex items-center gap-2 rounded-md border-2 border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                    aria-expanded={showAllBuiltInRules}
                  >
                    {showAllBuiltInRules ? 'Show less' : 'Show all'}
                    <svg className={`h-3.5 w-3.5 transition-transform ${showAllBuiltInRules ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
              {rulesLoading ? <div className="text-gray-400 text-sm">Loading rules...</div> : <RuleTable rules={showAllBuiltInRules ? rules.filter((rule) => rule.isSystem) : rules.filter((rule) => rule.isSystem).slice(0, 3)} />}
            </div>
          </section>

          <section className="finflux-panel h-full bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-base font-semibold mb-1">Upload bank statement</h2>
            <p className="text-sm text-gray-500 mb-3">Upload a PDF or XLSX statement. Maximum file size: 20 MB.</p>
          <div
            className={`upload-dropzone border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={handleFileChange}
            />
            {status === 'uploading' ? (
              <>
                <div className="text-4xl mb-3 animate-pulse">⏳</div>
                <p className="text-gray-600 font-medium">Uploading and processing...</p>
                <p className="text-gray-400 text-sm mt-1">Please wait</p>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">📄</div>
                <p className="text-gray-700 font-medium">Drop your PDF or XLSX here or click to browse</p>
                <p className="text-gray-400 text-sm mt-1">PDF or XLSX · max 20 MB</p>
              </>
            )}
          </div>
          </section>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
          <button
            onClick={() => setStatus('idle')}
            className="ml-2 underline"
          >
            Try again
          </button>
        </div>
      )}

      <div className="upload-note mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Supported formats</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• HDFC Bank statements (text-based PDF)</li>
          <li>• SBI statements (text-based PDF)</li>
          <li>• XLSX bank statement files</li>
          <li>• Generic PDF format (best-effort parsing)</li>
        </ul>
        <p className="text-xs text-blue-600 mt-2">
          Note: Image-scanned PDFs cannot be parsed. Download statement as PDF text from your net banking portal.
        </p>
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
    <div className="border border-gray-200 rounded-lg overflow-x-auto">
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
              <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rule.patternType === 'KEYWORD' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{rule.patternType}</span></td>
              <td className="p-3">{rule.category.icon} {rule.category.name}</td>
              <td className="p-3 text-right text-gray-600">{rule.priority}</td>
              <td className="p-3">
                {onToggle ? <button onClick={() => onToggle(rule)} className={`text-xs px-2 py-0.5 rounded-full font-medium ${rule.isActive ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{rule.isActive ? 'Active' : 'Disabled'}</button> : <span className="text-xs text-gray-500">{rule.isActive ? 'Active' : 'Disabled'}</span>}
              </td>
              {showDelete && onDelete && <td className="p-3 text-right"><button onClick={() => onDelete(rule.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
