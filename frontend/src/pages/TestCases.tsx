import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Grid, Card, Button, List, ListItem,
  ListItemButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, FormControl, InputLabel, Select, MenuItem,
  Stack, Chip, Divider, Alert, CircularProgress, Tabs, Tab, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Tooltip, LinearProgress, Avatar,
  ToggleButtonGroup, ToggleButton, Snackbar, Menu as MuiMenu,
} from '@mui/material';
import {
  Folder, FolderOpen, Description, PlayArrow, Add, CloudUpload,
  BugReport, PriorityHigh, LowPriority, FlagOutlined, ErrorOutline,
  CheckCircle, Cancel, Block, HelpOutline, TableChart, ViewList,
  Assignment, Timeline, Laptop, DataObject,
  MoreVert, EditOutlined, DeleteOutline,
} from '@mui/icons-material';
import { RootState } from '../store';
import api from '../services/api';
import { usePermission } from '../hooks/usePermission';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS & CONFIG
═══════════════════════════════════════════════════════════════ */
const PRIORITY_CFG = {
  Critical: { color: 'error'   as const, icon: <ErrorOutline sx={{ fontSize: 13 }} /> },
  High:     { color: 'warning' as const, icon: <PriorityHigh sx={{ fontSize: 13 }} /> },
  Medium:   { color: 'info'    as const, icon: <FlagOutlined  sx={{ fontSize: 13 }} /> },
  Low:      { color: 'default' as const, icon: <LowPriority   sx={{ fontSize: 13 }} /> },
} as const;

const STATUS_CFG = {
  Passed:   { color: 'success' as const, icon: <CheckCircle sx={{ fontSize: 13 }} /> },
  Failed:   { color: 'error'   as const, icon: <Cancel       sx={{ fontSize: 13 }} /> },
  Blocked:  { color: 'warning' as const, icon: <Block        sx={{ fontSize: 13 }} /> },
  Skipped:  { color: 'default' as const, icon: <HelpOutline  sx={{ fontSize: 13 }} /> },
  Untested: { color: 'default' as const, icon: <HelpOutline  sx={{ fontSize: 13 }} /> },
} as const;

const TEST_TYPES  = ['Functional','Regression','Smoke','Sanity','UAT','Integration','Performance','Security','Exploratory'];
const ENVIRONMENTS = [
  'Chrome / Windows / Staging',
  'Firefox / Windows / Staging',
  'Safari / macOS / Staging',
  'Chrome / Windows / Production',
  'Mobile Android / Staging',
  'Mobile iOS / Staging',
  'API / Postman / Staging',
];
const PRIORITIES    = ['Critical','High','Medium','Low'];
const EXEC_STATUSES = ['Passed','Failed','Blocked','Skipped'];

