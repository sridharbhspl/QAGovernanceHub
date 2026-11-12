import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem, Grid, Card, Stack,
  Chip, Divider, CircularProgress, IconButton, Tabs, Tab, Alert, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Drawer, Avatar, Stepper, Step, StepLabel, StepConnector, stepConnectorClasses,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Add, EditOutlined, DeleteOutline, Close, KeyboardArrowRight,
  CheckCircle, HourglassEmpty, ThumbUp, Build, VerifiedUser,
  Cancel, PauseCircle, ArrowForward, Comment, History,
  Assignment, TrendingUp, Warning,
  Send, Error as ErrorIcon,
} from '@mui/icons-material';

import { RootState } from '../store';
import api from '../services/api';
import { getPreset } from '../theme/theme';
import { usePermission } from '../hooks/usePermission';

/* ══════════════════════════════════════════════════════════
   CONSTANTS & LOOKUP MAPS
   ══════════════════════════════════════════════════════════ */
const CR_WORKFLOW_STAGES = ['Requested', 'Reviewed', 'Approved', 'Implemented', 'Verified'];

const CR_TERMINAL_STATES = ['Verified', 'Cancelled'];

const WORKFLOW_TRANSITIONS: Record<string, string[]> = {
  Requested:   ['Reviewed', 'On Hold', 'Rejected', 'Cancelled'],
  Reviewed:    ['Approved', 'Rejected', 'On Hold', 'Requested'],
  Approved:    ['Implemented', 'On Hold', 'Cancelled'],
  Implemented: ['Verified', 'Approved'],
  Verified:    [],
  Rejected:    ['Requested'],
  'On Hold':   ['Requested', 'Cancelled'],
  Cancelled:   [],
};

const APPROVE_REQUIRED = new Set(['Approved', 'Rejected', 'Verified', 'Cancelled']);

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const CATEGORIES = ['Functional', 'Non-Functional', 'UI/UX', 'Performance', 'Security', 'Infrastructure', 'Regulatory'];
const CHANGE_TYPES = ['Enhancement', 'Bug Fix', 'New Feature', 'Configuration', 'Process', 'Regulatory'];
const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'];
const ALL_STATUSES = [...CR_WORKFLOW_STAGES, 'Rejected', 'On Hold', 'Cancelled'];

const priorityColor: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  Low: 'success', Medium: 'info', High: 'warning', Critical: 'error',
};

const riskColor: Record<string, string> = {
  Low: '#10b981', Medium: '#f59e0b', High: '#f97316', Critical: '#ef4444',
};

const statusMeta: Record<string, { color: string; icon: React.ReactNode; bg: string }> = {
  Requested:   { color: '#6366f1', icon: <Assignment sx={{ fontSize: 14 }} />, bg: 'rgba(99,102,241,0.15)' },
  Reviewed:    { color: '#06b6d4', icon: <HourglassEmpty sx={{ fontSize: 14 }} />, bg: 'rgba(6,182,212,0.15)' },
  Approved:    { color: '#10b981', icon: <ThumbUp sx={{ fontSize: 14 }} />, bg: 'rgba(16,185,129,0.15)' },
  Implemented: { color: '#8b5cf6', icon: <Build sx={{ fontSize: 14 }} />, bg: 'rgba(139,92,246,0.15)' },
  Verified:    { color: '#22d3ee', icon: <VerifiedUser sx={{ fontSize: 14 }} />, bg: 'rgba(34,211,238,0.15)' },
  Rejected:    { color: '#ef4444', icon: <Cancel sx={{ fontSize: 14 }} />, bg: 'rgba(239,68,68,0.15)' },
  'On Hold':   { color: '#f59e0b', icon: <PauseCircle sx={{ fontSize: 14 }} />, bg: 'rgba(245,158,11,0.15)' },
  Cancelled:   { color: '#6b7280', icon: <ErrorIcon sx={{ fontSize: 14 }} />, bg: 'rgba(107,114,128,0.15)' },
};

/* ══════════════════════════════════════════════════════════
   STYLED STEPPER FOR WORKFLOW VISUALIZATION
   ══════════════════════════════════════════════════════════ */
const WorkflowConnector = styled(StepConnector)(({ theme: _theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: { top: 16 },
  [`& .${stepConnectorClasses.line}`]: {
    height: 3, border: 0, borderRadius: 1,
    backgroundImage: 'linear-gradient(90deg, rgba(99,102,241,0.3) 0%, rgba(139,92,246,0.3) 100%)',
  },
  [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
    backgroundImage: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
  },
  [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
    backgroundImage: 'linear-gradient(90deg, #6366f1, rgba(139,92,246,0.5))',
  },
}));

