import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Container, Box, Card, Typography, TextField, Button,
  Alert, InputAdornment, IconButton, CircularProgress,
  FormControlLabel, Checkbox, Link, Divider, Dialog,
  DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { Email, Lock, Visibility, VisibilityOff, LockReset, CheckCircle } from '@mui/icons-material';
import api from '../services/api';
import logo from '../assets/logo.png';
import { setCredentials } from '../store/authSlice';
import { RootState } from '../store';

// ── Forgot Password Dialog ─────────────────────────────────────────────────
const ForgotPasswordDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [step, setStep] = useState<'email' | 'token'>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleClose = () => {
    setStep('email'); setEmail(''); setToken(''); setNewPassword('');
    setError(null); setDevToken(null); setSuccess(false);
    onClose();
  };

  const handleRequestReset = async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.post('/auth/reset-password', { email });
      if (res.data.dev_token) setDevToken(res.data.dev_token);
      setStep('token');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send reset request.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    setLoading(true); setError(null);
    try {
      await api.post('/auth/reset-password/confirm', { email, token, new_password: newPassword });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Reset failed. Token may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth PaperProps={{
      sx: { borderRadius: 3, background: 'linear-gradient(145deg, #1e1b4b 0%, #1a1a2e 100%)', border: '1px solid rgba(139,92,246,0.2)' }
    }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockReset sx={{ color: '#8b5cf6' }} />
          <Typography variant="h6" fontWeight={700}>Reset Password</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {success ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CheckCircle sx={{ fontSize: 56, color: '#10b981', mb: 2 }} />
            <Typography fontWeight={600} sx={{ mb: 1 }}>Password Reset Successful!</Typography>
            <Typography variant="body2" color="text.secondary">
              Your password has been updated. Please log in with your new password.
            </Typography>
          </Box>
        ) : step === 'email' ? (
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter your registered email. We'll send you a reset token.
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField fullWidth label="Email Address" type="email" value={email}
              onChange={e => setEmail(e.target.value)} autoFocus size="small"
              InputProps={{ startAdornment: <InputAdornment position="start"><Email sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment> }} />
          </Box>
        ) : (
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter the reset token sent to <strong>{email}</strong> and your new password.
            </Typography>
            {devToken && (
              <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 0.5 }}>
                  DEV MODE — Token (copy below):
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {devToken}
                </Typography>
              </Alert>
            )}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField fullWidth label="Reset Token" value={token} onChange={e => setToken(e.target.value)}
              sx={{ mb: 2 }} size="small" multiline rows={2} />
            <TextField fullWidth label="New Password" type="password" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} size="small"
              helperText="Min 8 characters, 1 uppercase, 1 number" />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        {success ? (
          <Button fullWidth variant="contained" onClick={handleClose}
            sx={{ background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}>
            Back to Login
          </Button>
        ) : step === 'email' ? (
          <>
            <Button onClick={handleClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
            <Button variant="contained" onClick={handleRequestReset} disabled={!email || loading}
              sx={{ background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}>
              {loading ? <CircularProgress size={18} color="inherit" /> : 'Send Reset Token'}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setStep('email')} sx={{ color: 'text.secondary' }}>Back</Button>
            <Button variant="contained" onClick={handleConfirmReset}
              disabled={!token || !newPassword || loading}
              sx={{ background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}>
              {loading ? <CircularProgress size={18} color="inherit" /> : 'Reset Password'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

// ── Login Page ────────────────────────────────────────────────────────────────
const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Step 1: Get access + refresh tokens
      const loginRes = await api.post('/auth/login', { email, password, remember_me: rememberMe });
      const { access_token, refresh_token } = loginRes.data;

      // Step 2: Fetch full profile (includes permissions)
      const profileRes = await api.get('/auth/profile', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      dispatch(setCredentials({
        token: access_token,
        refreshToken: refresh_token,
        user: profileRes.data,
        permissions: profileRes.data.permissions ?? [],
      }));

      navigate('/dashboard');
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 423) {
        setError('Account temporarily locked due to too many failed attempts. Please try again later.');
      } else {
        setError(
          err.response?.data?.detail ||
          'Could not authenticate. Check network connection or credentials.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Box sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: 'radial-gradient(circle at 10% 20%, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 90%)',
      }}>
        <Container maxWidth="sm">
          <Card sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: { xs: 4, sm: 6 } }}>
            <Box
              component="img" src={logo} alt="QA Hub Logo"
              sx={{
                height: 170, mb: 3,
                filter: 'drop-shadow(0 0 20px rgba(139, 92, 246, 0.3))',
                transition: 'transform 0.3s ease-in-out',
                '&:hover': { transform: 'scale(1.05)' },
              }}
            />
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }} align="center">
              Sign in to manage projects, track defects, and export metrics reports.
            </Typography>

            {error && <Alert severity="error" sx={{ width: '100%', mb: 3 }}>{error}</Alert>}

            <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
              <TextField
                margin="normal" required fullWidth id="email"
                label="Email Address" name="email" autoComplete="email" autoFocus
                value={email} onChange={e => setEmail(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              <TextField
                margin="normal" required fullWidth name="password"
                label="Password" type={showPassword ? 'text' : 'password'} id="password"
                autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />

              {/* Remember me + Forgot password row */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      size="small"
                      sx={{ color: 'rgba(139,92,246,0.6)', '&.Mui-checked': { color: '#8b5cf6' } }}
                    />
                  }
                  label={<Typography variant="caption" color="text.secondary">Remember me (90 days)</Typography>}
                />
                <Link
                  component="button"
                  type="button"
                  variant="caption"
                  onClick={() => setForgotOpen(true)}
                  sx={{ color: '#8b5cf6', cursor: 'pointer', '&:hover': { color: '#a78bfa' } }}
                >
                  Forgot password?
                </Link>
              </Box>

              <Button
                type="submit" fullWidth variant="contained" color="primary"
                disabled={loading}
                sx={{
                  py: 1.5, fontSize: '1rem',
                  background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)',
                  '&:hover': { background: 'linear-gradient(90deg, #2563eb 0%, #7c3aed 100%)' },
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
              </Button>
            </Box>

            <Divider sx={{ width: '100%', mt: 4, mb: 2 }} />
            <Typography variant="caption" color="text.secondary" align="center">
              QA &amp; Governance Hub · Phase 0 · Protected by JWT + Refresh Tokens
            </Typography>
          </Card>
        </Container>
      </Box>

      <ForgotPasswordDialog open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </>
  );
};

export default Login;
