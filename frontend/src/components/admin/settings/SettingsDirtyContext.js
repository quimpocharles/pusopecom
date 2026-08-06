import { createContext, useContext } from 'react';

// Lets a category page report "I have unsaved changes" up to SettingsLayout,
// which uses it for both the in-app nav guard (clicking another category
// while dirty) and the tab-close/refresh warning — without every page
// needing its own copy of that logic.
const SettingsDirtyContext = createContext({ isDirty: false, setIsDirty: () => {} });

export const useSettingsDirty = () => useContext(SettingsDirtyContext);

export default SettingsDirtyContext;
