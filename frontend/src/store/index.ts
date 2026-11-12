import { configureStore as createStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import filterReducer from './filterSlice';
import themeReducer from './themeSlice';

export const store = createStore({
  reducer: {
    auth: authReducer,
    filters: filterReducer,
    theme: themeReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
