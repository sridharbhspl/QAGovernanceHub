import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ThemePresetId =
  | 'dark-navy'
  | 'purple-galaxy'
  | 'ocean-blue'
  | 'forest-green'
  | 'crimson-red'
  | 'slate-pro'
  | 'amber-gold';

interface ThemeState {
  presetId: ThemePresetId;
}

const initialState: ThemeState = {
  presetId: (localStorage.getItem('themePreset') as ThemePresetId) || 'dark-navy',
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setThemePreset(state, action: PayloadAction<ThemePresetId>) {
      state.presetId = action.payload;
      localStorage.setItem('themePreset', action.payload);
    },
  },
});

export const { setThemePreset } = themeSlice.actions;
export default themeSlice.reducer;