const WorkflowStepIcon = ({ icon, active, completed }: any) => {
  const icons: Record<number, React.ReactNode> = {
    1: <Assignment sx={{ fontSize: 18 }} />,
    2: <HourglassEmpty sx={{ fontSize: 18 }} />,
    3: <ThumbUp sx={{ fontSize: 18 }} />,
    4: <Build sx={{ fontSize: 18 }} />,
    5: <VerifiedUser sx={{ fontSize: 18 }} />,
  };
  return (
    <Box sx={{
      width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: completed
        ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
        : active
          ? 'linear-gradient(135deg, rgba(99,102,241,0.5), rgba(139,92,246,0.5))'
          : 'rgba(255,255,255,0.06)',
      border: active ? '2px solid #6366f1' : completed ? '2px solid #8b5cf6' : '2px solid rgba(255,255,255,0.1)',
      color: completed || active ? '#fff' : 'rgba(255,255,255,0.3)',
      transition: 'all 0.3s',
    }}>
      {icons[String(icon) as unknown as number]}
    </Box>
  );
};

/* ══════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════ */
const initials = (name: string) =>
  name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

const avatarGradient = (name: string) => {
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `linear-gradient(135deg, hsl(${hue},65%,50%), hsl(${(hue + 60) % 360},65%,40%))`;
};

