import api from './api';

// Settings > Security > Roles & Permissions — the first frontend consumer
// of StaffProfile; the model and backend repository existed since the
// Enterprise Fulfillment Blueprint with no route wired to either.
const staffService = {
  getStaff: async () => {
    const response = await api.get('/admin/staff');
    return response.data;
  },

  updateStaff: async (userId, data) => {
    const response = await api.patch(`/admin/staff/${userId}`, data);
    return response.data;
  },

  // The permission vocabulary + department defaults, served from
  // backend/lib/permissions.js — never hardcoded here, so this page can't
  // drift from what requirePermission() actually enforces.
  getPermissionVocabulary: async () => {
    const response = await api.get('/admin/staff/permissions');
    return response.data;
  },
};

export default staffService;
