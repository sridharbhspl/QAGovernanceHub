import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem, Grid, Card, Stack,
  Chip, List, ListItem, Divider, CircularProgress, IconButton,
  Tabs, Tab, Alert, LinearProgress, Tooltip, Drawer, Checkbox, FormControlLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material';
import {
  Add, EditOutlined, DeleteOutline, Visibility, Close, Assignment,
  Folder, TrendingUp, ListAlt, KeyboardArrowRight,
  CheckBoxOutlineBlank, CheckBox
} from '@mui/icons-material';

import { RootState } from '../store';
import api from '../services/api';
import { getPreset } from '../theme/theme';
import { usePermission } from '../hooks/usePermission';

/* ══════════════════════════════════════════════════
   CONSTANTS & COLOR HELPERS
   ══════════════════════════════════════════════════ */
const STORY_STATUSES = ['Backlog', 'To Do', 'In Progress', 'Dev Complete', 'Testing', 'Done'];
const EPIC_STATUSES = ['Backlog', 'Active', 'Completed'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const FIBONACCI_POINTS = [1, 2, 3, 5, 8, 13, 21];

const priorityColor: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  Low: 'success',
  Medium: 'info',
  High: 'warning',
  Critical: 'error',
};

const statusColor: Record<string, string> = {
  Backlog: '#6b7280',
  'To Do': '#6366f1',
  'In Progress': '#f59e0b',
  'Dev Complete': '#06b6d4',
  Testing: '#8b5cf6',
  Done: '#10b981',
};

const epicStatusColor: Record<string, string> = {
  Backlog: '#6b7280',
  Active: '#f59e0b',
  Completed: '#10b981',
};

const initials = (name: string) => {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
};

const avatarGradient = (name: string) => {
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `linear-gradient(135deg, hsl(${hue},65%,50%), hsl(${(hue + 60) % 360},65%,40%))`;
};


