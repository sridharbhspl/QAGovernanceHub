import React, { useEffect, useState, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, IconButton,
  ListItem, ListItemButton, ListItemIcon, ListItemText,
  Select, MenuItem, Stack, Avatar, Tooltip,
  Divider, Button, TextField, Chip, Badge, alpha, Switch, Popover,
} from '@mui/material';
import {
  Dashboard as DashIcon, BugReport, PlaylistAddCheck, GridOn,
  Settings, Logout, Menu as MenuIcon, Edit, PhotoCamera,
  Palette, Close, CheckCircle,
  BrightnessAuto,
  NotificationsNone, Shield, KeyboardArrowRight,
  TaskAlt, Info, MarkEmailRead, FiberManualRecord, Assignment, AdminPanelSettings,
} from '@mui/icons-material';
import logo from './assets/logo.png';
import { RootState } from './store';
import { logout } from './store/authSlice';
import { setFilter } from './store/filterSlice';
import { setThemePreset, ThemePresetId } from './store/themeSlice';
import { THEME_PRESETS, ThemePreset, getPreset } from './theme/theme';
import api from './services/api';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Defects from './pages/Defects';
import TestCases from './pages/TestCases';
import Traceability from './pages/Traceability';
import Admin from './pages/Admin';
import UserStories from './pages/UserStories'; // Re-resolve
import ChangeRequests from './pages/ChangeRequests';
import RBACManagement from "./pages/RBACManagement";

const DRAWER_W = 240;

/* ─────────────────────────────────────────────
   AVATAR HELPERS
───────────────────────────────────────────── */
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}
function avatarGradient(name: string) {
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `linear-gradient(135deg, hsl(${hue},65%,50%), hsl(${(hue + 60) % 360},65%,40%))`;
}

/* ─────────────────────────────────────────────
   USER PROFILE DRAWER
───────────────────────────────────────────── */
interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
  user: any;
  preset: ThemePreset;
}