const formatDate = (dt: string | null | undefined) => {
  if (!dt) return '-';
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const MetricCard = ({ label, value, color, icon }: { label: string; value: any; color: string; icon: React.ReactNode }) => (
  <Card sx={{
    background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 4, p: 3,
    boxShadow: '0 8px 32px 0 rgba(0,0,0,0.3)',
    transition: 'transform 0.2s',
    '&:hover': { transform: 'translateY(-2px)' },
  }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
        <Typography variant="h3" sx={{ fontFamily: 'Outfit', fontWeight: 800, mt: 0.5, color }}>
          {value}
        </Typography>
      </Box>
      <Box sx={{
        width: 48, height: 48, borderRadius: 3,
        background: `${color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color,
      }}>
        {icon}
      </Box>
    </Stack>
  </Card>
);

const StatusChip = ({ status }: { status: string }) => {
  const meta = statusMeta[status] || { color: '#6b7280', icon: null, bg: 'rgba(107,114,128,0.15)' };
  return (
    <Chip
      icon={meta.icon as any}
      label={status}
      size="small"
      sx={{
        bgcolor: meta.bg, color: meta.color,
        fontWeight: 700, fontSize: 11,
        '& .MuiChip-icon': { color: meta.color },
      }}
    />
  );
};

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════ */
const ChangeRequests: React.FC = () => {
  const queryClient = useQueryClient();
  const filters = useSelector((state: RootState) => state.filters);
  const presetId = useSelector((state: RootState) => state.theme.presetId);
  const preset = getPreset(presetId);

  const canCreate = usePermission('create');
  const canUpdate = usePermission('update');
  const canDelete = usePermission('delete');
  const canApprove = usePermission('approve');

  const projectId = filters.projectId;

  /* ── Local UI State ── */
  const [activeTab, setActiveTab] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCR, setEditingCR] = useState<any | null>(null);
  const [selectedCR, setSelectedCR] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [transitionDialog, setTransitionDialog] = useState<{ open: boolean; toStatus: string; notes: string; rejectionReason: string }>({
    open: false, toStatus: '', notes: '', rejectionReason: '',
  });
  const [newComment, setNewComment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const emptyForm = {
    cr_id: '', title: '', description: '', justification: '',
    impact_analysis: '', implementation_plan: '', rollback_plan: '', test_plan: '',
    category: 'Functional', priority: 'Medium', change_type: 'Enhancement',
    risk_level: 'Low', estimated_effort: '', target_version: '',
    application_id: '' as number | '', sprint_id: '' as number | '',
    release_id: '' as number | '', assigned_to_id: '' as number | '',
    target_date: '',
  };
  const [form, setForm] = useState({ ...emptyForm });

  /* ── Data Queries ── */
  const { data: projectList = [] } = useQuery({
    queryKey: ['projects', filters.companyId],
    queryFn: async () => (await api.get(`/org/projects?company_id=${filters.companyId}`)).data,
    enabled: !!filters.companyId,
  });
  const currentProject = (projectList as any[]).find((p: any) => p.id === projectId);
  const projectCode = currentProject?.code || 'PROJ';

  const { data: crs = [], isLoading } = useQuery({
    queryKey: ['change-requests', projectId],
    queryFn: async () => {
      const res = await api.get('/change-requests', { params: { project_id: projectId } });
      return res.data;
    },
    enabled: !!projectId,
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: async () => (await api.get(`/work/sprints?project_id=${projectId}`)).data,
    enabled: !!projectId,
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['applications', projectId],
    queryFn: async () => (await api.get(`/org/applications?project_id=${projectId}`)).data,
    enabled: !!projectId,
  });

  const { data: releases = [] } = useQuery({
    queryKey: ['releases', projectId],
    queryFn: async () => (await api.get(`/work/releases?project_id=${projectId}`)).data,
    enabled: !!projectId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['project-users', projectId],
    queryFn: async () => {
      try {
        const res = await api.get(`/org/team-mappings?project_id=${projectId}`);
        if (res.data?.length > 0) return res.data.map((m: any) => m.user).filter(Boolean);
      } catch { }
      return (await api.get('/org/users')).data;
    },
    enabled: !!projectId,
  });

  /* ── Full CR detail (with comments & history) ── */
  const { data: crDetail, refetch: refetchDetail } = useQuery({
    queryKey: ['cr-detail', selectedCR?.id],
    queryFn: async () => (await api.get(`/change-requests/${selectedCR.id}`)).data,
    enabled: !!selectedCR?.id,
  });

  /* ── Mutations ── */
  const createMut = useMutation({
    mutationFn: (body: any) => api.post('/change-requests', body).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['change-requests'] }); setIsFormOpen(false); resetForm(); },
    onError: (e: any) => setFormError(e?.response?.data?.detail || 'Failed to create Change Request.'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => api.put(`/change-requests/${id}`, body).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['change-requests'] });
      setIsFormOpen(false); setEditingCR(null); resetForm();
      if (selectedCR?.id === data.id) { setSelectedCR(data); refetchDetail(); }
    },
    onError: (e: any) => setFormError(e?.response?.data?.detail || 'Failed to update Change Request.'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/change-requests/${id}`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-requests'] });
      setIsDetailOpen(false); setSelectedCR(null);
    },
  });

  const transitionMut = useMutation({
    mutationFn: ({ id, toStatus, notes, rejectionReason }: any) =>
      api.post(`/change-requests/${id}/transition`, {
        to_status: toStatus,
        notes,
        rejection_reason: rejectionReason || undefined,
      }).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['cr-detail', data.id] });
      setSelectedCR(data);
      refetchDetail();
      setTransitionDialog({ open: false, toStatus: '', notes: '', rejectionReason: '' });
    },
    onError: (e: any) => setFormError(e?.response?.data?.detail || 'Transition failed.'),
  });

  const commentMut = useMutation({
    mutationFn: ({ crId, comment }: { crId: number; comment: string }) =>
      api.post(`/change-requests/${crId}/comments`, { cr_db_id: crId, comment }).then(r => r.data),
    onSuccess: () => { setNewComment(''); refetchDetail(); },
  });

  /* ── Form Helpers ── */
  const resetForm = () => {
    setForm({ ...emptyForm });
    setFormError(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setEditingCR(null);
    const nextNum = (crs as any[]).length + 1;
    setForm(p => ({ ...p, cr_id: `CR-${projectCode}-${String(nextNum).padStart(3, '0')}` }));
    setIsFormOpen(true);
  };

  const handleOpenEdit = (cr: any) => {
    setForm({
      cr_id: cr.cr_id,
      title: cr.title,
      description: cr.description || '',
      justification: cr.justification || '',
      impact_analysis: cr.impact_analysis || '',
      implementation_plan: cr.implementation_plan || '',
      rollback_plan: cr.rollback_plan || '',
      test_plan: cr.test_plan || '',
      category: cr.category,
      priority: cr.priority,
      change_type: cr.change_type,
      risk_level: cr.risk_level,
      estimated_effort: cr.estimated_effort || '',
      target_version: cr.target_version || '',
      application_id: cr.application_id || '',
      sprint_id: cr.sprint_id || '',
      release_id: cr.release_id || '',
      assigned_to_id: cr.assigned_to_id || '',
      target_date: cr.target_date ? cr.target_date.split('T')[0] : '',
    });
    setEditingCR(cr);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const payload = {
      ...form,
      project_id: projectId,
      application_id: form.application_id || null,
      sprint_id: form.sprint_id || null,
      release_id: form.release_id || null,
      assigned_to_id: form.assigned_to_id || null,
      target_date: form.target_date ? new Date(form.target_date).toISOString() : null,
    };
    if (editingCR) {
      updateMut.mutate({ id: editingCR.id, body: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  /* ── Derived Metrics ── */
  const crList = crs as any[];
  const totalCRs = crList.length;
  const openCRs = crList.filter(c => !['Verified', 'Cancelled', 'Rejected'].includes(c.status)).length;
  const approvedCRs = crList.filter(c => ['Approved', 'Implemented', 'Verified'].includes(c.status)).length;
  const highRisk = crList.filter(c => ['High', 'Critical'].includes(c.risk_level)).length;

  /* ── Filtered list ── */
  const filteredCRs = crList.filter(c => {
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchPriority = filterPriority === 'all' || c.priority === filterPriority;
    const matchRisk = filterRisk === 'all' || c.risk_level === filterRisk;
    return matchStatus && matchPriority && matchRisk;
  });

  /* ── Kanban grouped view ── */
  const kanbanColumns = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = crList.filter(c => c.status === s);
    return acc;
  }, {} as Record<string, any[]>);

  /* ── Workflow step index ── */
  const getWorkflowStep = (status: string) => CR_WORKFLOW_STAGES.indexOf(status);

  /* ══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */
  return (
    <Box>
      {/* PAGE HEADER */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: 'Outfit', fontWeight: 800 }}>
            Change Request Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Track, review, approve and implement change requests through a governed workflow.
          </Typography>
        </Box>
        {projectId && canCreate && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenCreate}
            sx={{ background: 'linear-gradient(90deg,#6366f1,#a855f7)', borderRadius: 2, px: 3 }}
          >
            Raise Change Request
          </Button>
        )}
      </Stack>

      {!projectId ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Please select a Project from the toolbar to load its Change Requests.
        </Alert>
      ) : (
        <Stack spacing={4}>
          {/* ── METRIC WIDGETS ── */}
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard label="Total CRs" value={isLoading ? '…' : totalCRs}
                color="#6366f1" icon={<Assignment fontSize="medium" />} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard label="Open / Active" value={isLoading ? '…' : openCRs}
                color="#06b6d4" icon={<HourglassEmpty fontSize="medium" />} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard label="Approved" value={isLoading ? '…' : approvedCRs}
                color="#10b981" icon={<CheckCircle fontSize="medium" />} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard label="High / Critical Risk" value={isLoading ? '…' : highRisk}
                color="#ef4444" icon={<Warning fontSize="medium" />} />
            </Grid>
          </Grid>

          {/* ── TABS ── */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} textColor="primary" indicatorColor="primary">
              <Tab label="List View" icon={<Assignment fontSize="small" />} iconPosition="start" />
              <Tab label="Kanban Pipeline" icon={<TrendingUp fontSize="small" />} iconPosition="start" />
            </Tabs>
          </Box>

          {/* ── FILTERS ── */}
          <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ gap: 1.5 }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value)}>
                <MenuItem value="all">All Statuses</MenuItem>
                {ALL_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Priority</InputLabel>
              <Select value={filterPriority} label="Priority" onChange={e => setFilterPriority(e.target.value)}>
                <MenuItem value="all">All Priorities</MenuItem>
                {PRIORITIES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Risk Level</InputLabel>
              <Select value={filterRisk} label="Risk Level" onChange={e => setFilterRisk(e.target.value)}>
                <MenuItem value="all">All Risk Levels</MenuItem>
                {RISK_LEVELS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>

          {/* ══ TAB 0: LIST VIEW ══ */}
          {activeTab === 0 && (
            isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
            ) : filteredCRs.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                No Change Requests found. {canCreate && 'Click "Raise Change Request" to create one.'}
              </Alert>
            ) : (
              <TableContainer component={Paper} sx={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4, background: 'rgba(255,255,255,0.01)' }}>
                <Table>
                  <TableHead sx={{ backgroundColor: 'background.paper' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>CR ID</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Risk</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Raised By</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Target Date</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: 60 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredCRs.map((cr: any) => (
                      <TableRow
                        key={cr.id} hover
                        onClick={() => { setSelectedCR(cr); setIsDetailOpen(true); }}
                        sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: preset.primary }}>
                            {cr.cr_id}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, maxWidth: 260 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{cr.title}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={cr.category} size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.1)', fontSize: 11 }} />
                        </TableCell>
                        <TableCell>
                          <Chip label={cr.priority} color={priorityColor[cr.priority] || 'default'} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={cr.risk_level} size="small"
                            sx={{ bgcolor: `${riskColor[cr.risk_level]}22`, color: riskColor[cr.risk_level], fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell><StatusChip status={cr.status} /></TableCell>
                        <TableCell>
                          {cr.requested_by ? (
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Avatar sx={{ width: 22, height: 22, fontSize: 9, fontWeight: 700, background: avatarGradient(cr.requested_by.full_name) }}>
                                {initials(cr.requested_by.full_name)}
                              </Avatar>
                              <Typography variant="caption">{cr.requested_by.full_name}</Typography>
                            </Stack>
                          ) : <Typography variant="caption" color="text.secondary">-</Typography>}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">{formatDate(cr.target_date)}</Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton size="small"><KeyboardArrowRight /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )
          )}

          {/* ══ TAB 1: KANBAN PIPELINE ══ */}
          {activeTab === 1 && (
            <Box sx={{ overflowX: 'auto', pb: 2 }}>
              <Stack direction="row" spacing={2} sx={{ minWidth: 1100 }}>
                {ALL_STATUSES.map(colStatus => {
                  const meta = statusMeta[colStatus] || { color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
                  const items = kanbanColumns[colStatus] || [];
                  return (
                    <Box key={colStatus} sx={{ flex: '0 0 200px', minWidth: 200 }}>
                      {/* Column header */}
                      <Box sx={{
                        px: 1.5, py: 1, mb: 1.5, borderRadius: 2,
                        background: meta.bg, border: `1px solid ${meta.color}33`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ color: meta.color }}>{(statusMeta[colStatus] as any)?.icon}</Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: meta.color, fontSize: 11 }}>
                            {colStatus}
                          </Typography>
                        </Stack>
                        <Chip label={items.length} size="small" sx={{ bgcolor: `${meta.color}22`, color: meta.color, fontWeight: 700, height: 18, fontSize: 10 }} />
                      </Box>
                      {/* Cards */}
                      <Stack spacing={1.5}>
                        {items.map((cr: any) => (
                          <Card
                            key={cr.id}
                            onClick={() => { setSelectedCR(cr); setIsDetailOpen(true); }}
                            sx={{
                              p: 1.5, cursor: 'pointer', borderRadius: 3,
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.06)',
                              transition: 'all 0.2s',
                              '&:hover': { background: 'rgba(255,255,255,0.06)', borderColor: preset.primary + '44', transform: 'translateY(-1px)' },
                            }}
                          >
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: preset.primary, fontWeight: 700 }}>
                              {cr.cr_id}
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600, mt: 0.5, lineHeight: 1.3 }}>
                              {cr.title.length > 60 ? cr.title.slice(0, 57) + '…' : cr.title}
                            </Typography>
                            <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                              <Chip label={cr.priority} color={priorityColor[cr.priority] || 'default'} size="small" variant="outlined" sx={{ height: 16, fontSize: 9 }} />
                              <Chip label={cr.risk_level} size="small"
                                sx={{ height: 16, fontSize: 9, bgcolor: `${riskColor[cr.risk_level]}22`, color: riskColor[cr.risk_level], fontWeight: 700 }} />
                            </Stack>
                          </Card>
                        ))}
                        {items.length === 0 && (
                          <Box sx={{ py: 3, textAlign: 'center', opacity: 0.3 }}>
                            <Typography variant="caption" color="text.secondary">Empty</Typography>
                          </Box>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          )}
        </Stack>
      )}

      {/* ══════════════════════════════════════════════
          DETAIL DRAWER
          ══════════════════════════════════════════════ */}
      <Drawer
        anchor="right" open={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setSelectedCR(null); }}
        PaperProps={{ sx: { width: { xs: '100%', md: 680 }, background: 'rgba(13,13,23,0.98)', borderLeft: '1px solid rgba(255,255,255,0.06)' } }}
      >
        {selectedCR && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Drawer header */}
            <Box sx={{
              px: 3, py: 2, borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.04))',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            }}>
              <Box>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: preset.primary, fontWeight: 700 }}>
                  {selectedCR.cr_id}
                </Typography>
                <Typography variant="h6" sx={{ fontFamily: 'Outfit', fontWeight: 700, mt: 0.3, lineHeight: 1.2 }}>
                  {selectedCR.title}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <StatusChip status={crDetail?.status || selectedCR.status} />
                  <Chip label={selectedCR.priority} color={priorityColor[selectedCR.priority] || 'default'} size="small" variant="outlined" />
                  <Chip label={selectedCR.risk_level} size="small"
                    sx={{ bgcolor: `${riskColor[selectedCR.risk_level]}22`, color: riskColor[selectedCR.risk_level], fontWeight: 700 }} />
                </Stack>
              </Box>
              <Stack direction="row" spacing={0.5}>
                {canUpdate && (
                  <Tooltip title="Edit CR">
                    <IconButton size="small" onClick={() => handleOpenEdit(selectedCR)}><EditOutlined fontSize="small" /></IconButton>
                  </Tooltip>
                )}
                {canDelete && (
                  <Tooltip title="Delete CR">
                    <IconButton size="small" color="error" onClick={() => deleteMut.mutate(selectedCR.id)}>
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <IconButton size="small" onClick={() => { setIsDetailOpen(false); setSelectedCR(null); }}>
                  <Close fontSize="small" />
                </IconButton>
              </Stack>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2,
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
            }}>
              {/* ── WORKFLOW STEPPER ── */}
              {(() => {
                const currentStatus = crDetail?.status || selectedCR.status;
                const stepIdx = getWorkflowStep(currentStatus);
                const isTerminal = CR_TERMINAL_STATES.includes(currentStatus);
                const isOffFlow = !CR_WORKFLOW_STAGES.includes(currentStatus); // Rejected / On Hold / Cancelled

                return (
                  <Card sx={{ mb: 3, p: 2.5, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 3 }}>
                    {isOffFlow ? (
                      <Stack alignItems="center" spacing={1}>
                        <StatusChip status={currentStatus} />
                        {crDetail?.rejection_reason && (
                          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 1 }}>
                            Reason: {crDetail.rejection_reason}
                          </Typography>
                        )}
                      </Stack>
                    ) : (
                      <Stepper alternativeLabel activeStep={stepIdx < 0 ? 0 : stepIdx} connector={<WorkflowConnector />}>
                        {CR_WORKFLOW_STAGES.map((label, idx) => (
                          <Step key={label} completed={stepIdx > idx}>
                            <StepLabel StepIconComponent={(props) =>
                              <WorkflowStepIcon {...props} icon={idx + 1} />
                            }>
                              <Typography variant="caption" sx={{ fontSize: 10, fontWeight: stepIdx === idx ? 700 : 400 }}>
                                {label}
                              </Typography>
                            </StepLabel>
                          </Step>
                        ))}
                      </Stepper>
                    )}

                    {/* Transition buttons */}
                    {!isTerminal && (
                      <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" sx={{ mt: 2, gap: 1 }}>
                        {(WORKFLOW_TRANSITIONS[currentStatus] || []).map((nextStatus: string) => {
                          const needsApprove = APPROVE_REQUIRED.has(nextStatus);
                          const disabled = needsApprove ? !canApprove : !canUpdate;
                          const meta = statusMeta[nextStatus];
                          return (
                            <Button
                              key={nextStatus}
                              size="small"
                              variant="outlined"
                              disabled={disabled}
                              startIcon={nextStatus === 'Rejected' ? <Cancel /> : nextStatus === 'On Hold' ? <PauseCircle /> : <ArrowForward />}
                              onClick={() => setTransitionDialog({ open: true, toStatus: nextStatus, notes: '', rejectionReason: '' })}
                              sx={{
                                borderColor: meta?.color + '55',
                                color: meta?.color,
                                '&:hover': { bgcolor: meta?.bg },
                                fontSize: 11,
                              }}
                            >
                              → {nextStatus}
                            </Button>
                          );
                        })}
                      </Stack>
                    )}
                  </Card>
                );
              })()}

              {/* ── KEY DETAILS GRID ── */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                  { label: 'Category', value: selectedCR.category },
                  { label: 'Change Type', value: selectedCR.change_type },
                  { label: 'Target Version', value: selectedCR.target_version || '-' },
                  { label: 'Estimated Effort', value: selectedCR.estimated_effort || '-' },
                  { label: 'Target Date', value: formatDate(selectedCR.target_date) },
                  { label: 'Raised On', value: formatDate(selectedCR.requested_date || selectedCR.created_at) },
                ].map(({ label, value }) => (
                  <Grid item xs={6} key={label}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 9.5 }}>
                      {label}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.3 }}>{value}</Typography>
                  </Grid>
                ))}
              </Grid>

              {/* ── PEOPLE TRAIL ── */}
              {(() => {
                const stages = [
                  { label: 'Requested By', user: crDetail?.requested_by || selectedCR.requested_by, date: crDetail?.requested_date || selectedCR.requested_date },
                  { label: 'Reviewed By', user: crDetail?.reviewed_by, date: crDetail?.reviewed_date },
                  { label: 'Approved By', user: crDetail?.approved_by, date: crDetail?.approved_date },
                  { label: 'Implemented By', user: crDetail?.implemented_by, date: crDetail?.implemented_date },
                  { label: 'Verified By', user: crDetail?.verified_by, date: crDetail?.verified_date },
                ].filter(s => s.user);
                return stages.length > 0 ? (
                  <Card sx={{ mb: 3, p: 2, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                      Workflow Trail
                    </Typography>
                    <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                      {stages.map(s => (
                        <Grid item xs={6} key={s.label}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ width: 24, height: 24, fontSize: 9, fontWeight: 700, background: avatarGradient(s.user.full_name) }}>
                              {initials(s.user.full_name)}
                            </Avatar>
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.1, fontSize: 10.5 }}>
                                {s.user.full_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9.5, lineHeight: 1 }}>
                                {s.label} • {formatDate(s.date)}
                              </Typography>
                            </Box>
                          </Stack>
                        </Grid>
                      ))}
                    </Grid>
                  </Card>
                ) : null;
              })()}

              {/* ── DESCRIPTION & RICH TEXT SECTIONS ── */}
              {[
                { label: 'Description', value: crDetail?.description || selectedCR.description },
                { label: 'Business Justification', value: crDetail?.justification || selectedCR.justification },
                { label: 'Impact Analysis', value: crDetail?.impact_analysis || selectedCR.impact_analysis },
                { label: 'Implementation Plan', value: crDetail?.implementation_plan || selectedCR.implementation_plan },
                { label: 'Rollback Plan', value: crDetail?.rollback_plan || selectedCR.rollback_plan },
                { label: 'Test Plan', value: crDetail?.test_plan || selectedCR.test_plan },
              ].filter(s => s.value).map(s => (
                <Box key={s.label} sx={{ mb: 2.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                    {s.label}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                    {s.value}
                  </Typography>
                  <Divider sx={{ mt: 1.5, borderColor: 'rgba(255,255,255,0.04)' }} />
                </Box>
              ))}

              {/* ── AUDIT HISTORY ── */}
              {(crDetail?.audit_history?.length > 0) && (
                <Box sx={{ mb: 3 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <History sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                      Workflow History
                    </Typography>
                  </Stack>
                  <Stack spacing={1}>
                    {crDetail.audit_history.map((h: any) => (
                      <Stack key={h.id} direction="row" spacing={1.5} alignItems="flex-start">
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#6366f1', mt: 0.7, flexShrink: 0 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontSize: 12 }}>
                            <strong>{h.user?.full_name}</strong> moved to <StatusChip status={h.to_status} />
                            {h.from_status && <> from <strong>{h.from_status}</strong></>}
                          </Typography>
                          {h.notes && <Typography variant="caption" color="text.secondary">{h.notes}</Typography>}
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, display: 'block' }}>
                            {new Date(h.changed_at).toLocaleString()}
                          </Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* ── COMMENTS ── */}
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <Comment sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                    Comments ({crDetail?.comments?.length || 0})
                  </Typography>
                </Stack>
                <Stack spacing={1.5} sx={{ mb: 2 }}>
                  {(crDetail?.comments || []).map((c: any) => (
                    <Box key={c.id} sx={{ display: 'flex', gap: 1.5 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: 10, fontWeight: 700, flexShrink: 0, background: avatarGradient(c.user?.full_name || 'U') }}>
                        {initials(c.user?.full_name || 'U')}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11.5 }}>{c.user?.full_name}</Typography>
                          {c.stage && <Chip label={c.stage} size="small" sx={{ height: 14, fontSize: 9 }} />}
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                            {new Date(c.created_at).toLocaleString()}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ mt: 0.3, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.comment}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
                {/* Add comment */}
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small" fullWidth multiline maxRows={3}
                    placeholder="Add a comment…"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                  <IconButton
                    color="primary"
                    disabled={!newComment.trim() || commentMut.isPending}
                    onClick={() => commentMut.mutate({ crId: selectedCR.id, comment: newComment.trim() })}
                  >
                    {commentMut.isPending ? <CircularProgress size={20} /> : <Send />}
                  </IconButton>
                </Stack>
              </Box>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* ══════════════════════════════════════════════
          WORKFLOW TRANSITION DIALOG
          ══════════════════════════════════════════════ */}
      <Dialog
        open={transitionDialog.open}
        onClose={() => setTransitionDialog(p => ({ ...p, open: false }))}
        maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3, background: 'rgba(13,13,23,0.98)' } }}
      >
        <DialogTitle sx={{ fontFamily: 'Outfit', fontWeight: 700 }}>
          Move to: <span style={{ color: statusMeta[transitionDialog.toStatus]?.color }}>{transitionDialog.toStatus}</span>
        </DialogTitle>
        <DialogContent>
          {transitionDialog.toStatus === 'Rejected' && (
            <TextField
              fullWidth label="Rejection Reason" multiline rows={3}
              value={transitionDialog.rejectionReason}
              onChange={e => setTransitionDialog(p => ({ ...p, rejectionReason: e.target.value }))}
              sx={{ mb: 2 }}
              required
            />
          )}
          <TextField
            fullWidth label="Notes (optional)" multiline rows={2}
            value={transitionDialog.notes}
            onChange={e => setTransitionDialog(p => ({ ...p, notes: e.target.value }))}
            placeholder="Add context for this transition…"
          />
          {formError && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{formError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => { setTransitionDialog(p => ({ ...p, open: false })); setFormError(null); }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={transitionMut.isPending || (transitionDialog.toStatus === 'Rejected' && !transitionDialog.rejectionReason.trim())}
            onClick={() => {
              setFormError(null);
              transitionMut.mutate({
                id: selectedCR?.id,
                toStatus: transitionDialog.toStatus,
                notes: transitionDialog.notes,
                rejectionReason: transitionDialog.rejectionReason,
              });
            }}
            sx={{ background: `${statusMeta[transitionDialog.toStatus]?.color || '#6366f1'}`, color: '#fff' }}
          >
            {transitionMut.isPending ? <CircularProgress size={20} color="inherit" /> : `Confirm → ${transitionDialog.toStatus}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════════════════════════════════════
          CREATE / EDIT DIALOG
          ══════════════════════════════════════════════ */}
      <Dialog
        open={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingCR(null); resetForm(); }}
        maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, background: 'rgba(13,13,23,0.98)', backgroundImage: 'none' } }}
      >
        <form onSubmit={handleFormSubmit}>
          <DialogTitle sx={{ fontFamily: 'Outfit', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{editingCR ? `Edit ${editingCR.cr_id}` : 'Raise a New Change Request'}</span>
            <IconButton size="small" onClick={() => { setIsFormOpen(false); setEditingCR(null); resetForm(); }}>
              <Close fontSize="small" />
            </IconButton>
          </DialogTitle>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

          <DialogContent sx={{ pt: 3 }}>
            <Stack spacing={3}>
              {/* Row 1: ID + Title */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField size="small" label="CR ID" value={form.cr_id}
                  onChange={e => setForm(p => ({ ...p, cr_id: e.target.value }))}
                  required disabled={!!editingCR} sx={{ minWidth: 180 }} />
                <TextField size="small" label="Title" value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  required fullWidth />
              </Stack>

              {/* Row 2: Classification */}
              <Grid container spacing={2}>
                {[
                  { label: 'Category', key: 'category', items: CATEGORIES },
                  { label: 'Change Type', key: 'change_type', items: CHANGE_TYPES },
                  { label: 'Priority', key: 'priority', items: PRIORITIES },
                  { label: 'Risk Level', key: 'risk_level', items: RISK_LEVELS },
                ].map(({ label, key, items }) => (
                  <Grid item xs={12} sm={6} md={3} key={key}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>{label}</InputLabel>
                      <Select label={label} value={(form as any)[key]}
                        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}>
                        {items.map(i => <MenuItem key={i} value={i}>{i}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                ))}
              </Grid>

              {/* Rich text fields */}
              {[
                { label: 'Description', key: 'description', rows: 3, placeholder: 'What needs to change and why?' },
                { label: 'Business Justification', key: 'justification', rows: 2, placeholder: 'Business case and value...' },
                { label: 'Impact Analysis', key: 'impact_analysis', rows: 3, placeholder: 'Which systems, users or processes are affected? Risk assessment...' },
                { label: 'Implementation Plan', key: 'implementation_plan', rows: 3, placeholder: 'Step-by-step implementation approach...' },
                { label: 'Rollback Plan', key: 'rollback_plan', rows: 2, placeholder: 'How to revert if the change fails...' },
                { label: 'Test Plan', key: 'test_plan', rows: 2, placeholder: 'How will this change be validated/tested...' },
              ].map(({ label, key, rows, placeholder }) => (
                <TextField
                  key={key} size="small" label={label} multiline rows={rows}
                  placeholder={placeholder} fullWidth
                  value={(form as any)[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                />
              ))}

              {/* Org scoping */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Application</InputLabel>
                    <Select label="Application" value={form.application_id}
                      onChange={e => setForm(p => ({ ...p, application_id: e.target.value as number | '' }))}>
                      <MenuItem value="">None</MenuItem>
                      {(applications as any[]).map((a: any) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Sprint</InputLabel>
                    <Select label="Sprint" value={form.sprint_id}
                      onChange={e => setForm(p => ({ ...p, sprint_id: e.target.value as number | '' }))}>
                      <MenuItem value="">None</MenuItem>
                      {(sprints as any[]).map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Release</InputLabel>
                    <Select label="Release" value={form.release_id}
                      onChange={e => setForm(p => ({ ...p, release_id: e.target.value as number | '' }))}>
                      <MenuItem value="">None</MenuItem>
                      {(releases as any[]).map((r: any) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Assign To</InputLabel>
                    <Select label="Assign To" value={form.assigned_to_id}
                      onChange={e => setForm(p => ({ ...p, assigned_to_id: e.target.value as number | '' }))}>
                      <MenuItem value="">Unassigned</MenuItem>
                      {(users as any[]).map((u: any) => <MenuItem key={u.id} value={u.id}>{u.full_name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {/* Metadata */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField size="small" label="Estimated Effort" value={form.estimated_effort}
                  onChange={e => setForm(p => ({ ...p, estimated_effort: e.target.value }))}
                  placeholder="e.g. 5 days / 8 SP" sx={{ flex: 1 }} />
                <TextField size="small" label="Target Version" value={form.target_version}
                  onChange={e => setForm(p => ({ ...p, target_version: e.target.value }))}
                  placeholder="e.g. v2.4.0" sx={{ flex: 1 }} />
                <TextField size="small" label="Target Date" type="date" value={form.target_date}
                  onChange={e => setForm(p => ({ ...p, target_date: e.target.value }))}
                  InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
              </Stack>

              {formError && <Alert severity="error" sx={{ borderRadius: 2 }}>{formError}</Alert>}
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => { setIsFormOpen(false); setEditingCR(null); resetForm(); }}>Cancel</Button>
            <Button
              type="submit" variant="contained"
              disabled={createMut.isPending || updateMut.isPending}
              sx={{ background: 'linear-gradient(90deg,#6366f1,#a855f7)' }}
            >
              {(createMut.isPending || updateMut.isPending) ? <CircularProgress size={20} color="inherit" /> : editingCR ? 'Save Changes' : 'Raise CR'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ChangeRequests;
