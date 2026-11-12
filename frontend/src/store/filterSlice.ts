import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface FilterState {
  groupId: number | null;
  companyId: number | null;
  projectId: number | null;
  applicationId: number | null;
  releaseId: number | null;
  sprintId: number | null;
  groupName: string | null;
  companyName: string | null;
  projectName: string | null;
  applicationName: string | null;
  releaseName: string | null;
  sprintName: string | null;
}

const initialState: FilterState = {
  groupId: null,
  companyId: null,
  projectId: null,
  applicationId: null,
  releaseId: null,
  sprintId: null,
  groupName: null,
  companyName: null,
  projectName: null,
  applicationName: null,
  releaseName: null,
  sprintName: null,
};

const filterSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setFilter(state, action: PayloadAction<Partial<FilterState>>) {
      return { ...state, ...action.payload };
    },
    resetFilters() {
      return initialState;
    },
  },
});

export const { setFilter, resetFilters } = filterSlice.actions;
export default filterSlice.reducer;
