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

  const upload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are accepted.');
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
            accept="application/pdf"
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
          <li>• Generic format (best-effort parsing)</li>
        </ul>
        <p className="text-xs text-blue-600 mt-2">
          Note: Image-scanned PDFs cannot be parsed. Download statement as PDF text from your net banking portal.
        </p>
      </div>
    </div>
  );
}
