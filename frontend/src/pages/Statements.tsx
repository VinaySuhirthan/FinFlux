import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { statementsApi } from '../services/api';
import { format } from 'date-fns';

interface Statement {
  id: string;
  fileName: string;
  uploadedAt: string;
  parseStatus: string;
  bankName?: string;
  statementPeriodStart?: string;
  statementPeriodEnd?: string;
  errorMessage?: string;
  _count: { transactions: number };
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-700',
    PROCESSING: 'bg-yellow-100 text-yellow-700',
    PENDING: 'bg-gray-100 text-gray-600',
    FAILED: 'bg-red-100 text-red-700',
    PARTIAL: 'bg-orange-100 text-orange-700',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
};

export default function Statements() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const data = await statementsApi.list();
      setStatements(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this statement and all its transactions?')) return;
    setDeletingId(id);
    try {
      await statementsApi.delete(id);
      setStatements((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Statements</h1>
          <p className="text-gray-500 text-sm mt-1">Your uploaded bank statements</p>
        </div>
        <button
          onClick={() => navigate('/upload')}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + Upload New
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : statements.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📄</div>
          <p className="text-gray-600 font-medium">No statements yet</p>
          <p className="text-gray-400 text-sm">Upload a bank statement PDF to get started.</p>
          <button
            onClick={() => navigate('/upload')}
            className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Upload Statement
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {statements.map((s) => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 truncate">{s.fileName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(s.parseStatus)}`}>
                      {s.parseStatus}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 space-y-0.5">
                    {s.bankName && <div>Bank: {s.bankName}</div>}
                    {s.statementPeriodStart && s.statementPeriodEnd && (
                      <div>
                        Period: {format(new Date(s.statementPeriodStart), 'dd MMM yyyy')} –{' '}
                        {format(new Date(s.statementPeriodEnd), 'dd MMM yyyy')}
                      </div>
                    )}
                    <div>Uploaded: {format(new Date(s.uploadedAt), 'dd MMM yyyy, HH:mm')}</div>
                    <div>{s._count.transactions} transactions</div>
                    {s.errorMessage && (
                      <div className="text-red-500">{s.errorMessage}</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4 shrink-0">
                  {s.parseStatus === 'COMPLETED' && (
                    <button
                      onClick={() => navigate(`/statements/${s.id}/transactions`)}
                      className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      View
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deletingId === s.id}
                    className="text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
