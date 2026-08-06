import api from './api';

// Settings > Integrations — read-only connection status, never a value.
const integrationsService = {
  getStatus: async () => {
    const response = await api.get('/admin/integrations/status');
    return response.data;
  },
};

export default integrationsService;
