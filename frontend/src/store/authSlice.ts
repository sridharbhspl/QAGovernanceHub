import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  company_id?: number | null;
  group_id?: number | null;
  mfa_enabled?: boolean;
  last_login?: string | null;
  project_roles?: Record<number, string>;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  permissions: string[];
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
  permissions: localStorage.getItem('permissions')
    ? JSON.parse(localStorage.getItem('permissions')!)
    : [],
  isAuthenticated: !!localStorage.getItem('token'),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{
        token: string;
        refreshToken: string;
        user: User;
        permissions?: string[];
      }>,
    ) {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;
      state.permissions = action.payload.permissions ?? [];
      state.isAuthenticated = true;

      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('refreshToken', action.payload.refreshToken);
      localStorage.setItem('user', JSON.stringify(action.payload.user));
      localStorage.setItem('permissions', JSON.stringify(action.payload.permissions ?? []));
    },

    updateToken(state, action: PayloadAction<{ token: string; refreshToken?: string }>) {
      // Called by the refresh interceptor when tokens are silently rotated
      state.token = action.payload.token;
      localStorage.setItem('token', action.payload.token);
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
        localStorage.setItem('refreshToken', action.payload.refreshToken);
      }
    },

    logout(state) {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      state.permissions = [];
      state.isAuthenticated = false;

      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('permissions');
    },
  },
});

export const { setCredentials, updateToken, logout } = authSlice.actions;
export default authSlice.reducer;
