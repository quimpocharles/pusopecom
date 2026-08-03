import api from './api';

export const reportService = {
  getSalesReport: async (params = {}) => {
    const response = await api.get('/reports/sales', { params });
    return response.data;
  },

  getProductsReport: async (params = {}) => {
    const response = await api.get('/reports/products', { params });
    return response.data;
  },

  getOrdersReport: async (params = {}) => {
    const response = await api.get('/reports/orders', { params });
    return response.data;
  },

  getCustomersReport: async (params = {}) => {
    const response = await api.get('/reports/customers', { params });
    return response.data;
  },

  getTryOnReport: async (params = {}) => {
    const response = await api.get('/reports/tryon', { params });
    return response.data;
  },

  // Downloads a report as CSV or Excel, preserving whatever date-range
  // params the on-screen report is currently filtered by. `reportKey` is
  // one of sales|products|orders|customers|tryon|shipping.
  exportReport: async (reportKey, format, params = {}) => {
    const response = await api.get(`/reports/${reportKey}/export`, {
      params: { ...params, format },
      responseType: 'blob',
    });

    const disposition = response.headers['content-disposition'] || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : `${reportKey}-report.${format}`;

    const mimeType = format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv';
    const url = URL.createObjectURL(new Blob([response.data], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Who the Daily Business Report is emailed to
  getRecipients: async () => {
    const response = await api.get('/reports/recipients');
    return response.data;
  },

  addRecipient: async (email) => {
    const response = await api.post('/reports/recipients', { email });
    return response.data;
  },

  setRecipientActive: async (id, active) => {
    const response = await api.patch(`/reports/recipients/${id}`, { active });
    return response.data;
  },

  removeRecipient: async (id) => {
    const response = await api.delete(`/reports/recipients/${id}`);
    return response.data;
  },

  // Report Delivery Schedules (Daily/Weekly/Monthly/Quarterly on/off)
  getSchedules: async () => {
    const response = await api.get('/reports/schedules');
    return response.data;
  },

  setScheduleActive: async (frequency, active) => {
    const response = await api.patch(`/reports/schedules/${frequency}`, { active });
    return response.data;
  },

  // Dashboard Widgets
  getDashboardWidgetConfig: async () => {
    const response = await api.get('/reports/dashboard-widgets/config');
    return response.data;
  },

  setDashboardWidgetActive: async (key, active) => {
    const response = await api.patch(`/reports/dashboard-widgets/config/${key}`, { active });
    return response.data;
  },

  reorderDashboardWidgets: async (widgets) => {
    const response = await api.put('/reports/dashboard-widgets/config', { widgets });
    return response.data;
  },

  getDashboardWidgetData: async () => {
    const response = await api.get('/reports/dashboard-widgets/data');
    return response.data;
  },

  // Report Archive
  getArchive: async (params = {}) => {
    const response = await api.get('/reports/archive', { params });
    return response.data;
  },

  getArchiveRun: async (id) => {
    const response = await api.get(`/reports/archive/${id}`);
    return response.data;
  },

  regenerateReport: async (frequency = 'daily') => {
    const response = await api.post('/reports/archive/regenerate', { frequency });
    return response.data;
  },

  deleteArchiveRun: async (id) => {
    const response = await api.delete(`/reports/archive/${id}`);
    return response.data;
  },

  downloadArchiveRun: async (id, format) => {
    const response = await api.get(`/reports/archive/${id}/download`, {
      params: { format },
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : `report-${id}.${format}`;
    const mimeType = format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv';
    const url = URL.createObjectURL(new Blob([response.data], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};

export default reportService;