/* ═══════════════════════════════════════════════════════════════
   BADGE HELPERS
═══════════════════════════════════════════════════════════════ */
const PriorityBadge = ({ priority }: { priority: string }) => {
  const cfg = PRIORITY_CFG[priority as keyof typeof PRIORITY_CFG] ?? PRIORITY_CFG.Medium;
  return (
    <Chip label={priority} color={cfg.color} icon={cfg.icon} size="small"
      variant="outlined" sx={{ fontWeight: 600, fontSize: 10, height: 20 }} />
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.Untested;
  return (
    <Chip label={status} color={cfg.color} icon={cfg.icon} size="small"
      sx={{ fontWeight: 600, fontSize: 10, height: 20 }} />
  );
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="overline"
    sx={{ color: 'text.disabled', fontSize: 10, letterSpacing: 1.2, display: 'block', mb: 0.5 }}>
    {children}
  </Typography>
);

/* ═══════════════════════════════════════════════════════════════
   INITIAL FORM STATE FACTORIES
═══════════════════════════════════════════════════════════════ */
const initSf = () => ({
  title:              '',
  module:             '',
  description:        '',
  objective:          '',
  precondition:       '',
  post_condition:     '',
  priority:           'Medium',
  test_type:          'Functional',
  requirement_id:     null as number | null,
  create_test_case:   false,
  tc_steps:           '',
  tc_expected_result: '',
  tc_test_data:       '',
  log_execution:      false,
  exec_status:        'Passed',
  exec_actual_result: '',
  exec_environment:   '',
  exec_comments:      '',
});

const initTcf = () => ({
  title:              '',
  priority:           'Medium',
  test_type:          'Functional',
  precondition:       '',
  steps:              '',
  test_data:          '',
  expected_result:    '',
  post_condition:     '',
  log_execution:      false,
  exec_status:        'Passed',
  exec_actual_result: '',
  exec_environment:   '',
  exec_comments:      '',
});


const initEf = () => ({
  status:           'Passed',
  actual_result:    '',
  test_environment: '',
  comments:         '',
  build_number:     '',
  defect_id:        null as number | null,
  run_type:         'Manual',
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const TestCases: React.FC = () => {
  const queryClient = useQueryClient();
  const filters = useSelector((state: RootState) => state.filters);

  const canCreate = usePermission('create');
  const canUpdate = usePermission('update');
  const canDelete = usePermission('delete');
  const canApprove = usePermission('approve');

  /* ── View ─────────────────────────────────────────────────── */
  const [viewMode, setViewMode]                 = useState<'detail'|'table'>('detail');
  const [selectedScenarioId, setSelectedScenarioId] = useState<number|null>(null);
  const [selectedTC, setSelectedTC]             = useState<any|null>(null);
  const [detailTab, setDetailTab]               = useState(0);

  /* ── Modals ───────────────────────────────────────────────── */
  const [openScenario, setOpenScenario] = useState(false);
  const [openTestCase, setOpenTestCase] = useState(false);
  const [openRun,      setOpenRun]      = useState(false);
  const [openUpload,   setOpenUpload]   = useState(false);
  const [openBulkUpload, setOpenBulkUpload] = useState(false);
  const [bulkUploadType, setBulkUploadType] = useState<'scenarios'|'testcases'>('scenarios');
  const [bulkFile,       setBulkFile]       = useState<File|null>(null);
  const [bulkResult,     setBulkResult]     = useState<any|null>(null);

  /* ── Bulk Import – Context / Cascading State ──────────────── */
  const [bulkCtx, setBulkCtx] = useState({
    groupId:       null as number | null,
    companyId:     null as number | null,
    projectId:     null as number | null,
    applicationId: null as number | null,
    releaseId:     null as number | null,
    sprintId:      null as number | null,
  });
  const [bulkGroups,       setBulkGroups]       = useState<any[]>([]);
  const [bulkCompanies,    setBulkCompanies]    = useState<any[]>([]);
  const [bulkProjects,     setBulkProjects]     = useState<any[]>([]);
  const [bulkApplications, setBulkApplications] = useState<any[]>([]);
  const [bulkReleases,     setBulkReleases]     = useState<any[]>([]);
  const [bulkSprints,      setBulkSprints]      = useState<any[]>([]);
  const [bulkCtxLoading,   setBulkCtxLoading]   = useState(false);

  /* ── Automation Upload – Context / Cascading State ────────── */
  const [autoCtx, setAutoCtx] = useState({
    groupId:       null as number | null,
    companyId:     null as number | null,
    projectId:     null as number | null,
    applicationId: null as number | null,
    releaseId:     null as number | null,
    sprintId:      null as number | null,
  });
  const [autoGroups,       setAutoGroups]       = useState<any[]>([]);
  const [autoCompanies,    setAutoCompanies]    = useState<any[]>([]);
  const [autoProjects,     setAutoProjects]     = useState<any[]>([]);
  const [autoApplications, setAutoApplications] = useState<any[]>([]);
  const [autoReleases,     setAutoReleases]     = useState<any[]>([]);
  const [autoSprints,      setAutoSprints]      = useState<any[]>([]);
  const [autoCtxLoading,   setAutoCtxLoading]   = useState(false);

  /* ── Toast ────────────────────────────────────────────────── */
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' }|null>(null);

  /* ── Row actions: Scenarios ───────────────────────────────── */
  const [scenMenuAnchor, setScenMenuAnchor] = useState<HTMLElement | null>(null);
  const [scenMenuTarget, setScenMenuTarget] = useState<any | null>(null);   // scenario being right-clicked
  const [editScenario,   setEditScenario]   = useState<any | null>(null);   // pre-fill scenario form
  const [deleteScenConfirm, setDeleteScenConfirm] = useState<{ open: boolean; scen: any | null }>({ open: false, scen: null });

  /* ── Row actions: Test Cases ──────────────────────────────── */
  const [editTC,         setEditTC]         = useState<any | null>(null);   // pre-fill TC form
  const [deleteTCConfirm, setDeleteTCConfirm] = useState<{ open: boolean; tc: any | null }>({ open: false, tc: null });

  /* ── Forms ────────────────────────────────────────────────── */
  const [sf,  setSf]  = useState(initSf());
  const [tcf, setTcf] = useState(initTcf());
  const [ef,  setEf]  = useState(initEf());
  const [uf,  setUf]  = useState({ build: '', framework: 'Playwright', environment: 'QA', testType: 'Regression' });
  const [uploadFile,   setUploadFile]   = useState<File|null>(null);
  const [uploadResult, setUploadResult] = useState<any|null>(null);

  // Step-wise Execution state
  const [stepStatuses, setStepStatuses] = useState<{ [key: number]: { status: string; actual_result: string } }>({});

  const parseTestSteps = (stepsText: string): string[] => {
    if (!stepsText) return [];
    return stepsText
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s.replace(/^\d+[\.\)\s\-]+/, '').trim())
      .filter(s => s.length > 0);
  };

  const updateStepStatus = (index: number, status: string) => {
    const nextStatuses = {
      ...stepStatuses,
      [index]: { ...stepStatuses[index], status }
    };
    setStepStatuses(nextStatuses);
    
    // Recalculate overall status
    const statuses = Object.values(nextStatuses).map(s => s.status);
    let nextOverall = 'Passed';
    if (statuses.includes('Failed')) {
      nextOverall = 'Failed';
    } else if (statuses.includes('Blocked')) {
      nextOverall = 'Blocked';
    } else if (statuses.includes('Skipped')) {
      nextOverall = 'Skipped';
    }
    setEf(prev => ({ ...prev, status: nextOverall }));
  };

  const updateStepActualResult = (index: number, actual_result: string) => {
    setStepStatuses(prev => ({
      ...prev,
      [index]: { ...prev[index], actual_result }
    }));
  };

  /* ── Supporting data ──────────────────────────────────────── */
  const [requirements, setRequirements] = useState<any[]>([]);
  const [defectsList,  setDefectsList]  = useState<any[]>([]);

  /* ── Queries ──────────────────────────────────────────────── */
  const { data: scenarios = [], isLoading: scenLoading } = useQuery({
    // ALL 4 filter dimensions in the queryKey — any change triggers a fresh fetch
    queryKey: ['scenarios', filters.projectId, filters.applicationId, filters.releaseId, filters.sprintId],
    queryFn:  () => {
      let url = `/testcases/scenarios?project_id=${filters.projectId}`;
      if (filters.applicationId) url += `&application_id=${filters.applicationId}`;
      if (filters.releaseId)     url += `&release_id=${filters.releaseId}`;
      if (filters.sprintId)      url += `&sprint_id=${filters.sprintId}`;
      return api.get(url).then(r => r.data);
    },
    enabled:  !!filters.projectId,
  });

  // Reset selected scenario when project/app/release/sprint filters change
  // so stale selection from a previous filter context is cleared
  useEffect(() => {
    setSelectedScenarioId(null);
    setSelectedTC(null);
  }, [filters.projectId, filters.applicationId, filters.releaseId, filters.sprintId]);

  const { data: testCases = [], isLoading: tcLoading } = useQuery({
    queryKey: ['testCases', selectedScenarioId],
    queryFn:  () => api.get(`/testcases/test-cases?test_scenario_id=${selectedScenarioId}`).then(r => r.data),
    enabled:  !!selectedScenarioId,
  });

  useEffect(() => {
    if (!filters.projectId) return;
    let reqUrl = `/testcases/requirements?project_id=${filters.projectId}`;
    if (filters.applicationId) reqUrl += `&application_id=${filters.applicationId}`;
    api.get(reqUrl).then(r => setRequirements(r.data)).catch(()=>{});
    api.get(`/defects?project_id=${filters.projectId}`).then(r => setDefectsList(r.data)).catch(()=>{});
  }, [filters.projectId, filters.applicationId]);

  /* ── Bulk Import – initialise context when modal opens ────── */
  useEffect(() => {
    if (!openBulkUpload) return;
    setBulkCtxLoading(true);
    const init = async () => {
      try {
        const grpsR = await api.get('/org/groups');
        setBulkGroups(grpsR.data);
        // Pre-fill from global filter state
        setBulkCtx({
          groupId:       filters.groupId,
          companyId:     filters.companyId,
          projectId:     filters.projectId,
          applicationId: filters.applicationId,
          releaseId:     filters.releaseId,
          sprintId:      filters.sprintId,
        });
        if (filters.groupId) {
          const comsR = await api.get(`/org/companies?group_id=${filters.groupId}`);
          setBulkCompanies(comsR.data);
        }
        if (filters.companyId) {
          const projsR = await api.get(`/org/projects?company_id=${filters.companyId}`);
          setBulkProjects(projsR.data);
        }
        if (filters.projectId) {
          const appQ = filters.applicationId ? `&application_id=${filters.applicationId}` : '';
          const [appsR, relsR, sprsR] = await Promise.all([
            api.get(`/org/applications?project_id=${filters.projectId}`),
            api.get(`/work/releases?project_id=${filters.projectId}${appQ}`),
            api.get(`/work/sprints?project_id=${filters.projectId}${appQ}`),
          ]);
          setBulkApplications(appsR.data);
          setBulkReleases(relsR.data);
          setBulkSprints(sprsR.data);
        }
      } catch (_) { /* silent */ }
      setBulkCtxLoading(false);
    };
    init();
  }, [openBulkUpload]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Automation Upload – initialise context when modal opens ── */
  useEffect(() => {
    if (!openUpload) return;
    setAutoCtxLoading(true);
    setUploadResult(null);
    const init = async () => {
      try {
        const grpsR = await api.get('/org/groups');
        setAutoGroups(grpsR.data);
        // Pre-fill from global filter state
        setAutoCtx({
          groupId:       filters.groupId,
          companyId:     filters.companyId,
          projectId:     filters.projectId,
          applicationId: filters.applicationId,
          releaseId:     filters.releaseId,
          sprintId:      filters.sprintId,
        });
        if (filters.groupId) {
          const comsR = await api.get(`/org/companies?group_id=${filters.groupId}`);
          setAutoCompanies(comsR.data);
        }
        if (filters.companyId) {
          const projsR = await api.get(`/org/projects?company_id=${filters.companyId}`);
          setAutoProjects(projsR.data);
        }
        if (filters.projectId) {
          const appQ = filters.applicationId ? `&application_id=${filters.applicationId}` : '';
          const [appsR, relsR, sprsR] = await Promise.all([
            api.get(`/org/applications?project_id=${filters.projectId}`),
            api.get(`/work/releases?project_id=${filters.projectId}${appQ}`),
            api.get(`/work/sprints?project_id=${filters.projectId}${appQ}`),
          ]);
          setAutoApplications(appsR.data);
          setAutoReleases(relsR.data);
          setAutoSprints(sprsR.data);
        }
      } catch (_) { /* silent */ }
      setAutoCtxLoading(false);
    };
    init();
  }, [openUpload]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Mutations ────────────────────────────────────────────── */
  const createScenario = useMutation({
    mutationFn: (body: any) => api.post('/testcases/scenarios', body).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      setOpenScenario(false);
      setSf(initSf());
      setToast({ msg: 'Scenario created successfully!', type: 'success' });
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d:any) => d.msg).join('; ')
          : 'Failed to create scenario. Please check all required fields.';
      setToast({ msg, type: 'error' });
    },
  });

  const createTC = useMutation({
    mutationFn: (body: any) => api.post('/testcases/test-cases', body).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testCases'] });
      setOpenTestCase(false);
      setTcf(initTcf());
      setToast({ msg: 'Test case created successfully!', type: 'success' });
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d:any) => d.msg).join('; ')
          : 'Failed to create test case.';
      setToast({ msg, type: 'error' });
    },
  });

  const createExecution = useMutation({
    mutationFn: (body: any) => api.post('/testcases/executions', body).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testCases'] });
      setOpenRun(false);
      setEf(initEf());
      setToast({ msg: 'Execution logged!', type: 'success' });
    },
    onError: () => setToast({ msg: 'Failed to log execution.', type: 'error' }),
  });

  const uploadAutomation = useMutation({
    mutationFn: (fd: FormData) => api.post('/automation/upload-results', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
    onSuccess: (data) => { setUploadResult(data); queryClient.invalidateQueries({ queryKey: ['scenarios'] }); },
    onError: () => setToast({ msg: 'Upload failed.', type: 'error' }),
  });

  const bulkUpload = useMutation({
    mutationFn: ({ type, fd }: { type: string; fd: FormData }) => 
      api.post(`/testcases/upload/${type}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
    onSuccess: (data) => {
      setBulkResult(data);
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      queryClient.invalidateQueries({ queryKey: ['testCases'] });
      setToast({ msg: 'Bulk import completed successfully!', type: 'success' });
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => d.msg).join('; ')
          : 'Bulk upload failed.';
      setToast({ msg, type: 'error' });
    },
  });

  /* ── CRUD mutations: Scenarios ────────────────────────────── */
  const updateScenario = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      api.patch(`/testcases/scenarios/${id}`, body).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      setOpenScenario(false);
      setEditScenario(null);
      setSf(initSf());
      setToast({ msg: 'Scenario updated!', type: 'success' });
    },
    onError: () => setToast({ msg: 'Failed to update scenario.', type: 'error' }),
  });

  const deleteScenario = useMutation({
    mutationFn: (id: number) => api.delete(`/testcases/scenarios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      setDeleteScenConfirm({ open: false, scen: null });
      setToast({ msg: 'Scenario deleted.', type: 'success' });
    },
    onError: () => setToast({ msg: 'Failed to delete scenario.', type: 'error' }),
  });

  /* ── CRUD mutations: Test Cases ───────────────────────────── */
  const updateTC = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      api.patch(`/testcases/test-cases/${id}`, body).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['testCases'] });
      setOpenTestCase(false);
      setEditTC(null);
      setTcf(initTcf());
      if (selectedTC?.id === data.id) setSelectedTC(data);
      setToast({ msg: 'Test case updated!', type: 'success' });
    },
    onError: () => setToast({ msg: 'Failed to update test case.', type: 'error' }),
  });

  const deleteTCMut = useMutation({
    mutationFn: (id: number) => api.delete(`/testcases/test-cases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testCases'] });
      setDeleteTCConfirm({ open: false, tc: null });
      if (selectedTC?.id === deleteTCConfirm.tc?.id) setSelectedTC(null);
      setToast({ msg: 'Test case deleted.', type: 'success' });
    },
    onError: () => setToast({ msg: 'Failed to delete test case.', type: 'error' }),
  });

  /* ── Edit helpers ─────────────────────────────────────────── */
  const handleOpenEditScenario = (scen: any) => {
    setSf(_ => ({
      ...initSf(),
      title:          scen.title       || '',
      module:         scen.module      || '',
      description:    scen.description || '',
      objective:      scen.objective   || '',
      precondition:   scen.precondition  || '',
      post_condition: scen.post_condition || '',
      priority:       scen.priority    || 'Medium',
      test_type:      scen.test_type   || 'Functional',
      requirement_id: scen.requirement_id ? Number(scen.requirement_id) : null,
    }));
    setEditScenario(scen);
    setOpenScenario(true);
  };

  const handleOpenEditTC = (tc: any) => {
    setTcf({
      ...initTcf(),
      title:              tc.title           || '',
      precondition:       tc.precondition    || '',
      steps:              tc.steps           || '',
      expected_result:    tc.expected_result || '',
      post_condition:     tc.post_condition  || '',
      priority:           tc.priority        || 'Medium',
      test_type:          tc.test_type       || 'Functional',
      test_data:          tc.test_data       || '',
    });
    setEditTC(tc);
    setSelectedScenarioId(tc.test_scenario_id);
    setOpenTestCase(true);
  };

  /* ── Stats ────────────────────────────────────────────────── */
  const scenarioStats = useCallback(() => {
    if (!testCases.length) return { total:0, passed:0, failed:0, blocked:0, untested:0, pct:0 };
    const c = { total: testCases.length, passed:0, failed:0, blocked:0, untested:0 };
    testCases.forEach((tc: any) => {
      const last = tc.executions.length ? tc.executions[tc.executions.length-1].status : 'Untested';
      if (last==='Passed') c.passed++;
      else if (last==='Failed') c.failed++;
      else if (last==='Blocked') c.blocked++;
      else c.untested++;
    });
    return { ...c, pct: Math.round((c.passed/c.total)*100) };
  }, [testCases]);

  /* ── Handlers ─────────────────────────────────────────────── */
  const handleCreateScenario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sf.title.trim()) return;
    if (editScenario) {
      updateScenario.mutate({
        id: editScenario.id,
        body: {
          title:       sf.title.trim(),
          module:      sf.module.trim()      || null,
          description: sf.description.trim() || null,
          priority:    sf.priority,
        },
      });
    } else {
      if (!filters.projectId) return;
      createScenario.mutate({
        title:              sf.title.trim(),
        module:             sf.module.trim()         || null,
        description:        sf.description.trim()    || null,
        objective:          sf.objective.trim()      || null,
        precondition:       sf.precondition.trim()   || null,
        post_condition:     sf.post_condition.trim() || null,
        priority:           sf.priority,
        test_type:          sf.test_type,
        project_id:         Number(filters.projectId),
        application_id:     filters.applicationId ? Number(filters.applicationId) : null,
        requirement_id:     sf.requirement_id,
        create_test_case:   sf.create_test_case,
        tc_steps:           sf.tc_steps.trim()           || null,
        tc_expected_result: sf.tc_expected_result.trim() || null,
        tc_test_data:       sf.tc_test_data.trim()       || null,
        log_execution:      sf.log_execution,
        exec_status:        sf.exec_status,
        exec_actual_result: sf.exec_actual_result.trim() || null,
        exec_environment:   sf.exec_environment.trim()   || null,
        exec_comments:      sf.exec_comments.trim()      || null,
      });
    }
  };

  const handleCreateTC = (e: React.FormEvent) => {
    e.preventDefault();
    if (editTC) {
      updateTC.mutate({
        id: editTC.id,
        body: {
          title:           tcf.title.trim(),
          priority:        tcf.priority,
          test_type:       tcf.test_type,
          precondition:    tcf.precondition.trim()   || null,
          steps:           tcf.steps,
          test_data:       tcf.test_data.trim()      || null,
          expected_result: tcf.expected_result,
          post_condition:  tcf.post_condition.trim() || null,
        },
      });
    } else {
      if (!selectedScenarioId) return;
      createTC.mutate({
        title:              tcf.title.trim(),
        priority:           tcf.priority,
        test_type:          tcf.test_type,
        precondition:       tcf.precondition.trim()   || null,
        steps:              tcf.steps,
        test_data:          tcf.test_data.trim()      || null,
        expected_result:    tcf.expected_result,
        post_condition:     tcf.post_condition.trim() || null,
        test_scenario_id:   selectedScenarioId,
        log_execution:      tcf.log_execution,
        exec_status:        tcf.exec_status,
        exec_actual_result: tcf.exec_actual_result.trim() || null,
        exec_environment:   tcf.exec_environment.trim()   || null,
        exec_comments:      tcf.exec_comments.trim()      || null,
      });
    }
  };


  const handleLogRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTC) return;
    
    const steps = parseTestSteps(selectedTC.steps);
    const stepResultsList = steps.map((step, idx) => ({
      step_number: idx + 1,
      step_text: step,
      status: stepStatuses[idx]?.status || 'Passed',
      actual_result: stepStatuses[idx]?.actual_result || '',
    }));

    createExecution.mutate({
      test_case_id:     selectedTC.id,
      status:           ef.status,
      actual_result:    ef.actual_result    || null,
      step_results:     JSON.stringify(stepResultsList),
      test_environment: ef.test_environment || null,
      comments:         ef.comments         || null,
      build_number:     ef.build_number     || null,
      defect_id:        ef.defect_id,
      run_type:         ef.run_type,
    });
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!autoCtx.projectId || !uploadFile) return;
    const fd = new FormData();
    fd.append('project_id', String(autoCtx.projectId));
    fd.append('build_number', uf.build);
    fd.append('framework', uf.framework);
    fd.append('environment', uf.environment);
    fd.append('test_type', uf.testType);
    if (autoCtx.applicationId) fd.append('application_id', String(autoCtx.applicationId));
    if (autoCtx.releaseId)     fd.append('release_id',     String(autoCtx.releaseId));
    if (autoCtx.sprintId)      fd.append('sprint_id',      String(autoCtx.sprintId));
    fd.append('file', uploadFile);
    uploadAutomation.mutate(fd);
  };

  /* ── Automation Upload – Cascade Handlers ─────────────────── */
  const handleAutoGroupChange = async (gId: number | null) => {
    setAutoCtx(p => ({ ...p, groupId: gId, companyId: null, projectId: null, applicationId: null, releaseId: null, sprintId: null }));
    setAutoCompanies([]); setAutoProjects([]); setAutoApplications([]); setAutoReleases([]); setAutoSprints([]);
    if (!gId) return;
    const r = await api.get(`/org/companies?group_id=${gId}`).catch(() => ({ data: [] }));
    setAutoCompanies(r.data);
  };

  const handleAutoCompanyChange = async (cId: number | null) => {
    setAutoCtx(p => ({ ...p, companyId: cId, projectId: null, applicationId: null, releaseId: null, sprintId: null }));
    setAutoProjects([]); setAutoApplications([]); setAutoReleases([]); setAutoSprints([]);
    if (!cId) return;
    const r = await api.get(`/org/projects?company_id=${cId}`).catch(() => ({ data: [] }));
    setAutoProjects(r.data);
  };

  const handleAutoProjectChange = async (pId: number | null) => {
    setAutoCtx(p => ({ ...p, projectId: pId, applicationId: null, releaseId: null, sprintId: null }));
    setAutoApplications([]); setAutoReleases([]); setAutoSprints([]);
    if (!pId) return;
    const [appsR, relsR, sprsR] = await Promise.all([
      api.get(`/org/applications?project_id=${pId}`).catch(() => ({ data: [] })),
      api.get(`/work/releases?project_id=${pId}`).catch(()  => ({ data: [] })),
      api.get(`/work/sprints?project_id=${pId}`).catch(()   => ({ data: [] })),
    ]);
    setAutoApplications(appsR.data);
    setAutoReleases(relsR.data);
    setAutoSprints(sprsR.data);
  };

  const handleAutoAppChange = async (aId: number | null, curProjectId: number | null) => {
    setAutoCtx(p => ({ ...p, applicationId: aId, releaseId: null, sprintId: null }));
    if (!curProjectId) return;
    const appQ = aId ? `&application_id=${aId}` : '';
    const [relsR, sprsR] = await Promise.all([
      api.get(`/work/releases?project_id=${curProjectId}${appQ}`).catch(() => ({ data: [] })),
      api.get(`/work/sprints?project_id=${curProjectId}${appQ}`).catch(()  => ({ data: [] })),
    ]);
    setAutoReleases(relsR.data);
    setAutoSprints(sprsR.data);
  };

  const handleBulkUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkCtx.projectId || !bulkFile) return;
    const fd = new FormData();
    fd.append('project_id', String(bulkCtx.projectId));
    if (bulkCtx.applicationId) fd.append('application_id', String(bulkCtx.applicationId));
    if (bulkCtx.releaseId)     fd.append('release_id',     String(bulkCtx.releaseId));
    if (bulkCtx.sprintId)      fd.append('sprint_id',      String(bulkCtx.sprintId));
    fd.append('file', bulkFile);
    bulkUpload.mutate({ type: bulkUploadType, fd });
  };

  /* ── Bulk Import – Cascade Handlers (each clears downstream) ── */
  const handleBulkGroupChange = async (gId: number | null) => {
    setBulkCtx(p => ({ ...p, groupId: gId, companyId: null, projectId: null, applicationId: null, releaseId: null, sprintId: null }));
    setBulkCompanies([]); setBulkProjects([]); setBulkApplications([]); setBulkReleases([]); setBulkSprints([]);
    if (!gId) return;
    const r = await api.get(`/org/companies?group_id=${gId}`).catch(() => ({ data: [] }));
    setBulkCompanies(r.data);
  };

  const handleBulkCompanyChange = async (cId: number | null) => {
    setBulkCtx(p => ({ ...p, companyId: cId, projectId: null, applicationId: null, releaseId: null, sprintId: null }));
    setBulkProjects([]); setBulkApplications([]); setBulkReleases([]); setBulkSprints([]);
    if (!cId) return;
    const r = await api.get(`/org/projects?company_id=${cId}`).catch(() => ({ data: [] }));
    setBulkProjects(r.data);
  };

  const handleBulkProjectChange = async (pId: number | null) => {
    setBulkCtx(p => ({ ...p, projectId: pId, applicationId: null, releaseId: null, sprintId: null }));
    setBulkApplications([]); setBulkReleases([]); setBulkSprints([]);
    if (!pId) return;
    const [appsR, relsR, sprsR] = await Promise.all([
      api.get(`/org/applications?project_id=${pId}`).catch(() => ({ data: [] })),
      api.get(`/work/releases?project_id=${pId}`).catch(()  => ({ data: [] })),
      api.get(`/work/sprints?project_id=${pId}`).catch(()   => ({ data: [] })),
    ]);
    setBulkApplications(appsR.data);
    setBulkReleases(relsR.data);
    setBulkSprints(sprsR.data);
  };

  const handleBulkAppChange = async (aId: number | null, curProjectId: number | null) => {
    setBulkCtx(p => ({ ...p, applicationId: aId, releaseId: null, sprintId: null }));
    if (!curProjectId) return;
    const appQ = aId ? `&application_id=${aId}` : '';
    const [relsR, sprsR] = await Promise.all([
      api.get(`/work/releases?project_id=${curProjectId}${appQ}`).catch(() => ({ data: [] })),
      api.get(`/work/sprints?project_id=${curProjectId}${appQ}`).catch(()  => ({ data: [] })),
    ]);
    setBulkReleases(relsR.data);
    setBulkSprints(sprsR.data);
  };

  const handleDownloadTemplate = (type: string, format: string) => {
    const url = `${api.defaults.baseURL || '/api/v1'}/testcases/templates/download?type=${type}&format=${format}`;
    window.open(url, '_blank');
  };


  const openRunModal = (tc: any) => {
    setSelectedTC(tc);
    
    const steps = parseTestSteps(tc.steps);
    const initialStatuses: { [key: number]: { status: string; actual_result: string } } = {};
    steps.forEach((_, idx) => {
      initialStatuses[idx] = { status: 'Passed', actual_result: '' };
    });
    setStepStatuses(initialStatuses);

    setEf({
      status: 'Passed',
      actual_result: '',
      test_environment: tc.executions?.[tc.executions.length-1]?.test_environment || '',
      comments: '',
      build_number: tc.executions?.[tc.executions.length-1]?.build_number || '',
      defect_id: null,
      run_type: 'Manual',
    });
    setOpenRun(true);
  };

  /* Open TC modal with a pre-selected scenario */
  const openAddTcForScenario = (scenId: number) => {
    setSelectedScenarioId(scenId);
    setOpenTestCase(true);
  };

  /* ── Derived ──────────────────────────────────────────────── */
  const selectedScenario = scenarios.find((s: any) => s.id === selectedScenarioId);
  const stats = scenarioStats();

  /* ── Active filter label helpers (for context banner) ─────── */

  /* ═══════════════════════════════════════════════════════════
     TABLE VIEW
  ═══════════════════════════════════════════════════════════ */
  const renderTableView = () => (
    <TableContainer component={Paper} sx={{ maxHeight: 560, borderRadius: 2 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow sx={{ '& th': { fontWeight:700, fontSize:11, letterSpacing:0.5,
            textTransform:'uppercase', bgcolor:'background.paper',
            borderBottom:'2px solid', borderColor:'divider' } }}>
            <TableCell>Test Case ID</TableCell>
            <TableCell>Module</TableCell>
            <TableCell sx={{ minWidth: 200 }}>Test Case Description</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell>Type</TableCell>
            <TableCell sx={{ minWidth: 150 }}>Pre Conditions</TableCell>
            <TableCell sx={{ minWidth: 190 }}>Test Steps</TableCell>
            <TableCell sx={{ minWidth: 110 }}>Test Data</TableCell>
            <TableCell sx={{ minWidth: 150 }}>Expected Result</TableCell>
            <TableCell sx={{ minWidth: 150 }}>Actual Result</TableCell>
            <TableCell>Status</TableCell>
            <TableCell sx={{ minWidth: 150 }}>Post Conditions</TableCell>
            <TableCell sx={{ minWidth: 130 }}>Test Environment</TableCell>
            <TableCell sx={{ minWidth: 120 }}>Notes</TableCell>
            <TableCell>Tested By</TableCell>
            <TableCell>Test Date</TableCell>
            <TableCell sx={{ minWidth: 120 }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {testCases.map((tc: any) => {
            const lastExec   = tc.executions.length ? tc.executions[tc.executions.length - 1] : null;
            const execStatus = lastExec?.status ?? 'Untested';
            return (
              <TableRow key={tc.id} hover>
                <TableCell><Typography variant="caption" sx={{ fontFamily:'monospace', fontWeight:600, color:'primary.main' }}>{tc.test_case_id}</Typography></TableCell>
                <TableCell><Typography variant="caption">{selectedScenario?.module ?? '—'}</Typography></TableCell>
                <TableCell><Typography variant="body2" sx={{ fontWeight:500 }}>{tc.title}</Typography></TableCell>
                <TableCell><PriorityBadge priority={tc.priority} /></TableCell>
                <TableCell><Chip label={tc.test_type ?? 'Functional'} size="small" variant="outlined" sx={{ fontSize:10, height:18 }} /></TableCell>
                <TableCell><Typography variant="caption" sx={{ whiteSpace:'pre-line' }}>{tc.precondition ?? '—'}</Typography></TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ whiteSpace:'pre-line', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                    {tc.steps}
                  </Typography>
                </TableCell>
                <TableCell><Typography variant="caption" sx={{ whiteSpace:'pre-line' }}>{tc.test_data ?? '—'}</Typography></TableCell>
                <TableCell><Typography variant="caption">{tc.expected_result}</Typography></TableCell>
                <TableCell><Typography variant="caption">{lastExec?.actual_result ?? '—'}</Typography></TableCell>
                <TableCell><StatusBadge status={execStatus} /></TableCell>
                <TableCell><Typography variant="caption">{tc.post_condition ?? '—'}</Typography></TableCell>
                <TableCell><Typography variant="caption">{lastExec?.test_environment ?? '—'}</Typography></TableCell>
                <TableCell><Typography variant="caption">{lastExec?.comments ?? '—'}</Typography></TableCell>
                <TableCell><Typography variant="caption">{lastExec?.executed_by?.full_name ?? '—'}</Typography></TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {lastExec ? new Date(lastExec.executed_at).toLocaleDateString() : '—'}
                  </Typography>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => handleOpenEditTC(tc)}
                      sx={{ color:'#f59e0b', '&:hover':{ bgcolor:'rgba(245,158,11,0.1)' } }}>
                      <EditOutlined sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => setDeleteTCConfirm({ open: true, tc })}
                      sx={{ color:'#ef4444', '&:hover':{ bgcolor:'rgba(239,68,68,0.1)' } }}>
                      <DeleteOutline sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Execute Test">
                    <IconButton size="small" color="success" onClick={() => openRunModal(tc)}>
                      <PlayArrow fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  /* ═══════════════════════════════════════════════════════════
     DETAIL VIEW
  ═══════════════════════════════════════════════════════════ */
  const renderDetailView = () => (
    <Grid container spacing={2.5}>
      {/* ── Test Case List ──────────────────────────────── */}
      <Grid item xs={12} md={5}>
        <Card sx={{ height: 560, overflow: 'auto' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="subtitle1" sx={{ fontFamily:'Outfit', fontWeight:700 }}>Test Cases</Typography>
                {selectedScenario && (
                  <Typography variant="caption" color="text.secondary">
                    {selectedScenario.title}
                  </Typography>
                )}
              </Box>
              {selectedScenarioId && canCreate && (
                <Button size="small" startIcon={<Add />} variant="contained"
                  onClick={() => setOpenTestCase(true)}
                  sx={{ background:'linear-gradient(90deg,#3b82f6,#8b5cf6)', fontSize:11 }}>
                  Add Test Case
                </Button>
              )}
            </Stack>
          </Box>

          {!selectedScenarioId ? (
            <Box sx={{ p:3, textAlign:'center', pt:5 }}>
              <Assignment sx={{ fontSize:48, color:'text.disabled', mb:1 }} />
              <Typography variant="body2" color="text.secondary">
                Select a scenario from the left panel
              </Typography>
            </Box>
          ) : tcLoading ? (
            <Box sx={{ p:3, display:'flex', justifyContent:'center' }}>
              <CircularProgress size={28} />
            </Box>
          ) : testCases.length === 0 ? (
            <Box sx={{ p:3, textAlign:'center', pt:5 }}>
              <Description sx={{ fontSize:48, color:'text.disabled', mb:1 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb:2 }}>
                No test cases yet for this scenario
              </Typography>
              {canCreate && (
                <Button variant="contained" startIcon={<Add />}
                  onClick={() => setOpenTestCase(true)}
                  sx={{ background:'linear-gradient(90deg,#3b82f6,#8b5cf6)' }}>
                  Add First Test Case
                </Button>
              )}
            </Box>
          ) : (
            <List sx={{ p:1 }}>
              {testCases.map((tc: any) => {
                const lastExec   = tc.executions.length ? tc.executions[tc.executions.length - 1] : null;
                const execStatus = lastExec?.status ?? 'Untested';
                return (
                  <ListItem key={tc.id} disablePadding sx={{ mb:0.5,
                    '&:hover .tc-row-actions': { opacity: 1 } }}>
                    <ListItemButton
                      selected={selectedTC?.id === tc.id}
                      onClick={() => { setSelectedTC(tc); setDetailTab(0); }}
                      sx={{ borderRadius:2, py:1.5 }}>
                      <Box sx={{ width:'100%' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box sx={{ flex:1, minWidth:0 }}>
                            <Typography variant="caption"
                              sx={{ fontFamily:'monospace', color:'primary.main', fontWeight:600 }}>
                              {tc.test_case_id}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight:500, mt:0.2, lineHeight:1.3 }}>
                              {tc.title}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={0.2} alignItems="center">
                            <StatusBadge status={execStatus} />
                            <Stack className="tc-row-actions" direction="row"
                              sx={{ opacity: 0, transition: 'opacity 0.15s', ml: 0.5 }}>
                              {canUpdate && (
                                <Tooltip title="Edit">
                                  <IconButton size="small"
                                    onClick={(e) => { e.stopPropagation(); handleOpenEditTC(tc); }}
                                    sx={{ color:'#f59e0b', p:0.4, '&:hover':{ bgcolor:'rgba(245,158,11,0.1)' } }}>
                                    <EditOutlined sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {canDelete && (
                                <Tooltip title="Delete">
                                  <IconButton size="small"
                                    onClick={(e) => { e.stopPropagation(); setDeleteTCConfirm({ open: true, tc }); }}
                                    sx={{ color:'#ef4444', p:0.4, '&:hover':{ bgcolor:'rgba(239,68,68,0.1)' } }}>
                                    <DeleteOutline sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                          </Stack>
                        </Stack>
                        <Stack direction="row" spacing={0.5} sx={{ mt:0.8 }} flexWrap="wrap">
                          <PriorityBadge priority={tc.priority} />
                          {tc.test_type && (
                            <Chip label={tc.test_type} size="small" variant="outlined"
                              sx={{ fontSize:10, height:18 }} />
                          )}
                        </Stack>
                      </Box>
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Card>
      </Grid>

      {/* ── Test Case Detail ─────────────────────────── */}
      <Grid item xs={12} md={7}>
        <Card sx={{ height: 560, overflow: 'auto' }}>
          {!selectedTC ? (
            <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center',
              justifyContent:'center', height:'100%', color:'text.disabled' }}>
              <Description sx={{ fontSize:48, mb:1 }} />
              <Typography variant="body2">Select a test case to view details</Typography>
            </Box>
          ) : (
            <>
              {/* TC Header */}
              <Box sx={{ p:2.5, borderBottom:'1px solid', borderColor:'divider',
                background:'linear-gradient(135deg,rgba(59,130,246,0.06) 0%,rgba(139,92,246,0.06) 100%)' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb:0.5 }}>
                      <Typography variant="caption"
                        sx={{ fontFamily:'monospace', color:'primary.main', fontWeight:700 }}>
                        {selectedTC.test_case_id}
                      </Typography>
                      <PriorityBadge priority={selectedTC.priority} />
                      {selectedTC.test_type && (
                        <Chip label={selectedTC.test_type} size="small"
                          sx={{ fontSize:10, height:18, bgcolor:'rgba(139,92,246,0.1)', color:'secondary.main' }} />
                      )}
                    </Stack>
                    <Typography variant="h6"
                      sx={{ fontFamily:'Outfit', fontWeight:700, lineHeight:1.3 }}>
                      {selectedTC.title}
                    </Typography>
                  </Box>
                  {canApprove && (
                    <Button variant="contained" size="small" startIcon={<PlayArrow />}
                      onClick={() => openRunModal(selectedTC)}
                      sx={{ background:'linear-gradient(90deg,#10b981,#06b6d4)', whiteSpace:'nowrap', ml:1 }}>
                      Execute
                    </Button>
                  )}
                </Stack>
              </Box>

              {/* Tabs */}
              <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)}
                sx={{ borderBottom:'1px solid', borderColor:'divider', px:2 }}>
                <Tab label="Test Steps" icon={<Assignment sx={{ fontSize:14 }} />}
                  iconPosition="start" sx={{ fontSize:12, minHeight:44 }} />
                <Tab label={`Execution History (${selectedTC.executions.length})`}
                  icon={<Timeline sx={{ fontSize:14 }} />}
                  iconPosition="start" sx={{ fontSize:12, minHeight:44 }} />
              </Tabs>

              {/* Steps Tab */}
              {detailTab === 0 && (
                <Box sx={{ p:2.5 }}>
                  <Grid container spacing={2}>
                    {/* Pre Conditions */}
                    <Grid item xs={12}>
                      <Box sx={{ p:1.5, bgcolor:'rgba(245,158,11,0.05)',
                        border:'1px solid rgba(245,158,11,0.2)', borderRadius:2 }}>
                        <SectionLabel>Pre Conditions</SectionLabel>
                        <Typography variant="body2" sx={{ whiteSpace:'pre-wrap', lineHeight:1.7 }}>
                          {selectedTC.precondition || <em style={{ color:'#9ca3af' }}>Not defined.</em>}
                        </Typography>
                      </Box>
                    </Grid>

                    {/* Steps */}
                    <Grid item xs={12} sm={selectedTC.test_data ? 8 : 12}>
                      <Box sx={{ p:1.5, bgcolor:'rgba(59,130,246,0.04)',
                        border:'1px solid rgba(59,130,246,0.15)', borderRadius:2 }}>
                        <SectionLabel>Test Steps</SectionLabel>
                        <Typography variant="body2"
                          sx={{ whiteSpace:'pre-wrap', fontFamily:'monospace', fontSize:12, lineHeight:1.8 }}>
                          {selectedTC.steps}
                        </Typography>
                      </Box>
                    </Grid>

                    {/* Test Data */}
                    {selectedTC.test_data && (
                      <Grid item xs={12} sm={4}>
                        <Box sx={{ p:1.5, bgcolor:'rgba(99,102,241,0.05)',
                          border:'1px solid rgba(99,102,241,0.2)', borderRadius:2, height:'100%' }}>
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb:0.5 }}>
                            <DataObject sx={{ fontSize:12, color:'text.disabled' }} />
                            <SectionLabel>Test Data</SectionLabel>
                          </Stack>
                          <Typography variant="body2"
                            sx={{ whiteSpace:'pre-wrap', fontFamily:'monospace', fontSize:11, lineHeight:1.8, color:'#6366f1' }}>
                            {selectedTC.test_data}
                          </Typography>
                        </Box>
                      </Grid>
                    )}

                    {/* Expected Result */}
                    <Grid item xs={12}>
                      <Box sx={{ p:1.5, bgcolor:'rgba(16,185,129,0.05)',
                        border:'1px solid rgba(16,185,129,0.2)', borderRadius:2 }}>
                        <SectionLabel>Expected Result</SectionLabel>
                        <Typography variant="body2" sx={{ whiteSpace:'pre-wrap', lineHeight:1.7 }}>
                          {selectedTC.expected_result}
                        </Typography>
                      </Box>
                    </Grid>

                    {/* Post Conditions */}
                    {selectedTC.post_condition && (
                      <Grid item xs={12}>
                        <Box sx={{ p:1.5, bgcolor:'rgba(139,92,246,0.05)',
                          border:'1px solid rgba(139,92,246,0.2)', borderRadius:2 }}>
                          <SectionLabel>Post Conditions</SectionLabel>
                          <Typography variant="body2" sx={{ whiteSpace:'pre-wrap', lineHeight:1.7 }}>
                            {selectedTC.post_condition}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </Box>
              )}

              {/* History Tab */}
              {detailTab === 1 && (
                <Box sx={{ p:2 }}>
                  {selectedTC.executions.length === 0 ? (
                    <Box sx={{ textAlign:'center', py:4, color:'text.disabled' }}>
                      <PlayArrow sx={{ fontSize:40, mb:1 }} />
                      <Typography variant="body2">No executions logged yet.</Typography>
                      {canApprove && (
                        <Button startIcon={<PlayArrow />} onClick={() => openRunModal(selectedTC)} sx={{ mt:1 }}>
                          Execute Now
                        </Button>
                      )}
                    </Box>
                  ) : (
                    <Stack spacing={1.5}>
                      {[...selectedTC.executions].reverse().map((exec: any) => (
                        <Card key={exec.id} variant="outlined" sx={{ p:2, borderRadius:2,
                          borderColor: exec.status==='Passed' ? 'success.main'
                            : exec.status==='Failed' ? 'error.main' : 'divider',
                          borderLeftWidth:4 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb:1 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <StatusBadge status={exec.status} />
                              {exec.build_number && (
                                <Chip label={exec.build_number} size="small" variant="outlined"
                                  sx={{ fontSize:10, height:18 }} />
                              )}
                              <Chip label={exec.run_type} size="small" variant="outlined"
                                sx={{ fontSize:10, height:18 }} />
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(exec.executed_at).toLocaleString()}
                            </Typography>
                          </Stack>
                          <Grid container spacing={1}>
                            {exec.test_environment && (
                              <Grid item xs={12}>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <Laptop sx={{ fontSize:12, color:'text.disabled' }} />
                                  <Typography variant="caption" color="text.secondary">
                                    {exec.test_environment}
                                  </Typography>
                                </Stack>
                              </Grid>
                            )}
                            {exec.actual_result && (
                              <Grid item xs={12}>
                                <SectionLabel>Actual Result</SectionLabel>
                                <Typography variant="body2">{exec.actual_result}</Typography>
                              </Grid>
                            )}
                            {exec.comments && (
                              <Grid item xs={12}>
                                <SectionLabel>Notes / Comments</SectionLabel>
                                <Typography variant="body2" sx={{ fontStyle:'italic', color:'text.secondary' }}>
                                  {exec.comments}
                                </Typography>
                              </Grid>
                            )}
                            {exec.step_results && (
                              <Grid item xs={12}>
                                <SectionLabel>Step-by-Step Details</SectionLabel>
                                <Box sx={{ p: 1.5, bgcolor: 'rgba(255, 255, 255, 0.02)', borderRadius: 2, border: '1px solid rgba(255, 255, 255, 0.05)', mt: 0.5, mb: 1 }}>
                                  <Stack spacing={1}>
                                    {JSON.parse(exec.step_results).map((sr: any) => (
                                      <Stack key={sr.step_number} direction="row" spacing={1.5} alignItems="flex-start" justifyContent="space-between">
                                        <Typography variant="body2" sx={{ fontSize: 12, flex: 1 }}>
                                          <span style={{ color: '#3b82f6', fontWeight: 600, marginRight: '4px' }}>{sr.step_number}.</span>
                                          {sr.step_text}
                                          {sr.actual_result && (
                                            <span style={{ display: 'block', fontSize: 10, color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic', marginTop: '2px' }}>
                                              Observed: {sr.actual_result}
                                            </span>
                                          )}
                                        </Typography>
                                        <StatusBadge status={sr.status} />
                                      </Stack>
                                    ))}
                                  </Stack>
                                </Box>
                              </Grid>
                            )}
                            {exec.executed_by && (
                              <Grid item xs={12}>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <Avatar sx={{ width:16, height:16, fontSize:9 }}>
                                    {exec.executed_by.full_name?.[0]}
                                  </Avatar>
                                  <Typography variant="caption" color="text.secondary">
                                    Tested by {exec.executed_by.full_name}
                                  </Typography>
                                </Stack>
                              </Grid>
                            )}
                            {exec.defect_id && (
                              <Grid item xs={12}>
                                <Chip label={`Bug #${exec.defect_id}`} color="error" size="small"
                                  icon={<BugReport sx={{ fontSize:12 }} />} />
                              </Grid>
                            )}
                          </Grid>
                        </Card>
                      ))}
                    </Stack>
                  )}
                </Box>
              )}
            </>
          )}
        </Card>
      </Grid>
    </Grid>
  );

  /* ═══════════════════════════════════════════════════════════
     ROOT RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <Box>
      {/* ── Page Header ─────────────────────────────────────── */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb:3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily:'Outfit', fontWeight:800 }}>
            Test Suite Manager
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt:0.5 }}>
            Scenario-wise test cases · Full template coverage · Industry standard
          </Typography>
        </Box>
        {filters.projectId && (
          <Stack direction="row" spacing={1.5}>
            {canCreate && (
              <Button variant="outlined" startIcon={<CloudUpload />} size="small"
                onClick={() => { setUploadResult(null); setOpenUpload(true); }}>
                Import Automation
              </Button>
            )}
            {canCreate && (
              <Button variant="outlined" startIcon={<CloudUpload />} size="small"
                onClick={() => { setBulkFile(null); setBulkResult(null); setOpenBulkUpload(true); }}
                sx={{ borderColor: 'rgba(59,130,246,0.5)', color: 'primary.main' }}>
                Bulk Import
              </Button>
            )}
            {canCreate && (
              <Button variant="contained" startIcon={<Add />} size="small"
                onClick={() => setOpenScenario(true)}
                sx={{ background:'linear-gradient(90deg,#f59e0b,#ef4444)', fontWeight:700 }}>
                New Scenario
              </Button>
            )}
          </Stack>
        )}

      </Stack>

      {!filters.projectId ? (
        <Alert severity="info" sx={{ borderRadius:2 }}>
          Please select a Project from the toolbar filters to manage test scenarios and test cases.
        </Alert>
      ) : (
        <>
          {/* ── Active Filter Context Banner ─────────────────── */}
          <Box sx={{
            mb: 2, px: 2, py: 1.2, borderRadius: 2,
            background: 'linear-gradient(135deg,rgba(99,102,241,0.08) 0%,rgba(139,92,246,0.08) 100%)',
            border: '1px solid rgba(99,102,241,0.18)',
            display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
          }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary',
              textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
              Viewing:
            </Typography>
            {[
              { label: 'Project',     value: filters.projectName || (filters.projectId ? `#${filters.projectId}` : null),     color: '#3b82f6' },
              { label: 'Application', value: filters.applicationName || (filters.applicationId ? `#${filters.applicationId}` : null), color: '#06b6d4' },
              { label: 'Release',     value: filters.releaseName || (filters.releaseId ? `#${filters.releaseId}` : null),     color: '#6366f1' },
              { label: 'Sprint',      value: filters.sprintName || (filters.sprintId ? `#${filters.sprintId}` : null),      color: '#8b5cf6' },
            ].map(f => f.value && (
              <Chip
                key={f.label}
                label={`${f.label}: ${f.value}`}
                size="small"
                sx={{
                  fontSize: 11, fontWeight: 600, height: 22,
                  bgcolor: `${f.color}18`,
                  color: f.color,
                  border: `1px solid ${f.color}33`,
                }}
              />
            ))}
            {!filters.applicationId && !filters.releaseId && !filters.sprintId && (
              <Typography sx={{ fontSize: 11, color: 'text.disabled', fontStyle: 'italic' }}>
                All applications, releases &amp; sprints
              </Typography>
            )}
            <Typography sx={{ fontSize: 10.5, color: 'text.disabled', ml: 'auto', flexShrink: 0 }}>
              {scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''} found
            </Typography>
          </Box>

        <Grid container spacing={2.5}>
          {/* ── Scenarios Sidebar ──────────────────────────── */}
          <Grid item xs={12} md={3}>
            <Card sx={{ height: 680, overflow: 'auto' }}>
              <Box sx={{ p:2, borderBottom:'1px solid', borderColor:'divider' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontFamily:'Outfit', fontWeight:700 }}>
                      Scenarios
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                  {canCreate && (
                    <Tooltip title="New Scenario">
                      <IconButton size="small" color="primary"
                        onClick={() => setOpenScenario(true)}
                        sx={{ bgcolor:'rgba(59,130,246,0.08)' }}>
                        <Add fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Box>

              {scenLoading ? (
                <Box sx={{ p:3, display:'flex', justifyContent:'center' }}>
                  <CircularProgress size={24} />
                </Box>
              ) : scenarios.length === 0 ? (
                <Box sx={{ p:3, textAlign:'center', pt:5 }}>
                  <Folder sx={{ fontSize:48, color:'text.disabled', mb:1 }} />
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb:0.5 }}>
                    No scenarios yet
                  </Typography>
                  {(filters.releaseId || filters.sprintId || filters.applicationId) && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb:1.5, px:1, fontStyle:'italic' }}>
                      Try removing the Release or Sprint filter to see all scenarios
                    </Typography>
                  )}
                  {canCreate && (
                    <Button size="small" variant="outlined" startIcon={<Add />}
                      onClick={() => setOpenScenario(true)}>
                      Create First Scenario
                    </Button>
                  )}
                </Box>
              ) : (
                <List sx={{ p:1 }}>
                  {scenarios.map((scen: any) => (
                    <ListItem key={scen.id} disablePadding sx={{ mb:0.5 }}>
                      <ListItemButton
                        selected={selectedScenarioId === scen.id}
                        onClick={() => { setSelectedScenarioId(scen.id); setSelectedTC(null); }}
                        sx={{ borderRadius:2, flexDirection:'column', alignItems:'flex-start', py:1.5 }}>

                        {/* Scenario title row */}
                        <Stack direction="row" width="100%" justifyContent="space-between" alignItems="flex-start">
                          <Box sx={{ mr:1, color: selectedScenarioId===scen.id ? 'warning.main' : 'text.disabled', mt:0.3 }}>
                            {selectedScenarioId===scen.id ? <FolderOpen sx={{ fontSize:18 }} /> : <Folder sx={{ fontSize:18 }} />}
                          </Box>
                          <Box sx={{ flex:1, minWidth:0 }}>
                            <Typography variant="body2" sx={{ fontWeight:600, lineHeight:1.3 }}>
                              {scen.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary"
                              sx={{ fontFamily:'monospace' }}>
                              {scen.scenario_id}
                            </Typography>
                          </Box>
                          {/* 3-dot actions menu */}
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); setScenMenuAnchor(e.currentTarget); setScenMenuTarget(scen); }}
                            sx={{ opacity: 0.4, transition: 'opacity 0.15s', ml: 0.5, mt: -0.3,
                              '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.08)' },
                              '.MuiListItemButton-root:hover &': { opacity: 0.8 } }}
                          >
                            <MoreVert sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Stack>

                        {/* Tags row */}
                        <Stack direction="row" spacing={0.5} sx={{ mt:0.8, ml:3.5 }} flexWrap="wrap">
                          {scen.module && (
                            <Chip label={scen.module} size="small" variant="outlined"
                              color="primary" sx={{ fontSize:9, height:16 }} />
                          )}
                          {scen.priority && (
                            <Chip label={scen.priority} size="small"
                              color={PRIORITY_CFG[scen.priority as keyof typeof PRIORITY_CFG]?.color ?? 'default'}
                              variant="outlined" sx={{ fontSize:9, height:16 }} />
                          )}
                          <Chip
                            label={`${scen.test_cases?.length ?? 0} TC`}
                            size="small"
                            sx={{ fontSize:9, height:16, bgcolor:'rgba(99,102,241,0.08)', color:'#6366f1' }}
                          />
                        </Stack>

                        {/* ── Per-Scenario Add Test Case Button ── */}
                        <Box sx={{ mt:1, ml:3.5, width:'calc(100% - 28px)' }}
                          onClick={e => { e.stopPropagation(); openAddTcForScenario(scen.id); }}>
                          <Button
                            size="small"
                            fullWidth
                            startIcon={<Add sx={{ fontSize:13 }} />}
                            variant="outlined"
                            sx={{
                              fontSize:10, py:0.4,
                              borderStyle:'dashed',
                              color:'text.secondary',
                              borderColor:'divider',
                              '&:hover':{ borderColor:'primary.main', color:'primary.main', bgcolor:'rgba(59,130,246,0.05)' }
                            }}>
                            Add Test Case
                          </Button>
                        </Box>

                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Card>
          </Grid>

          {/* ── Main Panel ─────────────────────────────────── */}
          <Grid item xs={12} md={9}>
            {/* Stats bar */}
            {selectedScenarioId && !tcLoading && testCases.length > 0 && (
              <Card sx={{ mb:2, p:2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                    <Typography variant="subtitle2" sx={{ fontWeight:700 }}>
                      {selectedScenario?.title}
                    </Typography>
                    {selectedScenario?.module && (
                      <Chip label={selectedScenario.module} size="small" color="primary" variant="outlined" />
                    )}
                    {selectedScenario?.priority && (
                      <PriorityBadge priority={selectedScenario.priority} />
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                    <Chip label={`${stats.total} Total`}   size="small" />
                    <Chip label={`${stats.passed} Passed`} size="small" color="success" />
                    <Chip label={`${stats.failed} Failed`} size="small" color="error" />
                    <Chip label={`${stats.blocked} Blocked`} size="small" color="warning" />
                    <Chip label={`${stats.untested} Untested`} size="small" />
                    <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                      <LinearProgress variant="determinate" value={stats.pct}
                        sx={{ width:80, height:6, borderRadius:3, bgcolor:'action.hover' }}
                        color={stats.pct===100 ? 'success' : stats.pct>50 ? 'info' : 'warning'} />
                      <Typography variant="caption" sx={{ fontWeight:700 }}>{stats.pct}%</Typography>
                    </Box>
                    <ToggleButtonGroup value={viewMode} exclusive
                      onChange={(_, v) => v && setViewMode(v)} size="small">
                      <ToggleButton value="detail"><ViewList sx={{ fontSize:16 }} /></ToggleButton>
                      <ToggleButton value="table"><TableChart sx={{ fontSize:16 }} /></ToggleButton>
                    </ToggleButtonGroup>
                    <Button size="small" variant="outlined" startIcon={<Add />}
                      onClick={() => setOpenTestCase(true)}>
                      Add Test Case
                    </Button>
                  </Stack>
                </Stack>
              </Card>
            )}

            {!selectedScenarioId ? (
              <Card sx={{ height:560, display:'flex', alignItems:'center',
                justifyContent:'center', flexDirection:'column', color:'text.disabled' }}>
                <Folder sx={{ fontSize:64, mb:2 }} />
                <Typography variant="h6" sx={{ fontFamily:'Outfit' }}>Select a Scenario</Typography>
                <Typography variant="body2" sx={{ mt:0.5 }}>
                  Choose from the left panel to load test cases
                </Typography>
                <Button variant="contained" startIcon={<Add />} sx={{ mt:2,
                  background:'linear-gradient(90deg,#f59e0b,#ef4444)' }}
                  onClick={() => setOpenScenario(true)}>
                  Create New Scenario
                </Button>
              </Card>
            ) : viewMode==='table' ? renderTableView() : renderDetailView()}
          </Grid>
          </Grid>
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL: New Scenario (all template fields)
      ════════════════════════════════════════════════════════ */}
      <Dialog open={openScenario} onClose={() => setOpenScenario(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontFamily:'Outfit', fontWeight:700, pb:1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width:36, height:36, borderRadius:2,
              background:'linear-gradient(135deg,#f59e0b,#ef4444)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Folder sx={{ fontSize:20, color:'#fff' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontFamily:'Outfit', fontWeight:700, lineHeight:1.2 }}>
                New Test Scenario
              </Typography>
              <Typography variant="caption" color="text.secondary">
                All template fields · Scenario ID is auto-generated
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt:2 }}>
          {createScenario.isError && (
            <Alert severity="error" sx={{ mb:2, borderRadius:2 }}>
              {(createScenario.error as any)?.response?.data?.detail
                ? (typeof (createScenario.error as any).response.data.detail === 'string'
                    ? (createScenario.error as any).response.data.detail
                    : JSON.stringify((createScenario.error as any).response.data.detail))
                : 'Failed to create scenario. Please check all fields.'}
            </Alert>
          )}
          <Box component="form" onSubmit={handleCreateScenario} id="scen-form">
            <Stack spacing={2.5}>

              {/* Row 1: Title + Priority + Test Type */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField required fullWidth label="Scenario Title *"
                    placeholder="e.g. User Authentication & Session Management"
                    helperText="High-level name of the testing scenario"
                    value={sf.title}
                    onChange={e => setSf({ ...sf, title: e.target.value })} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <FormControl fullWidth required>
                    <InputLabel>Priority</InputLabel>
                    <Select value={sf.priority} label="Priority"
                      onChange={e => setSf({ ...sf, priority: e.target.value })}>
                      {PRIORITIES.map(p => (
                        <MenuItem key={p} value={p}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {PRIORITY_CFG[p as keyof typeof PRIORITY_CFG]?.icon}
                            <span>{p}</span>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Test Type</InputLabel>
                    <Select value={sf.test_type} label="Test Type"
                      onChange={e => setSf({ ...sf, test_type: e.target.value })}>
                      {TEST_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {/* Row 2: Module + Requirement */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Module / Feature Area"
                    placeholder="e.g. Authentication, Checkout, User Management…"
                    helperText="Maps to the 'Module' column in the test template"
                    value={sf.module}
                    onChange={e => setSf({ ...sf, module: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Linked Requirement (optional)</InputLabel>
                    <Select
                      value={sf.requirement_id ?? ''}
                      label="Linked Requirement (optional)"
                      onChange={e => {
                        const v = e.target.value;
                        setSf({ ...sf, requirement_id: v === '' ? null : Number(v) });
                      }}>
                      <MenuItem value=""><em>None — standalone scenario</em></MenuItem>
                      {requirements.map(r => (
                        <MenuItem key={r.id} value={r.id}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip label={r.requirement_id} size="small" variant="outlined"
                              sx={{ fontSize:10, height:18 }} />
                            <span>{r.title}</span>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {/* Description */}
              <TextField fullWidth multiline rows={2} label="Test Scenario Description"
                placeholder="High-level description of what this scenario validates end-to-end…"
                helperText="Describe the overall testing scope in 1–3 sentences"
                value={sf.description}
                onChange={e => setSf({ ...sf, description: e.target.value })} />

              {/* Objective */}
              <TextField fullWidth multiline rows={2} label="Objective / Scope"
                placeholder={"• Verify that users can log in with valid credentials\n• Ensure session tokens are correctly created\n• Validate account lock-out after 5 failed attempts"}
                helperText="List the key testing objectives for this scenario"
                value={sf.objective}
                onChange={e => setSf({ ...sf, objective: e.target.value })} />

              {/* Pre + Post Conditions */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth multiline rows={4} label="Pre Conditions"
                    placeholder={"• User account exists and is Active\n• Application is accessible at staging URL\n• Test database has required seed data\n• Browser cache is cleared"}
                    helperText="System state required BEFORE any test case runs"
                    value={sf.precondition}
                    onChange={e => setSf({ ...sf, precondition: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth multiline rows={4} label="Post Conditions"
                    placeholder={"• User session is terminated on logout\n• Audit log entry created for each attempt\n• No residual test data in production tables"}
                    helperText="System state expected AFTER all test cases complete"
                    value={sf.post_condition}
                    onChange={e => setSf({ ...sf, post_condition: e.target.value })} />
                </Grid>
              </Grid>

              {/* Optional Linked Test Case */}
              <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 2, mt: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <input
                    type="checkbox"
                    id="create_test_case"
                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                    checked={sf.create_test_case}
                    onChange={e => setSf({ ...sf, create_test_case: e.target.checked })}
                  />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, cursor: 'pointer' }} component="label" htmlFor="create_test_case">
                    Create initial Test Case under this Scenario (Optional)
                  </Typography>
                </Stack>
                
                {sf.create_test_case && (
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    <TextField fullWidth multiline rows={3} label="Test Steps"
                      placeholder={"1. Navigate to URL\n2. Do action\n3. Verify outcome"}
                      value={sf.tc_steps}
                      onChange={e => setSf({ ...sf, tc_steps: e.target.value })} />
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={8}>
                        <TextField fullWidth multiline rows={2} label="Expected Result"
                          placeholder="What is the expected outcome of the test case?"
                          value={sf.tc_expected_result}
                          onChange={e => setSf({ ...sf, tc_expected_result: e.target.value })} />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField fullWidth multiline rows={2} label="Test Data"
                          placeholder="Sample credentials, inputs, etc."
                          value={sf.tc_test_data}
                          onChange={e => setSf({ ...sf, tc_test_data: e.target.value })} />
                      </Grid>
                    </Grid>

                    {/* Optional Execution */}
                    <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2, mt: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <input
                          type="checkbox"
                          id="scen_log_execution"
                          style={{ cursor: 'pointer', width: 14, height: 14 }}
                          checked={sf.log_execution}
                          onChange={e => setSf({ ...sf, log_execution: e.target.checked })}
                        />
                        <Typography variant="caption" sx={{ fontWeight: 600, cursor: 'pointer' }} component="label" htmlFor="scen_log_execution">
                          Log Initial Execution Run immediately
                        </Typography>
                      </Stack>

                      {sf.log_execution && (
                        <Grid container spacing={2} sx={{ mt: 1 }}>
                          <Grid item xs={12} sm={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Status</InputLabel>
                              <Select value={sf.exec_status} label="Status" size="small"
                                onChange={e => setSf({ ...sf, exec_status: e.target.value })}>
                                {EXEC_STATUSES.map(s => (
                                  <MenuItem key={s} value={s}>{s}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} sm={8}>
                            <TextField fullWidth size="small" label="Test Environment"
                              placeholder="e.g. Chrome / Windows / Staging"
                              value={sf.exec_environment}
                              onChange={e => setSf({ ...sf, exec_environment: e.target.value })} />
                          </Grid>
                          <Grid item xs={12}>
                            <TextField fullWidth size="small" label="Actual Result"
                              placeholder="Describe what actually happened..."
                              value={sf.exec_actual_result}
                              onChange={e => setSf({ ...sf, exec_actual_result: e.target.value })} />
                          </Grid>
                          <Grid item xs={12}>
                            <TextField fullWidth size="small" label="Notes / Comments"
                              placeholder="Any additional observations..."
                              value={sf.exec_comments}
                              onChange={e => setSf({ ...sf, exec_comments: e.target.value })} />
                          </Grid>
                        </Grid>
                      )}
                    </Box>
                  </Stack>
                )}
              </Box>

            </Stack>
          </Box>

        </DialogContent>
        <DialogActions sx={{ px:3, pb:2.5, gap:1 }}>
          <Button onClick={() => setOpenScenario(false)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button type="submit" form="scen-form" variant="contained"
            disabled={createScenario.isPending || !sf.title.trim()}
            sx={{ background:'linear-gradient(90deg,#f59e0b,#ef4444)', minWidth:160 }}>
            {createScenario.isPending
              ? <><CircularProgress size={16} color="inherit" sx={{ mr:1 }} />Creating…</>
              : 'Create Scenario'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════════════════════════════════════════════════════════
          MODAL: New Test Case (full template)
      ════════════════════════════════════════════════════════ */}
      <Dialog open={openTestCase} onClose={() => setOpenTestCase(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontFamily:'Outfit', fontWeight:700 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width:36, height:36, borderRadius:2,
              background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Description sx={{ fontSize:20, color:'#fff' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontFamily:'Outfit', fontWeight:700, lineHeight:1.2 }}>
                New Test Case
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedScenario ? `Scenario: ${selectedScenario.title}` : 'Full template · TC ID auto-generated'}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt:2 }}>
          {createTC.isError && (
            <Alert severity="error" sx={{ mb:2, borderRadius:2 }}>
              {(createTC.error as any)?.response?.data?.detail || 'Failed to create test case.'}
            </Alert>
          )}
          <Box component="form" onSubmit={handleCreateTC} id="tc-form">
            <Stack spacing={2.5}>

              {/* Row 1: Title + Priority + Type */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField required fullWidth label="Test Case Description *"
                    placeholder="e.g. Verify login with valid credentials"
                    helperText="Brief description of what this test validates"
                    value={tcf.title}
                    onChange={e => setTcf({ ...tcf, title: e.target.value })} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <FormControl fullWidth required>
                    <InputLabel>Priority</InputLabel>
                    <Select value={tcf.priority} label="Priority"
                      onChange={e => setTcf({ ...tcf, priority: e.target.value })}>
                      {PRIORITIES.map(p => (
                        <MenuItem key={p} value={p}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {PRIORITY_CFG[p as keyof typeof PRIORITY_CFG]?.icon}
                            <span>{p}</span>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Test Type</InputLabel>
                    <Select value={tcf.test_type} label="Test Type"
                      onChange={e => setTcf({ ...tcf, test_type: e.target.value })}>
                      {TEST_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {/* Pre Conditions */}
              <TextField fullWidth multiline rows={2} label="Pre Conditions"
                placeholder={"• User account exists and is active\n• Application is accessible at the staging URL\n• User is not currently logged in"}
                helperText="System state and data that must exist before test execution"
                value={tcf.precondition}
                onChange={e => setTcf({ ...tcf, precondition: e.target.value })} />

              {/* Steps + Test Data */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
                  <TextField required fullWidth multiline rows={6} label="Test Steps *"
                    placeholder={"1. Open browser and navigate to https://app.example.com/login\n2. Enter registered email in the Email field\n3. Enter valid password in the Password field\n4. Click the Sign In button\n5. Observe the application response"}
                    helperText="Number each step. One action per line."
                    value={tcf.steps}
                    onChange={e => setTcf({ ...tcf, steps: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth multiline rows={6} label="Test Data"
                    placeholder={"Email: user@company.com\nPassword: Test@1234\nRole: QA Engineer"}
                    helperText="Sample inputs, credentials, or payloads"
                    value={tcf.test_data}
                    onChange={e => setTcf({ ...tcf, test_data: e.target.value })} />
                </Grid>
              </Grid>

              {/* Expected Result */}
              <TextField required fullWidth multiline rows={2} label="Expected Result *"
                placeholder="User is successfully authenticated and redirected to the Dashboard. A 'Welcome back, [Name]!' notification is displayed."
                value={tcf.expected_result}
                onChange={e => setTcf({ ...tcf, expected_result: e.target.value })} />

              {/* Post Conditions */}
              <TextField fullWidth multiline rows={2} label="Post Conditions"
                placeholder={"• User session token is created and stored in browser cookies\n• Login activity is recorded in the audit log"}
                helperText="System state that should be true after successful execution"
                value={tcf.post_condition}
                onChange={e => setTcf({ ...tcf, post_condition: e.target.value })} />

              {/* Optional Execution */}
              <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 2, mt: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <input
                    type="checkbox"
                    id="tc_log_execution"
                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                    checked={tcf.log_execution}
                    onChange={e => setTcf({ ...tcf, log_execution: e.target.checked })}
                  />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, cursor: 'pointer' }} component="label" htmlFor="tc_log_execution">
                    Log Initial Execution Run immediately (Optional)
                  </Typography>
                </Stack>

                {tcf.log_execution && (
                  <Grid container spacing={2} sx={{ mt: 2 }}>
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Status</InputLabel>
                        <Select value={tcf.exec_status} label="Status" size="small"
                          onChange={e => setTcf({ ...tcf, exec_status: e.target.value })}>
                          {EXEC_STATUSES.map(s => (
                            <MenuItem key={s} value={s}>{s}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={8}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Test Environment</InputLabel>
                        <Select value={tcf.exec_environment} label="Test Environment" size="small"
                          onChange={e => setTcf({ ...tcf, exec_environment: e.target.value })}>
                          <MenuItem value=""><em>Not specified</em></MenuItem>
                          {ENVIRONMENTS.map(env => <MenuItem key={env} value={env}>{env}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth size="small" label="Actual Result"
                        placeholder="Describe what actually happened..."
                        value={tcf.exec_actual_result}
                        onChange={e => setTcf({ ...tcf, exec_actual_result: e.target.value })} />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth size="small" label="Notes / Comments"
                        placeholder="Any additional observations..."
                        value={tcf.exec_comments}
                        onChange={e => setTcf({ ...tcf, exec_comments: e.target.value })} />
                    </Grid>
                  </Grid>
                )}
              </Box>

            </Stack>
          </Box>

        </DialogContent>
        <DialogActions sx={{ px:3, pb:2.5, gap:1 }}>
          <Button onClick={() => setOpenTestCase(false)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button type="submit" form="tc-form" variant="contained"
            disabled={createTC.isPending || !tcf.title.trim() || !tcf.steps.trim() || !tcf.expected_result.trim()}
            sx={{ background:'linear-gradient(90deg,#3b82f6,#8b5cf6)', minWidth:160 }}>
            {createTC.isPending
              ? <><CircularProgress size={16} color="inherit" sx={{ mr:1 }} />Creating…</>
              : 'Create Test Case'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════════════════════════════════════════════════════════
          MODAL: Log Execution Run
      ════════════════════════════════════════════════════════ */}
      <Dialog open={openRun} onClose={() => setOpenRun(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontFamily:'Outfit', fontWeight:700 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width:36, height:36, borderRadius:2,
              background:'linear-gradient(135deg,#10b981,#06b6d4)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <PlayArrow sx={{ fontSize:20, color:'#fff' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontFamily:'Outfit', fontWeight:700, lineHeight:1.2 }}>
                Log Execution Run
              </Typography>
              {selectedTC && (
                <Typography variant="caption" color="text.secondary">
                  {selectedTC.test_case_id}: {selectedTC.title}
                </Typography>
              )}
            </Box>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Box component="form" onSubmit={handleLogRun} id="run-form">
            <Stack spacing={2.5} sx={{ mt:1 }}>
              
              {/* Step-wise Execution Grid */}
              {selectedTC && parseTestSteps(selectedTC.steps).length > 0 && (
                <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(255, 255, 255, 0.02)', borderRadius: 2, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, fontFamily: 'Outfit' }}>
                    Step-by-Step Status Verification
                  </Typography>
                  <Stack spacing={2} divider={<Divider sx={{ opacity: 0.5 }} />}>
                    {parseTestSteps(selectedTC.steps).map((step, idx) => (
                      <Stack key={idx} spacing={1}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
                          <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 500, flex: 1 }}>
                            <span style={{ color: '#3b82f6', fontWeight: 600, marginRight: '4px' }}>{idx + 1}.</span> {step}
                          </Typography>
                          <ToggleButtonGroup
                            value={stepStatuses[idx]?.status || 'Passed'}
                            exclusive
                            onChange={(_, val) => val && updateStepStatus(idx, val)}
                            size="small"
                            color="primary"
                          >
                            <ToggleButton value="Passed" sx={{ py: 0.2, px: 1, fontSize: 10, textTransform: 'none', color: '#10b981', '&.Mui-selected': { bgcolor: 'rgba(16,185,129,0.15)', color: '#10b981' } }}>Pass</ToggleButton>
                            <ToggleButton value="Failed" sx={{ py: 0.2, px: 1, fontSize: 10, textTransform: 'none', color: '#ef4444', '&.Mui-selected': { bgcolor: 'rgba(239,68,68,0.15)', color: '#ef4444' } }}>Fail</ToggleButton>
                            <ToggleButton value="Blocked" sx={{ py: 0.2, px: 1, fontSize: 10, textTransform: 'none', color: '#f59e0b', '&.Mui-selected': { bgcolor: 'rgba(245,158,11,0.15)', color: '#f59e0b' } }}>Block</ToggleButton>
                            <ToggleButton value="Skipped" sx={{ py: 0.2, px: 1, fontSize: 10, textTransform: 'none', color: '#9ca3af', '&.Mui-selected': { bgcolor: 'rgba(156,163,175,0.15)', color: '#9ca3af' } }}>Skip</ToggleButton>
                          </ToggleButtonGroup>
                        </Stack>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Step actual result / notes (optional)"
                          variant="outlined"
                          value={stepStatuses[idx]?.actual_result || ''}
                          onChange={(e) => updateStepActualResult(idx, e.target.value)}
                          InputProps={{ style: { fontSize: 11 } }}
                        />
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}

              <FormControl fullWidth required>
                <InputLabel>Overall Status *</InputLabel>
                <Select value={ef.status} label="Overall Status *"
                  onChange={e => setEf({ ...ef, status: e.target.value })}>
                  {EXEC_STATUSES.map(s => (
                    <MenuItem key={s} value={s}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <StatusBadge status={s} />
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  Automatically calculated from step results, but can be manually overridden.
                </Typography>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Test Environment</InputLabel>
                <Select value={ef.test_environment} label="Test Environment"
                  onChange={e => setEf({ ...ef, test_environment: e.target.value })}>
                  <MenuItem value=""><em>Not specified</em></MenuItem>
                  {ENVIRONMENTS.map(env => <MenuItem key={env} value={env}>{env}</MenuItem>)}
                </Select>
              </FormControl>

              <TextField fullWidth label="Build / Version"
                placeholder="e.g. v2.4.0 / build-298"
                helperText="Test Date and Tested By are captured automatically from your session"
                value={ef.build_number}
                onChange={e => setEf({ ...ef, build_number: e.target.value })} />

              <TextField fullWidth multiline rows={3} label="Overall Actual Result"
                placeholder="Describe exactly what happened when the test was executed…"
                value={ef.actual_result}
                onChange={e => setEf({ ...ef, actual_result: e.target.value })} />

              <TextField fullWidth multiline rows={2} label="Notes / Comments"
                placeholder="Any additional observations, environment issues, or follow-up actions…"
                value={ef.comments}
                onChange={e => setEf({ ...ef, comments: e.target.value })} />

              {(ef.status === 'Failed' || ef.status === 'Blocked') && (
                <FormControl fullWidth>
                  <InputLabel>Link Defect (optional)</InputLabel>
                  <Select
                    value={ef.defect_id ?? ''}
                    label="Link Defect (optional)"
                    onChange={e => {
                      const v = e.target.value;
                      setEf({ ...ef, defect_id: v === '' ? null : Number(v) });
                    }}>
                    <MenuItem value=""><em>No existing defect</em></MenuItem>
                    {defectsList.map(d => (
                      <MenuItem key={d.id} value={d.id}>{d.defect_id}: {d.title}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2.5, gap:1 }}>
          <Button onClick={() => setOpenRun(false)} variant="outlined" color="inherit">Cancel</Button>
          <Button type="submit" form="run-form" variant="contained" color="success"
            disabled={createExecution.isPending}
            sx={{ minWidth:140 }}>
            {createExecution.isPending
              ? <><CircularProgress size={16} color="inherit" sx={{ mr:1 }} />Saving…</>
              : 'Save Execution'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════════════════════════════════════════════════════════
          MODAL: Import Automation Results (v2 – context-aware)
      ════════════════════════════════════════════════════════ */}
      <Dialog open={openUpload} onClose={() => { setOpenUpload(false); setUploadFile(null); setUploadResult(null); }}
        fullWidth maxWidth="md" PaperProps={{ sx: { maxHeight:'94vh' } }}>

        {/* ── Dialog Header ── */}
        <DialogTitle sx={{ fontFamily:'Outfit', fontWeight:700, pb:1.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{
              width:44, height:44, borderRadius:2, flexShrink:0,
              background:'linear-gradient(135deg,#6366f1,#a855f7)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <DataObject sx={{ fontSize:24, color:'#fff' }} />
            </Box>
            <Box sx={{ flex:1 }}>
              <Typography variant="h6" sx={{ fontFamily:'Outfit', fontWeight:700, lineHeight:1.2 }}>
                Import Automation Results
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Map test runner output (Cypress, Playwright, Selenium…) to the right project context
              </Typography>
            </Box>
            {autoCtxLoading && <CircularProgress size={18} sx={{ flexShrink:0 }} />}
          </Stack>
        </DialogTitle>
        <Divider />

        <DialogContent sx={{ overflowY:'auto' }}>
          <Box component="form" onSubmit={handleUpload} id="upload-form">
            <Stack spacing={2.5} sx={{ mt:1 }}>

              {/* ════ SECTION 1 — Target Hierarchy ════ */}
              <Box sx={{
                p:2.5, borderRadius:2, border:'1px solid',
                borderColor: autoCtx.projectId ? 'rgba(99,102,241,0.4)' : 'divider',
                background:'linear-gradient(135deg,rgba(99,102,241,0.03) 0%,rgba(168,85,247,0.03) 100%)',
              }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb:2 }}>
                  <Box sx={{ width:4, height:26, borderRadius:1, flexShrink:0,
                    background:'linear-gradient(180deg,#6366f1,#a855f7)' }} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontFamily:'Outfit', fontWeight:700, lineHeight:1.2 }}>
                      Target Hierarchy
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Results will be imported into the selected project scope. Project is required.
                    </Typography>
                  </Box>
                </Stack>

                {/* Row 1 — Group · Company · Project */}
                <Grid container spacing={1.5} sx={{ mb:1.5 }}>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Group *</InputLabel>
                      <Select
                        value={autoCtx.groupId ?? ''}
                        label="Group *"
                        onChange={e => handleAutoGroupChange(e.target.value ? Number(e.target.value) : null)}
                      >
                        {autoGroups.map((g:any) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" disabled={!autoCtx.groupId || autoCompanies.length === 0}>
                      <InputLabel>Company *</InputLabel>
                      <Select
                        value={autoCtx.companyId ?? ''}
                        label="Company *"
                        onChange={e => handleAutoCompanyChange(e.target.value ? Number(e.target.value) : null)}
                      >
                        {autoCompanies.map((c:any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" disabled={!autoCtx.companyId || autoProjects.length === 0}>
                      <InputLabel>Project *</InputLabel>
                      <Select
                        value={autoCtx.projectId ?? ''}
                        label="Project *"
                        onChange={e => handleAutoProjectChange(e.target.value ? Number(e.target.value) : null)}
                      >
                        {autoProjects.map((p:any) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {/* Row 2 — Application · Version/Release · Sprint */}
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" disabled={!autoCtx.projectId}>
                      <InputLabel>Application</InputLabel>
                      <Select
                        value={autoCtx.applicationId ?? ''}
                        label="Application"
                        onChange={e => handleAutoAppChange(
                          e.target.value ? Number(e.target.value) : null,
                          autoCtx.projectId
                        )}
                      >
                        <MenuItem value=""><em>All Applications</em></MenuItem>
                        {autoApplications.map((a:any) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" disabled={!autoCtx.projectId}>
                      <InputLabel>Version / Release</InputLabel>
                      <Select
                        value={autoCtx.releaseId ?? ''}
                        label="Version / Release"
                        onChange={e => setAutoCtx(p => ({ ...p, releaseId: e.target.value ? Number(e.target.value) : null }))}
                      >
                        <MenuItem value=""><em>Unversioned</em></MenuItem>
                        {autoReleases.map((r:any) => <MenuItem key={r.id} value={r.id}>{r.version}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" disabled={!autoCtx.projectId}>
                      <InputLabel>Sprint</InputLabel>
                      <Select
                        value={autoCtx.sprintId ?? ''}
                        label="Sprint"
                        onChange={e => setAutoCtx(p => ({ ...p, sprintId: e.target.value ? Number(e.target.value) : null }))}
                      >
                        <MenuItem value=""><em>No Sprint</em></MenuItem>
                        {autoSprints.map((s:any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {/* Context Summary Banner */}
                {autoCtx.projectId ? (
                  <Box sx={{
                    mt:2, p:1.5, borderRadius:1.5,
                    background:'linear-gradient(90deg,rgba(99,102,241,0.08),rgba(168,85,247,0.08))',
                    border:'1px solid rgba(99,102,241,0.25)',
                  }}>
                    <Stack direction="row" alignItems="center" sx={{ flexWrap:'wrap', gap:0.5 }}>
                      <CheckCircle sx={{ fontSize:15, color:'#6366f1', flexShrink:0 }} />
                      <Typography variant="caption" sx={{ fontWeight:700, color:'#6366f1' }}>Target →</Typography>
                      {[
                        autoGroups.find((g:any) => g.id === autoCtx.groupId)?.name,
                        autoCompanies.find((c:any) => c.id === autoCtx.companyId)?.name,
                        autoProjects.find((p:any) => p.id === autoCtx.projectId)?.name,
                      ].filter(Boolean).map((lbl, idx, arr) => (
                        <Stack key={lbl} direction="row" spacing={0.3} alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight:600 }}>{lbl}</Typography>
                          {idx < arr.length - 1 && (
                            <Typography variant="caption" color="text.disabled">›</Typography>
                          )}
                        </Stack>
                      ))}
                      {autoCtx.applicationId && (
                        <Chip size="small"
                          label={autoApplications.find((a:any) => a.id === autoCtx.applicationId)?.name}
                          sx={{ fontSize:10, height:18, ml:0.5, bgcolor:'rgba(99,102,241,0.12)', color:'primary.main' }} />
                      )}
                      {autoCtx.releaseId && (
                        <Chip size="small"
                          label={autoReleases.find((r:any) => r.id === autoCtx.releaseId)?.version}
                          sx={{ fontSize:10, height:18, bgcolor:'rgba(16,185,129,0.12)', color:'#10b981' }} />
                      )}
                      {autoCtx.sprintId && (
                        <Chip size="small"
                          label={autoSprints.find((s:any) => s.id === autoCtx.sprintId)?.name}
                          sx={{ fontSize:10, height:18, bgcolor:'rgba(168,85,247,0.12)', color:'secondary.main' }} />
                      )}
                    </Stack>
                  </Box>
                ) : (
                  <Box sx={{ mt:2, p:1.2, borderRadius:1.5,
                    bgcolor:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
                    <Typography variant="caption" color="warning.main" sx={{ fontWeight:500 }}>
                      ⚠️ Select a Project to enable the upload
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* ════ SECTION 2 — Run Configuration ════ */}
              <Box sx={{
                p:2.5, borderRadius:2, border:'1px solid', borderColor:'divider',
                background:'rgba(255,255,255,0.01)',
              }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb:2 }}>
                  <Box sx={{ width:4, height:26, borderRadius:1, flexShrink:0,
                    background:'linear-gradient(180deg,#10b981,#06b6d4)' }} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontFamily:'Outfit', fontWeight:700, lineHeight:1.2 }}>
                      Run Configuration
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Describe the test runner, build, and execution environment
                    </Typography>
                  </Box>
                </Stack>

                <Grid container spacing={1.5}>
                  {/* Framework */}
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Framework *</InputLabel>
                      <Select value={uf.framework} label="Framework *"
                        onChange={e => setUf({ ...uf, framework: e.target.value })}>
                        {['Playwright','Cypress','Selenium','JMeter','Pytest','JUnit','TestNG','Robot Framework','WebdriverIO','Appium'].map(f =>
                          <MenuItem key={f} value={f}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Laptop sx={{ fontSize:14, color:'text.secondary' }} />
                              <span>{f}</span>
                            </Stack>
                          </MenuItem>
                        )}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Test Type */}
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Test Type</InputLabel>
                      <Select value={uf.testType} label="Test Type"
                        onChange={e => setUf({ ...uf, testType: e.target.value })}>
                        {['Regression','Smoke','Sanity','Integration','E2E','Performance','Security','UAT'].map(t =>
                          <MenuItem key={t} value={t}>{t}</MenuItem>
                        )}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Environment */}
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Environment</InputLabel>
                      <Select value={uf.environment} label="Environment"
                        onChange={e => setUf({ ...uf, environment: e.target.value })}>
                        {['QA','Staging','UAT','Pre-Prod','Production','Dev','CI'].map(env =>
                          <MenuItem key={env} value={env}>{env}</MenuItem>
                        )}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Build Number */}
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField required fullWidth size="small" label="Build / Version *"
                      placeholder="e.g. v2.5.1 or build-2048"
                      value={uf.build}
                      onChange={e => setUf({ ...uf, build: e.target.value })} />
                  </Grid>
                </Grid>
              </Box>

              {/* ════ SECTION 3 — Report File ════ */}
              <Box sx={{
                p:2.5, borderRadius:2, border:'1px solid',
                borderColor: uploadFile ? 'rgba(16,185,129,0.4)' : 'divider',
                background: uploadFile ? 'rgba(16,185,129,0.03)' : 'rgba(255,255,255,0.01)',
                transition: 'all 0.2s',
              }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb:2 }}>
                  <Box sx={{ width:4, height:26, borderRadius:1, flexShrink:0,
                    background: uploadFile ? 'linear-gradient(180deg,#10b981,#059669)' : 'linear-gradient(180deg,#6b7280,#9ca3af)' }} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontFamily:'Outfit', fontWeight:700, lineHeight:1.2 }}>
                      Report File
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Supports Cypress JSON, Playwright JSON, JUnit XML-as-JSON, Pytest JSON
                    </Typography>
                  </Box>
                </Stack>

                <Button
                  variant="outlined"
                  component="label"
                  startIcon={uploadFile ? <CheckCircle sx={{ color:'#10b981' }} /> : <CloudUpload />}
                  fullWidth
                  size="large"
                  sx={{
                    py: 2.5,
                    borderStyle: 'dashed',
                    borderColor: uploadFile ? '#10b981' : 'divider',
                    color: uploadFile ? '#10b981' : 'text.secondary',
                    borderRadius: 2,
                    fontSize: 13,
                    fontWeight: 600,
                    '&:hover': {
                      borderColor: '#6366f1',
                      bgcolor: 'rgba(99,102,241,0.04)',
                    },
                  }}
                >
                  {uploadFile ? uploadFile.name : 'Click to Choose report.json'}
                  <input type="file" hidden accept=".json"
                    onChange={e => { setUploadFile(e.target.files?.[0] ?? null); setUploadResult(null); }} />
                </Button>

                {uploadFile && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt:0.5, display:'block', textAlign:'center' }}>
                    {(uploadFile.size / 1024).toFixed(1)} KB · {uploadFile.type || 'application/json'}
                  </Typography>
                )}
              </Box>

              {/* ════ RESULT BANNER ════ */}
              {uploadResult && (
                <Box sx={{
                  p:2, borderRadius:2,
                  background:'linear-gradient(135deg,rgba(16,185,129,0.08),rgba(6,182,212,0.08))',
                  border:'1px solid rgba(16,185,129,0.3)',
                }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb:1 }}>
                    <CheckCircle sx={{ color:'#10b981', fontSize:20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight:700, color:'#10b981' }}>
                      Report Imported Successfully!
                    </Typography>
                  </Stack>
                  <Grid container spacing={2}>
                    {[
                      { label:'Tests Parsed', value: uploadResult.tests_parsed, color:'text.primary' },
                      { label:'Passed',       value: uploadResult.passed,       color:'#10b981' },
                      { label:'Failed',       value: uploadResult.failed,       color:'#ef4444' },
                      { label:'Auto Defects', value: uploadResult.auto_created_defects?.length ?? 0, color:'#f59e0b' },
                    ].map(stat => (
                      <Grid item xs={6} sm={3} key={stat.label}>
                        <Box sx={{ textAlign:'center', p:1, borderRadius:1.5, bgcolor:'rgba(255,255,255,0.04)' }}>
                          <Typography variant="h5" sx={{ fontWeight:800, color: stat.color, fontFamily:'Outfit' }}>
                            {stat.value}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                  {uploadResult.auto_created_defects?.length > 0 && (
                    <Box sx={{ mt:1.5, p:1.2, borderRadius:1, bgcolor:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)' }}>
                      <Typography variant="caption" color="warning.main" sx={{ fontWeight:600 }}>
                        ⚡ Auto-created defects: {uploadResult.auto_created_defects.join(', ')}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}

            </Stack>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px:3, pb:2.5, gap:1, borderTop:'1px solid', borderColor:'divider' }}>
          <Button
            onClick={() => { setOpenUpload(false); setUploadFile(null); setUploadResult(null); }}
            variant="outlined" color="inherit"
          >
            Close
          </Button>
          <Button
            type="submit" form="upload-form" variant="contained"
            disabled={!uploadFile || !autoCtx.projectId || !uf.build.trim() || uploadAutomation.isPending}
            sx={{ minWidth:160, background:'linear-gradient(90deg,#6366f1,#a855f7)' }}
          >
            {uploadAutomation.isPending
              ? <><CircularProgress size={16} color="inherit" sx={{ mr:1 }} />Uploading…</>
              : <><CloudUpload sx={{ fontSize:16, mr:0.8 }} />Upload & Parse</>}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════════════════════════════════════════════════════════
          MODAL: Bulk Import Scenarios & Test Cases (v2 – context-aware)
      ════════════════════════════════════════════════════════ */}
      <Dialog open={openBulkUpload} onClose={() => setOpenBulkUpload(false)} fullWidth maxWidth="md"
        PaperProps={{ sx: { maxHeight:'92vh' } }}>
        {/* ── Dialog Header ── */}
        <DialogTitle sx={{ fontFamily:'Outfit', fontWeight:700, pb:1.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width:40, height:40, borderRadius:2, flexShrink:0,
              background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <CloudUpload sx={{ fontSize:22, color:'#fff' }} />
            </Box>
            <Box sx={{ flex:1 }}>
              <Typography variant="h6" sx={{ fontFamily:'Outfit', fontWeight:700, lineHeight:1.2 }}>
                Bulk Import Test Suite
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Upload Scenarios or Test Cases from Excel, CSV, or Word Document
              </Typography>
            </Box>
            {bulkCtxLoading && <CircularProgress size={18} sx={{ flexShrink:0 }} />}
          </Stack>
        </DialogTitle>
        <Divider />

        <DialogContent sx={{ overflowY:'auto' }}>
          <Box component="form" onSubmit={handleBulkUploadSubmit} id="bulk-upload-form">
            <Stack spacing={2.5} sx={{ mt:1 }}>

              {/* ════ SECTION 1 — Import Destination Context ════ */}
              <Box sx={{
                p:2.5, borderRadius:2, border:'1px solid',
                borderColor: bulkCtx.projectId ? 'rgba(59,130,246,0.4)' : 'divider',
                background:'linear-gradient(135deg,rgba(59,130,246,0.03) 0%,rgba(139,92,246,0.03) 100%)',
              }}>
                {/* Section header */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb:2 }}>
                  <Box sx={{ width:4, height:26, borderRadius:1, flexShrink:0,
                    background:'linear-gradient(180deg,#3b82f6,#8b5cf6)' }} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontFamily:'Outfit', fontWeight:700, lineHeight:1.2 }}>
                      Import Destination
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Specify the hierarchy where test assets will be created. Project is required.
                    </Typography>
                  </Box>
                </Stack>

                {/* Row 1 – Group · Company · Project (required) */}
                <Grid container spacing={1.5} sx={{ mb:1.5 }}>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" required>
                      <InputLabel>Group *</InputLabel>
                      <Select
                        value={bulkCtx.groupId ?? ''}
                        label="Group *"
                        onChange={e => handleBulkGroupChange(e.target.value ? Number(e.target.value) : null)}
                      >
                        {bulkGroups.map((g:any) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" required
                      disabled={!bulkCtx.groupId || bulkCompanies.length === 0}>
                      <InputLabel>Company *</InputLabel>
                      <Select
                        value={bulkCtx.companyId ?? ''}
                        label="Company *"
                        onChange={e => handleBulkCompanyChange(e.target.value ? Number(e.target.value) : null)}
                      >
                        {bulkCompanies.map((c:any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" required
                      disabled={!bulkCtx.companyId || bulkProjects.length === 0}>
                      <InputLabel>Project *</InputLabel>
                      <Select
                        value={bulkCtx.projectId ?? ''}
                        label="Project *"
                        onChange={e => handleBulkProjectChange(e.target.value ? Number(e.target.value) : null)}
                      >
                        {bulkProjects.map((p:any) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {/* Row 2 – Application · Version/Release · Sprint (optional) */}
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" disabled={!bulkCtx.projectId}>
                      <InputLabel>Application</InputLabel>
                      <Select
                        value={bulkCtx.applicationId ?? ''}
                        label="Application"
                        onChange={e => handleBulkAppChange(
                          e.target.value ? Number(e.target.value) : null,
                          bulkCtx.projectId
                        )}
                      >
                        <MenuItem value=""><em>None (All Apps)</em></MenuItem>
                        {bulkApplications.map((a:any) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" disabled={!bulkCtx.projectId}>
                      <InputLabel>Version / Release</InputLabel>
                      <Select
                        value={bulkCtx.releaseId ?? ''}
                        label="Version / Release"
                        onChange={e => setBulkCtx(p => ({ ...p, releaseId: e.target.value ? Number(e.target.value) : null }))}
                      >
                        <MenuItem value=""><em>None (Unversioned)</em></MenuItem>
                        {bulkReleases.map((r:any) => <MenuItem key={r.id} value={r.id}>{r.version}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" disabled={!bulkCtx.projectId}>
                      <InputLabel>Sprint</InputLabel>
                      <Select
                        value={bulkCtx.sprintId ?? ''}
                        label="Sprint"
                        onChange={e => setBulkCtx(p => ({ ...p, sprintId: e.target.value ? Number(e.target.value) : null }))}
                      >
                        <MenuItem value=""><em>None (No Sprint)</em></MenuItem>
                        {bulkSprints.map((s:any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {/* Context Summary Banner */}
                {bulkCtx.projectId ? (
                  <Box sx={{
                    mt:2, p:1.5, borderRadius:1.5,
                    background:'linear-gradient(90deg,rgba(16,185,129,0.08),rgba(59,130,246,0.08))',
                    border:'1px solid rgba(16,185,129,0.25)',
                  }}>
                    <Stack direction="row" alignItems="center" sx={{ flexWrap:'wrap', gap:0.5 }}>
                      <CheckCircle sx={{ fontSize:15, color:'#10b981', flexShrink:0 }} />
                      <Typography variant="caption" sx={{ fontWeight:700, color:'#10b981' }}>
                        Ready →
                      </Typography>
                      {[
                        bulkGroups.find((g:any) => g.id === bulkCtx.groupId)?.name,
                        bulkCompanies.find((c:any) => c.id === bulkCtx.companyId)?.name,
                        bulkProjects.find((p:any) => p.id === bulkCtx.projectId)?.name,
                      ].filter(Boolean).map((lbl, idx, arr) => (
                        <Stack key={lbl} direction="row" spacing={0.3} alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight:600 }}>{lbl}</Typography>
                          {idx < arr.length - 1 && (
                            <Typography variant="caption" color="text.disabled">›</Typography>
                          )}
                        </Stack>
                      ))}
                      {bulkCtx.applicationId && (
                        <Chip size="small"
                          label={bulkApplications.find((a:any) => a.id === bulkCtx.applicationId)?.name}
                          sx={{ fontSize:10, height:18, ml:0.5, bgcolor:'rgba(59,130,246,0.12)', color:'primary.main' }} />
                      )}
                      {bulkCtx.releaseId && (
                        <Chip size="small"
                          label={bulkReleases.find((r:any) => r.id === bulkCtx.releaseId)?.version}
                          sx={{ fontSize:10, height:18, bgcolor:'rgba(16,185,129,0.12)', color:'#10b981' }} />
                      )}
                      {bulkCtx.sprintId && (
                        <Chip size="small"
                          label={bulkSprints.find((s:any) => s.id === bulkCtx.sprintId)?.name}
                          sx={{ fontSize:10, height:18, bgcolor:'rgba(139,92,246,0.12)', color:'secondary.main' }} />
                      )}
                    </Stack>
                  </Box>
                ) : (
                  <Box sx={{ mt:2, p:1.2, borderRadius:1.5,
                    bgcolor:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
                    <Typography variant="caption" color="warning.main" sx={{ fontWeight:500 }}>
                      ⚠️ Select at least a Project to enable the import
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* ════ SECTION 2 — Upload Type ════ */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight:600, mb:1 }}>
                  What are you uploading?
                </Typography>
                <ToggleButtonGroup
                  value={bulkUploadType} exclusive fullWidth
                  onChange={(_, val) => { if (val) { setBulkUploadType(val); setBulkFile(null); setBulkResult(null); } }}
                  color="primary" size="small"
                >
                  <ToggleButton value="scenarios" sx={{ py:1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Folder sx={{ fontSize:16 }} /><span>Test Scenarios Template</span>
                    </Stack>
                  </ToggleButton>
                  <ToggleButton value="testcases" sx={{ py:1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Description sx={{ fontSize:16 }} /><span>Test Cases Template</span>
                    </Stack>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* ════ SECTION 3 — Template Downloads ════ */}
              <Box sx={{ p:2, bgcolor:'background.default', borderRadius:2, border:'1px solid', borderColor:'divider' }}>
                <Typography variant="subtitle2" sx={{ fontWeight:600, mb:0.5 }}>
                  Step 1: Download the Template
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb:1.5 }}>
                  Ensure your document matches the column headers of our templates to prevent parsing errors.
                </Typography>
                <Grid container spacing={1.5}>
                  {['xlsx','csv','docx'].map(fmt => {
                    const label = fmt==='xlsx' ? 'Excel (.xlsx)' : fmt==='csv' ? 'CSV (.csv)' : 'Word (.docx)';
                    return (
                      <Grid item xs={12} sm={4} key={fmt}>
                        <Button fullWidth variant="outlined" size="small"
                          startIcon={<TableChart sx={{ fontSize:14 }} />}
                          onClick={() => handleDownloadTemplate(bulkUploadType, fmt)}>
                          {label}
                        </Button>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>

              {/* ════ SECTION 4 — File Upload ════ */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight:600, mb:1 }}>
                  Step 2: Select and Upload File
                </Typography>
                <Button variant="outlined" component="label" startIcon={<CloudUpload />}
                  size="large"
                  disabled={!bulkCtx.projectId}
                  sx={{
                    py:3, borderStyle:'dashed', width:'100%',
                    transition:'all 0.2s',
                    '&:not(:disabled):hover':{ borderColor:'primary.main', bgcolor:'rgba(59,130,246,0.04)' }
                  }}>
                  {bulkFile ? bulkFile.name : (!bulkCtx.projectId
                    ? 'Select a Project above to enable upload'
                    : 'Click to select .xlsx, .csv, or .docx file')}
                  <input type="file" hidden accept=".xlsx,.xls,.csv,.docx"
                    onChange={e => { setBulkFile(e.target.files?.[0] ?? null); setBulkResult(null); }} />
                </Button>
                {bulkFile && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt:1 }}>
                    <Chip label={bulkFile.name} size="small"
                      onDelete={() => setBulkFile(null)}
                      sx={{ maxWidth:280, fontSize:11 }} />
                    <Typography variant="caption" color="text.secondary">
                      {(bulkFile.size / 1024).toFixed(1)} KB
                    </Typography>
                  </Stack>
                )}
              </Box>

              {/* ════ Import Results ════ */}
              {bulkResult && (() => {
                const realErrors = (bulkResult.errors || []).filter((e: string) => !e.includes('Skipped —'));
                const skippedRows = (bulkResult.errors || []).filter((e: string) => e.includes('Skipped —'));
                const hasRealErrors = realErrors.length > 0;
                return (
                  <Box>
                    <Alert
                      severity={hasRealErrors ? 'warning' : skippedRows.length > 0 ? 'info' : 'success'}
                      sx={{ borderRadius: 2 }}
                    >
                      <Typography variant="subtitle2" fontWeight={700}>
                        {bulkResult.message || 'Import Completed'}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        • Scenarios Created: <strong>{bulkResult.scenarios_created}</strong>
                      </Typography>
                      <Typography variant="body2">
                        • Test Cases Created: <strong>{bulkResult.test_cases_created}</strong>
                      </Typography>
                      <Typography variant="body2">
                        • Executions Logged: <strong>{bulkResult.executions_logged}</strong>
                      </Typography>
                      {(bulkResult.skipped_duplicates > 0 || skippedRows.length > 0) && (
                        <Typography variant="body2" sx={{ color: 'info.main' }}>
                          • Skipped Duplicates: <strong>{bulkResult.skipped_duplicates ?? skippedRows.length}</strong>
                          <Typography component="span" variant="caption" sx={{ ml: 1, opacity: 0.75 }}>
                            (already exist — safe to ignore)
                          </Typography>
                        </Typography>
                      )}
                    </Alert>

                    {/* Real parse/validation errors */}
                    {hasRealErrors && (
                      <Box sx={{ mt: 1.5 }}>
                        <Typography variant="caption" color="error" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
                          Parse Errors ({realErrors.length}):
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 140, overflow: 'auto', bgcolor: 'rgba(239,68,68,0.05)' }}>
                          {realErrors.map((err: string, i: number) => (
                            <Typography key={i} variant="caption" color="error.main" display="block" sx={{ fontFamily: 'monospace' }}>
                              {err}
                            </Typography>
                          ))}
                        </Paper>
                      </Box>
                    )}

                    {/* Duplicate skip notices — collapsible, amber */}
                    {skippedRows.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 600, mb: 0.5 }} display="block">
                          Skipped (already exist — {skippedRows.length} rows):
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 100, overflow: 'auto', bgcolor: 'rgba(245,158,11,0.05)' }}>
                          {skippedRows.map((err: string, i: number) => (
                            <Typography key={i} variant="caption" sx={{ color: 'warning.dark', fontFamily: 'monospace' }} display="block">
                              {err}
                            </Typography>
                          ))}
                        </Paper>
                      </Box>
                    )}
                  </Box>
                );
              })()}

            </Stack>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px:3, pb:2.5, gap:1 }}>
          <Button onClick={() => setOpenBulkUpload(false)} variant="outlined" color="inherit">
            Close
          </Button>
          <Button
            type="submit"
            form="bulk-upload-form"
            variant="contained"
            disabled={!bulkFile || !bulkCtx.projectId || bulkUpload.isPending}
            sx={{ background:'linear-gradient(90deg,#3b82f6,#8b5cf6)', minWidth:160 }}
          >
            {bulkUpload.isPending ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} color="inherit" />
                <span>Importing…</span>
              </Stack>
            ) : (
              <span>Upload & Import</span>
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════════════════════════════════════════════════
          SCENARIO 3-DOT MENU
      ════════════════════════════════════════════════ */}
      <MuiMenu
        anchorEl={scenMenuAnchor}
        open={Boolean(scenMenuAnchor)}
        onClose={() => { setScenMenuAnchor(null); setScenMenuTarget(null); }}
        PaperProps={{ sx: { borderRadius: 2, boxShadow: 6, minWidth: 160 } }}>
        {canUpdate && (
          <MenuItem
            onClick={() => {
              setScenMenuAnchor(null);
              if (scenMenuTarget) handleOpenEditScenario(scenMenuTarget);
            }}
            sx={{ gap: 1.5, py: 1.2 }}>
            <EditOutlined sx={{ fontSize: 17, color: '#f59e0b' }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Edit Scenario</Typography>
          </MenuItem>
        )}
        {canDelete && (
          <MenuItem
            onClick={() => {
              setScenMenuAnchor(null);
              if (scenMenuTarget) setDeleteScenConfirm({ open: true, scen: scenMenuTarget });
            }}
            sx={{ gap: 1.5, py: 1.2 }}>
            <DeleteOutline sx={{ fontSize: 17, color: '#ef4444' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#ef4444' }}>Delete Scenario</Typography>
          </MenuItem>
        )}
      </MuiMenu>

      {/* ════════════════════════════════════════════════
          CONFIRM DELETE SCENARIO
      ════════════════════════════════════════════════ */}
      <Dialog open={deleteScenConfirm.open}
        onClose={() => setDeleteScenConfirm({ open: false, scen: null })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Outfit', fontWeight: 700 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: 'rgba(239,68,68,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DeleteOutline sx={{ color: '#ef4444', fontSize: 20 }} />
            </Box>
            <Typography variant="h6" sx={{ fontFamily: 'Outfit', fontWeight: 700 }}>Delete Scenario</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Delete scenario{' '}
            <strong style={{ color: '#6366f1' }}>{deleteScenConfirm.scen?.scenario_id}</strong>?
            <br />All test cases inside will also be deleted. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteScenConfirm({ open: false, scen: null })} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button variant="contained" disabled={deleteScenario.isPending}
            onClick={() => deleteScenConfirm.scen && deleteScenario.mutate(deleteScenConfirm.scen.id)}
            sx={{ bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' }, minWidth: 110 }}>
            {deleteScenario.isPending
              ? <><CircularProgress size={14} color="inherit" sx={{ mr: 1 }} />Deleting…</>
              : <><DeleteOutline sx={{ fontSize: 16, mr: 0.5 }} />Delete</>}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════════════════════════════════════════════════
          CONFIRM DELETE TEST CASE
      ════════════════════════════════════════════════ */}
      <Dialog open={deleteTCConfirm.open}
        onClose={() => setDeleteTCConfirm({ open: false, tc: null })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Outfit', fontWeight: 700 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: 'rgba(239,68,68,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DeleteOutline sx={{ color: '#ef4444', fontSize: 20 }} />
            </Box>
            <Typography variant="h6" sx={{ fontFamily: 'Outfit', fontWeight: 700 }}>Delete Test Case</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Delete{' '}
            <strong style={{ color: '#6366f1' }}>{deleteTCConfirm.tc?.test_case_id}</strong>?
            <br />Execution history will also be removed. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteTCConfirm({ open: false, tc: null })} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button variant="contained" disabled={deleteTCMut.isPending}
            onClick={() => deleteTCConfirm.tc && deleteTCMut.mutate(deleteTCConfirm.tc.id)}
            sx={{ bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' }, minWidth: 110 }}>
            {deleteTCMut.isPending
              ? <><CircularProgress size={14} color="inherit" sx={{ mr: 1 }} />Deleting…</>
              : <><DeleteOutline sx={{ fontSize: 16, mr: 0.5 }} />Delete</>}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Toast Notifications ─────────────────────────────── */}
      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical:'bottom', horizontal:'right' }}>
        <Alert severity={toast?.type ?? 'info'} onClose={() => setToast(null)}
          sx={{ minWidth:280, borderRadius:2, boxShadow:4 }}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TestCases;
