import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Tabs, Tab, TextField, Button, Grid, Card,
  FormControl, InputLabel, Select, MenuItem, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Alert, Chip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Switch
} from '@mui/material';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import api from '../services/api';
import AuditLog from './AuditLog';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = (props: any) => {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

const Admin: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const { user } = useSelector((state: RootState) => state.auth);

  // Database Explorer states
  const [dbTables, setDbTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableSchema, setTableSchema] = useState<any[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [customQuery, setCustomQuery] = useState<string>('');
  const [queryResult, setQueryResult] = useState<{ columns: string[]; rows: any[]; duration_ms?: number; row_count?: number } | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  // Network Ports states
  const [networkPorts, setNetworkPorts] = useState<any[]>([]);
  const [portsLoading, setPortsLoading] = useState(false);
  const [portsError, setPortsError] = useState<string | null>(null);
  const [portsSearch, setPortsSearch] = useState('');

  // Fetch db tables for Super Admin
  useEffect(() => {
    if (user?.role === 'Super Admin') {
      api.get('/admin/db/tables')
        .then(res => setDbTables(res.data.tables))
        .catch(console.error);
    }
  }, [user]);

  // Fetch schema when table is selected
  useEffect(() => {
    if (selectedTable) {
      setSchemaLoading(true);
      api.get(`/admin/db/schema/${selectedTable}`)
        .then(res => {
          setTableSchema(res.data.columns);
          setSchemaLoading(false);
          setCustomQuery(`SELECT * FROM \`${selectedTable}\` LIMIT 10;`);
          setQueryResult(null);
          setQueryError(null);
        })
        .catch(err => {
          console.error(err);
          setSchemaLoading(false);
        });
    } else {
      setTableSchema([]);
    }
  }, [selectedTable]);

  const handleRunQuery = async (queryText: string) => {
    setQueryLoading(true);
    setQueryResult(null);
    setQueryError(null);
    try {
      const res = await api.post('/admin/db/query', { query: queryText });
      setQueryResult(res.data);
    } catch (err: any) {
      setQueryError(err.response?.data?.detail || 'An error occurred while running the query.');
    } finally {
      setQueryLoading(false);
    }
  };


  // Lists states
  const [groups, setGroups] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [allApps, setAllApps] = useState<any[]>([]);

  // 1. Group Form states
  const [gName, setGName] = useState('');
  const [gDesc, setGDesc] = useState('');

  // 2. Company Form states
  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cGroupId, setCGroupId] = useState<number | ''>('');

  // 3. Project Form states
  const [pName, setPName] = useState('');
  const [pCode, setPCode] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pCompId, setPCompId] = useState<number | ''>('');

  // 3b. Application Form states
  const [appName, setAppName] = useState('');
  const [appCode, setAppCode] = useState('');
  const [appDesc, setAppDesc] = useState('');
  const [appProjId, setAppProjId] = useState<number | ''>('');

  // 4. Sprint & Release Form states
  const [sprintName, setSprintName] = useState('');
  const [sprintProjId, setSprintProjId] = useState<number | ''>('');
  const [sprintAppId, setSprintAppId] = useState<number | ''>('');
  const [sprintApps, setSprintApps] = useState<any[]>([]);
  const [sprintStart, setSprintStart] = useState('');
  const [sprintEnd, setSprintEnd] = useState('');

  const [relVersion, setRelVersion] = useState('');
  const [relProjId, setRelProjId] = useState<number | ''>('');
  const [relAppId, setRelAppId] = useState<number | ''>('');
  const [releaseApps, setReleaseApps] = useState<any[]>([]);
  const [relDate, setRelDate] = useState('');

  // 5. Requirement Form states
  const [reqId, setReqId] = useState('');
  const [reqTitle, setReqTitle] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqProjId, setReqProjId] = useState<number | ''>('');
  const [reqAppId, setReqAppId] = useState<number | ''>('');
  const [reqApps, setReqApps] = useState<any[]>([]);
  const [allReqs, setAllReqs] = useState<any[]>([]);

  // 6. User Form states
  const [uEmail, setUEmail] = useState('');
  const [uName, setUName] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uRoles, setURoles] = useState<string[]>(['Viewer']);
  const [uGroupId, setUGroupId] = useState<number | ''>('');
  const [uCompId, setUCompId] = useState<number | ''>('');

  // User Edit Modal states
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUEmail, setEditUEmail] = useState('');
  const [editUName, setEditUName] = useState('');
  const [editUPassword, setEditUPassword] = useState('');
  const [editURoles, setEditURoles] = useState<string[]>([]);
  const [editUGroupId, setEditUGroupId] = useState<number | ''>('');
  const [editUCompId, setEditUCompId] = useState<number | ''>('');
  const [editUActive, setEditUActive] = useState(true);

  const filteredUserCompanies = uGroupId
    ? companies.filter(c => c.group_id === uGroupId)
    : companies;

  const filteredEditUserCompanies = editUGroupId
    ? companies.filter(c => c.group_id === editUGroupId)
    : companies;

  const handleUserGroupChange = (val: number | '') => {
    setUGroupId(val);
    if (val) {
      const comp = companies.find(c => c.id === uCompId);
      if (comp && comp.group_id !== val) {
        setUCompId('');
      }
    }
  };

  const handleUserCompanyChange = (val: number | '') => {
    setUCompId(val);
    if (val) {
      const comp = companies.find(c => c.id === val);
      if (comp && comp.group_id) {
        setUGroupId(comp.group_id);
      }
    }
  };

  const handleEditUserGroupChange = (val: number | '') => {
    setEditUGroupId(val);
    if (val) {
      const comp = companies.find(c => c.id === editUCompId);
      if (comp && comp.group_id !== val) {
        setEditUCompId('');
      }
    }
  };

  const handleEditUserCompanyChange = (val: number | '') => {
    setEditUCompId(val);
    if (val) {
      const comp = companies.find(c => c.id === val);
      if (comp && comp.group_id) {
        setEditUGroupId(comp.group_id);
      }
    }
  };

  const handleOpenEditUser = (u: any) => {
    setEditingUserId(u.id);
    setEditUEmail(u.email);
    setEditUName(u.full_name);
    setEditUPassword('');
    setEditURoles(u.role ? u.role.split(',').map((r: string) => r.trim()) : []);
    setEditUGroupId(u.group_id || '');
    setEditUCompId(u.company_id || '');
    setEditUActive(u.is_active !== false);
    setEditUserOpen(true);
  };

  // Notifications
  const [notif, setNotif] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Fetch applications for Schedule Sprint form when project changes
  useEffect(() => {
    if (sprintProjId) {
      api.get(`/org/applications?project_id=${sprintProjId}`)
        .then(res => setSprintApps(res.data))
        .catch(console.error);
    } else {
      setSprintApps([]);
    }
    setSprintAppId('');
  }, [sprintProjId]);

  // Fetch applications for Schedule Release form when project changes
  useEffect(() => {
    if (relProjId) {
      api.get(`/org/applications?project_id=${relProjId}`)
        .then(res => setReleaseApps(res.data))
        .catch(console.error);
    } else {
      setReleaseApps([]);
    }
    setRelAppId('');
  }, [relProjId]);

  // Fetch applications for Requirement form when project changes
  useEffect(() => {
    if (reqProjId) {
      api.get(`/org/applications?project_id=${reqProjId}`)
        .then(res => setReqApps(res.data))
        .catch(console.error);
      api.get(`/testcases/requirements?project_id=${reqProjId}`)
        .then(res => setAllReqs(res.data))
        .catch(console.error);
    } else {
      setReqApps([]);
      setAllReqs([]);
    }
    setReqAppId('');
  }, [reqProjId]);

  // Fetch network ports
  const fetchNetworkPorts = () => {
    setPortsLoading(true);
    setPortsError(null);
    api.get('/admin/system/ports')
      .then(res => {
        setNetworkPorts(res.data.connections || []);
        setPortsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setPortsError(err.response?.data?.detail || 'Failed to fetch network ports.');
        setPortsLoading(false);
      });
  };

  useEffect(() => {
    if (tabValue === 6 && user?.role === 'Super Admin') {
      fetchNetworkPorts();
    }
  }, [tabValue, user]);

  // Load masters on mount / updates
  const loadMasters = () => {
    api.get('/org/groups').then(res => setGroups(res.data)).catch(console.error);
    api.get('/org/companies').then(res => setCompanies(res.data)).catch(console.error);
    api.get('/org/projects').then(res => setProjects(res.data)).catch(console.error);
    api.get('/org/users').then(res => setUsers(res.data)).catch(console.error);
    api.get('/org/applications').then(res => setAllApps(res.data)).catch(console.error);
  };

  useEffect(() => {
    loadMasters();
  }, []);

  // Form Submissions
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/org/groups', { name: gName, description: gDesc });
      setNotif({ type: 'success', msg: 'Group registered successfully!' });
      setGName(''); setGDesc('');
      loadMasters();
      window.dispatchEvent(new CustomEvent('masters:refresh'));
    } catch (err: any) {
      setNotif({ type: 'error', msg: err.response?.data?.detail || 'Error creating group.' });
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/org/companies', { name: cName, description: cDesc, group_id: cGroupId });
      setNotif({ type: 'success', msg: 'Company registered successfully!' });
      setCName(''); setCDesc(''); setCGroupId('');
      loadMasters();
      window.dispatchEvent(new CustomEvent('masters:refresh'));
    } catch (err: any) {
      setNotif({ type: 'error', msg: err.response?.data?.detail || 'Error creating company.' });
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/org/projects', { name: pName, code: pCode, description: pDesc, company_id: pCompId });
      setNotif({ type: 'success', msg: 'Project registered successfully!' });
      setPName(''); setPCode(''); setPDesc(''); setPCompId('');
      loadMasters();
      window.dispatchEvent(new CustomEvent('masters:refresh'));
    } catch (err: any) {
      setNotif({ type: 'error', msg: err.response?.data?.detail || 'Error creating project.' });
    }
  };

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/org/applications', {
        name: appName,
        code: appCode,
        description: appDesc || null,
        project_id: appProjId,
        is_active: true
      });
      setNotif({ type: 'success', msg: 'Application registered successfully!' });
      // Refresh current sprint/release applications if they belong to this project
      if (sprintProjId === appProjId) {
        api.get(`/org/applications?project_id=${sprintProjId}`)
          .then(res => setSprintApps(res.data))
          .catch(console.error);
      }
      if (relProjId === appProjId) {
        api.get(`/org/applications?project_id=${relProjId}`)
          .then(res => setReleaseApps(res.data))
          .catch(console.error);
      }
      setAppName(''); setAppCode(''); setAppDesc(''); setAppProjId('');
      loadMasters();
      window.dispatchEvent(new CustomEvent('masters:refresh'));
    } catch (err: any) {
      setNotif({ type: 'error', msg: err.response?.data?.detail || 'Error creating application.' });
    }
  };

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/work/sprints', {
        name: sprintName,
        project_id: sprintProjId,
        application_id: sprintAppId || null,
        start_date: sprintStart || null,
        end_date: sprintEnd || null,
        status: 'Active'
      });
      setNotif({ type: 'success', msg: 'Sprint scheduled successfully!' });
      setSprintName(''); setSprintProjId(''); setSprintAppId(''); setSprintStart(''); setSprintEnd('');
      loadMasters();
      window.dispatchEvent(new CustomEvent('masters:refresh'));
    } catch (err: any) {
      setNotif({ type: 'error', msg: err.response?.data?.detail || 'Error scheduling sprint.' });
    }
  };

  const handleCreateRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/work/releases', {
        version: relVersion,
        project_id: relProjId,
        application_id: relAppId || null,
        release_date: relDate || null,
        status: 'Planning'
      });
      setNotif({ type: 'success', msg: 'Release version scheduled successfully!' });
      setRelVersion(''); setRelProjId(''); setRelAppId(''); setRelDate('');
      loadMasters();
      window.dispatchEvent(new CustomEvent('masters:refresh'));
    } catch (err: any) {
      setNotif({ type: 'error', msg: err.response?.data?.detail || 'Error scheduling release.' });
    }
  };

  const handleCreateRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/testcases/requirements', {
        requirement_id: reqId,
        title: reqTitle,
        description: reqDesc,
        project_id: reqProjId,
        application_id: reqAppId || null
      });
      setNotif({ type: 'success', msg: 'Requirement recorded successfully!' });
      setReqId(''); setReqTitle(''); setReqDesc('');
      // Refresh requirements list
      if (reqProjId) {
        api.get(`/testcases/requirements?project_id=${reqProjId}`)
          .then(res => setAllReqs(res.data))
          .catch(console.error);
      }
    } catch (err: any) {
      setNotif({ type: 'error', msg: err.response?.data?.detail || 'Error logging requirement.' });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', {
        email: uEmail,
        full_name: uName,
        password: uPassword,
        role: uRoles.join(','),
        company_id: uCompId || null,
        group_id: uGroupId || null
      });
      setNotif({ type: 'success', msg: 'System user registered successfully!' });
      setUEmail(''); setUName(''); setUPassword(''); setURoles(['Viewer']); setUGroupId(''); setUCompId('');
      loadMasters();
      window.dispatchEvent(new CustomEvent('masters:refresh'));
    } catch (err: any) {
      setNotif({ type: 'error', msg: err.response?.data?.detail || 'Error creating user.' });
    }
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    try {
      await api.put(`/org/users/${editingUserId}`, {
        email: editUEmail,
        full_name: editUName,
        password: editUPassword || undefined,
        role: editURoles.join(','),
        group_id: editUGroupId || 0,
        company_id: editUCompId || 0,
        is_active: editUActive
      });
      setNotif({ type: 'success', msg: 'User updated successfully!' });
      setEditUserOpen(false);
      loadMasters();
      window.dispatchEvent(new CustomEvent('masters:refresh'));
    } catch (err: any) {
      setNotif({ type: 'error', msg: err.response?.data?.detail || 'Error updating user.' });
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontFamily: 'Outfit', fontWeight: 800 }}>Master Administration Panel</Typography>
        <Typography variant="body2" color="text.secondary">Configure groups, companies, projects, release schedules, requirements, and registered user accounts.</Typography>
      </Box>

      {notif && (
        <Alert severity={notif.type} onClose={() => setNotif(null)} sx={{ mb: 3 }}>
          {notif.msg}
        </Alert>
      )}

      <Tabs value={tabValue} onChange={(_, val) => setTabValue(val)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Groups & Companies" />
        <Tab label="Projects, Sprints & Releases" />
        <Tab label="Requirements Mapping" />
        <Tab label="User Registrations" />
        <Tab label="Audit Trail" />
        {user?.role === 'Super Admin' && <Tab label="Database Explorer" />}
        {user?.role === 'Super Admin' && <Tab label="Network Ports" />}
      </Tabs>

      {/* Tab 1: Groups & Companies */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Card component="form" onSubmit={handleCreateGroup}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Register Group Master</Typography>
              <Stack spacing={2}>
                <TextField required fullWidth label="Group Name" value={gName} onChange={e => setGName(e.target.value)} />
                <TextField fullWidth label="Group Description" value={gDesc} onChange={e => setGDesc(e.target.value)} />
                <Button type="submit" variant="contained">Create Group</Button>
              </Stack>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card component="form" onSubmit={handleCreateCompany}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Register Company Master</Typography>
              <Stack spacing={2}>
                <TextField required fullWidth label="Company Name" value={cName} onChange={e => setCName(e.target.value)} />
                <TextField fullWidth label="Company Description" value={cDesc} onChange={e => setCDesc(e.target.value)} />
                <FormControl fullWidth required>
                  <InputLabel>Associated Group</InputLabel>
                  <Select value={cGroupId} label="Associated Group" onChange={e => setCGroupId(Number(e.target.value))}>
                    {groups.map(g => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <Button type="submit" variant="contained">Create Company</Button>
              </Stack>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Tab 2: Projects, Sprints & Releases */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={4}>
          {/* Project Form */}
          <Grid item xs={12} md={6}>
            <Card component="form" onSubmit={handleCreateProject} sx={{ height: '100%' }}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Create Project</Typography>
              <Stack spacing={2}>
                <TextField required fullWidth label="Project Name" value={pName} onChange={e => setPName(e.target.value)} />
                <TextField required fullWidth label="Project Code (e.g. PROJ001)" value={pCode} onChange={e => setPCode(e.target.value)} />
                <TextField fullWidth label="Project Description" value={pDesc} onChange={e => setPDesc(e.target.value)} />
                <FormControl fullWidth required>
                  <InputLabel>Company</InputLabel>
                  <Select value={pCompId} label="Company" onChange={e => setPCompId(Number(e.target.value))}>
                    {companies.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <Button type="submit" variant="contained">Create Project</Button>
              </Stack>
            </Card>
          </Grid>

          {/* Application Form */}
          <Grid item xs={12} md={6}>
            <Card component="form" onSubmit={handleCreateApplication} sx={{ height: '100%' }}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Register Application</Typography>
              <Stack spacing={2}>
                <TextField required fullWidth label="Application Name" value={appName} onChange={e => setAppName(e.target.value)} />
                <TextField required fullWidth label="Application Code (e.g. APP001)" value={appCode} onChange={e => setAppCode(e.target.value)} />
                <TextField fullWidth label="Application Description" value={appDesc} onChange={e => setAppDesc(e.target.value)} />
                <FormControl fullWidth required>
                  <InputLabel>Associated Project</InputLabel>
                  <Select value={appProjId} label="Associated Project" onChange={e => setAppProjId(Number(e.target.value))}>
                    {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <Button type="submit" variant="contained">Create Application</Button>
              </Stack>
            </Card>
          </Grid>

          {/* Sprint Form */}
          <Grid item xs={12} md={6}>
            <Card component="form" onSubmit={handleCreateSprint} sx={{ height: '100%' }}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Schedule Sprint</Typography>
              <Stack spacing={2}>
                <TextField required fullWidth label="Sprint Name (e.g. Sprint 1)" value={sprintName} onChange={e => setSprintName(e.target.value)} />
                <FormControl fullWidth required>
                  <InputLabel>Project</InputLabel>
                  <Select value={sprintProjId} label="Project" onChange={e => setSprintProjId(Number(e.target.value))}>
                    {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl fullWidth disabled={!sprintProjId}>
                  <InputLabel>Application (Optional)</InputLabel>
                  <Select value={sprintAppId} label="Application (Optional)" onChange={e => setSprintAppId(e.target.value ? Number(e.target.value) : '')}>
                    <MenuItem value=""><em>None (Project-wide)</em></MenuItem>
                    {sprintApps.map(app => <MenuItem key={app.id} value={app.id}>{app.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField fullWidth type="date" label="Start Date" InputLabelProps={{ shrink: true }} value={sprintStart} onChange={e => setSprintStart(e.target.value)} />
                <TextField fullWidth type="date" label="End Date" InputLabelProps={{ shrink: true }} value={sprintEnd} onChange={e => setSprintEnd(e.target.value)} />
                <Button type="submit" variant="contained">Schedule Sprint</Button>
              </Stack>
            </Card>
          </Grid>

          {/* Release Form */}
          <Grid item xs={12} md={6}>
            <Card component="form" onSubmit={handleCreateRelease} sx={{ height: '100%' }}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Schedule Release Version</Typography>
              <Stack spacing={2}>
                <TextField required fullWidth label="Release Version (e.g. v1.0.0)" value={relVersion} onChange={e => setRelVersion(e.target.value)} />
                <FormControl fullWidth required>
                  <InputLabel>Project</InputLabel>
                  <Select value={relProjId} label="Project" onChange={e => setRelProjId(Number(e.target.value))}>
                    {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl fullWidth disabled={!relProjId}>
                  <InputLabel>Application (Optional)</InputLabel>
                  <Select value={relAppId} label="Application (Optional)" onChange={e => setRelAppId(e.target.value ? Number(e.target.value) : '')}>
                    <MenuItem value=""><em>None (Project-wide)</em></MenuItem>
                    {releaseApps.map(app => <MenuItem key={app.id} value={app.id}>{app.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField fullWidth type="date" label="Release Target Date" InputLabelProps={{ shrink: true }} value={relDate} onChange={e => setRelDate(e.target.value)} />
                <Button type="submit" variant="contained">Schedule Release</Button>
              </Stack>
            </Card>
          </Grid>
        </Grid>

        {/* Existing Applications Table */}
        <Box sx={{ mt: 5 }}>
          <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Existing Applications</Typography>
          <TableContainer component={Paper} sx={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4 }}>
            <Table>
              <TableHead sx={{ backgroundColor: 'background.paper' }}>
                <TableRow>
                  <TableCell>Application Name</TableCell>
                  <TableCell>Application Code</TableCell>
                  <TableCell>Project Name</TableCell>
                  <TableCell>Description</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allApps.map((app: any) => {
                  const matchedProject = projects.find(p => p.id === app.project_id);
                  const projectName = matchedProject ? matchedProject.name : 'Unknown Project';
                  return (
                    <TableRow key={app.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{app.name}</TableCell>
                      <TableCell>{app.code}</TableCell>
                      <TableCell>{projectName}</TableCell>
                      <TableCell>{app.description || '—'}</TableCell>
                    </TableRow>
                  );
                })}
                {allApps.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No applications registered yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </TabPanel>

      {/* Tab 3: Requirements Mapping */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={4}>
          {/* Create Requirement Form */}
          <Grid item xs={12} md={5}>
            <Card component="form" onSubmit={handleCreateRequirement} sx={{ height: '100%' }}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 0.5 }}>Create Requirement</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Requirements can be scoped at project level or optionally pinned to a specific application module.
              </Typography>
              <Stack spacing={2}>
                <FormControl fullWidth required>
                  <InputLabel>Project</InputLabel>
                  <Select value={reqProjId} label="Project" onChange={e => setReqProjId(Number(e.target.value))}>
                    {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                  </Select>
                </FormControl>

                <FormControl fullWidth disabled={!reqProjId}>
                  <InputLabel>Application (Optional)</InputLabel>
                  <Select
                    value={reqAppId}
                    label="Application (Optional)"
                    onChange={e => setReqAppId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <MenuItem value=""><em>None (Project-wide)</em></MenuItem>
                    {reqApps.map(app => <MenuItem key={app.id} value={app.id}>{app.name}</MenuItem>)}
                  </Select>
                </FormControl>

                <TextField
                  required
                  fullWidth
                  label="Requirement ID"
                  placeholder="e.g. REQ-GOVP-001"
                  value={reqId}
                  onChange={e => setReqId(e.target.value)}
                  helperText="Use a consistent naming convention: REQ-[PROJECT CODE]-[NNN]"
                />
                <TextField
                  required
                  fullWidth
                  label="Title / Summary"
                  placeholder="e.g. User login with SSO must enforce MFA"
                  value={reqTitle}
                  onChange={e => setReqTitle(e.target.value)}
                />
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Acceptance Criteria / Description"
                  placeholder="Describe the acceptance criteria, user story, or compliance rule..."
                  value={reqDesc}
                  onChange={e => setReqDesc(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!reqProjId || !reqId || !reqTitle}
                  sx={{ background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)', py: 1.2 }}
                >
                  Register Requirement
                </Button>
              </Stack>
            </Card>
          </Grid>

          {/* Existing Requirements Table */}
          <Grid item xs={12} md={7}>
            <Box sx={{ height: '100%' }}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 1 }}>Registered Requirements</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                {reqProjId ? `Showing requirements for selected project.` : 'Select a project to view its requirements.'}
              </Typography>
              <TableContainer component={Paper} sx={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 3, maxHeight: 480, overflow: 'auto' }}>
                <Table stickyHeader size="small">
                  <TableHead sx={{ '& th': { backgroundColor: 'background.paper', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 } }}>
                    <TableRow>
                      <TableCell>Req ID</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Application</TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allReqs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                            {reqProjId ? 'No requirements found for this project.' : 'Select a project above to load requirements.'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      allReqs.map((req: any) => {
                        const matchedApp = reqApps.find((a: any) => a.id === req.application_id);
                        return (
                          <TableRow key={req.id} hover>
                            <TableCell>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.main', fontWeight: 700 }}>
                                {req.requirement_id}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>{req.title}</Typography>
                            </TableCell>
                            <TableCell>
                              {matchedApp
                                ? <Typography variant="caption" sx={{ color: 'secondary.main', fontWeight: 600 }}>{matchedApp.name}</Typography>
                                : <Typography variant="caption" color="text.disabled">Project-wide</Typography>
                              }
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {req.description ? req.description.substring(0, 60) + (req.description.length > 60 ? '...' : '') : '—'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Tab 4: User Administration */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={4}>
          <Grid item xs={12} md={5}>
            <Card component="form" onSubmit={handleCreateUser}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Register User & Assign Roles</Typography>
              <Stack spacing={2}>
                <TextField required fullWidth label="Full Name" value={uName} onChange={e => setUName(e.target.value)} />
                <TextField required fullWidth type="email" label="Email Address" value={uEmail} onChange={e => setUEmail(e.target.value)} />
                <TextField required fullWidth type="password" label="Temporary Password" value={uPassword} onChange={e => setUPassword(e.target.value)} />
                
                <FormControl fullWidth required>
                  <InputLabel>System Roles</InputLabel>
                  <Select
                    multiple
                    value={uRoles}
                    label="System Roles"
                    onChange={e => setURoles(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[])}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {['Super Admin', 'Group Admin', 'Company Admin', 'Project Manager', 'QA Lead', 'QA Engineer', 'Developer', 'Client', 'Viewer'].map(r => (
                      <MenuItem key={r} value={r}>{r}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Associated Group</InputLabel>
                  <Select value={uGroupId} label="Associated Group" onChange={e => handleUserGroupChange(e.target.value ? Number(e.target.value) : '')}>
                    <MenuItem value=""><em>None (Global Access)</em></MenuItem>
                    {groups.map(g => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Associated Company</InputLabel>
                  <Select value={uCompId} label="Associated Company" onChange={e => handleUserCompanyChange(e.target.value ? Number(e.target.value) : '')}>
                    <MenuItem value=""><em>None (Global Access)</em></MenuItem>
                    {filteredUserCompanies.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>

                <Button type="submit" variant="contained">Register User</Button>
              </Stack>
            </Card>
          </Grid>

          <Grid item xs={12} md={7}>
            <TableContainer component={Paper} sx={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4 }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: 'background.paper' }}>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Roles</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((u: any) => (
                    <TableRow key={u.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{u.full_name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(u.role || '').split(',').map((r: string) => r.trim()).filter(Boolean).map((r: string) => (
                            <Chip key={r} label={r} size="small" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell>{u.company?.name || 'Global'}</TableCell>
                      <TableCell>
                        <Chip
                          label={u.is_active !== false ? 'Active' : 'Inactive'}
                          color={u.is_active !== false ? 'success' : 'error'}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: 9, fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Button variant="outlined" size="small" sx={{ py: 0.3, px: 1, minWidth: 0, textTransform: 'none' }} onClick={() => handleOpenEditUser(u)}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Edit User Dialog */}
      <Dialog open={editUserOpen} onClose={() => setEditUserOpen(false)} maxWidth="sm" fullWidth PaperProps={{
        sx: { borderRadius: 3, background: 'linear-gradient(145deg, #1e1b4b 0%, #1a1a2e 100%)', border: '1px solid rgba(139,92,246,0.2)' }
      }}>
        <DialogTitle sx={{ pb: 1 }}>Edit User Profile</DialogTitle>
        <Box component="form" onSubmit={handleEditUserSubmit}>
          <DialogContent>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <TextField required fullWidth label="Full Name" value={editUName} onChange={e => setEditUName(e.target.value)} />
              <TextField required fullWidth type="email" label="Email Address" value={editUEmail} onChange={e => setEditUEmail(e.target.value)} />
              <TextField fullWidth type="password" label="New Password (leave blank to keep current)" value={editUPassword} onChange={e => setEditUPassword(e.target.value)} />
              
              <FormControl fullWidth required>
                <InputLabel>System Roles</InputLabel>
                <Select
                  multiple
                  value={editURoles}
                  label="System Roles"
                  onChange={e => setEditURoles(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[])}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {['Super Admin', 'Group Admin', 'Company Admin', 'Project Manager', 'QA Lead', 'QA Engineer', 'Developer', 'Client', 'Viewer'].map(r => (
                    <MenuItem key={r} value={r}>{r}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Associated Group</InputLabel>
                <Select value={editUGroupId} label="Associated Group" onChange={e => handleEditUserGroupChange(e.target.value ? Number(e.target.value) : '')}>
                  <MenuItem value=""><em>None (Global Access)</em></MenuItem>
                  {groups.map(g => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Associated Company</InputLabel>
                <Select value={editUCompId} label="Associated Company" onChange={e => handleEditUserCompanyChange(e.target.value ? Number(e.target.value) : '')}>
                  <MenuItem value=""><em>None (Global Access)</em></MenuItem>
                  {filteredEditUserCompanies.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={editUActive}
                    onChange={e => setEditUActive(e.target.checked)}
                    color="primary"
                  />
                }
                label="Account Active"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setEditUserOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
            <Button type="submit" variant="contained" sx={{ background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}>Save Changes</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Tab 5: Audit Trail */}
      <TabPanel value={tabValue} index={4}>
        <AuditLog />
      </TabPanel>

      {/* Tab 6: Database Explorer */}
      {user?.role === 'Super Admin' && (
        <TabPanel value={tabValue} index={5}>
          <Grid container spacing={4}>
            {/* Physical Schema / Metadata */}
            <Grid item xs={12} md={4}>
              <Card sx={{ p: 3, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4, height: '100%', bgcolor: 'background.paper' }}>
                <Typography variant="h6" sx={{ fontFamily: 'Outfit', fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>🗄️</span> Database Tables
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
                  Select any database table to inspect its physical storage schema, constraints, and column metadata.
                </Typography>

                <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                  <InputLabel>Select Database Table</InputLabel>
                  <Select
                    value={selectedTable}
                    label="Select Database Table"
                    onChange={e => setSelectedTable(e.target.value as string)}
                  >
                    {dbTables.map(tbl => (
                      <MenuItem key={tbl} value={tbl}>{tbl}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {selectedTable && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>📊</span> Columns in `{selectedTable}`
                    </Typography>
                    {schemaLoading ? (
                      <Typography variant="body2" color="text.secondary">Loading schema...</Typography>
                    ) : (
                      <TableContainer component={Paper} sx={{ maxHeight: 400, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 2 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow sx={{ '& th': { bgcolor: 'background.paper', fontSize: 10, fontWeight: 700, py: 1 } }}>
                              <TableCell>Column</TableCell>
                              <TableCell>Type</TableCell>
                              <TableCell align="center">Key</TableCell>
                              <TableCell align="center">Null</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {tableSchema.map(col => (
                              <TableRow key={col.field} hover sx={{ '& td': { py: 0.8 } }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: 11, fontFamily: 'monospace' }}>{col.field}</TableCell>
                                <TableCell sx={{ fontSize: 11, color: 'text.secondary' }}>{col.type}</TableCell>
                                <TableCell align="center" sx={{ fontSize: 10 }}>
                                  {col.key === 'PRI' ? (
                                    <Chip label="PK" size="small" color="primary" sx={{ height: 16, fontSize: 8, fontWeight: 800 }} />
                                  ) : col.key === 'MUL' ? (
                                    <Chip label="FK" size="small" color="secondary" sx={{ height: 16, fontSize: 8, fontWeight: 800 }} />
                                  ) : '—'}
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: 10, color: 'text.secondary' }}>
                                  {col.null === 'YES' ? 'Yes' : 'No'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Box>
                )}
              </Card>
            </Grid>

            {/* SQL Execution / Results Grid */}
            <Grid item xs={12} md={8}>
              <Card sx={{ p: 3, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4, minHeight: 500, display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
                <Typography variant="h6" sx={{ fontFamily: 'Outfit', fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>⚡</span> Dynamic Query Fetcher
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
                  Write custom SQL SELECT commands to filter, join, and inspect data. Only read-only queries are permitted.
                </Typography>

                {selectedTable && (
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleRunQuery(`SELECT * FROM \`${selectedTable}\` LIMIT 10;`)}
                      sx={{ fontSize: 11, textTransform: 'none' }}
                    >
                      Quick Fetch (10 Rows)
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleRunQuery(`SELECT COUNT(*) AS total_count FROM \`${selectedTable}\`;`)}
                      sx={{ fontSize: 11, textTransform: 'none' }}
                    >
                      Row Count
                    </Button>
                  </Stack>
                )}

                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    placeholder="SELECT * FROM users LIMIT 10;"
                    value={customQuery}
                    onChange={e => setCustomQuery(e.target.value)}
                    sx={{
                      '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: 13, bgcolor: 'rgba(0,0,0,0.25)' }
                    }}
                  />
                  <Button
                    variant="contained"
                    disabled={queryLoading || !customQuery.trim()}
                    onClick={() => handleRunQuery(customQuery)}
                    sx={{
                      mt: 1.5,
                      background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                      '&:hover': { background: 'linear-gradient(90deg, #059669 0%, #047857 100%)' },
                      fontWeight: 700,
                      textTransform: 'none'
                    }}
                  >
                    {queryLoading ? 'Running Query...' : 'Execute SQL Query'}
                  </Button>
                </Box>

                {queryError && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Query Execution Failed:</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', mt: 0.5, display: 'block' }}>{queryError}</Typography>
                  </Alert>
                )}

                {queryResult && (
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'success.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <span>✓</span> Success ({queryResult.row_count} rows returned)
                      </Typography>
                      {queryResult.duration_ms !== undefined && (
                        <Typography variant="caption" color="text.secondary">
                          Execution time: {queryResult.duration_ms}ms
                        </Typography>
                      )}
                    </Stack>

                    <TableContainer component={Paper} sx={{ flex: 1, maxHeight: 350, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'auto' }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow sx={{ '& th': { bgcolor: 'background.paper', fontWeight: 700, fontSize: 11, py: 1.2 } }}>
                            {queryResult.columns.map(col => (
                              <TableCell key={col}>{col}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {queryResult.rows.map((row, rIdx) => (
                            <TableRow key={rIdx} hover>
                              {row.map((val: any, cIdx: number) => (
                                <TableCell key={cIdx} sx={{ fontSize: 11, color: val === null ? 'text.disabled' : 'text.primary' }}>
                                  {val === null ? 'NULL' : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                          {queryResult.rows.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={queryResult.columns.length} align="center">
                                <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                                  No records found.
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      )}

      {/* Tab 7: Network Ports */}
      {user?.role === 'Super Admin' && (
        <TabPanel value={tabValue} index={6}>
          <Card sx={{ p: 3, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4, bgcolor: 'background.paper' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontFamily: 'Outfit', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>🔌</span> Active Network Ports
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Displays all active TCP and UDP listening ports and network connections on the server host.
                </Typography>
              </Box>
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Filter by Port, PID, Proto..."
                  value={portsSearch}
                  onChange={e => setPortsSearch(e.target.value)}
                  sx={{ width: 220 }}
                />
                <Button variant="outlined" onClick={fetchNetworkPorts} disabled={portsLoading} size="small">
                  Refresh
                </Button>
              </Stack>
            </Stack>

            {portsError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {portsError}
              </Alert>
            )}

            {portsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
            ) : (
              <TableContainer component={Paper} sx={{ maxHeight: 500, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 3 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: 'background.paper', fontWeight: 700, fontSize: 11 } }}>
                      <TableCell>Protocol</TableCell>
                      <TableCell>Local Address</TableCell>
                      <TableCell>Foreign Address</TableCell>
                      <TableCell>State</TableCell>
                      <TableCell align="center">Process ID</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {networkPorts
                      .filter(conn => {
                        const search = portsSearch.toLowerCase();
                        return (
                          conn.proto.toLowerCase().includes(search) ||
                          conn.local_address.toLowerCase().includes(search) ||
                          conn.foreign_address.toLowerCase().includes(search) ||
                          conn.state.toLowerCase().includes(search) ||
                          conn.pid.toLowerCase().includes(search)
                        );
                      })
                      .map((conn, idx) => (
                        <TableRow key={idx} hover sx={{ '& td': { py: 1 } }}>
                          <TableCell>
                            <Chip
                              label={conn.proto}
                              size="small"
                              color={conn.proto === 'TCP' ? 'primary' : 'secondary'}
                              sx={{ height: 20, fontSize: 9, fontWeight: 800 }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{conn.local_address}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{conn.foreign_address}</TableCell>
                          <TableCell>
                            {conn.state ? (
                              <Chip
                                label={conn.state}
                                size="small"
                                color={conn.state === 'LISTENING' ? 'success' : 'default'}
                                variant="outlined"
                                sx={{ height: 18, fontSize: 9, fontWeight: 700 }}
                              />
                            ) : (
                              <Typography variant="caption" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                          <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>
                            {conn.pid || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    {networkPorts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" color="text.secondary">No network port data found.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>
        </TabPanel>
      )}
  </Box>
);
};

export default Admin;
