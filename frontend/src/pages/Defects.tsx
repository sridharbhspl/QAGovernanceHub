import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem, Grid, Card, Stack,
  Chip, List, ListItem, ListItemText, Divider, CircularProgress, IconButton,
  Tabs, Tab, Alert, LinearProgress, Tooltip,
} from '@mui/material';
import {
  Add, Comment, AttachFile, History, Close, CloudUpload, Download,
  BugReport, CheckCircle, TableChart,
  Visibility, EditOutlined, DeleteOutline,
} from '@mui/icons-material';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, RowDoubleClickedEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { RootState } from '../store';
import api from '../services/api';
import { usePermission } from '../hooks/usePermission';

/* ══════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════ */
const SEVERITIES  = ['Low', 'Medium', 'High', 'Critical'];
const PRIORITIES  = ['Low', 'Medium', 'High', 'Urgent'];
const ENVIRONMENTS = ['Dev', 'QA', 'Staging', 'UAT', 'Pre-Prod', 'Production', 'CI'];
const BUG_TYPES   = ['Bug', 'Change Request', 'Enhancement', 'Performance', 'Security', 'UI/UX'];
const STATUSES    = ['New', 'Assigned', 'Open', 'Fixed', 'Retest', 'Reopened', 'Closed', 'Deferred'];
const REPRO_OPTS  = ['YES', 'NO', 'Intermittent'];

/* ── init form factory ── */
const initForm = () => ({
  title:              '',
  description:        '',
  source_screen:      '',
  bug_type:           'Bug',
  screenshot_url:     '',
  expected_behavior:  '',
  actual_behavior:    '',
  reproducible:       'YES',
  steps_to_reproduce: '',
  severity:           'Medium',
  priority:           'Medium',
  environment:        'QA',
  build_number:       '',
  assigned_to_id:     '' as number | '',
  developer_name:     '',
  developer_comments: '',
  date_of_fixing:     '',
  status:             'New',
});

/* ══════════════════════════════════════════════════
   SEVERITY / PRIORITY colour helpers
══════════════════════════════════════════════════ */
const sevColor: Record<string, any> = { Low:'success', Medium:'warning', High:'error', Critical:'error' };
const priColor: Record<string, any> = { Low:'success', Medium:'info',    High:'warning', Urgent:'error' };
const statColor: Record<string, string> = {
  New:'#6366f1', Assigned:'#3b82f6', Open:'#f59e0b', Fixed:'#10b981',
  Retest:'#06b6d4', Reopened:'#ef4444', Closed:'#6b7280', Deferred:'#a78bfa',
};

