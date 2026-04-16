import { useState, useRef, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { statementsApi } from '../services/api';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function Upload() {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState('');
  const [uploadedId, setUploadedId] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [pdfPassword, setPdfPassword] = useState('');
  const [rawText, setRawText] = useState('');

  const upload = async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isTxt = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');
    const isCsv = file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv');
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    if (!isPdf && !isTxt && !isCsv && !isXlsx) {
      setError('Only PDF, TXT, CSV or XLSX files are accepted.');
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
      const result = await statementsApi.upload(file, isPdf ? pdfPassword || undefined : undefined);
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
      <h1 className="text-2xl font-bold mb-2">Upload Statement</h1>
      <p className="text-gray-500 mb-6">Upload a bank statement PDF to start tracking your expenses.</p>

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
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
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
              accept=".pdf,.txt,.csv,.xlsx,application/pdf,text/plain,text/csv"
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
                <p className="text-gray-700 font-medium">Drop your PDF here or click to browse</p>
                <p className="text-gray-400 text-sm mt-1">PDF files only, max 20 MB</p>
              </>
            )}
          </div>

          {!status.includes('uploading') && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <label htmlFor="pdf-password" className="block text-sm font-medium text-gray-700 mb-2">
                PDF Password (if required)
              </label>
              <input
                id="pdf-password"
                type="password"
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                placeholder="Leave blank if PDF is not password-protected"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoComplete="off"
              />
              <p className="text-xs text-gray-500 mt-1">Password will not be saved after upload</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Paste tabular text or CSV here</label>
                <textarea
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={`Date | Description | Amount | Category\n2026-04-10 | Uber Ride | -250 | Travel`}
                  onChange={(e) => setRawText(e.target.value)}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={async () => {
                      if (!rawText.trim()) return;
                      setStatus('uploading');
                      try {
                        const res = await statementsApi.importText(rawText);
                        setUploadedId(res.id);
                        setStatus('success');
                      } catch (err: any) {
                        setError(err.response?.data?.message || 'Import failed');
                        setStatus('error');
                      }
                    }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Import Text
                  </button>
                </div>
              </div>
            </div>
          )}
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

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Supported formats</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• HDFC Bank statements (text-based PDF)</li>
          <li>• SBI statements (text-based PDF)</li>
          <li>• Plain text files with parsed transactions (.txt)</li>
          <li>• Generic format (best-effort parsing)</li>
        </ul>
        <p className="text-xs text-blue-600 mt-2">
          Note: Image-scanned PDFs cannot be parsed. Download statement as PDF text from your net banking portal.
        </p>
      </div>
    </div>
  );
}