const UserStories: React.FC = () => {
  const queryClient = useQueryClient();
  const filters = useSelector((state: RootState) => state.filters);
  const { user } = useSelector((state: RootState) => state.auth);
  const presetId = useSelector((state: RootState) => state.theme.presetId);
  const preset = getPreset(presetId);

  // Gated Permissions
  const canCreate = usePermission('create');
  const canUpdate = usePermission('update');
  const canDelete = usePermission('delete');
  const isStatusOnlyEditor = !canUpdate && (user?.role === 'Developer' || user?.role === 'QA Lead' || user?.role === 'QA Engineer');

  const projectId = filters.projectId;
  const activeSprintId = filters.sprintId;
  const activeAppId = filters.applicationId;

  // Tabs layout
  const [activeTab, setActiveTab] = useState(0);

  // Filtering local state inside stories tab
  const [selectedEpicFilter, setSelectedEpicFilter] = useState<number | 'all'>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string | 'all'>('all');

  // Slide-out Backlog Drawer details
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedStory, setSelectedStory] = useState<any | null>(null);

  // Form Modals
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [isEpicModalOpen, setIsEpicModalOpen] = useState(false);

  // Edit Mode states
  const [editingStory, setEditingStory] = useState<any | null>(null);
  const [editingEpic, setEditingEpic] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form States
  const [storyForm, setStoryForm] = useState({
    story_id: '',
    title: '',
    description: '',
    epic_id: '' as number | '',
    story_points: '' as number | '',
    acceptance_criteria: '',
    sprint_id: '' as number | '',
    application_id: '' as number | '',
    status: 'Backlog',
    priority: 'Medium',
    assigned_to_id: '' as number | '',
  });

  const [epicForm, setEpicForm] = useState({
    epic_id: '',
    title: '',
    description: '',
    status: 'Backlog',
  });

  // Local state for checking items in the Acceptance Criteria checklist
  const [acChecklist, setAcChecklist] = useState<{ text: string; checked: boolean }[]>([]);

  /* ══════════════════════════════════════════════════
     REACT QUERY DATA FETCHING
     ══════════════════════════════════════════════════ */
  // Fetch Project details to get the project code for ID generation
  const { data: projectList = [] } = useQuery({
    queryKey: ['projects', filters.companyId],
    queryFn: async () => {
      const res = await api.get(`/org/projects?company_id=${filters.companyId}`);
      return res.data;
    },
    enabled: !!filters.companyId,
  });
  const currentProjectObj = projectList.find((p: any) => p.id === projectId);
  const projectCode = currentProjectObj?.code || 'PROJ';

  // Fetch Stories
  const { data: stories = [], isLoading: loadingStories } = useQuery({
    queryKey: ['user-stories', projectId, activeSprintId, activeAppId],
    queryFn: async () => {
      const params: any = { project_id: projectId };
      if (activeSprintId) params.sprint_id = activeSprintId;
      if (activeAppId) params.application_id = activeAppId;
      const res = await api.get('/user-stories', { params });
      return res.data;
    },
    enabled: !!projectId,
  });

  // Fetch Epics
  const { data: epics = [], isLoading: loadingEpics } = useQuery({
    queryKey: ['epics', projectId],
    queryFn: async () => {
      const res = await api.get(`/user-stories/epics?project_id=${projectId}`);
      return res.data;
    },
    enabled: !!projectId,
  });

  // Fetch Sprints
  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: async () => {
      const res = await api.get(`/work/sprints?project_id=${projectId}`);
      return res.data;
    },
    enabled: !!projectId,
  });

  // Fetch Users (Assignees)
  const { data: users = [] } = useQuery({
    queryKey: ['project-users', projectId],
    queryFn: async () => {
      try {
        const res = await api.get(`/org/team-mappings?project_id=${projectId}`);
        if (res.data && res.data.length > 0) {
          return res.data.map((m: any) => m.user).filter(Boolean);
        }
      } catch (err) {
        console.error('Failed fetching team mapping, using general users fallback', err);
      }
      const fallback = await api.get('/org/users');
      return fallback.data;
    },
    enabled: !!projectId,
  });

  // Fetch Applications
  const { data: applications = [] } = useQuery({
    queryKey: ['applications', projectId],
    queryFn: async () => {
      const res = await api.get(`/org/applications?project_id=${projectId}`);
      return res.data;
    },
    enabled: !!projectId,
  });

  /* ══════════════════════════════════════════════════
     MUTATIONS (CREATE, UPDATE, DELETE)
     ══════════════════════════════════════════════════ */
  // Epics mutations
  const createEpicMut = useMutation({
    mutationFn: (body: any) => api.post('/user-stories/epics', body).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epics'] });
      setIsEpicModalOpen(false);
      resetEpicForm();
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || 'Failed to create Epic.');
    },
  });

  const updateEpicMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      api.put(`/user-stories/epics/${id}`, body).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epics'] });
      setIsEpicModalOpen(false);
      setEditingEpic(null);
      resetEpicForm();
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || 'Failed to update Epic.');
    },
  });

  const deleteEpicMut = useMutation({
    mutationFn: (id: number) => api.delete(`/user-stories/epics/${id}`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epics'] });
      queryClient.invalidateQueries({ queryKey: ['user-stories'] });
    },
  });

  // Stories mutations
  const createStoryMut = useMutation({
    mutationFn: (body: any) => api.post('/user-stories', body).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-stories'] });
      setIsStoryModalOpen(false);
      resetStoryForm();
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || 'Failed to create User Story.');
    },
  });

  const updateStoryMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      api.put(`/user-stories/${id}`, body).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-stories'] });
      setIsStoryModalOpen(false);
      setEditingStory(null);
      resetStoryForm();
      // Update drawer if open
      if (selectedStory?.id === data.id) {
        setSelectedStory(data);
      }
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || 'Failed to update User Story.');
    },
  });

  const deleteStoryMut = useMutation({
    mutationFn: (id: number) => api.delete(`/user-stories/${id}`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-stories'] });
      setIsDrawerOpen(false);
      setSelectedStory(null);
    },
  });

  /* ══════════════════════════════════════════════════
     FORM & UI EVENT HANDLERS
     ══════════════════════════════════════════════════ */
  const resetStoryForm = () => {
    setStoryForm({
      story_id: '',
      title: '',
      description: '',
      epic_id: '',
      story_points: '',
      acceptance_criteria: '',
      sprint_id: activeSprintId || '',
      application_id: activeAppId || '',
      status: 'Backlog',
      priority: 'Medium',
      assigned_to_id: '',
    });
    setFormError(null);
  };

  const resetEpicForm = () => {
    setEpicForm({
      epic_id: '',
      title: '',
      description: '',
      status: 'Backlog',
    });
    setFormError(null);
  };

  const handleOpenCreateStory = () => {
    resetStoryForm();
    setEditingStory(null);
    // Pre-fill next story ID
    const nextNum = stories.length + 1;
    const padNum = String(nextNum).padStart(3, '0');
    setStoryForm(p => ({
      ...p,
      story_id: `US-${projectCode}-${padNum}`,
    }));
    setIsStoryModalOpen(true);
  };

  const handleOpenEditStory = (story: any) => {
    setStoryForm({
      story_id: story.story_id,
      title: story.title,
      description: story.description || '',
      epic_id: story.epic_id || '',
      story_points: story.story_points || '',
      acceptance_criteria: story.acceptance_criteria || '',
      sprint_id: story.sprint_id || '',
      application_id: story.application_id || '',
      status: story.status,
      priority: story.priority,
      assigned_to_id: story.assigned_to_id || '',
    });
    setEditingStory(story);
    setFormError(null);
    setIsStoryModalOpen(true);
  };

  const handleOpenCreateEpic = () => {
    resetEpicForm();
    setEditingEpic(null);
    // Pre-fill next epic ID
    const nextNum = epics.length + 1;
    const padNum = String(nextNum).padStart(3, '0');
    setEpicForm(p => ({
      ...p,
      epic_id: `EPIC-${projectCode}-${padNum}`,
    }));
    setIsEpicModalOpen(true);
  };

  const handleOpenEditEpic = (epic: any) => {
    setEpicForm({
      epic_id: epic.epic_id,
      title: epic.title,
      description: epic.description || '',
      status: epic.status,
    });
    setEditingEpic(epic);
    setFormError(null);
    setIsEpicModalOpen(true);
  };

  const handleStorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const payload = {
      ...storyForm,
      project_id: projectId,
      epic_id: storyForm.epic_id || null,
      story_points: storyForm.story_points || null,
      sprint_id: storyForm.sprint_id || null,
      application_id: storyForm.application_id || null,
      assigned_to_id: storyForm.assigned_to_id || null,
    };

    if (editingStory) {
      if (isStatusOnlyEditor) {
        // Dev/QA status updates only
        updateStoryMut.mutate({
          id: editingStory.id,
          body: {
            status: storyForm.status,
            assigned_to_id: storyForm.assigned_to_id || null,
          },
        });
      } else {
        // Full update
        updateStoryMut.mutate({
          id: editingStory.id,
          body: payload,
        });
      }
    } else {
      createStoryMut.mutate(payload);
    }
  };

  const handleEpicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const payload = {
      ...epicForm,
      project_id: projectId,
    };

    if (editingEpic) {
      updateEpicMut.mutate({
        id: editingEpic.id,
        body: payload,
      });
    } else {
      createEpicMut.mutate(payload);
    }
  };

  const handleRowClick = (story: any) => {
    setSelectedStory(story);
    setIsDrawerOpen(true);
  };

  // Convert Acceptance Criteria raw text into checkbox list items
  useEffect(() => {
    if (!selectedStory) {
      setAcChecklist([]);
      return;
    }

    const acText = selectedStory.acceptance_criteria || '';
    if (!acText.trim()) {
      setAcChecklist([]);
      return;
    }

    // Split by newlines, clean prefixes like '- ', '* ', or numbers
    const lines = acText.split('\n').filter((line: string) => line.trim().length > 0);
    const parsedLines = lines.map((line: string) => {
      const cleanText = line.replace(/^[-*•\d+.\s]+/, '').trim();
      return { text: cleanText, checked: false };
    });
    setAcChecklist(parsedLines);
  }, [selectedStory]);

  const toggleAcCheckbox = (index: number) => {
    setAcChecklist(prev =>
      prev.map((item, idx) => (idx === index ? { ...item, checked: !item.checked } : item))
    );
  };

  /* ══════════════════════════════════════════════════
     METRIC CALCS & DATA FILTERING
     ══════════════════════════════════════════════════ */
  // Aggregate stats based on active scoped queries
  const totalStories = stories.length;
  const totalPoints = stories.reduce((sum: number, s: any) => sum + (s.story_points || 0), 0);
  const completedPoints = stories
    .filter((s: any) => s.status === 'Done')
    .reduce((sum: number, s: any) => sum + (s.story_points || 0), 0);
  const completionPercentage = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

  // Filter list on Tab 1
  const filteredStories = stories.filter((story: any) => {
    const matchesEpic = selectedEpicFilter === 'all' || story.epic_id === selectedEpicFilter;
    const matchesStatus = selectedStatusFilter === 'all' || story.status === selectedStatusFilter;
    return matchesEpic && matchesStatus;
  });

  return (
    <Box>
      {/* PAGE HEADER */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: 'Outfit', fontWeight: 800 }}>User Stories &amp; Epics</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage agile backlogs, epics, story points, and sprint workflows.
          </Typography>
        </Box>
        {projectId && (
          <Stack direction="row" spacing={1.5}>
            {activeTab === 0 && canCreate && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleOpenCreateStory}
                sx={{ background: 'linear-gradient(90deg,#6366f1,#a855f7)' }}
              >
                Create User Story
              </Button>
            )}
            {activeTab === 1 && canCreate && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleOpenCreateEpic}
                sx={{ background: 'linear-gradient(90deg,#6366f1,#a855f7)' }}
              >
                Create Epic
              </Button>
            )}
          </Stack>
        )}
      </Stack>

      {!projectId ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Please select a Project from the toolbar filters to load its Backlog and Epics.
        </Alert>
      ) : (
        <Stack spacing={4}>
          {/* METRIC WIDGETS */}
          <Grid container spacing={3}>
            {/* Widget 1: Total Stories */}
            <Grid item xs={12} sm={4}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 4,
                  p: 3,
                  boxShadow: '0 8px 32px 0 rgba(0,0,0,0.3)',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-2px)' },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                      Total Stories
                    </Typography>
                    <Typography variant="h3" sx={{ fontFamily: 'Outfit', fontWeight: 800, mt: 1 }}>
                      {loadingStories ? <CircularProgress size={24} /> : totalStories}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.05))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#6366f1',
                    }}
                  >
                    <ListAlt fontSize="medium" />
                  </Box>
                </Stack>
              </Card>
            </Grid>

            {/* Widget 2: Total Story Points */}
            <Grid item xs={12} sm={4}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 4,
                  p: 3,
                  boxShadow: '0 8px 32px 0 rgba(0,0,0,0.3)',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-2px)' },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                      Total Story Points
                    </Typography>
                    <Typography variant="h3" sx={{ fontFamily: 'Outfit', fontWeight: 800, mt: 1 }}>
                      {loadingStories ? <CircularProgress size={24} /> : totalPoints}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#8b5cf6',
                    }}
                  >
                    <TrendingUp fontSize="medium" />
                  </Box>
                </Stack>
              </Card>
            </Grid>

            {/* Widget 3: Sprint Progress */}
            <Grid item xs={12} sm={4}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 4,
                  p: 3,
                  boxShadow: '0 8px 32px 0 rgba(0,0,0,0.3)',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-2px)' },
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                      Sprint Delivery Progress
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#10b981' }}>
                      {completionPercentage}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={completionPercentage}
                    color="success"
                    sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.08)' }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {completedPoints} of {totalPoints} Story Points completed
                  </Typography>
                </Stack>
              </Card>
            </Grid>
          </Grid>

          {/* MAIN TAB SWITCHER */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)} textColor="primary" indicatorColor="primary">
              <Tab label="Agile Backlog" icon={<Assignment fontSize="small" />} iconPosition="start" />
              <Tab label="Epic Master Board" icon={<Folder fontSize="small" />} iconPosition="start" />
            </Tabs>
          </Box>

          {/* TAB 1: AGILE BACKLOG */}
          {activeTab === 0 && (
            <Stack spacing={3}>
              {/* Local Backlog Filters */}
              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Filter by Epic</InputLabel>
                  <Select
                    value={selectedEpicFilter}
                    label="Filter by Epic"
                    onChange={e => setSelectedEpicFilter(e.target.value as number | 'all')}
                  >
                    <MenuItem value="all">All Epics</MenuItem>
                    {epics.map((epic: any) => (
                      <MenuItem key={epic.id} value={epic.id}>
                        {epic.epic_id} - {epic.title}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Filter by Status</InputLabel>
                  <Select
                    value={selectedStatusFilter}
                    label="Filter by Status"
                    onChange={e => setSelectedStatusFilter(e.target.value)}
                  >
                    <MenuItem value="all">All Statuses</MenuItem>
                    {STORY_STATUSES.map(status => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              {/* Backlog Table */}
              {loadingStories ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
              ) : filteredStories.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  No User Stories found matching current filters. Click &apos;Create User Story&apos; to add one.
                </Alert>
              ) : (
                <TableContainer component={Paper} sx={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4, background: 'rgba(255,255,255,0.01)' }}>
                  <Table>
                    <TableHead sx={{ backgroundColor: 'background.paper' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Story ID</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Title</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Epic Scope</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Points</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Priority</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Assignee</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', width: 60 }}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredStories.map((story: any) => (
                        <TableRow
                          key={story.id}
                          hover
                          onClick={() => handleRowClick(story)}
                          sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                        >
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: preset.primary }}>
                              {story.story_id}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{story.title}</TableCell>
                          <TableCell>
                            {story.epic ? (
                              <Tooltip title={story.epic.description || ''}>
                                <Chip label={story.epic.epic_id} size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                              </Tooltip>
                            ) : (
                              <Typography variant="caption" color="text.secondary">-</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={story.story_points || 'Unestimated'}
                              size="small"
                              variant={story.story_points ? 'filled' : 'outlined'}
                              sx={{ fontWeight: 700 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={story.priority}
                              color={priorityColor[story.priority] || 'default'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={story.status}
                              size="small"
                              sx={{
                                bgcolor: (statusColor[story.status] || '#6b7280') + '22',
                                color: statusColor[story.status] || '#6b7280',
                                fontWeight: 700,
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {story.assigned_to ? (
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Box
                                  sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    background: avatarGradient(story.assigned_to.full_name),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: '#fff',
                                  }}
                                >
                                  {initials(story.assigned_to.full_name)}
                                </Box>
                                <Typography variant="caption">{story.assigned_to.full_name}</Typography>
                              </Stack>
                            ) : (
                              <Typography variant="caption" color="text.secondary">Unassigned</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <IconButton size="small">
                              <KeyboardArrowRight />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Stack>
          )}

          {/* TAB 2: EPIC BOARD */}
          {activeTab === 1 && (
            <Stack spacing={3}>
              {loadingEpics ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
              ) : epics.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  No Epics logged under this project. Click &apos;Create Epic&apos; to start grouping your stories.
                </Alert>
              ) : (
                <Grid container spacing={3}>
                  {epics.map((epic: any) => {
                    // Epic progress stats
                    const epicStories = stories.filter((s: any) => s.epic_id === epic.id);
                    const totalEpicPoints = epicStories.reduce((acc: number, curr: any) => acc + (curr.story_points || 0), 0);
                    const completedEpicPoints = epicStories
                      .filter((s: any) => s.status === 'Done')
                      .reduce((acc: number, curr: any) => acc + (curr.story_points || 0), 0);
                    const epicProgress = totalEpicPoints > 0 ? Math.round((completedEpicPoints / totalEpicPoints) * 100) : 0;

                    return (
                      <Grid item xs={12} sm={6} key={epic.id}>
                        <Card
                          sx={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.005))',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: 4,
                            p: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            height: '100%',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                            transition: 'all 0.2s',
                            '&:hover': {
                              transform: 'scale(1.01)',
                              borderColor: alpha(preset.primary, 0.3),
                              boxShadow: `0 8px 32px ${preset.primary}15`,
                            },
                          }}
                        >
                          <Box>
                            {/* Epic Card Header */}
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                              <Box>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 800, color: preset.primary }}>
                                  {epic.epic_id}
                                </Typography>
                                <Typography variant="h6" sx={{ fontFamily: 'Outfit', fontWeight: 700, mt: 0.5 }}>
                                  {epic.title}
                                </Typography>
                              </Box>
                              <Chip
                                label={epic.status}
                                size="small"
                                sx={{
                                  bgcolor: (epicStatusColor[epic.status] || '#6b7280') + '22',
                                  color: epicStatusColor[epic.status] || '#6b7280',
                                  fontWeight: 700,
                                }}
                              />
                            </Stack>

                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, minHeight: 40, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {epic.description || 'No description provided.'}
                            </Typography>
                          </Box>

                          <Box>
                            {/* Epic Progress Section */}
                            <Stack spacing={1} sx={{ mb: 2.5 }}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="caption" color="text.secondary">
                                  Epic Progress
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                  {epicProgress}%
                                </Typography>
                              </Stack>
                              <LinearProgress
                                variant="determinate"
                                value={epicProgress}
                                color={epicProgress === 100 ? 'success' : 'primary'}
                                sx={{ height: 6, borderRadius: 3 }}
                              />
                              <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {epicStories.length} User Stories linked
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {completedEpicPoints} of {totalEpicPoints} Points completed
                                </Typography>
                              </Stack>
                            </Stack>

                            <Divider sx={{ mb: 2 }} />

                            {/* Card Footer Actions */}
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Button
                                size="small"
                                variant="text"
                                color="primary"
                                startIcon={<Visibility sx={{ fontSize: 14 }} />}
                                onClick={() => {
                                  setSelectedEpicFilter(epic.id);
                                  setActiveTab(0);
                                }}
                              >
                                View Stories
                              </Button>

                              {canUpdate && (
                                <Stack direction="row" spacing={1}>
                                  <IconButton size="small" onClick={() => handleOpenEditEpic(epic)}>
                                    <EditOutlined fontSize="small" sx={{ color: 'warning.main' }} />
                                  </IconButton>
                                  {canDelete && (
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        if (window.confirm(`Are you sure you want to delete Epic '${epic.epic_id}'? This will unlink all its stories.`)) {
                                          deleteEpicMut.mutate(epic.id);
                                        }
                                      }}
                                    >
                                      <DeleteOutline fontSize="small" sx={{ color: 'error.main' }} />
                                    </IconButton>
                                  )}
                                </Stack>
                              )}
                            </Stack>
                          </Box>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </Stack>
          )}

          {/* ════════════════════════════════════════════════════════
              SLIDE-OUT DRAWER: Story Details
              ════════════════════════════════════════════════════════ */}
          <Drawer
            anchor="right"
            open={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            PaperProps={{ sx: { width: 500, bgcolor: preset.paper, p: 4, display: 'flex', flexDirection: 'column', overflowY: 'auto' } }}
          >
            {selectedStory && (
              <Stack spacing={3.5} sx={{ height: '100%' }}>
                {/* Drawer Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 800, color: preset.primary }}>
                      {selectedStory.story_id}
                    </Typography>
                    <Typography variant="h5" sx={{ fontFamily: 'Outfit', fontWeight: 700, mt: 0.5 }}>
                      {selectedStory.title}
                    </Typography>
                  </Box>
                  <IconButton onClick={() => setIsDrawerOpen(false)}>
                    <Close />
                  </IconButton>
                </Stack>

                <Divider />

                {/* Scope & Agile Fields Grid */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 2.5 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
                      Status
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Chip
                        label={selectedStory.status}
                        size="small"
                        sx={{
                          bgcolor: (statusColor[selectedStory.status] || '#6b7280') + '22',
                          color: statusColor[selectedStory.status] || '#6b7280',
                          fontWeight: 700,
                        }}
                      />
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
                      Priority
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Chip
                        label={selectedStory.priority}
                        color={priorityColor[selectedStory.priority] || 'default'}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
                      Story Points
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.8 }}>
                      {selectedStory.story_points || 'Unestimated'}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
                      Epic Module
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.8 }}>
                      {selectedStory.epic ? `${selectedStory.epic.epic_id} - ${selectedStory.epic.title}` : 'Unlinked'}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
                      Sprint
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.8 }}>
                      {selectedStory.sprint ? selectedStory.sprint.name : 'Backlog'}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
                      Application Scope
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.8 }}>
                      {selectedStory.application ? selectedStory.application.name : 'General Project Scope'}
                    </Typography>
                  </Box>

                  <Box sx={{ gridColumn: 'span 2' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
                      Assigned Developer/QA
                    </Typography>
                    {selectedStory.assigned_to ? (
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: avatarGradient(selectedStory.assigned_to.full_name),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            color: '#fff',
                            fontSize: 12,
                          }}
                        >
                          {initials(selectedStory.assigned_to.full_name)}
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {selectedStory.assigned_to.full_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {selectedStory.assigned_to.role}
                          </Typography>
                        </Box>
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
                        Unassigned
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Divider />

                {/* Description */}
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700, display: 'block', mb: 1 }}>
                    Description
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line', lineHeight: 1.5, color: 'text.primary' }}>
                    {selectedStory.description || 'No description provided.'}
                  </Typography>
                </Box>

                {/* Interactive Acceptance Criteria Checklist */}
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700, display: 'block', mb: 1 }}>
                    Acceptance Criteria Checklist
                  </Typography>
                  {acChecklist.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">No acceptance criteria specified.</Typography>
                  ) : (
                    <List sx={{ p: 0 }}>
                      {acChecklist.map((item, index) => (
                        <ListItem key={index} disableGutters sx={{ py: 0.5 }}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={item.checked}
                                onChange={() => toggleAcCheckbox(index)}
                                icon={<CheckBoxOutlineBlank fontSize="small" />}
                                checkedIcon={<CheckBox fontSize="small" sx={{ color: 'success.main' }} />}
                              />
                            }
                            label={
                              <Typography variant="body2" sx={{ textDecoration: item.checked ? 'line-through' : 'none', color: item.checked ? 'text.secondary' : 'text.primary' }}>
                                {item.text}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>

                {/* Creator Details */}
                <Box sx={{ mt: 'auto' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Created by {selectedStory.creator?.full_name || 'System'} on {new Date(selectedStory.created_at).toLocaleDateString()}
                  </Typography>
                  {selectedStory.updated_at && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Last updated: {new Date(selectedStory.updated_at).toLocaleString()}
                    </Typography>
                  )}
                </Box>

                {/* Actions */}
                {(canUpdate || isStatusOnlyEditor) && (
                  <Stack direction="row" spacing={2} sx={{ mt: 'auto', pt: 2 }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="warning"
                      startIcon={<EditOutlined />}
                      onClick={() => handleOpenEditStory(selectedStory)}
                    >
                      {isStatusOnlyEditor ? 'Update Status/Assignee' : 'Edit Story'}
                    </Button>
                    {canDelete && (
                      <Button
                        fullWidth
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteOutline />}
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete User Story '${selectedStory.story_id}'?`)) {
                            deleteStoryMut.mutate(selectedStory.id);
                          }
                        }}
                      >
                        Delete Story
                      </Button>
                    )}
                  </Stack>
                )}
              </Stack>
            )}
          </Drawer>

          {/* ════════════════════════════════════════════════════════
              DIALOG: Create / Edit User Story
              ════════════════════════════════════════════════════════ */}
          <Dialog
            open={isStoryModalOpen}
            onClose={() => setIsStoryModalOpen(false)}
            fullWidth
            maxWidth="md"
            PaperProps={{ sx: { background: preset.paper } }}
          >
            <DialogTitle sx={{ fontFamily: 'Outfit', fontWeight: 700 }}>
              {editingStory ? (isStatusOnlyEditor ? 'Update Status & Assignee' : `Edit User Story: ${storyForm.story_id}`) : 'Create User Story'}
            </DialogTitle>
            <Box component="form" onSubmit={handleStorySubmit}>
              <DialogContent>
                {formError && (
                  <Alert severity="error" sx={{ mb: 2.5 }}>
                    {formError}
                  </Alert>
                )}

                <Grid container spacing={2.5}>
                  {/* Status Only View Mode - Render limited status & assignee controls */}
                  {isStatusOnlyEditor ? (
                    <>
                      <Grid item xs={12}>
                        <Alert severity="info" sx={{ mb: 1 }}>
                          Your role permits status workflow updates and assignee re-assignment only. General specifications are locked.
                        </Alert>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth required>
                          <InputLabel>Status</InputLabel>
                          <Select
                            value={storyForm.status}
                            label="Status"
                            onChange={e => setStoryForm(p => ({ ...p, status: e.target.value }))}
                          >
                            {STORY_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Assignee</InputLabel>
                          <Select
                            value={storyForm.assigned_to_id}
                            label="Assignee"
                            onChange={e => setStoryForm(p => ({ ...p, assigned_to_id: e.target.value as number }))}
                          >
                            <MenuItem value=""><em>Unassigned</em></MenuItem>
                            {users.map((u: any) => <MenuItem key={u.id} value={u.id}>{u.full_name} ({u.role})</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                    </>
                  ) : (
                    // Full Edit Mode
                    <>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          required
                          fullWidth
                          label="Story ID"
                          disabled={!!editingStory} // Lock ID on update
                          placeholder="e.g. US-SCM-001"
                          value={storyForm.story_id}
                          onChange={e => setStoryForm(p => ({ ...p, story_id: e.target.value }))}
                        />
                      </Grid>
                      <Grid item xs={12} sm={8}>
                        <TextField
                          required
                          fullWidth
                          label="User Story Title"
                          placeholder="As a [user], I want [action] so that [benefit]"
                          value={storyForm.title}
                          onChange={e => setStoryForm(p => ({ ...p, title: e.target.value }))}
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          multiline
                          rows={3}
                          label="Detailed Description"
                          placeholder="Provide additional details, context, and use cases..."
                          value={storyForm.description}
                          onChange={e => setStoryForm(p => ({ ...p, description: e.target.value }))}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Epic / Module Group</InputLabel>
                          <Select
                            value={storyForm.epic_id}
                            label="Epic / Module Group"
                            onChange={e => setStoryForm(p => ({ ...p, epic_id: e.target.value as number }))}
                          >
                            <MenuItem value=""><em>Unlinked</em></MenuItem>
                            {epics.map((epic: any) => (
                              <MenuItem key={epic.id} value={epic.id}>
                                {epic.epic_id} - {epic.title}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={6} sm={3}>
                        <FormControl fullWidth>
                          <InputLabel>Story Points</InputLabel>
                          <Select
                            value={storyForm.story_points}
                            label="Story Points"
                            onChange={e => setStoryForm(p => ({ ...p, story_points: e.target.value as number }))}
                          >
                            <MenuItem value=""><em>Unestimated</em></MenuItem>
                            {FIBONACCI_POINTS.map(pt => (
                              <MenuItem key={pt} value={pt}>
                                {pt}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={6} sm={3}>
                        <FormControl fullWidth>
                          <InputLabel>Priority</InputLabel>
                          <Select
                            value={storyForm.priority}
                            label="Priority"
                            onChange={e => setStoryForm(p => ({ ...p, priority: e.target.value }))}
                          >
                            {PRIORITIES.map(pr => <MenuItem key={pr} value={pr}>{pr}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <FormControl fullWidth>
                          <InputLabel>Target Sprint</InputLabel>
                          <Select
                            value={storyForm.sprint_id}
                            label="Target Sprint"
                            onChange={e => setStoryForm(p => ({ ...p, sprint_id: e.target.value as number }))}
                          >
                            <MenuItem value=""><em>Backlog (No Sprint)</em></MenuItem>
                            {sprints.map((spr: any) => (
                              <MenuItem key={spr.id} value={spr.id}>
                                {spr.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <FormControl fullWidth>
                          <InputLabel>Application Scope</InputLabel>
                          <Select
                            value={storyForm.application_id}
                            label="Application Scope"
                            onChange={e => setStoryForm(p => ({ ...p, application_id: e.target.value as number }))}
                          >
                            <MenuItem value=""><em>General Project Scope</em></MenuItem>
                            {applications.map((app: any) => (
                              <MenuItem key={app.id} value={app.id}>
                                {app.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <FormControl fullWidth>
                          <InputLabel>Status</InputLabel>
                          <Select
                            value={storyForm.status}
                            label="Status"
                            onChange={e => setStoryForm(p => ({ ...p, status: e.target.value }))}
                          >
                            {STORY_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Assign To Developer/QA</InputLabel>
                          <Select
                            value={storyForm.assigned_to_id}
                            label="Assign To Developer/QA"
                            onChange={e => setStoryForm(p => ({ ...p, assigned_to_id: e.target.value as number }))}
                          >
                            <MenuItem value=""><em>Unassigned</em></MenuItem>
                            {users.map((u: any) => <MenuItem key={u.id} value={u.id}>{u.full_name} ({u.role})</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          multiline
                          rows={4}
                          label="Acceptance Criteria"
                          placeholder="Acceptance criteria triggers a dynamic checklist in detail panel&#10;- Criteria 1&#10;- Criteria 2"
                          value={storyForm.acceptance_criteria}
                          onChange={e => setStoryForm(p => ({ ...p, acceptance_criteria: e.target.value }))}
                        />
                      </Grid>
                    </>
                  )}
                </Grid>
              </DialogContent>
              <DialogActions sx={{ p: 3 }}>
                <Button onClick={() => setIsStoryModalOpen(false)} variant="outlined" color="inherit">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={createStoryMut.isPending || updateStoryMut.isPending}
                  sx={{ background: 'linear-gradient(90deg,#6366f1,#a855f7)' }}
                >
                  {editingStory ? 'Save Changes' : 'Create User Story'}
                </Button>
              </DialogActions>
            </Box>
          </Dialog>

          {/* ════════════════════════════════════════════════════════
              DIALOG: Create / Edit Epic
              ════════════════════════════════════════════════════════ */}
          <Dialog
            open={isEpicModalOpen}
            onClose={() => setIsEpicModalOpen(false)}
            fullWidth
            maxWidth="sm"
            PaperProps={{ sx: { background: preset.paper } }}
          >
            <DialogTitle sx={{ fontFamily: 'Outfit', fontWeight: 700 }}>
              {editingEpic ? `Edit Epic: ${epicForm.epic_id}` : 'Create Epic'}
            </DialogTitle>
            <Box component="form" onSubmit={handleEpicSubmit}>
              <DialogContent>
                {formError && (
                  <Alert severity="error" sx={{ mb: 2.5 }}>
                    {formError}
                  </Alert>
                )}

                <Stack spacing={3}>
                  <TextField
                    required
                    fullWidth
                    label="Epic ID"
                    disabled={!!editingEpic} // Lock ID on update
                    placeholder="e.g. EPIC-SCM-001"
                    value={epicForm.epic_id}
                    onChange={e => setEpicForm(p => ({ ...p, epic_id: e.target.value }))}
                  />

                  <TextField
                    required
                    fullWidth
                    label="Epic Title"
                    placeholder="Provide a large theme or milestone title"
                    value={epicForm.title}
                    onChange={e => setEpicForm(p => ({ ...p, title: e.target.value }))}
                  />

                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Epic Description"
                    placeholder="Describe the overarching goals of this Epic"
                    value={epicForm.description}
                    onChange={e => setEpicForm(p => ({ ...p, description: e.target.value }))}
                  />

                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={epicForm.status}
                      label="Status"
                      onChange={e => setEpicForm(p => ({ ...p, status: e.target.value }))}
                    >
                      {EPIC_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Stack>
              </DialogContent>
              <DialogActions sx={{ p: 3 }}>
                <Button onClick={() => setIsEpicModalOpen(false)} variant="outlined" color="inherit">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={createEpicMut.isPending || updateEpicMut.isPending}
                  sx={{ background: 'linear-gradient(90deg,#6366f1,#a855f7)' }}
                >
                  {editingEpic ? 'Save Changes' : 'Create Epic'}
                </Button>
              </DialogActions>
            </Box>
          </Dialog>
        </Stack>
      )}
    </Box>
  );
};

// MUI alpha helper fallback if not explicitly defined by theme context
function alpha(color: string, opacity: number): string {
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
}

export default UserStories;
