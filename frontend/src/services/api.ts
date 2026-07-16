import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// Auth
export const authApi = {
  register: (data: { email: string; password: string; name?: string }) =>
    api.post('/auth/register', data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

// Statements
export const statementsApi = {
  upload: (file: File, pdfPassword?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (pdfPassword) form.append('pdfPassword', pdfPassword);
    return api.post('/statements/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  importText: (text: string, rows?: any[], fileName?: string) => {
    return api.post('/statements/import', { text, rows, fileName }).then((r) => r.data);
  },
  list: () => api.get('/statements').then((r) => r.data),
  get: (id: string) => api.get(`/statements/${id}`).then((r) => r.data),
  delete: (id: string) => api.delete(`/statements/${id}`).then((r) => r.data),
};

// Transactions
export const transactionsApi = {
  list: (
    statementId: string,
    params?: {
      categoryId?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
    },
  ) =>
    api
      .get(`/statements/${statementId}/transactions`, { params })
      .then((r) => r.data),
  listAll: (
    params?: {
      categoryId?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
      direction?: 'DEBIT' | 'CREDIT';
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) =>
    api
      .get('/transactions/all', { params })
      .then((r) => r.data),
  updateCategory: (id: string, categoryId: string) =>
    api.patch(`/transactions/${id}/category`, { categoryId }).then((r) => r.data),
  update: (id: string, data: Partial<{ description: string; amount: number; txnDate: string; type: 'CR' | 'DR'; categoryId: string }>) =>
    api.patch(`/transactions/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/transactions/${id}`).then((r) => r.data),
  bulkCategorize: (transactionIds: string[], categoryId: string) =>
    api
      .post('/transactions/bulk-categorize', { transactionIds, categoryId })
      .then((r) => r.data),
  getCategories: () => api.get('/categories').then((r) => r.data),
};

// Analytics
export const analyticsApi = {
  summary: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get('/analytics/summary', { params }).then((r) => r.data),
  categoryBreakdown: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get('/analytics/category-breakdown', { params }).then((r) => r.data),
  monthlyTrend: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get('/analytics/monthly-trend', { params }).then((r) => r.data),
  topMerchants: (params?: { dateFrom?: string; dateTo?: string; limit?: number }) =>
    api.get('/analytics/top-merchants', { params }).then((r) => r.data),
};

// Rules
export const rulesApi = {
  list: () => api.get('/rules').then((r) => r.data),
  create: (data: { pattern: string; patternType: string; categoryId: string; priority?: number }) =>
    api.post('/rules', data).then((r) => r.data),
  update: (id: string, data: Partial<{ pattern: string; patternType: string; categoryId: string; priority: number; isActive: boolean }>) =>
    api.patch(`/rules/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/rules/${id}`).then((r) => r.data),
};

// Classification
export const classificationApi = {
  reprocess: (statementId: string) =>
    api.post(`/classification/reprocess/${statementId}`).then((r) => r.data),
};

export default api;
