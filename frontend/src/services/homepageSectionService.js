import api from './api';

const homepageSectionService = {
  getSections: async () => {
    const response = await api.get('/homepage-sections');
    return response.data;
  },

  setSectionActive: async (key, active) => {
    const response = await api.patch(`/homepage-sections/${key}`, { active });
    return response.data;
  },

  reorderSections: async (sections) => {
    const response = await api.put('/homepage-sections', { sections });
    return response.data;
  },
};

export default homepageSectionService;