const ProfileDrawer: React.FC<ProfileDrawerProps> = ({ open, onClose, user, preset }) => {
  const dispatch = useDispatch();
  const presetId = useSelector((state: RootState) => state.theme.presetId);

  const [tab, setTab]       = useState<'profile'|'settings'>('profile');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [editMode, setEditMode]   = useState(false);
  const [fullName, setFullName]   = useState(user?.full_name || '');
  const [email, setEmail]         = useState(user?.email || '');
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync avatar from localStorage on open
  useEffect(() => {
    const saved = localStorage.getItem('userAvatar');
    if (saved) setAvatarUrl(saved);
  }, [open]);

  // Sync edit fields when user changes
  useEffect(() => {
    setFullName(user?.full_name || '');
    setEmail(user?.email || '');
  }, [user]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setAvatarUrl(url);
      localStorage.setItem('userAvatar', url);
    };
    reader.readAsDataURL(file);
  };

  const DRAWER_WIDTH = 380;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{ zIndex: (t) => t.zIndex.appBar + 10 }}
      PaperProps={{
        sx: {
          width: DRAWER_WIDTH,
          bgcolor: preset.bg,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
        },
      }}
    >
      {/* ══ GRADIENT HEADER ══ */}
      <Box sx={{
        background: preset.gradient,
        pt: '80px', pb: 2.5, px: 3,
        flexShrink: 0,
        position: 'relative',
      }}>
        {/* Close button */}
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            position: 'absolute', top: 10, right: 10,
            color: 'rgba(255,255,255,0.85)',
            bgcolor: 'rgba(0,0,0,0.2)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.35)' },
          }}
        >
          <Close fontSize="small" />
        </IconButton>

        {/* Avatar row */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <Avatar
              src={avatarUrl || undefined}
              sx={{
                width: 68, height: 68, fontSize: 26,
                fontFamily: 'Outfit', fontWeight: 800,
                background: avatarGradient(user?.full_name || 'U'),
                border: '3px solid rgba(255,255,255,0.35)',
                boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
              }}
            >
              {!avatarUrl && initials(user?.full_name || 'U')}
            </Avatar>
            <Tooltip title="Upload photo">
              <IconButton
                size="small"
                onClick={() => fileRef.current?.click()}
                sx={{
                  position: 'absolute', bottom: -4, right: -4,
                  width: 24, height: 24,
                  bgcolor: 'rgba(0,0,0,0.65)',
                  border: '1.5px solid rgba(255,255,255,0.25)',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' },
                }}
              >
                <PhotoCamera sx={{ fontSize: 13, color: '#fff' }} />
              </IconButton>
            </Tooltip>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{
              fontFamily: 'Outfit', fontWeight: 700, fontSize: 17,
              color: '#fff', lineHeight: 1.25, mb: 0.5,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user?.full_name}
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', mb: 0.8, display: 'block' }}>
              {user?.email}
            </Typography>
            <Chip
              label={user?.role}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.22)',
                color: '#fff', fontSize: 10, fontWeight: 700,
                height: 20, borderRadius: 1,
              }}
            />
          </Box>
        </Stack>

        {/* Online status bar */}
        <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mt: 2 }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#10b981', boxShadow: '0 0 6px #10b981' }} />
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
            Online · Active Session
          </Typography>
        </Stack>

        {/* Tab switcher */}
        <Stack direction="row" sx={{ mt: 2, bgcolor: 'rgba(0,0,0,0.25)', borderRadius: '8px', p: '3px' }}>
          {(['profile', 'settings'] as const).map(t => (
            <Button
              key={t}
              onClick={() => setTab(t)}
              size="small"
              sx={{
                flex: 1, py: '5px', borderRadius: '6px',
                fontSize: 12, fontWeight: 600,
                bgcolor: tab === t ? 'rgba(255,255,255,0.2)' : 'transparent',
                color: tab === t ? '#fff' : 'rgba(255,255,255,0.6)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.13)' },
                textTransform: 'none',
                transition: 'all 0.18s',
              }}
            >
              {t === 'profile' ? '👤  Profile' : '⚙️  Settings'}
            </Button>
          ))}
        </Stack>
      </Box>

      {/* ══ SCROLLABLE BODY ══ */}
      <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: preset.paper, p: 2.5,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2 },
      }}>

        {/* ════ PROFILE TAB ════ */}
        {tab === 'profile' && (
          <Stack spacing={2.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontWeight: 700, color: 'text.secondary',
                textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.08em' }}>
                Account Information
              </Typography>
              <Button size="small" startIcon={<Edit sx={{ fontSize: 12 }} />}
                onClick={() => setEditMode(e => !e)}
                sx={{ fontSize: 11, py: 0.3, px: 1, borderRadius: 1.5,
                  bgcolor: editMode ? alpha(preset.primary, 0.15) : 'rgba(255,255,255,0.04)',
                  color: editMode ? preset.primary : 'text.secondary',
                  '&:hover': { bgcolor: alpha(preset.primary, 0.12) } }}>
                {editMode ? 'Cancel' : 'Edit'}
              </Button>
            </Stack>

            {editMode ? (
              <Stack spacing={2}>
                <TextField fullWidth size="small" label="Full Name" value={fullName}
                  onChange={e => setFullName(e.target.value)} />
                <TextField fullWidth size="small" label="Email" value={email}
                  onChange={e => setEmail(e.target.value)} type="email" />
                <Button fullWidth variant="contained" size="small"
                  sx={{ background: preset.gradient }} onClick={() => setEditMode(false)}>
                  Save Changes
                </Button>
              </Stack>
            ) : (
              <Stack sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                {[
                  { label: 'Full Name', value: user?.full_name },
                  { label: 'Email',     value: user?.email },
                  { label: 'Role',      value: user?.role },
                  { label: 'Status',    value: 'Active ✓' },
                ].map((row, i, arr) => (
                  <Box key={row.label} sx={{
                    px: 2, py: 1.4,
                    borderBottom: i < arr.length - 1 ? '1px solid' : 'none',
                    borderColor: 'divider',
                    bgcolor: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                  }}>
                    <Typography sx={{ fontSize: 9.5, color: 'text.secondary', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', mb: 0.3 }}>
                      {row.label}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{row.value || '—'}</Typography>
                  </Box>
                ))}
              </Stack>
            )}

            <Typography sx={{ fontWeight: 700, color: 'text.secondary',
              textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.08em', mt: 0.5 }}>
              Quick Actions
            </Typography>
            <Stack spacing={1}>
              {[
                { icon: <PhotoCamera sx={{ fontSize: 16 }} />, label: 'Change Profile Photo', action: () => fileRef.current?.click() },
                { icon: <Settings sx={{ fontSize: 16 }} />,    label: 'App Settings',          action: () => setTab('settings') },
              ].map(a => (
                <ListItemButton key={a.label} onClick={a.action}
                  sx={{ borderRadius: 2, py: 1, px: 1.5,
                    bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: 'divider',
                    '&:hover': { bgcolor: alpha(preset.primary, 0.08), borderColor: alpha(preset.primary, 0.2) } }}>
                  <ListItemIcon sx={{ minWidth: 32, color: preset.primary }}>{a.icon}</ListItemIcon>
                  <ListItemText primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}>{a.label}</ListItemText>
                  <KeyboardArrowRight sx={{ fontSize: 16, color: 'text.secondary' }} />
                </ListItemButton>
              ))}
            </Stack>
          </Stack>
        )}

        {/* ════ SETTINGS TAB ════ */}
        {tab === 'settings' && (
          <Stack spacing={2}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Palette sx={{ fontSize: 15, color: preset.primary }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Theme & Colours</Typography>
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 1 }}>
                {THEME_PRESETS.map(p => (
                  <Box key={p.id} onClick={() => dispatch(setThemePreset(p.id as ThemePresetId))}
                    sx={{ cursor: 'pointer', borderRadius: 2, overflow: 'hidden', border: '2px solid',
                      borderColor: presetId === p.id ? p.primary : 'rgba(255,255,255,0.06)',
                      transition: 'all 0.2s', transform: presetId === p.id ? 'scale(1.02)' : 'scale(1)',
                      boxShadow: presetId === p.id ? `0 0 16px ${p.primary}55` : 'none',
                      '&:hover': { borderColor: alpha(p.primary, 0.5), transform: 'scale(1.02)' } }}>
                    <Box sx={{ height: 38, background: p.gradient, display: 'flex',
                      alignItems: 'center', justifyContent: 'center' }}>
                      {presetId === p.id && (
                        <CheckCircle sx={{ color: '#fff', fontSize: 18, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                      )}
                    </Box>
                    <Box sx={{ p: 0.8, bgcolor: p.paper }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, lineHeight: 1.2 }}>{p.emoji} {p.label}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>

            <Divider />

            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <BrightnessAuto sx={{ fontSize: 15, color: preset.primary }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Display</Typography>
              </Stack>
              <Stack spacing={1}>
                {[
                  { label: 'Compact Sidebar', key: 'compactSidebar' },
                  { label: 'Reduce Motion',   key: 'reduceMotion' },
                  { label: 'Show Tooltips',   key: 'showTooltips', defaultOn: true },
                ].map(item => (
                  <Stack key={item.key} direction="row" justifyContent="space-between" alignItems="center"
                    sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2">{item.label}</Typography>
                    <Switch size="small" defaultChecked={!!item.defaultOn}
                      sx={{ '& .MuiSwitch-thumb': { bgcolor: preset.primary } }} />
                  </Stack>
                ))}
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <NotificationsNone sx={{ fontSize: 15, color: preset.primary }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Notifications</Typography>
              </Stack>
              <Stack spacing={1}>
                {['Defect Assigned to Me', 'Test Run Complete', 'Build Upload Done'].map(n => (
                  <Stack key={n} direction="row" justifyContent="space-between" alignItems="center"
                    sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ lineHeight: 1.3 }}>{n}</Typography>
                    <Switch size="small" defaultChecked
                      sx={{ '& .MuiSwitch-thumb': { bgcolor: preset.primary } }} />
                  </Stack>
                ))}
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Shield sx={{ fontSize: 15, color: preset.primary }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Security</Typography>
              </Stack>
              <Stack spacing={1}>
                {['Change Password', 'Active Sessions'].map(label => (
                  <ListItemButton key={label}
                    sx={{ borderRadius: 2, py: 1, px: 1.5,
                      bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: 'divider',
                      '&:hover': { bgcolor: alpha(preset.primary, 0.07) } }}>
                    <ListItemText primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}>{label}</ListItemText>
                    <KeyboardArrowRight sx={{ fontSize: 16, color: 'text.secondary' }} />
                  </ListItemButton>
                ))}
              </Stack>
            </Box>
          </Stack>
        )}
      </Box>

      {/* ══ FOOTER ══ */}
      <Box sx={{ px: 3, py: 1.5, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
          QA &amp; Governance Hub · v2.0.0
        </Typography>
      </Box>
    </Drawer>
  );
};



/* ─────────────────────────────────────────────
   MAIN APP
───────────────────────────────────────────── */
const App: React.FC = () => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const dispatch   = useDispatch();

  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const filters  = useSelector((state: RootState) => state.filters);
  const presetId = useSelector((state: RootState) => state.theme.presetId);
  const preset   = getPreset(presetId);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifAnchor, setNotifAnchor] = useState<HTMLElement | null>(null);

  // ── mock notification data ──
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'bug',     read: false, title: 'BUG_SCM_0042 assigned to you',      body: 'Procurement → Vendor field crash on save', time: '2 min ago' },
    { id: 2, type: 'info',    read: false, title: 'Build V1.0.4 uploaded',              body: 'SCM_BHSPL project · 18 test cases linked',  time: '14 min ago' },
    { id: 3, type: 'success', read: false, title: 'Test run completed',                body: '43 passed, 3 failed — Sprint 4',             time: '1 hr ago' },
    { id: 4, type: 'info',    read: true,  title: 'Release V1.0.3 marked closed',      body: 'Governance Portal project',                  time: 'Yesterday' },
    { id: 5, type: 'bug',     read: true,  title: 'BUG_SCM_0039 status → Resolved',   body: 'Fixed by Raj Kumar · Verified',              time: 'Yesterday' },
  ]);
  const unreadCount = notifications.filter(n => !n.read).length;

  const [groups,          setGroups]          = useState<any[]>([]);
  const [companies,       setCompanies]       = useState<any[]>([]);
  const [projects,        setProjects]        = useState<any[]>([]);
  const [applications,    setApplications]    = useState<any[]>([]);
  const [releases,        setReleases]        = useState<any[]>([]);
  const [sprints,         setSprints]         = useState<any[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingProjects,  setLoadingProjects]  = useState(false);

  const [avatarUrl, setAvatarUrl] = useState('');
  useEffect(() => {
    const saved = localStorage.getItem('userAvatar');
    if (saved) setAvatarUrl(saved);
  }, [profileOpen]);

  /* ── Filter cascade: single-init approach (no chained useEffects) ── */
  const [_filtersReady, setFiltersReady] = useState(false);

  // Runs ONCE when auth is ready. Loads the full group→company→project chain atomically.
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let cancelled = false;
    const init = async () => {
      setLoadingCompanies(true);
      setLoadingProjects(true);
      try {
        const userRoles = (user.role || '').split(',').map((r: any) => r.trim());
        const isSuper = userRoles.includes('Super Admin');
        const isGroup = userRoles.includes('Group Admin');

        // 1. Groups
        const grpsRes = await api.get('/org/groups');
        if (cancelled) return;
        const grps: any[] = grpsRes.data;
        setGroups(grps);

        // Pick group: prefer user.group_id match if not super admin, else first
        const matchedGrp = !isSuper && user.group_id ? grps.find((g: any) => g.id === user.group_id) : null;
        const selectedGrp = matchedGrp || grps[0];
        if (!selectedGrp) {
          setLoadingCompanies(false);
          setLoadingProjects(false);
          return;
        }
        const gId = selectedGrp.id;
        const gName = selectedGrp.name;
        dispatch(setFilter({ groupId: gId, groupName: gName }));

        // 2. Companies for that group
        const comsRes = await api.get(`/org/companies?group_id=${gId}`);
        if (cancelled) return;
        const coms: any[] = comsRes.data;
        setCompanies(coms);
        setLoadingCompanies(false);
        if (!coms.length) {
          setLoadingProjects(false);
          return;
        }

        // Pick company: prefer user.company_id match if not super/group admin, else first
        const matchedComp = !(isSuper || isGroup) && user.company_id 
          ? coms.find((c: any) => c.id === user.company_id) 
          : (user.company_id ? coms.find((c: any) => c.id === user.company_id) : null);
        const selectedComp = matchedComp || coms[0];
        const cId = selectedComp.id;
        const cName = selectedComp.name;
        dispatch(setFilter({ companyId: cId, companyName: cName }));

        // 3. Projects for that company
        const projsRes = await api.get(`/org/projects?company_id=${cId}`);
        if (cancelled) return;
        const projs: any[] = projsRes.data;
        setProjects(projs);
        setLoadingProjects(false);
        if (!projs.length) return;

        // Pick project: prefer matched assigned project from user.project_roles
        const userProjIds = user.project_roles ? Object.keys(user.project_roles).map(Number) : [];
        const matchedProj = userProjIds.length ? projs.find((p: any) => userProjIds.includes(p.id)) : null;
        const selectedProj = matchedProj || projs[0];
        const pId = selectedProj.id;
        const pName = selectedProj.name;
        dispatch(setFilter({ projectId: pId, projectName: pName }));

        // 4. Applications + Releases + Sprints in parallel
        const [appsRes, relsRes, sprsRes] = await Promise.all([
          api.get(`/org/applications?project_id=${pId}`).catch(() => ({ data: [] })),
          api.get(`/work/releases?project_id=${pId}`).catch(() => ({ data: [] })),
          api.get(`/work/sprints?project_id=${pId}`).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setApplications(appsRes.data);
        setReleases(relsRes.data);
        setSprints(sprsRes.data);
      } catch (e) {
        console.error('Filter init error:', e);
        setLoadingCompanies(false);
        setLoadingProjects(false);
      }
      if (!cancelled) setFiltersReady(true);
    };
    init();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual change handlers (called when user picks from a dropdown)
  const onGroupChange = async (gId: number | null) => {
    const gName = gId ? (groups.find((g: any) => g.id === gId)?.name || null) : null;
    if (!gId) {
      dispatch(setFilter({
        groupId: null, groupName: null,
        companyId: null, companyName: null,
        projectId: null, projectName: null,
        applicationId: null, applicationName: null,
        releaseId: null, releaseName: null,
        sprintId: null, sprintName: null
      }));
      setCompanies([]); setProjects([]); setApplications([]); setReleases([]); setSprints([]);
      return;
    }
    
    setLoadingCompanies(true);
    setLoadingProjects(true);
    try {
      const comsRes = await api.get(`/org/companies?group_id=${gId}`).catch(() => ({ data: [] }));
      const coms: any[] = comsRes.data;
      setCompanies(coms);
      setLoadingCompanies(false);
      
      if (!coms.length) {
        dispatch(setFilter({
          groupId: gId, groupName: gName,
          companyId: null, companyName: null,
          projectId: null, projectName: null,
          applicationId: null, applicationName: null,
          releaseId: null, releaseName: null,
          sprintId: null, sprintName: null
        }));
        setProjects([]); setApplications([]); setReleases([]); setSprints([]);
        setLoadingProjects(false);
        return;
      }
      
      const cId = coms[0].id;
      const cName = coms[0].name;
      
      const projsRes = await api.get(`/org/projects?company_id=${cId}`).catch(() => ({ data: [] }));
      const projs: any[] = projsRes.data;
      setProjects(projs);
      setLoadingProjects(false);
      
      if (!projs.length) {
        dispatch(setFilter({
          groupId: gId, groupName: gName,
          companyId: cId, companyName: cName,
          projectId: null, projectName: null,
          applicationId: null, applicationName: null,
          releaseId: null, releaseName: null,
          sprintId: null, sprintName: null
        }));
        setApplications([]); setReleases([]); setSprints([]);
        return;
      }
      
      const pId = projs[0].id;
      const pName = projs[0].name;
      
      const [appsRes, relsRes, sprsRes] = await Promise.all([
        api.get(`/org/applications?project_id=${pId}`).catch(() => ({ data: [] })),
        api.get(`/work/releases?project_id=${pId}`).catch(() => ({ data: [] })),
        api.get(`/work/sprints?project_id=${pId}`).catch(() => ({ data: [] })),
      ]);
      
      setApplications(appsRes.data);
      setReleases(relsRes.data);
      setSprints(sprsRes.data);
      
      dispatch(setFilter({
        groupId: gId, groupName: gName,
        companyId: cId, companyName: cName,
        projectId: pId, projectName: pName,
        applicationId: null, applicationName: null,
        releaseId: null, releaseName: null,
        sprintId: null, sprintName: null
      }));
    } catch (err) {
      console.error(err);
      setLoadingCompanies(false);
      setLoadingProjects(false);
    }
  };

  const onCompanyChange = async (cId: number | null) => {
    const cName = cId ? (companies.find((c: any) => c.id === cId)?.name || null) : null;
    if (!cId) {
      dispatch(setFilter({
        companyId: null, companyName: null,
        projectId: null, projectName: null,
        applicationId: null, applicationName: null,
        releaseId: null, releaseName: null,
        sprintId: null, sprintName: null
      }));
      setProjects([]); setApplications([]); setReleases([]); setSprints([]);
      return;
    }
    
    setLoadingProjects(true);
    try {
      const projsRes = await api.get(`/org/projects?company_id=${cId}`).catch(() => ({ data: [] }));
      const projs: any[] = projsRes.data;
      setProjects(projs);
      setLoadingProjects(false);
      
      if (!projs.length) {
        dispatch(setFilter({
          companyId: cId, companyName: cName,
          projectId: null, projectName: null,
          applicationId: null, applicationName: null,
          releaseId: null, releaseName: null,
          sprintId: null, sprintName: null
        }));
        setApplications([]); setReleases([]); setSprints([]);
        return;
      }
      
      const pId = projs[0].id;
      const pName = projs[0].name;
      
      const [appsRes, relsRes, sprsRes] = await Promise.all([
        api.get(`/org/applications?project_id=${pId}`).catch(() => ({ data: [] })),
        api.get(`/work/releases?project_id=${pId}`).catch(() => ({ data: [] })),
        api.get(`/work/sprints?project_id=${pId}`).catch(() => ({ data: [] })),
      ]);
      
      setApplications(appsRes.data);
      setReleases(relsRes.data);
      setSprints(sprsRes.data);
      
      dispatch(setFilter({
        companyId: cId, companyName: cName,
        projectId: pId, projectName: pName,
        applicationId: null, applicationName: null,
        releaseId: null, releaseName: null,
        sprintId: null, sprintName: null
      }));
    } catch (err) {
      console.error(err);
      setLoadingProjects(false);
    }
  };

  const onProjectChange = async (pId: number | null) => {
    const pName = pId ? (projects.find((p: any) => p.id === pId)?.name || null) : null;
    dispatch(setFilter({
      projectId: pId, projectName: pName,
      applicationId: null, applicationName: null,
      releaseId: null, releaseName: null,
      sprintId: null, sprintName: null
    }));
    setApplications([]); setReleases([]); setSprints([]);
    if (!pId) return;
    const [appsRes, relsRes, sprsRes] = await Promise.all([
      api.get(`/org/applications?project_id=${pId}`).catch(() => ({ data: [] })),
      api.get(`/work/releases?project_id=${pId}`).catch(() => ({ data: [] })),
      api.get(`/work/sprints?project_id=${pId}`).catch(() => ({ data: [] })),
    ]);
    setApplications(appsRes.data); setReleases(relsRes.data); setSprints(sprsRes.data);
  };

  const onAppChange = async (aId: number | null) => {
    const aName = aId ? (applications.find((a: any) => a.id === aId)?.name || null) : null;
    dispatch(setFilter({
      applicationId: aId || null, applicationName: aName,
      releaseId: null, releaseName: null,
      sprintId: null, sprintName: null
    }));
    if (!filters.projectId) return;
    const appQ = aId ? `&application_id=${aId}` : '';
    const [relsRes, sprsRes] = await Promise.all([
      api.get(`/work/releases?project_id=${filters.projectId}${appQ}`).catch(() => ({ data: [] })),
      api.get(`/work/sprints?project_id=${filters.projectId}${appQ}`).catch(() => ({ data: [] })),
    ]);
    setReleases(relsRes.data); setSprints(sprsRes.data);
  };

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await api.post('/auth/logout', { refresh_token: refreshToken }).catch(() => {});
      }
    } finally {
      dispatch(logout());
      navigate('/login');
    }
  };

  // Listen for auth:logout event dispatched by the API interceptor on refresh failure
  useEffect(() => {
    const handler = () => { dispatch(logout()); navigate('/login'); };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for masters:refresh event to reload organizational and release/sprint hierarchy lists
  useEffect(() => {
    const handleRefresh = async () => {
      if (!isAuthenticated) return;
      try {
        const grpsRes = await api.get('/org/groups');
        setGroups(grpsRes.data);

        if (filters.groupId) {
          const comsRes = await api.get(`/org/companies?group_id=${filters.groupId}`);
          setCompanies(comsRes.data);
        }

        if (filters.companyId) {
          const projsRes = await api.get(`/org/projects?company_id=${filters.companyId}`);
          setProjects(projsRes.data);
        }

        if (filters.projectId) {
          const appQ = filters.applicationId ? `&application_id=${filters.applicationId}` : '';
          const [appsRes, relsRes, sprsRes] = await Promise.all([
            api.get(`/org/applications?project_id=${filters.projectId}`).catch(() => ({ data: [] })),
            api.get(`/work/releases?project_id=${filters.projectId}${appQ}`).catch(() => ({ data: [] })),
            api.get(`/work/sprints?project_id=${filters.projectId}${appQ}`).catch(() => ({ data: [] })),
          ]);
          setApplications(appsRes.data);
          setReleases(relsRes.data);
          setSprints(sprsRes.data);
        }
      } catch (err) {
        console.error('Error refreshing masters:', err);
      }
    };

    window.addEventListener('masters:refresh', handleRefresh);
    return () => window.removeEventListener('masters:refresh', handleRefresh);
  }, [isAuthenticated, filters.groupId, filters.companyId, filters.projectId, filters.applicationId]);


  if (!isAuthenticated && location.pathname !== '/login')
    return <Navigate to="/login" replace />;

  const menuItems = [
    { text: 'Analytics Dashboard',    icon: <DashIcon />,        path: '/dashboard' },
    { text: 'User Stories',           icon: <Assignment />,       path: '/stories' },
    { text: 'Change Requests',        icon: <Shield />,           path: '/change-requests' },
    { text: 'Defects Tracker',        icon: <BugReport />,        path: '/defects' },
    { text: 'Test Suite',             icon: <PlaylistAddCheck />, path: '/testcases' },
    { text: 'Traceability Matrix',    icon: <GridOn />,           path: '/traceability' },
    { text: 'RBAC Management',        icon: <AdminPanelSettings />, path: '/rbac' },
    { text: 'Administration Master',  icon: <Settings />,         path: '/admin' },
  ];

  const userRoles = (user?.role || '').split(',').map((r: any) => r.trim());
  const isSuperAdmin = userRoles.includes('Super Admin');
  const isGroupAdmin = userRoles.includes('Group Admin');

  const filterControls = [
    { id: 'group',   label: 'Group',       val: filters.groupId,       items: groups,       key: 'groupId',       nameKey: 'name',    disabled: !isSuperAdmin && !!user?.group_id,               loading: false,          onChange: (v: number|null) => onGroupChange(v) },
    { id: 'company', label: 'Company',     val: filters.companyId,     items: companies,    key: 'companyId',     nameKey: 'name',    disabled: !(isSuperAdmin || isGroupAdmin) && !!user?.company_id,  loading: loadingCompanies, onChange: (v: number|null) => onCompanyChange(v) },
    { id: 'project', label: 'Project',     val: filters.projectId,     items: projects,     key: 'projectId',     nameKey: 'name',    disabled: false,               loading: loadingProjects,  onChange: (v: number|null) => onProjectChange(v) },
    { id: 'app',     label: 'Application', val: filters.applicationId, items: applications, key: 'applicationId', nameKey: 'name',    disabled: false, optional: true, loading: false,            onChange: (v: number|null) => onAppChange(v) },
    { id: 'release', label: 'Release',     val: filters.releaseId,     items: releases,     key: 'releaseId',     nameKey: 'version', disabled: false, optional: true, loading: false,            onChange: (v: number|null) => {
      const rName = v ? (releases.find((r: any) => r.id === v)?.version || null) : null;
      dispatch(setFilter({ releaseId: v, releaseName: rName }));
    } },
    { id: 'sprint',  label: 'Sprint',      val: filters.sprintId,      items: sprints,      key: 'sprintId',      nameKey: 'name',    disabled: false, optional: true, loading: false,            onChange: (v: number|null) => {
      const sName = v ? (sprints.find((s: any) => s.id === v)?.name || null) : null;
      dispatch(setFilter({ sprintId: v, sprintName: sName }));
    } },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      {isAuthenticated && (
        <>
          {/* ══ APP BAR ══ */}
          <AppBar position="fixed" sx={{
            zIndex: t => t.zIndex.drawer + 1,
            background: preset.appBarBg,
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 1px 20px rgba(0,0,0,0.3)',
            // overflow must be visible so floating InputLabels are not clipped
            overflow: 'visible',
          }}>
            <Toolbar sx={{ minHeight: '72px !important', px: 2, gap: 1.5, overflow: 'visible' }}>

              {/* ── LEFT: Menu + Logo ── */}
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexShrink: 0 }}>
                <IconButton color="inherit" onClick={() => setSidebarOpen(o => !o)} size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.04)', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
                  <MenuIcon fontSize="small" />
                </IconButton>

                {/* Logo — larger, properly sized */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box component="img" src={logo} alt="QA Hub Logo"
                    sx={{ height: 48, width: 'auto', objectFit: 'contain',
                      filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }} />
                </Box>
              </Stack>

              {/* ── CENTRE: Filter Engine ── */}
              <Box sx={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflowX: 'auto', overflowY: 'visible', minWidth: 0,
                '&::-webkit-scrollbar': { height: 3 },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
              }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1 }}>
                  {filterControls.map((fc) => (
                    <Box key={fc.id} sx={{
                      display: 'flex', flexDirection: 'column',
                      minWidth: fc.optional ? 112 : 130, flexShrink: 0,
                    }}>
                      {/* Static label above — never floats, never overlaps */}
                      <Typography sx={{
                        fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.06em',
                        textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)',
                        lineHeight: 1, mb: '3px', pl: '2px', userSelect: 'none',
                      }}>
                        {fc.label}
                      </Typography>
                      <Select
                        value={fc.val || ''}
                        displayEmpty
                        disabled={fc.disabled}
                        variant="outlined"
                        size="small"
                        sx={{
                          fontSize: 12, fontWeight: 500, height: 30,
                          bgcolor: 'rgba(255,255,255,0.04)',
                          '& .MuiSelect-select': {
                            py: 0, px: 1.2, lineHeight: '30px',
                            fontSize: 12, fontWeight: 500,
                          },
                          '& .MuiSelect-icon': { fontSize: 16, right: 4 },
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255,255,255,0.10)',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255,255,255,0.28)',
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: preset.primary,
                            borderWidth: 1,
                          },
                          '&.Mui-disabled': { opacity: 0.45 },
                          borderRadius: '6px',
                        }}
                        onChange={e => fc.onChange(e.target.value ? Number(e.target.value) : null)}
                        MenuProps={{ PaperProps: { sx: { mt: 0.5, maxHeight: 280, fontSize: 13 } } }}
                      >
                        {fc.optional && (
                          <MenuItem value="" sx={{ fontSize: 12, fontStyle: 'italic', color: 'text.secondary' }}>
                            All
                          </MenuItem>
                        )}
                        {!fc.optional && fc.loading && (
                          <MenuItem value="" disabled sx={{ fontSize: 12 }}>Loading…</MenuItem>
                        )}
                        {!fc.optional && !fc.loading && fc.items.length === 0 && (
                          <MenuItem value="" disabled sx={{ fontSize: 12, fontStyle: 'italic' }}>No data</MenuItem>
                        )}
                        {fc.items.map((item: any) => (
                          <MenuItem key={item.id} value={item.id} sx={{ fontSize: 13 }}>
                            {item[fc.nameKey]}
                          </MenuItem>
                        ))}
                      </Select>
                    </Box>
                  ))}
                </Stack>
              </Box>

              {/* ── RIGHT: User Profile Button ── */}
              <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>

                {/* Notification bell */}
                <Tooltip title="Notifications">
                  <IconButton
                    size="small"
                    onClick={(e) => setNotifAnchor(e.currentTarget)}
                    sx={{ color: 'text.secondary', position: 'relative',
                      '&:hover': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.06)' } }}
                  >
                    <Badge
                      badgeContent={unreadCount}
                      color="error"
                      sx={{ '& .MuiBadge-badge': { fontSize: 9, height: 14, minWidth: 14 } }}
                    >
                      <NotificationsNone fontSize="small" />
                    </Badge>
                  </IconButton>
                </Tooltip>

                {/* ── NOTIFICATIONS POPOVER ── */}
                <Popover
                  open={Boolean(notifAnchor)}
                  anchorEl={notifAnchor}
                  onClose={() => setNotifAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  PaperProps={{
                    sx: {
                      width: 360, mt: 1,
                      bgcolor: preset.paper,
                      border: '1px solid rgba(255,255,255,0.08)',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                      borderRadius: 3,
                      overflow: 'hidden',
                    },
                  }}
                >
                  {/* Header */}
                  <Stack direction="row" justifyContent="space-between" alignItems="center"
                    sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Notifications</Typography>
                      {unreadCount > 0 && (
                        <Chip label={unreadCount} size="small"
                          sx={{ height: 18, fontSize: 10, fontWeight: 700,
                            bgcolor: alpha(preset.primary, 0.18), color: preset.primary }} />
                      )}
                    </Stack>
                    <Button
                      size="small"
                      startIcon={<MarkEmailRead sx={{ fontSize: 14 }} />}
                      onClick={() => setNotifications(ns => ns.map(n => ({ ...n, read: true })))}
                      sx={{ fontSize: 11, py: 0.3, px: 1, borderRadius: 1.5,
                        color: preset.primary, '&:hover': { bgcolor: alpha(preset.primary, 0.1) } }}
                    >
                      Mark all read
                    </Button>
                  </Stack>

                  {/* Notification list */}
                  <Box sx={{ maxHeight: 360, overflowY: 'auto',
                    '&::-webkit-scrollbar': { width: 4 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2 } }}>
                    {notifications.map((notif, i) => {
                      const iconMap = {
                        bug:     { icon: <BugReport sx={{ fontSize: 16 }} />, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
                        info:    { icon: <Info sx={{ fontSize: 16 }} />,      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
                        success: { icon: <TaskAlt sx={{ fontSize: 16 }} />,   color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
                      };
                      const ic = iconMap[notif.type as keyof typeof iconMap];
                      return (
                        <Box
                          key={notif.id}
                          onClick={() => setNotifications(ns =>
                            ns.map(n => n.id === notif.id ? { ...n, read: true } : n)
                          )}
                          sx={{
                            display: 'flex', gap: 1.5, px: 2.5, py: 1.5, cursor: 'pointer',
                            borderBottom: i < notifications.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                            bgcolor: notif.read ? 'transparent' : alpha(preset.primary, 0.04),
                            transition: 'background 0.15s',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                          }}
                        >
                          {/* Type icon */}
                          <Box sx={{ width: 32, height: 32, borderRadius: 1.5, flexShrink: 0,
                            bgcolor: ic.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: ic.color, mt: 0.3 }}>
                            {ic.icon}
                          </Box>
                          {/* Content */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                              <Typography sx={{ fontSize: 12.5, fontWeight: notif.read ? 400 : 700,
                                lineHeight: 1.35, pr: 1 }}>
                                {notif.title}
                              </Typography>
                              {!notif.read && (
                                <FiberManualRecord sx={{ fontSize: 8, color: preset.primary, flexShrink: 0, mt: 0.6 }} />
                              )}
                            </Stack>
                            <Typography sx={{ fontSize: 11.5, color: 'text.secondary', lineHeight: 1.35, mt: 0.2 }}>
                              {notif.body}
                            </Typography>
                            <Typography sx={{ fontSize: 10.5, color: alpha('#fff', 0.35), mt: 0.5 }}>
                              {notif.time}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Footer */}
                  <Box sx={{ px: 2.5, py: 1.2, borderTop: '1px solid rgba(255,255,255,0.06)',
                    textAlign: 'center' }}>
                    <Button size="small" sx={{ fontSize: 11, color: preset.primary,
                      '&:hover': { bgcolor: alpha(preset.primary, 0.08) } }}>
                      View all notifications
                    </Button>
                  </Box>
                </Popover>

                {/* Profile button */}
                <Tooltip title="My Profile & Settings">
                  <Box onClick={() => setProfileOpen(true)}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer',
                      px: 1.5, py: 0.6, borderRadius: 2.5,
                      bgcolor: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: alpha(preset.primary, 0.1),
                        borderColor: alpha(preset.primary, 0.3),
                        boxShadow: `0 0 12px ${preset.primary}22`,
                      } }}>
                    <Avatar src={avatarUrl || undefined}
                      sx={{ width: 32, height: 32, fontSize: 13, fontFamily: 'Outfit', fontWeight: 700,
                        background: avatarGradient(user?.full_name || 'U'), flexShrink: 0 }}>
                      {!avatarUrl && initials(user?.full_name || 'U')}
                    </Avatar>
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.2, fontSize: 11, color: 'text.primary' }}>
                        {user?.full_name?.split(' ')[0]}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: 9.5, color: 'text.secondary', lineHeight: 1, display: 'block' }}>
                        {user?.role}
                      </Typography>
                    </Box>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981',
                      flexShrink: 0, boxShadow: '0 0 6px #10b981' }} />
                  </Box>
                </Tooltip>
              </Stack>
            </Toolbar>
          </AppBar>

          {/* ══ SIDEBAR DRAWER ══ */}
          <Drawer variant="permanent" open={sidebarOpen} sx={{
            width: sidebarOpen ? DRAWER_W : 64,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: sidebarOpen ? DRAWER_W : 64,
              boxSizing: 'border-box',
              transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
              overflowX: 'hidden',
              background: preset.sidebarBg,
              borderRight: '1px solid rgba(255,255,255,0.05)',
            },
          }}>
            <Toolbar sx={{ minHeight: '72px !important' }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <List sx={{ mt: 1, px: 1 }}>
                {menuItems.map(item => {
                  const userRoles = user?.role?.split(',').map((r: string) => r.trim()) || [];
                  const isAdmin = userRoles.some(r => ['Super Admin', 'Group Admin', 'Company Admin'].includes(r));
                  if (item.path === '/admin' && !isAdmin) {
                    return null;
                  }
                  if (item.path === '/rbac' && !isAdmin) {
                    return null;
                  }
                  const active = location.pathname === item.path;
                  return (
                    <ListItem key={item.text} disablePadding sx={{ display: 'block', mb: 0.5 }}>
                      <Tooltip title={!sidebarOpen ? item.text : ''} placement="right">
                        <ListItemButton component={Link} to={item.path} sx={{
                          minHeight: 44, borderRadius: 2,
                          justifyContent: sidebarOpen ? 'initial' : 'center',
                          px: sidebarOpen ? 2 : 1.5,
                          backgroundColor: active ? alpha(preset.primary, 0.12) : 'transparent',
                          borderLeft: active ? `3px solid ${preset.primary}` : '3px solid transparent',
                          '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' },
                        }}>
                          <ListItemIcon sx={{ minWidth: 0, mr: sidebarOpen ? 2 : 'auto', justifyContent: 'center',
                            color: active ? preset.primary : 'text.secondary' }}>
                            {item.icon}
                          </ListItemIcon>
                          {sidebarOpen && (
                            <ListItemText primary={item.text}
                              sx={{ color: active ? preset.primary : 'text.primary',
                                '& span': { fontWeight: active ? 600 : 400, fontSize: 13 } }} />
                          )}
                        </ListItemButton>
                      </Tooltip>
                    </ListItem>
                  );
                })}
              </List>

              <Box sx={{ p: 1.5 }}>
                {/* User card in sidebar */}
                {sidebarOpen && (
                  <Box onClick={() => setProfileOpen(true)} sx={{ mb: 1.5, p: 1.5, borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer', transition: 'all 0.2s',
                    '&:hover': { bgcolor: alpha(preset.primary, 0.06), borderColor: alpha(preset.primary, 0.2) } }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar src={avatarUrl || undefined}
                        sx={{ width: 30, height: 30, fontSize: 11, fontWeight: 700, fontFamily: 'Outfit',
                          background: avatarGradient(user?.full_name || 'U') }}>
                        {!avatarUrl && initials(user?.full_name || 'U')}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: preset.primary, display: 'block', lineHeight: 1.2, fontSize: 11 }}>
                          {user?.full_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9.5, lineHeight: 1 }}>
                          {user?.role}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                )}

                <Tooltip title={!sidebarOpen ? 'Sign Out' : ''} placement="right">
                  <ListItemButton onClick={handleLogout}
                    sx={{ borderRadius: 2, py: 1, px: sidebarOpen ? 2 : 1.5,
                      color: 'error.main', justifyContent: sidebarOpen ? 'initial' : 'center',
                      '&:hover': { bgcolor: 'rgba(239,68,68,0.08)' } }}>
                    <ListItemIcon sx={{ minWidth: 0, mr: sidebarOpen ? 2 : 'auto', justifyContent: 'center', color: 'error.main' }}>
                      <Logout fontSize="small" />
                    </ListItemIcon>
                    {sidebarOpen && <ListItemText primary="Sign Out" primaryTypographyProps={{ fontSize: 13 }} />}
                  </ListItemButton>
                </Tooltip>
              </Box>
            </Box>
          </Drawer>

          {/* ══ PROFILE DRAWER ══ */}
          <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} user={user} preset={preset} />
        </>
      )}

      {/* ══ MAIN CONTENT ══ */}
      <Box component="main" sx={{
        flexGrow: 1,
        p: isAuthenticated ? 4 : 0,
        mt: isAuthenticated ? '72px' : 0,
        minHeight: '100vh',
        backgroundColor: preset.bg,
        overflowX: 'auto',
      }}>
        <Routes>
          <Route path="/login"           element={<Login />} />
          <Route path="/dashboard"        element={<Dashboard />} />
          <Route path="/stories"          element={<UserStories />} />
          <Route path="/change-requests" element={<ChangeRequests />} />
          <Route path="/defects"          element={<Defects />} />
          <Route path="/testcases"        element={<TestCases />} />
          <Route path="/traceability"     element={<Traceability />} />
          <Route path="/admin"            element={
            (user?.role?.split(',').map((r: any) => r.trim()) || []).some((r: any) => ['Super Admin', 'Group Admin', 'Company Admin'].includes(r)) ? <Admin /> : <Navigate to="/dashboard" replace />
          } />
          <Route path="/rbac"             element={
            (user?.role?.split(',').map((r: any) => r.trim()) || []).some((r: any) => ['Super Admin', 'Group Admin', 'Company Admin'].includes(r)) ? <RBACManagement /> : <Navigate to="/dashboard" replace />
          } />
          <Route path="*"                 element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default App;
// Force typecheck reload
