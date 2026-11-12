/**
 * AuditLog — Admin-only audit trail viewer
 * Features: paginated table, action/entity/date filtering, login history tab
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Select, MenuItem,
  TextField, Stack, IconButton, Tooltip, CircularProgress,
  Alert, Tabs, Tab, Avatar, alpha, Pagination, FormControl,
  InputLabel,
} from '@mui/material';
import {
  Refresh, FilterList, Login as LoginIcon, Logout as LogoutIcon,
  Add, Edit, Delete, CheckCircle, Cancel, Security,
  VpnKey, History,
} from '@mui/icons-material';
import api from '../services/api';

// ── Types ──────────────────────────────────────────────────────────────────
interface AuditEntry {
  id: number;
  user_id: number | null;
  user_email: string | null;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  entity_label: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  created_at: string;
}

interface LoginHistoryEntry {
  id: number;
  email_attempted: string;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  failure_reason: string | null;
  created_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
const ACTION_CONFIGS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  login:         { label: 'Login',          color: '#10b981', icon: <LoginIcon sx={{ fontSize: 13 }} /> },
  logout:        { label: 'Logout',         color: '#6b7280', icon: <LogoutIcon sx={{ fontSize: 13 }} /> },
  login_failed:  { label: 'Login Failed',   color: '#ef4444', icon: <VpnKey sx={{ fontSize: 13 }} /> },
  create:        { label: 'Create',         color: '#3b82f6', icon: <Add sx={{ fontSize: 13 }} /> },
  update:        { label: 'Update',         color: '#f59e0b', icon: <Edit sx={{ fontSize: 13 }} /> },
  delete:        { label: 'Delete',         color: '#ef4444', icon: <Delete sx={{ fontSize: 13 }} /> },
  approve:       { label: 'Approve',        color: '#10b981', icon: <CheckCircle sx={{ fontSize: 13 }} /> },
  reject:        { label: 'Reject',         color: '#ef4444', icon: <Cancel sx={{ fontSize: 13 }} /> },
  password_reset:{ label: 'Password Reset', color: '#8b5cf6', icon: <Security sx={{ fontSize: 13 }} /> },
  session_revoked:{ label: 'Session Revoked', color: '#f59e0b', icon: <VpnKey sx={{ fontSize: 13 }} /> },
  password_changed:{ label: 'Password Changed', color: '#8b5cf6', icon: <Security sx={{ fontSize: 13 }} /> },
};

function ActionChip({ action }: { action: string }) {
  const cfg = ACTION_CONFIGS[action] ?? { label: action, color: '#6b7280', icon: <History sx={{ fontSize: 13 }} /> };
  return (
    <Chip
      icon={<Box sx={{ color: `${cfg.color} !important`, display: 'flex', ml: '8px !important' }}>{cfg.icon}</Box>}
      label={cfg.label}
      size="small"
      sx={{
        fontSize: 11, fontWeight: 600, height: 24,
        bgcolor: alpha(cfg.color, 0.12), color: cfg.color,
        border: `1px solid ${alpha(cfg.color, 0.25)}`,
        '& .MuiChip-icon': { color: cfg.color },
      }}
    />
  );
}

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function UserCell({ name, email }: { name: string | null; email: string | null }) {
  if (!name && !email) return <Typography variant="caption" color="text.secondary">System</Typography>;
  const initials = (name || email || 'S').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const hue = [...(name || email || '')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Avatar sx={{
        width: 24, height: 24, fontSize: 10, fontWeight: 700,
        background: `linear-gradient(135deg, hsl(${hue},65%,50%), hsl(${(hue + 60) % 360},65%,40%))`,
      }}>{initials}</Avatar>
      <Box>
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, lineHeight: 1.2 }}>{name || '—'}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{email || '—'}</Typography>
      </Box>
    </Stack>
  );
}

// ── Audit Log Tab ─────────────────────────────────────────────────────────
function AuditLogTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 25;

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, any> = { page, page_size: PAGE_SIZE };
      if (filterAction) params.action = filterAction;
      if (filterEntity) params.entity_type = filterEntity;
      if (filterFrom) params.from_date = new Date(filterFrom).toISOString();
      if (filterTo) params.to_date = new Date(filterTo).toISOString();

      const [logsRes, countRes] = await Promise.all([
        api.get('/audit/logs', { params }),
        api.get('/audit/logs/count', { params }),
      ]);
      setEntries(logsRes.data);
      setTotal(countRes.data.total);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterEntity, filterFrom, filterTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <Box>
      {/* Filter Bar */}
      <Box sx={{
        p: 2, mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider',
        bgcolor: 'rgba(255,255,255,0.02)',
      }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <FilterList sx={{ color: 'text.secondary', fontSize: 18 }} />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ fontSize: 12 }}>Action</InputLabel>
            <Select value={filterAction} label="Action" onChange={e => { setFilterAction(e.target.value); setPage(1); }} sx={{ fontSize: 12 }}>
              <MenuItem value="">All</MenuItem>
              {Object.entries(ACTION_CONFIGS).map(([key, cfg]) => (
                <MenuItem key={key} value={key} sx={{ fontSize: 12 }}>{cfg.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel sx={{ fontSize: 12 }}>Entity Type</InputLabel>
            <Select value={filterEntity} label="Entity Type" onChange={e => { setFilterEntity(e.target.value); setPage(1); }} sx={{ fontSize: 12 }}>
              <MenuItem value="">All</MenuItem>
              {['user', 'defect', 'test_case', 'project', 'session', 'release'].map(e => (
                <MenuItem key={e} value={e} sx={{ fontSize: 12 }}>{e}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField size="small" type="date" label="From" value={filterFrom}
            onChange={e => { setFilterFrom(e.target.value); setPage(1); }} InputLabelProps={{ shrink: true }} sx={{ '& input': { fontSize: 12 } }} />
          <TextField size="small" type="date" label="To" value={filterTo}
            onChange={e => { setFilterTo(e.target.value); setPage(1); }} InputLabelProps={{ shrink: true }} sx={{ '& input': { fontSize: 12 } }} />
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={fetchLogs} disabled={loading}>
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
          {total > 0 && (
            <Chip label={`${total.toLocaleString()} entries`} size="small"
              sx={{ fontSize: 11, bgcolor: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }} />
          )}
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} sx={{ color: '#8b5cf6' }} />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5, bgcolor: 'rgba(255,255,255,0.03)' } }}>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Entity</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell>IP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No audit log entries found.
                    </TableCell>
                  </TableRow>
                ) : entries.map(entry => (
                  <TableRow key={entry.id} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.025)' } }}>
                    <TableCell>
                      <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', fontSize: 11 }}>
                        {formatTimestamp(entry.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell><UserCell name={entry.user_name} email={entry.user_email} /></TableCell>
                    <TableCell><ActionChip action={entry.action} /></TableCell>
                    <TableCell>
                      {entry.entity_type ? (
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', textTransform: 'capitalize' }}>
                            {entry.entity_type}
                          </Typography>
                          {entry.entity_label && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                              {entry.entity_label}
                            </Typography>
                          )}
                        </Box>
                      ) : <Typography variant="caption" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 250 }}>
                      {entry.new_values ? (
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 10, color: 'text.secondary', display: 'block',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {JSON.stringify(entry.new_values)}
                        </Typography>
                      ) : <Typography variant="caption" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 10, color: 'text.secondary' }}>
                        {entry.ip_address || '—'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {total > PAGE_SIZE && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination
                count={Math.ceil(total / PAGE_SIZE)} page={page}
                onChange={(_, p) => setPage(p)} size="small"
                sx={{ '& .MuiPaginationItem-root': { fontSize: 12 } }}
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

// ── Login History Tab ─────────────────────────────────────────────────────
function LoginHistoryTab() {
  const [entries, setEntries] = useState<LoginHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { limit: 100 };
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/audit/login-history/all', { params });
      setEntries(res.data);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const statusColor = (s: string) =>
    s === 'success' ? '#10b981' : s === 'failed' ? '#ef4444' : '#f59e0b';

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel sx={{ fontSize: 12 }}>Status</InputLabel>
          <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value)} sx={{ fontSize: 12 }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="success">Success</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
            <MenuItem value="locked">Locked</MenuItem>
          </Select>
        </FormControl>
        <Tooltip title="Refresh"><IconButton size="small" onClick={fetchHistory}><Refresh fontSize="small" /></IconButton></Tooltip>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} sx={{ color: '#8b5cf6' }} />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5, bgcolor: 'rgba(255,255,255,0.03)' } }}>
                <TableCell>Timestamp</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>IP Address</TableCell>
                <TableCell>Browser</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No login history.</TableCell>
                </TableRow>
              ) : entries.map(e => (
                <TableRow key={e.id} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.025)' } }}>
                  <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11 }}>{formatTimestamp(e.created_at)}</Typography></TableCell>
                  <TableCell><Typography variant="caption" sx={{ fontWeight: 500 }}>{e.email_attempted}</Typography></TableCell>
                  <TableCell>
                    <Chip label={e.status} size="small" sx={{
                      fontSize: 10, fontWeight: 700, height: 20,
                      bgcolor: alpha(statusColor(e.status), 0.12),
                      color: statusColor(e.status),
                    }} />
                  </TableCell>
                  <TableCell><Typography variant="caption" color="text.secondary">{e.failure_reason || '—'}</Typography></TableCell>
                  <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 10 }}>{e.ip_address || '—'}</Typography></TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.user_agent ? e.user_agent.substring(0, 60) + '…' : '—'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

// ── Main AuditLog Page ────────────────────────────────────────────────────
const AuditLog: React.FC = () => {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
        }}>
          <History sx={{ fontSize: 18, color: '#fff' }} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={700}>Audit Trail</Typography>
          <Typography variant="caption" color="text.secondary">
            Immutable log of all significant platform events
          </Typography>
        </Box>
      </Stack>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
        mb: 3, borderBottom: '1px solid', borderColor: 'divider',
        '& .MuiTab-root': { fontSize: 13, fontWeight: 600, textTransform: 'none', minHeight: 44 },
      }}>
        <Tab label="Audit Logs" icon={<History sx={{ fontSize: 16 }} />} iconPosition="start" />
        <Tab label="Login History" icon={<LoginIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
      </Tabs>

      {tab === 0 && <AuditLogTab />}
      {tab === 1 && <LoginHistoryTab />}
    </Box>
  );
};

export default AuditLog;