/* ══════════════════════════════════════════════════
   SECTION HEADER helper
══════════════════════════════════════════════════ */
const SectionHeader = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
    <Box sx={{ width: 4, height: 24, borderRadius: 1, flexShrink: 0, background: color }} />
    <Typography variant="subtitle1" sx={{ fontFamily: 'Outfit', fontWeight: 700, lineHeight: 1.2 }}>
      {children}
    </Typography>
  </Stack>
);

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
const Defects: React.FC = () => {
  const queryClient = useQueryClient();
  const filters = useSelector((state: RootState) => state.filters);
  const { user } = useSelector((state: RootState) => state.auth);

  const canCreate = usePermission('create');
  const canUpdate = usePermission('update');
  const canDelete = usePermission('delete');

  /* ── modal open states ── */
  const [isDetailOpen,   setIsDetailOpen]   = useState(false);
  const [isCreateOpen,   setIsCreateOpen]   = useState(false);
  const [isBulkOpen,     setIsBulkOpen]     = useState(false);

  /* ── detail state ── */
  const [selectedDefect, setSelectedDefect] = useState<any | null>(null);
  const [newComment,     setNewComment]     = useState('');
  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── create form state ── */
  const [form, setForm]     = useState(initForm());
  const [formTab, setFormTab] = useState(0);

  /* ── bulk upload: cascading context selectors ── */
  const [bulkGroup,        setBulkGroup]        = useState<number | null>(null);
  const [bulkCompany,      setBulkCompany]      = useState<number | null>(null);
  const [bulkProject,      setBulkProject]      = useState<number | null>(null);
  const [bulkApplication,  setBulkApplication]  = useState<number | null>(null);
  const [bulkRelease,      setBulkRelease]      = useState<number | null>(null);
  const [bulkSprint,       setBulkSprint]       = useState<number | null>(null);

  const [bulkGroups,       setBulkGroups]       = useState<any[]>([]);
  const [bulkCompanies,    setBulkCompanies]    = useState<any[]>([]);
  const [bulkProjects,     setBulkProjects]     = useState<any[]>([]);
  const [bulkApplications, setBulkApplications] = useState<any[]>([]);
  const [bulkReleases,     setBulkReleases]     = useState<any[]>([]);
  const [bulkSprints,      setBulkSprints]      = useState<any[]>([]);
  const [bulkCtxLoading,   setBulkCtxLoading]   = useState(false);

  /* Bootstrap the cascade when the modal opens — pre-fill from global filters */
  React.useEffect(() => {
    if (!isBulkOpen) return;
    const init = async () => {
      setBulkCtxLoading(true);
      try {
        const [grpsRes] = await Promise.all([api.get('/org/groups')]);
        const grps: any[] = grpsRes.data;
        setBulkGroups(grps);
        if (!grps.length) return;

        // Pre-select first group
        const gId = filters.groupId ?? grps[0].id;
        setBulkGroup(gId);

        const comsRes = await api.get(`/org/companies?group_id=${gId}`);
        const coms: any[] = comsRes.data;
        setBulkCompanies(coms);
        if (!coms.length) return;

        const cId = filters.companyId ?? coms[0].id;
        setBulkCompany(cId);

        const projsRes = await api.get(`/org/projects?company_id=${cId}`);
        const projs: any[] = projsRes.data;
        setBulkProjects(projs);
        if (!projs.length) return;

        const pId = filters.projectId ?? projs[0].id;
        setBulkProject(pId);

        const [appsRes, relsRes, sprsRes] = await Promise.all([
          api.get(`/org/applications?project_id=${pId}`).catch(() => ({ data: [] })),
          api.get(`/work/releases?project_id=${pId}`).catch(() => ({ data: [] })),
          api.get(`/work/sprints?project_id=${pId}`).catch(() => ({ data: [] })),
        ]);
        setBulkApplications(appsRes.data);
        setBulkReleases(relsRes.data);
        setBulkSprints(sprsRes.data);

        // Pre-select from global filters if set
        if (filters.applicationId) setBulkApplication(filters.applicationId);
        if (filters.releaseId)     setBulkRelease(filters.releaseId);
        if (filters.sprintId)      setBulkSprint(filters.sprintId);
      } finally {
        setBulkCtxLoading(false);
      }
    };
    init();
  }, [isBulkOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Cascade handlers */
  const onBulkGroupChange = async (gId: number | null) => {
    setBulkGroup(gId); setBulkCompany(null); setBulkProject(null);
    setBulkApplication(null); setBulkRelease(null); setBulkSprint(null);
    setBulkCompanies([]); setBulkProjects([]); setBulkApplications([]); setBulkReleases([]); setBulkSprints([]);
    if (!gId) return;
    const r = await api.get(`/org/companies?group_id=${gId}`).catch(() => ({ data: [] }));
    setBulkCompanies(r.data);
  };
  const onBulkCompanyChange = async (cId: number | null) => {
    setBulkCompany(cId); setBulkProject(null);
    setBulkApplication(null); setBulkRelease(null); setBulkSprint(null);
    setBulkProjects([]); setBulkApplications([]); setBulkReleases([]); setBulkSprints([]);
    if (!cId) return;
    const r = await api.get(`/org/projects?company_id=${cId}`).catch(() => ({ data: [] }));
    setBulkProjects(r.data);
  };
  const onBulkProjectChange = async (pId: number | null) => {
    setBulkProject(pId);
    setBulkApplication(null); setBulkRelease(null); setBulkSprint(null);
    setBulkApplications([]); setBulkReleases([]); setBulkSprints([]);
    if (!pId) return;
    const [appsRes, relsRes, sprsRes] = await Promise.all([
      api.get(`/org/applications?project_id=${pId}`).catch(() => ({ data: [] })),
      api.get(`/work/releases?project_id=${pId}`).catch(() => ({ data: [] })),
      api.get(`/work/sprints?project_id=${pId}`).catch(() => ({ data: [] })),
    ]);
    setBulkApplications(appsRes.data);
    setBulkReleases(relsRes.data);
    setBulkSprints(sprsRes.data);
  };
  const onBulkAppChange = async (aId: number | null) => {
    setBulkApplication(aId); setBulkRelease(null); setBulkSprint(null);
    if (!bulkProject) return;
    const appQ = aId ? `&application_id=${aId}` : '';
    const [relsRes, sprsRes] = await Promise.all([
      api.get(`/work/releases?project_id=${bulkProject}${appQ}`).catch(() => ({ data: [] })),
      api.get(`/work/sprints?project_id=${bulkProject}${appQ}`).catch(() => ({ data: [] })),
    ]);
    setBulkReleases(relsRes.data);
    setBulkSprints(sprsRes.data);
  };
  /* ── bulk file + result state ── */
  const [bulkFile,    setBulkFile]    = useState<File | null>(null);
  const [bulkResult,  setBulkResult]  = useState<any | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [projectUsers, setProjectUsers] = useState<any[]>([]);

  /* ── row-action state ── */
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; defect: any | null }>({ open: false, defect: null });
  const [editDefect,    setEditDefect]    = useState<any | null>(null);   // non-null = edit mode
  const [formError,     setFormError]     = useState<string | null>(null);


  const { data: defects = [], isLoading } = useQuery({
    queryKey: ['defects', filters],
    queryFn: async () => {
      const params: any = {};
      if (filters.projectId)  params.project_id  = filters.projectId;
      if (filters.releaseId)  params.release_id  = filters.releaseId;
      if (filters.sprintId)   params.sprint_id   = filters.sprintId;
      const res = await api.get('/defects', { params });
      return res.data;
    },
    enabled: !!filters.projectId,
  });

  useEffect(() => {
    if (!filters.projectId) { setProjectUsers([]); return; }

    // Prefer project-scoped team members; fall back to company users
    api.get(`/org/team-mappings?project_id=${filters.projectId}`)
      .then((res: any) => {
        const mapped: any[] = res.data;
        if (mapped.length > 0) {
          // team-mappings returns { id, project_id, user_id, user: {...} }
          const users = mapped
            .map((m: any) => m.user)
            .filter(Boolean);
          setProjectUsers(users);
        } else {
          // Fallback: load all company users
          const params: any = {};
          if (user?.company_id) params.company_id = user.company_id;
          api.get('/org/users', { params })
            .then((r: any) => setProjectUsers(r.data))
            .catch(console.error);
        }
      })
      .catch(() => {
        // On any error also fall back
        const params: any = {};
        if (user?.company_id) params.company_id = user.company_id;
        api.get('/org/users', { params })
          .then((r: any) => setProjectUsers(r.data))
          .catch(console.error);
      });
  }, [filters.projectId, user?.company_id]);

  /* ══ MUTATIONS ══ */
  const createMut = useMutation({
    mutationFn: (body: any) => api.post('/defects', body).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defects'] });
      setIsCreateOpen(false);
      setForm(initForm());
      setFormTab(0);
      setFormError(null);
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      setFormError(
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: any) => `${d.loc?.slice(1).join(' → ') || ''}: ${d.msg}`).join(' | ')
            : err?.message || 'Failed to create defect.'
      );
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: any }) =>
      api.put(`/defects/${id}`, updates).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['defects'] });
      setSelectedDefect(data);
    },
  });

  const commentMut = useMutation({
    mutationFn: ({ defectId, comment }: { defectId: number; comment: string }) =>
      api.post(`/defects/${defectId}/comments`, { comment }).then(r => r.data),
    onSuccess: () => {
      if (selectedDefect) fetchDetail(selectedDefect.id);
      setNewComment('');
    },
  });

  const attachMut = useMutation({
    mutationFn: ({ defectId, file }: { defectId: number; file: File }) => {
      const fd = new FormData(); fd.append('file', file);
      return api.post(`/defects/${defectId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
    },
    onSuccess: () => { if (selectedDefect) fetchDetail(selectedDefect.id); setSelectedFile(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/defects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defects'] });
      setDeleteConfirm({ open: false, defect: null });
      // Close detail drawer if the deleted defect was open
      setSelectedDefect((d: any | null) => d?.id === deleteConfirm.defect?.id ? null : d);
      setIsDetailOpen(false);
    },
  });

  const editMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      api.put(`/defects/${id}`, body).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['defects'] });
      setEditDefect(null);
      setForm(initForm());
      setFormTab(0);
      setIsCreateOpen(false);
      setFormError(null);
      // Refresh detail drawer if open
      if (selectedDefect?.id === data.id) setSelectedDefect(data);
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      setFormError(
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: any) => `${d.loc?.slice(1).join(' → ') || ''}: ${d.msg}`).join(' | ')
            : err?.message || 'Failed to update defect.'
      );
    },
  });

  /* ══ HELPERS ══ */
  const fetchDetail = async (id: number) => {
    const res = await api.get(`/defects/${id}`);
    setSelectedDefect(res.data);
  };

  const handleOpenEdit = (defect: any) => {
    setForm({
      title:              defect.title              || '',
      description:        defect.description        || '',
      source_screen:      defect.source_screen      || '',
      bug_type:           defect.bug_type           || 'Bug',
      screenshot_url:     defect.screenshot_url     || '',
      expected_behavior:  defect.expected_behavior  || '',
      actual_behavior:    defect.actual_behavior    || '',
      reproducible:       defect.reproducible       || 'YES',
      steps_to_reproduce: defect.steps_to_reproduce || '',
      severity:           defect.severity           || 'Medium',
      priority:           defect.priority           || 'Medium',
      environment:        defect.environment        || 'QA',
      build_number:       defect.build_number       || '',
      assigned_to_id:     defect.assigned_to_id     || '',
      developer_name:     defect.developer_name     || '',
      developer_comments: defect.developer_comments || '',
      date_of_fixing:     defect.date_of_fixing     || '',
      status:             defect.status             || 'New',
    });
    setEditDefect(defect);
    setFormTab(0);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleRowDoubleClick = (event: RowDoubleClickedEvent) => {
    if (event.data) { fetchDetail(event.data.id); setIsDetailOpen(true); }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (editDefect) {
      // Edit mode — PUT
      editMut.mutate({
        id: editDefect.id,
        body: { ...form, assigned_to_id: form.assigned_to_id || null },
      });
    } else {
      // Create mode — POST
      if (!filters.projectId) return;
      createMut.mutate({
        ...form,
        project_id:     filters.projectId,
        release_id:     filters.releaseId,
        sprint_id:      filters.sprintId,
        assigned_to_id: form.assigned_to_id || null,
      });
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkProject || !bulkFile) return;

    // Client-side validation
    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const fileExt = bulkFile.name.toLowerCase().slice(bulkFile.name.lastIndexOf('.'));
    if (!allowedTypes.includes(fileExt)) {
      setBulkResult({ error: 'Invalid file type. Please upload a .xlsx, .xls, or .csv file.' });
      return;
    }
    if (bulkFile.size > 10 * 1024 * 1024) {
      setBulkResult({ error: 'File is too large. Maximum allowed size is 10 MB.' });
      return;
    }
    if (bulkFile.size === 0) {
      setBulkResult({ error: 'The selected file is empty.' });
      return;
    }

    setBulkLoading(true);
    setBulkResult(null);
    try {
      const fd = new FormData();
      fd.append('project_id', String(bulkProject));
      fd.append('build_number', '');
      if (bulkApplication) fd.append('application_id', String(bulkApplication));
      if (bulkRelease)     fd.append('release_id',     String(bulkRelease));
      if (bulkSprint)      fd.append('sprint_id',      String(bulkSprint));
      fd.append('file', bulkFile);
      // NOTE: Do NOT set Content-Type manually — browser sets it with multipart boundary
      const res = await api.post('/defects/bulk-upload', fd);
      setBulkResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['defects'] });
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      let errMsg = 'Upload failed. Please check your file and try again.';

      if (status === 413) {
        errMsg = 'File is too large for the server. Please reduce the file size and try again.';
      } else if (status === 422) {
        if (Array.isArray(detail) && detail.length > 0) {
          errMsg = detail.map((d: any) => {
            const loc = d.loc?.slice(1).join(' → ') || '';
            return loc ? `${loc}: ${d.msg}` : d.msg;
          }).join(' | ');
        } else if (typeof detail === 'string') {
          errMsg = detail;
        }
      } else if (typeof detail === 'string') {
        errMsg = detail;
      } else if (err?.message) {
        errMsg = err.message;
      }
      setBulkResult({ error: errMsg });
    }
    setBulkLoading(false);
  };

  const downloadTemplate = (format: string) => {
    let baseUrl = api.defaults.baseURL || '';
    if (!baseUrl.startsWith('http')) {
      // Direct call to development backend to bypass Vite's proxy for download headers
      const devBackendUrl = import.meta.env.VITE_DEV_BACKEND_URL;
      if (devBackendUrl) {
        baseUrl = devBackendUrl + (baseUrl || '/api/v1');
      } else {
        const devPort = import.meta.env.VITE_DEV_BACKEND_PORT || '8000';
        baseUrl = `${window.location.protocol}//${window.location.hostname}:${devPort}${baseUrl || '/api/v1'}`;
      }
    }
    const url = `${baseUrl}/defects/templates/download?format=${format}`;
    window.open(url, '_blank');
  };

  /* ══ AG GRID COLUMN DEFS ══ */
  const columnDefs: ColDef[] = [
    {
      headerName: 'Actions', width: 110, pinned: 'right' as const,
      sortable: false, filter: false, resizable: false,
      cellRenderer: (p: any) => (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ height: '100%' }}>
          <Tooltip title="View Details">
            <IconButton size="small" onClick={() => { fetchDetail(p.data.id); setIsDetailOpen(true); }}
              sx={{ color: '#3b82f6', '&:hover': { bgcolor: 'rgba(59,130,246,0.1)' } }}>
              <Visibility sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          {canUpdate && (
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => handleOpenEdit(p.data)}
                sx={{ color: '#f59e0b', '&:hover': { bgcolor: 'rgba(245,158,11,0.1)' } }}>
                <EditOutlined sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title="Delete">
              <IconButton size="small"
                onClick={() => setDeleteConfirm({ open: true, defect: p.data })}
                sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}>
                <DeleteOutline sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
    { field: 'defect_id',           headerName: 'Bug/CR ID',     width: 180, sortable: true, filter: true,
      cellRenderer: (p: any) => <Typography variant="caption" sx={{ fontFamily:'monospace', color:'#6366f1', fontWeight:700 }}>{p.value}</Typography> },
    { field: 'source_screen',       headerName: 'Source Screen',  width: 180, filter: true,
      cellRenderer: (p: any) => <Typography variant="caption">{p.value || '—'}</Typography> },
    { field: 'bug_type',            headerName: 'Type',           width: 120, filter: true,
      cellRenderer: (p: any) => <Chip label={p.value || 'Bug'} size="small" variant="outlined" sx={{ fontSize:10, height:18 }} /> },
    { field: 'title',               headerName: 'Bug/CR Description', flex: 1, sortable: true, filter: true,
      cellRenderer: (p: any) => <Typography variant="body2" sx={{ fontWeight:500 }}>{p.value}</Typography> },
    { field: 'severity',            headerName: 'Severity',       width: 110,
      cellRenderer: (p: any) => <Chip label={p.value} color={sevColor[p.value]||'default'} size="small" variant="outlined" /> },
    { field: 'priority',            headerName: 'Priority',       width: 110,
      cellRenderer: (p: any) => <Chip label={p.value} color={priColor[p.value]||'default'} size="small" variant="outlined" /> },
    { field: 'status',              headerName: 'Status',         width: 120,
      cellRenderer: (p: any) => <Chip label={p.value} size="small"
        sx={{ bgcolor: (statColor[p.value] || '#6366f1') + '22', color: statColor[p.value]||'#6366f1', fontWeight:700, fontSize:10 }} /> },
    { field: 'reproducible',        headerName: 'Reproducible',   width: 120,
      cellRenderer: (p: any) => <Chip label={p.value||'—'} size="small" color={p.value==='YES'?'error':'success'} variant="outlined" sx={{fontSize:10,height:18}} /> },
    { field: 'environment',         headerName: 'Environment',    width: 110, filter: true },
    { field: 'build_number',        headerName: 'Build/Version',  width: 130 },
    { field: 'assigned_to.full_name', headerName: 'Assigned To',  width: 150 },
    { field: 'reported_by.full_name', headerName: 'Tester Name',  width: 150 },
    { field: 'developer_name',      headerName: 'Developer',      width: 150 },
    { field: 'created_at',          headerName: 'Date Found',     width: 140,
      cellRenderer: (p: any) => <Typography variant="caption">{p.value ? new Date(p.value).toLocaleDateString('en-GB') : '—'}</Typography> },
  ];

  /* ══════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════ */
  return (
    <Box>
      {/* ── PAGE HEADER ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: 'Outfit', fontWeight: 800 }}>Defects Tracker</Typography>
          <Typography variant="body2" color="text.secondary">
            Log, track, and resolve Bug/CR reports across all projects.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          {canCreate && (
            <Button
              variant="outlined" startIcon={<CloudUpload />}
              onClick={() => { setBulkFile(null); setBulkResult(null); setIsBulkOpen(true); }}
              disabled={!filters.projectId}
              sx={{ borderColor: 'rgba(99,102,241,0.5)', color: '#6366f1', '&:hover': { borderColor: '#6366f1', bgcolor: 'rgba(99,102,241,0.06)' } }}
            >
              Bulk Import
            </Button>
          )}
          {canCreate && (
            <Button
              variant="contained" startIcon={<Add />}
              onClick={() => { setForm(initForm()); setFormTab(0); setFormError(null); setIsCreateOpen(true); }}
              disabled={!filters.projectId}
              sx={{ background: 'linear-gradient(90deg,#6366f1,#a855f7)' }}
            >
              Log Defect
            </Button>
          )}
        </Stack>
      </Stack>

      {/* ── GRID ── */}
      {!filters.projectId ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Select a Project from the toolbar filters to view its Bug/CR reports.
        </Alert>
      ) : isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
      ) : (
        <div className="ag-theme-alpine" style={{ height: 620, width: '100%' }}>
          <AgGridReact
            rowData={defects}
            columnDefs={columnDefs}
            pagination={true}
            paginationPageSize={15}
            onRowDoubleClicked={handleRowDoubleClick}
            rowHeight={44}
            overlayNoRowsTemplate="<span>No defects logged. Click 'Log Defect' to create your first Bug/CR report.</span>"
          />
        </div>
      )}


      {/* ════════════════════════════════════════════════════════
          MODAL: Log New Defect (full Bug/CR template)
      ════════════════════════════════════════════════════════ */}
      <Dialog open={isCreateOpen} onClose={() => { setIsCreateOpen(false); setEditDefect(null); setForm(initForm()); setFormTab(0); setFormError(null); }} fullWidth maxWidth="lg"
        PaperProps={{ sx: { maxHeight: '95vh' } }}>

        <DialogTitle sx={{ fontFamily: 'Outfit', fontWeight: 700, pb: 0 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width:42, height:42, borderRadius:2, flexShrink:0,
              background: editDefect
                ? 'linear-gradient(135deg,#f59e0b,#f97316)'
                : 'linear-gradient(135deg,#ef4444,#f97316)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              {editDefect ? <EditOutlined sx={{ fontSize:22, color:'#fff' }} /> : <BugReport sx={{ fontSize:22, color:'#fff' }} />}
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontFamily:'Outfit', fontWeight:700, lineHeight:1.2 }}>
                {editDefect ? `Edit: ${editDefect.defect_id}` : 'Log Bug / CR Report'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {editDefect ? 'Update the defect details below and save' : 'Complete as many fields as possible for accurate tracking'}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <Tabs value={formTab} onChange={(_, v) => setFormTab(v)}
          sx={{ px:3, borderBottom:'1px solid', borderColor:'divider' }}>
          <Tab label="Bug Details"        icon={<BugReport sx={{ fontSize:14 }} />} iconPosition="start" sx={{ fontSize:12, minHeight:44 }} />
          <Tab label="Classification"    icon={<TableChart sx={{ fontSize:14 }} />} iconPosition="start" sx={{ fontSize:12, minHeight:44 }} />
          <Tab label="Dev Resolution"    icon={<CheckCircle sx={{ fontSize:14 }} />} iconPosition="start" sx={{ fontSize:12, minHeight:44 }} />
        </Tabs>

        <Box component="form" onSubmit={handleCreateSubmit} id="create-defect-form">
          <DialogContent sx={{ overflowY: 'auto', pt: 2.5 }}>
            {formError && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
                {formError}
              </Alert>
            )}

            {/* ══ TAB 0 – Bug Details ══ */}
            {formTab === 0 && (
              <Grid container spacing={2.5}>

                {/* Row 1 – Source Screen + Type */}
                <Grid item xs={12}>
                  <SectionHeader color="linear-gradient(180deg,#ef4444,#f97316)">Identification</SectionHeader>
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField required fullWidth label="Bug/CR Description *"
                    placeholder="Concise description of what is broken or needs changing"
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth>
                    <InputLabel>Type of Bug/CR</InputLabel>
                    <Select value={form.bug_type} label="Type of Bug/CR"
                      onChange={e => setForm(p => ({ ...p, bug_type: e.target.value }))}>
                      {BUG_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={8}>
                  <TextField fullWidth label="Source Screen / URL"
                    placeholder="e.g. Procurement → RFQ or https://app.com/rfq/new"
                    value={form.source_screen}
                    onChange={e => setForm(p => ({ ...p, source_screen: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Screenshot / Evidence URL"
                    placeholder="https://… or N/A"
                    value={form.screenshot_url}
                    onChange={e => setForm(p => ({ ...p, screenshot_url: e.target.value }))} />
                </Grid>

                {/* Row 2 – Expected / Actual */}
                <Grid item xs={12}>
                  <Divider sx={{ my: 0.5 }} />
                  <SectionHeader color="linear-gradient(180deg,#3b82f6,#6366f1)">Behaviour</SectionHeader>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth multiline rows={3} label="Expected Behavior"
                    placeholder="What should happen?"
                    value={form.expected_behavior}
                    onChange={e => setForm(p => ({ ...p, expected_behavior: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth multiline rows={3} label="Actual Behavior"
                    placeholder="What actually happened?"
                    value={form.actual_behavior}
                    onChange={e => setForm(p => ({ ...p, actual_behavior: e.target.value }))} />
                </Grid>

                {/* Row 3 – Steps + Reproducible */}
                <Grid item xs={12} sm={9}>
                  <TextField fullWidth multiline rows={4} label="Steps to Reproduce"
                    placeholder="1. Open RFQ&#10;2. Click Vendor field&#10;3. Attempt to add multiple vendors"
                    value={form.steps_to_reproduce}
                    onChange={e => setForm(p => ({ ...p, steps_to_reproduce: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Reproducible?</InputLabel>
                    <Select value={form.reproducible} label="Reproducible?"
                      onChange={e => setForm(p => ({ ...p, reproducible: e.target.value }))}>
                      {REPRO_OPTS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Row 4 – Full description / Notes */}
                <Grid item xs={12}>
                  <TextField fullWidth multiline rows={3} label="Additional Notes / Description"
                    placeholder="Any additional context, workarounds, links, or observations…"
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </Grid>
              </Grid>
            )}

            {/* ══ TAB 1 – Classification ══ */}
            {formTab === 1 && (
              <Grid container spacing={2.5}>
                <Grid item xs={12}>
                  <SectionHeader color="linear-gradient(180deg,#f59e0b,#ef4444)">Classification & Assignment</SectionHeader>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Severity *</InputLabel>
                    <Select value={form.severity} label="Severity *"
                      onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}>
                      {SEVERITIES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Priority *</InputLabel>
                    <Select value={form.priority} label="Priority *"
                      onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                      {PRIORITIES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select value={form.status} label="Status"
                      onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                      {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Environment</InputLabel>
                    <Select value={form.environment} label="Environment"
                      onChange={e => setForm(p => ({ ...p, environment: e.target.value }))}>
                      {ENVIRONMENTS.map(e => <MenuItem key={e} value={e}>{e}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Build / Version Number"
                    placeholder="e.g. V1.0.2 or build-2048"
                    value={form.build_number}
                    onChange={e => setForm(p => ({ ...p, build_number: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Assign To</InputLabel>
                    <Select value={form.assigned_to_id} label="Assign To"
                      onChange={e => setForm(p => ({ ...p, assigned_to_id: e.target.value as number }))}>
                      <MenuItem value=""><em>Unassigned</em></MenuItem>
                      {projectUsers.map((u: any) => <MenuItem key={u.id} value={u.id}>{u.full_name} ({u.role})</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Status summary card */}
                <Grid item xs={12}>
                  <Box sx={{ p:2, borderRadius:2, border:'1px solid',
                    borderColor: form.severity==='Critical'||form.severity==='High' ? 'rgba(239,68,68,0.3)':'divider',
                    background:'rgba(255,255,255,0.02)' }}>
                    <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1}>
                      <Chip label={`Severity: ${form.severity}`}  color={sevColor[form.severity]||'default'} variant="outlined" size="small" />
                      <Chip label={`Priority: ${form.priority}`}  color={priColor[form.priority]||'default'} variant="outlined" size="small" />
                      <Chip label={`Status: ${form.status}`}      size="small"
                        sx={{ bgcolor:(statColor[form.status]||'#6366f1')+'22', color:statColor[form.status]||'#6366f1', fontWeight:700 }} />
                      <Chip label={`Env: ${form.environment}`}    size="small" variant="outlined" />
                      <Chip label={`Repro: ${form.reproducible}`} size="small"
                        color={form.reproducible==='YES'?'error':'success'} variant="outlined" />
                    </Stack>
                  </Box>
                </Grid>
              </Grid>
            )}

            {/* ══ TAB 2 – Dev Resolution ══ */}
            {formTab === 2 && (
              <Grid container spacing={2.5}>
                <Grid item xs={12}>
                  <SectionHeader color="linear-gradient(180deg,#10b981,#06b6d4)">Developer Resolution</SectionHeader>
                  <Alert severity="info" sx={{ mb:2, fontSize:12 }}>
                    Fill this section once the developer picks up the bug. Leave blank for new defects.
                  </Alert>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Developer Name"
                    placeholder="Full name of the fixing developer"
                    value={form.developer_name}
                    onChange={e => setForm(p => ({ ...p, developer_name: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Date of Fixing"
                    placeholder="DD/MM/YYYY"
                    value={form.date_of_fixing}
                    onChange={e => setForm(p => ({ ...p, date_of_fixing: e.target.value }))} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth multiline rows={4} label="Developer Comments / Fix Notes"
                    placeholder="Describe what was changed, which commit/PR fixed it, test coverage added…"
                    value={form.developer_comments}
                    onChange={e => setForm(p => ({ ...p, developer_comments: e.target.value }))} />
                </Grid>
              </Grid>
            )}

          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            {/* Tab navigation */}
            {formTab > 0 && (
              <Button onClick={() => setFormTab(t => t - 1)} variant="outlined" color="inherit">← Back</Button>
            )}
            {formTab < 2 && (
              <Button onClick={() => setFormTab(t => t + 1)} variant="outlined">Next →</Button>
            )}
            <Box sx={{ flex: 1 }} />
            <Button onClick={() => { setIsCreateOpen(false); setEditDefect(null); setForm(initForm()); setFormTab(0); }}
              variant="outlined" color="inherit">Cancel</Button>
            <Button type="submit" form="create-defect-form" variant="contained"
              disabled={!form.title.trim() || createMut.isPending || editMut.isPending}
              sx={{ minWidth: 150, background: editDefect
                ? 'linear-gradient(90deg,#f59e0b,#f97316)'
                : 'linear-gradient(90deg,#ef4444,#f97316)' }}>
              {(createMut.isPending || editMut.isPending)
                ? <><CircularProgress size={15} color="inherit" sx={{ mr:1 }} />Saving…</>
                : editDefect
                  ? <><EditOutlined sx={{ fontSize:16, mr:0.8 }} />Save Changes</>
                  : <><BugReport sx={{ fontSize:16, mr:0.8 }} />Submit Bug/CR</>}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>


      {/* ════════════════════════════════════════════════════════
          MODAL: Bulk Import (Bug/CR Report template)
      ════════════════════════════════════════════════════════ */}
      <Dialog open={isBulkOpen}
        onClose={() => { setIsBulkOpen(false); setBulkFile(null); setBulkResult(null); }}
        fullWidth maxWidth="md"
        PaperProps={{ sx: { maxHeight: '92vh' } }}>

        {/* ── Dialog Header ── */}
        <DialogTitle sx={{ fontFamily: 'Outfit', fontWeight: 700, pb: 1.5,
          background: 'linear-gradient(135deg,rgba(59,130,246,0.06),rgba(99,102,241,0.06))' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width:42, height:42, borderRadius:2, flexShrink:0,
              background:'linear-gradient(135deg,#3b82f6,#6366f1)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <CloudUpload sx={{ fontSize:22, color:'#fff' }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontFamily:'Outfit', fontWeight:700, lineHeight:1.2 }}>
                Bulk Import Bug/CR Report
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Select the target context, then upload an Excel or CSV matching the Bug/CR Report template
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => { setIsBulkOpen(false); setBulkFile(null); setBulkResult(null); }}>
              <Close fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>
        <Divider />

        <Box component="form" onSubmit={handleBulkSubmit}>
          <DialogContent sx={{ overflowY: 'auto' }}>
            <Stack spacing={2.5} sx={{ mt: 1 }}>

              {/* ── STEP 1: Context Selector ─────────────────────────── */}
              <Box sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(99,102,241,0.25)',
                background: 'linear-gradient(135deg,rgba(99,102,241,0.04),rgba(139,92,246,0.04))' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#6366f1' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#6366f1' }}>
                    Step 1 — Select Import Context *
                  </Typography>
                  {bulkCtxLoading && <CircularProgress size={14} sx={{ ml: 1 }} />}
                </Stack>

                <Grid container spacing={1.5}>
                  {/* Group */}
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl fullWidth size="small" required>
                      <InputLabel>Group *</InputLabel>
                      <Select value={bulkGroup ?? ''} label="Group *"
                        onChange={e => onBulkGroupChange(e.target.value ? Number(e.target.value) : null)}>
                        {bulkGroups.map((g: any) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  {/* Company */}
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl fullWidth size="small" required disabled={!bulkGroup || !bulkCompanies.length}>
                      <InputLabel>Company *</InputLabel>
                      <Select value={bulkCompany ?? ''} label="Company *"
                        onChange={e => onBulkCompanyChange(e.target.value ? Number(e.target.value) : null)}>
                        {bulkCompanies.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  {/* Project */}
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl fullWidth size="small" required disabled={!bulkCompany || !bulkProjects.length}>
                      <InputLabel>Project *</InputLabel>
                      <Select value={bulkProject ?? ''} label="Project *"
                        onChange={e => onBulkProjectChange(e.target.value ? Number(e.target.value) : null)}>
                        {bulkProjects.map((p: any) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  {/* Application */}
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl fullWidth size="small" disabled={!bulkProject}>
                      <InputLabel>Application</InputLabel>
                      <Select value={bulkApplication ?? ''} label="Application"
                        onChange={e => onBulkAppChange(e.target.value ? Number(e.target.value) : null)}>
                        <MenuItem value=""><em>All / None</em></MenuItem>
                        {bulkApplications.map((a: any) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  {/* Release / Version */}
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl fullWidth size="small" disabled={!bulkProject}>
                      <InputLabel>Release / Version</InputLabel>
                      <Select value={bulkRelease ?? ''} label="Release / Version"
                        onChange={e => setBulkRelease(e.target.value ? Number(e.target.value) : null)}>
                        <MenuItem value=""><em>None</em></MenuItem>
                        {bulkReleases.map((r: any) => <MenuItem key={r.id} value={r.id}>{r.version}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  {/* Sprint */}
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl fullWidth size="small" disabled={!bulkProject}>
                      <InputLabel>Sprint</InputLabel>
                      <Select value={bulkSprint ?? ''} label="Sprint"
                        onChange={e => setBulkSprint(e.target.value ? Number(e.target.value) : null)}>
                        <MenuItem value=""><em>None</em></MenuItem>
                        {bulkSprints.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {/* Active context summary chips */}
                {bulkProject && (
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(99,102,241,0.15)' }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary',
                      textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.8 }}>
                      Imported defects will be tagged to:
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.7}>
                      {[
                        { label: 'Project',     val: bulkProjects.find((p: any) => p.id === bulkProject)?.name || (bulkProject ? `#${bulkProject}` : null),     color: '#3b82f6' },
                        { label: 'Application', val: bulkApplications.find((a: any) => a.id === bulkApplication)?.name || (bulkApplication ? `#${bulkApplication}` : null), color: '#06b6d4' },
                        { label: 'Release',     val: bulkReleases.find((r: any) => r.id === bulkRelease)?.version || (bulkRelease ? `#${bulkRelease}` : null),     color: '#6366f1' },
                        { label: 'Sprint',      val: bulkSprints.find((s: any) => s.id === bulkSprint)?.name || (bulkSprint ? `#${bulkSprint}` : null),      color: '#8b5cf6' },
                      ].map(f => f.val && (
                        <Chip key={f.label} label={`${f.label}: ${f.val}`} size="small"
                          sx={{ fontSize: 11, fontWeight: 600, height: 22,
                            bgcolor: `${f.color}18`, color: f.color,
                            border: `1px solid ${f.color}33` }} />
                      ))}
                      {!bulkApplication && !bulkRelease && !bulkSprint && (
                        <Typography sx={{ fontSize: 11, color: 'text.disabled', fontStyle: 'italic' }}>
                          No application / release / sprint tag
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                )}
              </Box>

              {/* ── STEP 2: Download Template ── */}
              <Box sx={{ p:2, borderRadius:2, border:'1px solid', borderColor:'rgba(99,102,241,0.3)',
                background:'linear-gradient(135deg,rgba(99,102,241,0.04),rgba(168,85,247,0.04))' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#8b5cf6' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight:700, color:'#8b5cf6' }}>
                    Step 2 — Download Template (optional)
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display:'block', mb:1.5 }}>
                  Bug/CR Report template · 20 standard columns · sample row pre-filled
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" startIcon={<Download />}
                    onClick={() => downloadTemplate('xlsx')}
                    sx={{ borderColor:'rgba(99,102,241,0.4)', color:'#6366f1',
                      '&:hover':{ borderColor:'#6366f1', bgcolor:'rgba(99,102,241,0.06)' } }}>
                    Download .xlsx
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<Download />}
                    onClick={() => downloadTemplate('csv')}
                    sx={{ borderColor:'rgba(16,185,129,0.4)', color:'#10b981',
                      '&:hover':{ borderColor:'#10b981', bgcolor:'rgba(16,185,129,0.06)' } }}>
                    Download .csv
                  </Button>
                </Stack>
              </Box>

              {/* ── STEP 3: File Upload ── */}
              <Box sx={{ p:2, borderRadius:2, border:'1px solid',
                borderColor: bulkFile ? 'rgba(16,185,129,0.5)':'rgba(99,102,241,0.25)',
                background:  bulkFile ? 'rgba(16,185,129,0.03)':'rgba(255,255,255,0.01)',
                transition:'all 0.2s' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: bulkFile ? '#10b981' : '#3b82f6' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight:700, color: bulkFile ? '#10b981' : 'text.primary' }}>
                    Step 3 — Upload File *
                  </Typography>
                </Stack>
                <Button fullWidth variant="outlined" component="label" size="large"
                  disabled={!bulkProject}
                  startIcon={bulkFile ? <CheckCircle sx={{ color:'#10b981' }} /> : <CloudUpload />}
                  sx={{ py:2.5, borderStyle:'dashed',
                    borderColor: bulkFile ? '#10b981' : !bulkProject ? 'divider' : 'rgba(99,102,241,0.4)',
                    color: bulkFile ? '#10b981' : !bulkProject ? 'text.disabled' : 'text.secondary',
                    borderRadius:2, fontWeight:600, fontSize:13,
                    '&:hover':{ borderColor:'#6366f1', bgcolor:'rgba(99,102,241,0.04)' } }}>
                  {!bulkProject
                    ? 'Select a Project first'
                    : bulkFile ? bulkFile.name : 'Click to Choose .xlsx or .csv'}
                  <input type="file" hidden accept=".xlsx,.xls,.csv"
                    onChange={e => { setBulkFile(e.target.files?.[0] ?? null); setBulkResult(null); }} />
                </Button>
                {bulkFile && (
                  <Typography variant="caption" color="text.secondary"
                    sx={{ mt:0.5, display:'block', textAlign:'center' }}>
                    {(bulkFile.size / 1024).toFixed(1)} KB · {bulkFile.name.split('.').pop()?.toUpperCase()}
                  </Typography>
                )}
              </Box>

              {/* ── Column legend ── */}
              <Box sx={{ p:1.5, borderRadius:2, bgcolor:'rgba(255,255,255,0.02)', border:'1px solid', borderColor:'divider' }}>
                <Typography variant="caption" sx={{ fontWeight:700, display:'block', mb:0.8 }}>
                  Template Columns (20)
                </Typography>
                <Box sx={{ display:'flex', flexWrap:'wrap', gap:0.5 }}>
                  {['Bug/CR ID','Test Case ID','Source Screen/URL','Type of Bug/CR','Bug/CR Description',
                    'Screenshot URL','Expected Behavior','Actual Behavior','Reproducible? (YES/NO)',
                    'Steps to Reproduce','Bug/CR Status','Severity','Priority','Tester Name',
                    'Date Found/Posted','Status','Age','Developer Name','Date of Fixing','Developer Comments'
                  ].map(col => (
                    <Chip key={col} label={col} size="small" variant="outlined"
                      sx={{ fontSize:9, height:18, borderRadius:0.8 }} />
                  ))}
                </Box>
              </Box>

              {/* ── Upload result ── */}
              {bulkLoading && <LinearProgress sx={{ borderRadius:1 }} />}
              {bulkResult && !bulkResult.error && (
                <Box sx={{ p:2, borderRadius:2,
                  background:'linear-gradient(135deg,rgba(16,185,129,0.08),rgba(6,182,212,0.08))',
                  border:'1px solid rgba(16,185,129,0.3)' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb:1.5 }}>
                    <CheckCircle sx={{ color:'#10b981', fontSize:20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight:700, color:'#10b981' }}>Import Complete!</Typography>
                  </Stack>
                  <Grid container spacing={2}>
                    {[
                      { label:'Created',   value: bulkResult.created,           color:'#10b981' },
                      { label:'Skipped',   value: bulkResult.skipped_duplicates, color:'#f59e0b' },
                      { label:'Errors',    value: bulkResult.errors?.length??0,  color:'#ef4444' },
                    ].map(stat => (
                      <Grid item xs={4} key={stat.label}>
                        <Box sx={{ textAlign:'center', p:1, borderRadius:1.5, bgcolor:'rgba(255,255,255,0.04)' }}>
                          <Typography variant="h5" sx={{ fontWeight:800, color:stat.color, fontFamily:'Outfit' }}>{stat.value}</Typography>
                          <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                  {bulkResult.errors?.length > 0 && (
                    <Box sx={{ mt:1.5, p:1.2, borderRadius:1, bgcolor:'rgba(239,68,68,0.06)',
                      border:'1px solid rgba(239,68,68,0.2)', maxHeight:100, overflow:'auto' }}>
                      {bulkResult.errors.map((e: string, i: number) => (
                        <Typography key={i} variant="caption" color="error.main" sx={{ display:'block' }}>{e}</Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              )}
              {bulkResult?.error && (
                <Alert severity="error">{bulkResult.error}</Alert>
              )}

            </Stack>
          </DialogContent>

          <DialogActions sx={{ px:3, pb:2.5, gap:1, borderTop:'1px solid', borderColor:'divider' }}>
            <Button onClick={() => { setIsBulkOpen(false); setBulkFile(null); setBulkResult(null); }}
              variant="outlined" color="inherit">Close</Button>
            <Button type="submit" variant="contained"
              disabled={!bulkFile || !bulkProject || bulkLoading}
              sx={{ minWidth:160, background:'linear-gradient(90deg,#3b82f6,#6366f1)' }}>
              {bulkLoading
                ? <><CircularProgress size={15} color="inherit" sx={{ mr:1 }} />Importing…</>
                : <><CloudUpload sx={{ fontSize:16, mr:0.8 }} />Upload &amp; Import</>}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>


      {/* ════════════════════════════════════════════════════════
          MODAL: Defect Detail / Edit
      ════════════════════════════════════════════════════════ */}
      <Dialog open={isDetailOpen} onClose={() => setIsDetailOpen(false)} fullWidth maxWidth="lg">
        {selectedDefect && (
          <>
            <DialogTitle sx={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              background:'linear-gradient(135deg,rgba(239,68,68,0.08),rgba(249,115,22,0.08))' }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Typography variant="h5" sx={{ fontFamily:'Outfit', fontWeight:700 }}>{selectedDefect.defect_id}</Typography>
                <Chip label={selectedDefect.status}
                  sx={{ bgcolor:(statColor[selectedDefect.status]||'#6366f1')+'22',
                    color:statColor[selectedDefect.status]||'#6366f1', fontWeight:700 }} />
                <Chip label={selectedDefect.severity} color={sevColor[selectedDefect.severity]||'default'} variant="outlined" size="small" />
                <Chip label={selectedDefect.priority} color={priColor[selectedDefect.priority]||'default'} variant="outlined" size="small" />
              </Stack>
              <IconButton onClick={() => setIsDetailOpen(false)}><Close /></IconButton>
            </DialogTitle>

            <DialogContent dividers sx={{ p: 4 }}>
              <Grid container spacing={4}>

                {/* ── Left: details + comments ── */}
                <Grid item xs={12} md={7}>
                  <Typography variant="h6" gutterBottom>{selectedDefect.title}</Typography>

                  {/* Meta chips */}
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb:2 }} gap={0.5}>
                    {selectedDefect.source_screen && <Chip label={`📍 ${selectedDefect.source_screen}`} size="small" variant="outlined" />}
                    {selectedDefect.bug_type      && <Chip label={selectedDefect.bug_type} size="small" variant="outlined" />}
                    {selectedDefect.reproducible  && <Chip label={`Repro: ${selectedDefect.reproducible}`} size="small"
                      color={selectedDefect.reproducible==='YES'?'error':'success'} variant="outlined" />}
                    {selectedDefect.environment   && <Chip label={selectedDefect.environment} size="small" variant="outlined" />}
                    {selectedDefect.build_number  && <Chip label={`Build: ${selectedDefect.build_number}`} size="small" variant="outlined" />}
                  </Stack>

                  {/* Description / content */}
                  <Box sx={{ p:2, bgcolor:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:2, mb:2.5 }}>
                    <Typography variant="body2" sx={{ whiteSpace:'pre-wrap', lineHeight:1.8 }}>
                      {selectedDefect.description || 'No description provided.'}
                    </Typography>
                  </Box>

                  {/* Comments */}
                  <Typography variant="subtitle1" sx={{ fontWeight:700, mb:1, display:'flex', alignItems:'center', gap:1 }}>
                    <Comment fontSize="small" /> Comments
                  </Typography>
                  <Divider sx={{ mb:1.5 }} />
                  <List sx={{ maxHeight:200, overflow:'auto', mb:2 }}>
                    {selectedDefect.comments.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">No comments yet.</Typography>
                    ) : selectedDefect.comments.map((c: any) => (
                      <ListItem key={c.id} disablePadding sx={{ mb:1.5, display:'block' }}>
                        <Typography variant="caption" color="primary.main" sx={{ fontWeight:700 }}>
                          {c.user?.full_name} · {new Date(c.created_at).toLocaleString()}
                        </Typography>
                        <Typography variant="body2">{c.comment}</Typography>
                      </ListItem>
                    ))}
                  </List>
                  {canUpdate && (
                    <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (selectedDefect && newComment.trim()) commentMut.mutate({ defectId: selectedDefect.id, comment: newComment }); }}
                      sx={{ display:'flex', gap:1 }}>
                      <TextField fullWidth size="small" placeholder="Add comment…" value={newComment} onChange={e => setNewComment(e.target.value)} />
                      <Button type="submit" variant="contained" disabled={!newComment.trim() || commentMut.isPending}>Post</Button>
                    </Box>
                  )}
                </Grid>

                {/* ── Right: properties + audit ── */}
                <Grid item xs={12} md={5}>
                  <Card sx={{ p:2.5, mb:3, bgcolor:'rgba(255,255,255,0.01)' }}>
                    <Typography variant="h6" sx={{ fontFamily:'Outfit', mb:2 }}>Properties</Typography>
                    <Stack spacing={2}>
                      {[
                        { label:'Status',   val:selectedDefect.status,   opts:STATUSES,   key:'status' },
                        { label:'Severity', val:selectedDefect.severity, opts:SEVERITIES, key:'severity' },
                        { label:'Priority', val:selectedDefect.priority, opts:PRIORITIES, key:'priority' },
                      ].map(({ label, val, opts, key }) => (
                        <FormControl key={key} fullWidth size="small">
                          <InputLabel>{label}</InputLabel>
                          <Select value={val} label={label} disabled={!canUpdate}
                            onChange={e => updateMut.mutate({ id: selectedDefect.id, updates: { [key]: e.target.value } })}>
                            {opts.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                          </Select>
                        </FormControl>
                      ))}
                      <FormControl fullWidth size="small">
                        <InputLabel>Assigned To</InputLabel>
                        <Select value={selectedDefect.assigned_to_id || ''} label="Assigned To" disabled={!canUpdate}
                          onChange={e => updateMut.mutate({ id: selectedDefect.id, updates: { assigned_to_id: e.target.value } })}>
                          <MenuItem value=""><em>Unassigned</em></MenuItem>
                          {projectUsers.map((u: any) => <MenuItem key={u.id} value={u.id}>{u.full_name}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Stack>
                  </Card>

                  {/* Attachments */}
                  <Typography variant="subtitle1" sx={{ fontWeight:700, mb:1, display:'flex', alignItems:'center', gap:1 }}>
                    <AttachFile fontSize="small" /> Attachments
                  </Typography>
                  <Divider sx={{ mb:1.5 }} />
                  <List sx={{ mb:1.5 }}>
                    {selectedDefect.attachments.map((a: any) => (
                      <ListItem key={a.id} disablePadding sx={{ mb:0.5 }}>
                        <ListItemText primary={a.filename} secondary={a.file_type || ''} primaryTypographyProps={{ variant:'caption' }} />
                      </ListItem>
                    ))}
                  </List>
                  {canUpdate && (
                    <Stack direction="row" spacing={1}>
                      <input type="file" ref={fileInputRef} style={{ display:'none' }}
                        onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)} />
                      <Button size="small" onClick={() => fileInputRef.current?.click()}>
                        {selectedFile ? selectedFile.name : 'Choose File'}
                      </Button>
                      <Button size="small" variant="contained" disabled={!selectedFile} onClick={() => {
                        if (selectedDefect && selectedFile) attachMut.mutate({ defectId: selectedDefect.id, file: selectedFile });
                      }}>Upload</Button>
                    </Stack>
                  )}

                  {/* Audit Trail */}
                  <Box sx={{ mt:3 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight:700, mb:1, display:'flex', alignItems:'center', gap:1 }}>
                      <History fontSize="small" /> Audit Trail
                    </Typography>
                    <Divider sx={{ mb:1.5 }} />
                    <List sx={{ maxHeight:150, overflow:'auto', p:0 }}>
                      {selectedDefect.audit_history.map((h: any) => (
                        <ListItem key={h.id} disablePadding sx={{ mb:1 }}>
                          <ListItemText
                            primary={`${h.user?.full_name || 'System'} changed ${h.field_name}`}
                            secondary={`${h.old_value || 'None'} → ${h.new_value} · ${new Date(h.changed_at).toLocaleString()}`}
                            primaryTypographyProps={{ variant:'caption', fontWeight:700 }}
                            secondaryTypographyProps={{ variant:'caption' }} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* ════════════════════════════════════════════════════════
          CONFIRM DELETE DIALOG
      ════════════════════════════════════════════════════════ */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, defect: null })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Outfit', fontWeight: 700 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: 'rgba(239,68,68,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DeleteOutline sx={{ color: '#ef4444', fontSize: 20 }} />
            </Box>
            <Typography variant="h6" sx={{ fontFamily: 'Outfit', fontWeight: 700 }}>Delete Defect</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to permanently delete{' '}
            <strong style={{ color: '#6366f1' }}>{deleteConfirm.defect?.defect_id}</strong>?
            <br />This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteConfirm({ open: false, defect: null })} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={deleteMut.isPending}
            onClick={() => deleteConfirm.defect && deleteMut.mutate(deleteConfirm.defect.id)}
            sx={{ bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' }, minWidth: 110 }}>
            {deleteMut.isPending
              ? <><CircularProgress size={14} color="inherit" sx={{ mr: 1 }} />Deleting…</>
              : <><DeleteOutline sx={{ fontSize: 16, mr: 0.5 }} />Delete</>}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default Defects;
