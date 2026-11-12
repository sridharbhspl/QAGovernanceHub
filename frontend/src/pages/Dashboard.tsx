import React from 'react';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Grid, Card, Typography, Box, Stack, Button, CircularProgress,
  LinearProgress, Avatar, Chip
} from '@mui/material';
import {
  Download, BugReport, Assessment, TaskAlt, Speed, Loop, PlaylistAddCheck
} from '@mui/icons-material';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend, LineChart, Line, CartesianGrid
} from 'recharts';
import { RootState } from '../store';
import api from '../services/api';
import logo from '../assets/logo.png';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

const Dashboard: React.FC = () => {
  const filters = useSelector((state: RootState) => state.filters);
  const { user } = useSelector((state: RootState) => state.auth);

  // Fetch Dashboard Metrics using React Query
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['dashboardMetrics', filters],
    queryFn: async () => {
      const params: any = {};
      if (filters.groupId) params.group_id = filters.groupId;
      if (filters.companyId) params.company_id = filters.companyId;
      if (filters.projectId) params.project_id = filters.projectId;
      if (filters.applicationId) params.application_id = filters.applicationId;
      if (filters.releaseId) params.release_id = filters.releaseId;
      if (filters.sprintId) params.sprint_id = filters.sprintId;

      const res = await api.get('/dashboard/metrics', { params });
      return res.data;
    },
    enabled: !!filters.groupId || !!filters.companyId,
  });

  const handleExport = (type: 'defects' | 'rtm' | 'pdf') => {
    if (!filters.projectId) return;
    
    let url = '';
    let filename = '';
    if (type === 'defects') {
      url = `/reports/defects/excel?project_id=${filters.projectId}`;
      filename = `defects_project_${filters.projectId}.xlsx`;
    } else if (type === 'rtm') {
      url = `/reports/rtm/excel?project_id=${filters.projectId}`;
      filename = `rtm_project_${filters.projectId}.xlsx`;
    } else {
      url = `/reports/project-health/pdf?project_id=${filters.projectId}`;
      filename = `health_project_${filters.projectId}.pdf`;
    }

    // Trigger download
    api.get(url, { responseType: 'blob' })
      .then((response) => {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(new Blob([response.data]));
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch(console.error);
  };

  const renderWidget = (title: string, value: any, icon: React.ReactNode, subtext?: string) => (
    <Card sx={{ height: '100%', minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h3" sx={{ fontFamily: 'Outfit', fontWeight: 800 }}>
            {value}
          </Typography>
        </Box>
        <Box sx={{ color: 'primary.main', p: 1, borderRadius: 2, backgroundColor: 'rgba(59, 130, 246, 0.08)' }}>
          {icon}
        </Box>
      </Stack>
      {subtext && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          {subtext}
        </Typography>
      )}
    </Card>
  );

  return (
    <Box>
      {/* Welcome & Profile Banner */}
      {user && (
        <Card 
          sx={{ 
            p: 3, 
            mb: 4, 
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 4,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Avatar 
                sx={{ 
                  width: 56, 
                  height: 56, 
                  background: 'linear-gradient(45deg, #3b82f6 0%, #8b5cf6 100%)',
                  fontFamily: 'Outfit',
                  fontWeight: 700,
                  fontSize: '1.25rem',
                  boxShadow: '0 0 15px rgba(139, 92, 246, 0.3)'
                }}
              >
                {user.full_name ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'U'}
              </Avatar>
            </Grid>
            <Grid item xs>
              <Box>
                <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                  <Typography variant="h5" sx={{ fontFamily: 'Outfit', fontWeight: 800 }}>
                    Welcome back, {user.full_name}!
                  </Typography>
                  <Chip 
                    label={user.role} 
                    size="small" 
                    sx={{ 
                      background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)', 
                      color: '#ffffff', 
                      fontWeight: 600,
                      fontFamily: 'Outfit',
                      fontSize: '0.75rem',
                      border: 'none'
                    }} 
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {user.email} • Active Session • Access Level: {user.role}
                </Typography>
              </Box>
            </Grid>
            <Grid item>
              <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Current Local Time
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Card>
      )}

      {/* Conditional Content: Loading / Onboarding / Main Metrics */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress size={50} />
        </Box>
      ) : (error || !metrics || !metrics.level) ? (
        <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <Card sx={{ p: 5, maxWidth: 600, textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(7, 10, 19, 0.6)', backdropFilter: 'blur(16px)', borderRadius: 4, boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)' }}>
            <Box component="img" src={logo} alt="Bavya Logo" sx={{ height: 140, mb: 4, mx: 'auto' }} />
            <Typography variant="h4" sx={{ fontFamily: 'Outfit', fontWeight: 800, mb: 2 }}>
              Welcome to QA & Governance Hub
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              It looks like the organization hierarchy is not fully configured yet, or no active filters are selected. To begin viewing analytics, please set up your Groups, Companies, Projects, and Sprints first.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button 
                variant="contained" 
                component={Link} 
                to="/admin"
                sx={{ background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)', px: 4, py: 1.5, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
              >
                Go to Administration Master
              </Button>
            </Stack>
          </Card>
        </Box>
      ) : (
        <>
          {/* Dashboard Title & Actions */}
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: 'Outfit', fontWeight: 800 }} gutterBottom>
            {metrics.level === 1 && 'Level 1: Group Governance'}
            {metrics.level === 2 && 'Level 2: Company Metrics'}
            {metrics.level === 3 && 'Level 3: Project Analytics'}
            {metrics.level === 4 && 'Level 4: Application Analytics'}
            {metrics.level === 5 && 'Level 5: Release Health'}
            {metrics.level === 6 && 'Level 6: Sprint Monitor'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Aggregated QA, defect and trace metrics dynamically compiled.
          </Typography>
        </Box>

        {filters.projectId && (
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download />}
              onClick={() => handleExport('defects')}
            >
              Defects Excel
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download />}
              onClick={() => handleExport('rtm')}
            >
              RTM Excel
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<Assessment />}
              onClick={() => handleExport('pdf')}
              sx={{ background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)' }}
            >
              Health PDF
            </Button>
          </Stack>
        )}
      </Stack>

      {/* Level 1: Group Dashboard */}
      {metrics.level === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={4}>
            {renderWidget('Total Companies', metrics.widgets.totalCompanies, <Speed />)}
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            {renderWidget('Total Projects', metrics.widgets.totalProjects, <Assessment />)}
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            {renderWidget('Active Users', metrics.widgets.totalUsers, <Speed />)}
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            {renderWidget('Total Open Defects', metrics.widgets.totalOpenDefects, <BugReport sx={{ color: 'error.main' }} />)}
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            {renderWidget('Total Closed Defects', metrics.widgets.totalClosedDefects, <TaskAlt sx={{ color: 'success.main' }} />)}
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ height: '100%' }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Overall Testing Progress
              </Typography>
              <Typography variant="h3" sx={{ fontFamily: 'Outfit', fontWeight: 800, mb: 1 }}>
                {metrics.widgets.overallTestingProgress}%
              </Typography>
              <LinearProgress variant="determinate" value={metrics.widgets.overallTestingProgress} sx={{ height: 8, borderRadius: 4 }} />
            </Card>
          </Grid>

          {/* Level 1 Charts */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: 400 }}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Company-wise Defects</Typography>
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie
                    data={metrics.charts.companyWiseDefects}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {metrics.charts.companyWiseDefects.map((_: any, idx: number) => (
                      <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} Defects`, 'Count']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: 400 }}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Company-wise Project Health (%)</Typography>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={metrics.charts.companyWiseProjectHealth}>
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" domain={[0, 100]} />
                  <Tooltip formatter={(value) => [`${value}% Health`, 'Value']} />
                  <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Level 2: Company Dashboard */}
      {metrics.level === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            {renderWidget('Projects Count', metrics.widgets.projectsCount, <Assessment />)}
          </Grid>
          <Grid item xs={12} sm={4}>
            {renderWidget('Active Users', metrics.widgets.usersCount, <Speed />)}
          </Grid>
          <Grid item xs={12} sm={4}>
            {renderWidget('Active Sprints', metrics.widgets.activeSprints, <Loop />)}
          </Grid>
          <Grid item xs={12} sm={6}>
            {renderWidget('Open Defects', metrics.widgets.openBugs, <BugReport sx={{ color: 'error.main' }} />)}
          </Grid>
          <Grid item xs={12} sm={6}>
            {renderWidget('Closed Defects', metrics.widgets.closedBugs, <TaskAlt sx={{ color: 'success.main' }} />)}
          </Grid>

          {/* Level 2 Charts */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: 400 }}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Project-wise Defect Volume</Typography>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={metrics.charts.projectWiseDefects}>
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: 400 }}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Project-wise QA Progress (%)</Typography>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={metrics.charts.projectWiseQAProgress}>
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Level 3: Project Dashboard */}
      {metrics.level === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            {renderWidget('Requirements', metrics.widgets.requirements, <PlaylistAddCheck />)}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {renderWidget('Test Cases', metrics.widgets.testCases, <PlaylistAddCheck sx={{ color: 'info.main' }} />)}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {renderWidget('Open Defects', metrics.widgets.openDefects, <BugReport sx={{ color: 'error.main' }} />)}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {renderWidget('Closed Defects', metrics.widgets.closedDefects, <TaskAlt sx={{ color: 'success.main' }} />)}
          </Grid>

          {/* Detailed QA Run Results */}
          <Grid item xs={12}>
            <Card>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Test Case Execution Metrics</Typography>
              <Grid container spacing={3} textAlign="center">
                <Grid item xs={4}>
                  <Typography variant="h4" color="success.main" sx={{ fontWeight: 800 }}>{metrics.widgets.executedTestsPassed}</Typography>
                  <Typography variant="caption" color="text.secondary">Tests Passed</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="h4" color="error.main" sx={{ fontWeight: 800 }}>{metrics.widgets.executedTestsFailed}</Typography>
                  <Typography variant="caption" color="text.secondary">Tests Failed</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="h4" color="warning.main" sx={{ fontWeight: 800 }}>{metrics.widgets.executedTestsBlocked}</Typography>
                  <Typography variant="caption" color="text.secondary">Tests Blocked</Typography>
                </Grid>
              </Grid>
            </Card>
          </Grid>

          {/* Level 3 Charts */}
          <Grid item xs={12} md={4}>
            <Card sx={{ height: 350 }}>
              <Typography variant="subtitle1" sx={{ fontFamily: 'Outfit', mb: 1 }}>Severity Distribution</Typography>
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={metrics.charts.severityDistribution}
                    cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value"
                  >
                    {metrics.charts.severityDistribution.map((_: any, idx: number) => (
                      <Cell key={`cell-${idx}`} fill={['#10b981', '#f59e0b', '#ef4444', '#b91c1c'][idx % 4]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ height: 350 }}>
              <Typography variant="subtitle1" sx={{ fontFamily: 'Outfit', mb: 1 }}>Priority Distribution</Typography>
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={metrics.charts.priorityDistribution}
                    cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value"
                  >
                    {metrics.charts.priorityDistribution.map((_: any, idx: number) => (
                      <Cell key={`cell-${idx}`} fill={['#3b82f6', '#06b6d4', '#8b5cf6', '#dc2626'][idx % 4]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ height: 350 }}>
              <Typography variant="subtitle1" sx={{ fontFamily: 'Outfit', mb: 1 }}>Defect Aging</Typography>
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={metrics.charts.defectAging}>
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Level 4: Application Dashboard */}
      {metrics.level === 4 && (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            {renderWidget('Releases', metrics.widgets.requirements, <PlaylistAddCheck />)}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {renderWidget('Test Cases', metrics.widgets.testCases, <PlaylistAddCheck sx={{ color: 'info.main' }} />)}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {renderWidget('Open Defects', metrics.widgets.openDefects, <BugReport sx={{ color: 'error.main' }} />)}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {renderWidget('Closed Defects', metrics.widgets.closedDefects, <TaskAlt sx={{ color: 'success.main' }} />)}
          </Grid>

          {/* Detailed QA Run Results */}
          <Grid item xs={12}>
            <Card>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Test Case Execution Metrics</Typography>
              <Grid container spacing={3} textAlign="center">
                <Grid item xs={4}>
                  <Typography variant="h4" color="success.main" sx={{ fontWeight: 800 }}>{metrics.widgets.executedTestsPassed}</Typography>
                  <Typography variant="caption" color="text.secondary">Tests Passed</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="h4" color="error.main" sx={{ fontWeight: 800 }}>{metrics.widgets.executedTestsFailed}</Typography>
                  <Typography variant="caption" color="text.secondary">Tests Failed</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="h4" color="warning.main" sx={{ fontWeight: 800 }}>{metrics.widgets.executedTestsBlocked}</Typography>
                  <Typography variant="caption" color="text.secondary">Tests Blocked</Typography>
                </Grid>
              </Grid>
            </Card>
          </Grid>

          {/* Level 4 Charts */}
          <Grid item xs={12} md={4}>
            <Card sx={{ height: 350 }}>
              <Typography variant="subtitle1" sx={{ fontFamily: 'Outfit', mb: 1 }}>Severity Distribution</Typography>
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={metrics.charts.severityDistribution}
                    cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value"
                  >
                    {metrics.charts.severityDistribution.map((_: any, idx: number) => (
                      <Cell key={`cell-${idx}`} fill={['#10b981', '#f59e0b', '#ef4444', '#b91c1c'][idx % 4]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ height: 350 }}>
              <Typography variant="subtitle1" sx={{ fontFamily: 'Outfit', mb: 1 }}>Priority Distribution</Typography>
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={metrics.charts.priorityDistribution}
                    cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value"
                  >
                    {metrics.charts.priorityDistribution.map((_: any, idx: number) => (
                      <Cell key={`cell-${idx}`} fill={['#3b82f6', '#06b6d4', '#8b5cf6', '#dc2626'][idx % 4]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ height: 350 }}>
              <Typography variant="subtitle1" sx={{ fontFamily: 'Outfit', mb: 1 }}>Defect Aging</Typography>
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={metrics.charts.defectAging}>
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Level 5: Release Dashboard */}
      {metrics.level === 5 && (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            {renderWidget('Release Health (%)', `${metrics.widgets.releaseHealth}%`, <Speed sx={{ color: 'success.main' }} />, 'Percentage of resolved defects')}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {renderWidget('Defect Leakage (%)', `${metrics.widgets.defectLeakage}%`, <BugReport sx={{ color: 'error.main' }} />, 'Production vs QA leakage')}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {renderWidget('Regression Status (%)', `${metrics.widgets.regressionStatus}%`, <Assessment />, 'Regression test suite run pass rate')}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {renderWidget('Automation Coverage (%)', `${metrics.widgets.automationCoverage}%`, <PlaylistAddCheck sx={{ color: 'info.main' }} />, 'Automated test suite coverage')}
          </Grid>

          {/* Level 5 Charts */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: 350 }}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Defects by Environment</Typography>
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie data={metrics.charts.defectLeakageTrend} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                    {metrics.charts.defectLeakageTrend.map((_: any, idx: number) => (
                      <Cell key={`cell-${idx}`} fill={['#3b82f6', '#ef4444'][idx % 2]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: 350 }}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Regression Run Stats</Typography>
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie data={metrics.charts.regressionPassedFailed} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                    {metrics.charts.regressionPassedFailed.map((_: any, idx: number) => (
                      <Cell key={`cell-${idx}`} fill={['#10b981', '#ef4444'][idx % 2]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Level 6: Sprint Dashboard */}
      {metrics.level === 6 && (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            {renderWidget('Sprint Progress (%)', `${metrics.widgets.sprintProgress}%`, <Speed />, 'Tests executions completed')}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {renderWidget('Testing Completion (%)', `${metrics.widgets.testingCompletion}%`, <PlaylistAddCheck sx={{ color: 'info.main' }} />)}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {renderWidget('Resolved Bugs', metrics.widgets.resolvedBugs, <TaskAlt sx={{ color: 'success.main' }} />)}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {renderWidget('Pending Bugs', metrics.widgets.pendingBugs, <BugReport sx={{ color: 'error.main' }} />)}
          </Grid>

          {/* Level 6 Burndown Chart */}
          <Grid item xs={12}>
            <Card sx={{ height: 400 }}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', mb: 2 }}>Sprint Burndown Chart (Bugs Count)</Typography>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={metrics.charts.burndown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="ideal" name="Ideal Burndown" stroke="#10b981" strokeDasharray="5 5" strokeWidth={2} />
                  <Line type="monotone" dataKey="actual" name="Actual Remaining" stroke="#ef4444" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Grid>
        </Grid>
      )}
        </>
      )}
    </Box>
  );
};

export default Dashboard;
