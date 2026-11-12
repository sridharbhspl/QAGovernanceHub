import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, Grid, Tab, Tabs, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox,
  FormControl, InputLabel, Select, MenuItem, Button, TextField,
  Stack, Chip, CircularProgress, Alert, Snackbar, Dialog, DialogTitle,
  DialogContent, DialogActions, FormHelperText, IconButton
} from '@mui/material';
import {
  AdminPanelSettings, Add, Delete, PersonAdd
} from '@mui/icons-material';
import api from '../services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

interface Permission {
  id: number;
  action: string;
  description: string;
}

interface RoleWithPermissions {
  id: number;
  name: string;
  description?: string;
  is_system_role: boolean;
  permissions: Permission[];
}

interface Project {
  id: number;
  name: string;
  code: string;
}

interface User {
  id: number;
  full_name: string;
  email: string;
  role: string;
}

interface TeamMapping {
  id: number;
  project_id: number;
  user_id: number;
  role?: string;
  user?: User;
}

const RBACManagement: React.FC = () => {
  const [tabVal, setTabVal] = useState(0);
  const [notif, setNotif] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // --- Matrix Tab states ---
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  // New Custom Role state
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePerms, setNewRolePerms] = useState<number[]>([]);

  // --- Mappings Tab states ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [teamMappings, setTeamMappings] = useState<TeamMapping[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [mappingUser, setMappingUser] = useState<number | ''>('');
  const [mappingRoles, setMappingRoles] = useState<string[]>(['Viewer']);
  const [loadingMappings, setLoadingMappings] = useState(false);

  // Fetch roles and permissions
  const fetchMatrixData = async () => {
    setLoadingMatrix(true);
    try {
      const [rRes, pRes] = await Promise.all([
        api.get('/rbac/roles'),
        api.get('/rbac/permissions')
      ]);
      setRoles(rRes.data);
      setPermissions(pRes.data);
    } catch (err) {
      console.error(err);
      setNotif({ type: 'error', msg: 'Failed to load roles/permissions matrix.' });
    } finally {
      setLoadingMatrix(false);
    }
  };

  // Fetch project list & users
  const fetchMappingData = async () => {
    try {
      const [pRes, uRes] = await Promise.all([
        api.get('/org/projects'),
        api.get('/org/users')
      ]);
      setProjects(pRes.data);
      setAllUsers(uRes.data);
    } catch (err) {
      console.error(err);
      setNotif({ type: 'error', msg: 'Failed to load organizational lists.' });
    }
  };

  useEffect(() => {
    fetchMatrixData();
    fetchMappingData();
  }, []);

  // Fetch mappings when project changes
  useEffect(() => {
    if (selectedProjectId) {
      setLoadingMappings(true);
      api.get(`/org/team-mappings?project_id=${selectedProjectId}`)
        .then(res => setTeamMappings(res.data))
        .catch(err => {
          console.error(err);
          setNotif({ type: 'error', msg: 'Failed to fetch team mappings.' });
        })
        .finally(() => setLoadingMappings(false));
    } else {
      setTeamMappings([]);
    }
  }, [selectedProjectId]);

  // Handle cell permission toggle
  const handleTogglePermission = async (role: RoleWithPermissions, perm: Permission) => {
    const isAssigned = role.permissions.some(p => p.id === perm.id);
    let updatedPermIds: number[];

    if (isAssigned) {
      updatedPermIds = role.permissions.filter(p => p.id !== perm.id).map(p => p.id);
    } else {
      updatedPermIds = [...role.permissions.map(p => p.id), perm.id];
    }

    try {
      const res = await api.put(`/rbac/roles/${role.id}/permissions`, {
        permission_ids: updatedPermIds
      });
      // Update local state
      setRoles(roles.map(r => r.id === role.id ? res.data : r));
      setNotif({ type: 'success', msg: `Permissions updated for role "${role.name}".` });
      window.dispatchEvent(new CustomEvent('masters:refresh'));
    } catch (err) {
      console.error(err);
      setNotif({ type: 'error', msg: 'Failed to update role permission.' });
    }
  };

  // Handle create role submit
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      await api.post('/rbac/roles', {
        name: newRoleName,
        description: newRoleDesc,
        permission_ids: newRolePerms
      });
      setNotif({ type: 'success', msg: `Custom role "${newRoleName}" created successfully!` });
      setNewRoleName('');
      setNewRoleDesc('');
      setNewRolePerms([]);
      setCreateOpen(false);
      fetchMatrixData();
    } catch (err: any) {
      setNotif({ type: 'error', msg: err.response?.data?.detail || 'Failed to create role.' });
    }
  };

  // Map user to project
  const handleMapUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !mappingUser) return;
    try {
      await api.post('/org/team-mappings', {
        project_id: selectedProjectId,
        user_id: mappingUser,
        role: mappingRoles.join(',')
      });
      setNotif({ type: 'success', msg: 'Team member mapped successfully!' });
      setMappingUser('');
      setMappingRoles(['Viewer']);
      // Refresh mappings
      const res = await api.get(`/org/team-mappings?project_id=${selectedProjectId}`);
      setTeamMappings(res.data);
      window.dispatchEvent(new CustomEvent('masters:refresh'));
    } catch (err: any) {
      setNotif({ type: 'error', msg: err.response?.data?.detail || 'Failed to map user.' });
    }
  };

  // Update a mapped user's project role
  const handleUpdateMappingRole = async (mappingId: number, rolesList: string[]) => {
    try {
      await api.put(`/org/team-mappings/${mappingId}`, {
        role: rolesList.join(',')
      });
      setNotif({ type: 'success', msg: 'Team member role updated.' });
      // Update locally
      setTeamMappings(teamMappings.map(m => m.id === mappingId ? { ...m, role: rolesList.join(',') } : m));
      window.dispatchEvent(new CustomEvent('masters:refresh'));
    } catch (err) {
      console.error(err);
      setNotif({ type: 'error', msg: 'Failed to update team member role.' });
    }
  };

  // Unmap user
  const handleUnmapUser = async (mappingId: number) => {
    try {
      await api.delete(`/org/team-mappings/${mappingId}`);
      setNotif({ type: 'success', msg: 'Team member unmapped successfully.' });
      setTeamMappings(teamMappings.filter(m => m.id !== mappingId));
      window.dispatchEvent(new CustomEvent('masters:refresh'));
    } catch (err) {
      console.error(err);
      setNotif({ type: 'error', msg: 'Failed to unmap team member.' });
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: 'Outfit', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AdminPanelSettings sx={{ fontSize: 36, color: '#8b5cf6' }} />
            Role &amp; Access Control Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure system-wide role-permission matrix settings and project-specific scoping.
          </Typography>
        </Box>
        {tabVal === 0 && (
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}
            sx={{ background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)' }}>
            New Custom Role
          </Button>
        )}
      </Box>

      <Tabs value={tabVal} onChange={(_, val) => setTabVal(val)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tab label="System Permission Matrix" />
        <Tab label="Project Scoped Team Roles" />
      </Tabs>

      {/* --- Tab 1: System Permission Matrix --- */}
      <TabPanel value={tabVal} index={0}>
        {loadingMatrix ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : (
          <Card sx={{ p: 3, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4, bgcolor: 'background.paper' }}>
            <TableContainer component={Paper} sx={{ borderRadius: 3, overflowX: 'auto' }}>
              <Table size="small">
                <TableHead sx={{ '& th': { bgcolor: 'background.paper', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', py: 1.5 } }}>
                  <TableRow>
                    <TableCell>System Role</TableCell>
                    {permissions.map(p => (
                      <TableCell key={p.id} align="center" sx={{ minWidth: 100 }}>
                        <TooltipTitle title={p.description}>
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>{p.action.replace('_', ' ')}</Typography>
                        </TooltipTitle>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {roles.map(role => (
                    <TableRow key={role.id} hover>
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{role.name}</Typography>
                        {role.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
                            {role.description}
                          </Typography>
                        )}
                        {role.is_system_role && (
                          <Chip label="System" size="small" variant="outlined" color="primary" sx={{ height: 16, fontSize: 8, fontWeight: 800, mt: 0.5 }} />
                        )}
                      </TableCell>
                      {permissions.map(perm => {
                        const isAssigned = role.permissions.some(p => p.id === perm.id);
                        const isSuperAdmin = role.name === 'Super Admin';
                        return (
                          <TableCell key={perm.id} align="center">
                            <Checkbox
                              checked={isAssigned || isSuperAdmin}
                              disabled={isSuperAdmin}
                              onChange={() => handleTogglePermission(role, perm)}
                              sx={{
                                color: 'rgba(255,255,255,0.2)',
                                '&.Mui-checked': { color: isSuperAdmin ? 'rgba(139,92,246,0.4)' : '#8b5cf6' }
                              }}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        )}
      </TabPanel>

      {/* --- Tab 2: Project Scoped Team Roles --- */}
      <TabPanel value={tabVal} index={1}>
        <Grid container spacing={4}>
          {/* Mapping Control Panel */}
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 3, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4, bgcolor: 'background.paper', height: '100%' }}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonAdd sx={{ color: '#8b5cf6' }} />
                Map Team Member
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
                Assign project-specific roles to users. Global roles act as the baseline, and project scoped roles will add matching permissions inside the project context.
              </Typography>

              <Stack spacing={3} component="form" onSubmit={handleMapUser}>
                <FormControl fullWidth required size="small">
                  <InputLabel>Select Project Context</InputLabel>
                  <Select value={selectedProjectId} label="Select Project Context" onChange={e => setSelectedProjectId(Number(e.target.value))}>
                    {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name} ({p.code})</MenuItem>)}
                  </Select>
                </FormControl>

                <FormControl fullWidth required size="small" disabled={!selectedProjectId}>
                  <InputLabel>Select User</InputLabel>
                  <Select value={mappingUser} label="Select User" onChange={e => setMappingUser(Number(e.target.value))}>
                    {allUsers.filter(u => !teamMappings.some(m => m.user_id === u.id)).map(u => (
                      <MenuItem key={u.id} value={u.id}>
                        {u.full_name} ({u.email})
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>Only users not already mapped are listed</FormHelperText>
                </FormControl>

                <FormControl fullWidth required size="small" disabled={!selectedProjectId}>
                  <InputLabel>Project Roles (Multi-select)</InputLabel>
                  <Select
                    multiple
                    value={mappingRoles}
                    label="Project Roles (Multi-select)"
                    onChange={e => setMappingRoles(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[])}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {['Project Manager', 'QA Lead', 'QA Engineer', 'Developer', 'Client', 'Viewer'].map(r => (
                      <MenuItem key={r} value={r}>{r}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button type="submit" variant="contained" disabled={!selectedProjectId || !mappingUser}
                  sx={{ background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)', py: 1 }}>
                  Map User with Role
                </Button>
              </Stack>
            </Card>
          </Grid>

          {/* Mappings Listing Grid */}
          <Grid item xs={12} md={8}>
            <Card sx={{ p: 3, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4, bgcolor: 'background.paper', minHeight: 400 }}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', fontWeight: 800, mb: 1 }}>
                Team Members Mapped
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
                {selectedProjectId ? 'Listing mapped members for the selected project.' : 'Select a project context on the left panel to list members.'}
              </Typography>

              {loadingMappings ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
              ) : teamMappings.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography variant="body2" color="text.secondary">
                    {selectedProjectId ? 'No team members mapped to this project context.' : 'Choose a project to view mappings.'}
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 3, overflow: 'auto', maxHeight: 350 }}>
                  <Table size="small" stickyHeader>
                    <TableHead sx={{ '& th': { bgcolor: 'background.paper', fontSize: 10, fontWeight: 700 } }}>
                      <TableRow>
                        <TableCell>User</TableCell>
                        <TableCell>Global Role</TableCell>
                        <TableCell>Project Scope Role</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {teamMappings.map(mapping => {
                        const mUser = mapping.user;
                        if (!mUser) return null;
                        const roleArr = mapping.role ? mapping.role.split(',').map(r => r.trim()).filter(Boolean) : [];
                        return (
                          <TableRow key={mapping.id} hover>
                            <TableCell sx={{ py: 1 }}>
                              <Typography variant="body2" fontWeight={600}>{mUser.full_name}</Typography>
                              <Typography variant="caption" color="text.secondary">{mUser.email}</Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {(mUser.role || '').split(',').map(r => r.trim()).filter(Boolean).map(r => (
                                  <Chip key={r} label={r} size="small" variant="outlined" sx={{ fontSize: 9, height: 16 }} />
                                ))}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <FormControl fullWidth size="small" sx={{ minWidth: 150 }}>
                                <Select
                                  multiple
                                  value={roleArr}
                                  onChange={e => handleUpdateMappingRole(mapping.id, typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[])}
                                  renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                      {(selected as string[]).map((value) => (
                                        <Chip key={value} label={value} size="small" sx={{ height: 18, fontSize: 9 }} />
                                      ))}
                                    </Box>
                                  )}
                                  sx={{ fontSize: 11, height: 32 }}
                                >
                                  {['Project Manager', 'QA Lead', 'QA Engineer', 'Developer', 'Client', 'Viewer'].map(r => (
                                    <MenuItem key={r} value={r} sx={{ fontSize: 11 }}>{r}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </TableCell>
                            <TableCell align="center">
                              <IconButton color="error" onClick={() => handleUnmapUser(mapping.id)}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* --- Create Custom Role Dialog --- */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth PaperProps={{
        sx: { borderRadius: 3, background: 'linear-gradient(145deg, #1e1b4b 0%, #1a1a2e 100%)', border: '1px solid rgba(139,92,246,0.2)' }
      }}>
        <DialogTitle sx={{ pb: 1 }}>Create Custom System Role</DialogTitle>
        <Box component="form" onSubmit={handleCreateRole}>
          <DialogContent>
            <Stack spacing={3} sx={{ pt: 1 }}>
              <TextField required fullWidth label="Role Name" placeholder="e.g. Audit Auditor" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} />
              <TextField fullWidth label="Description" placeholder="Explain the capabilities of this role..." value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)} />
              
              <FormControl fullWidth required>
                <InputLabel>Permissions Mapping</InputLabel>
                <Select
                  multiple
                  value={newRolePerms}
                  label="Permissions Mapping"
                  onChange={e => setNewRolePerms(typeof e.target.value === 'string' ? e.target.value.split(',').map(Number) : e.target.value as number[])}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as number[]).map((id) => {
                        const action = permissions.find(p => p.id === id)?.action || 'unknown';
                        return <Chip key={id} label={action.replace('_', ' ')} size="small" />;
                      })}
                    </Box>
                  )}
                >
                  {permissions.map(p => (
                    <MenuItem key={p.id} value={p.id}>{p.action.replace('_', ' ')}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setCreateOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
            <Button type="submit" variant="contained" sx={{ background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}>Create Role</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Notifications */}
      {notif && (
        <Snackbar open={!!notif} autoHideDuration={4000} onClose={() => setNotif(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert severity={notif.type} sx={{ width: '100%', borderRadius: 2 }} onClose={() => setNotif(null)}>
            {notif.msg}
          </Alert>
        </Snackbar>
      )}
    </Box>
  );
};

// Help tooltip wrapper component
const TooltipTitle: React.FC<{ title?: string; children: React.ReactElement }> = ({ title, children }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  
  if (!title) return children;
  
  return (
    <Box
      onMouseEnter={e => setAnchorEl(e.currentTarget)}
      onMouseLeave={() => setAnchorEl(null)}
      sx={{ cursor: 'help', display: 'inline-block' }}
    >
      {children}
      {anchorEl && (
        <Paper
          sx={{
            position: 'absolute',
            zIndex: 1400,
            p: 1,
            mt: 0.5,
            transform: 'translateX(-30%)',
            maxWidth: 200,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            bgcolor: '#1e1b4b',
            pointerEvents: 'none'
          }}
        >
          <Typography variant="caption" color="text.secondary">{title}</Typography>
        </Paper>
      )}
    </Box>
  );
};

export default RBACManagement;
