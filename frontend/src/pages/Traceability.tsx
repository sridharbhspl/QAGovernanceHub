import React from 'react';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, LinearProgress, Stack, Chip, Alert,
  CircularProgress, Tooltip
} from '@mui/material';
import { BugReport } from '@mui/icons-material';
import { RootState } from '../store';
import api from '../services/api';

const Traceability: React.FC = () => {
  const filters = useSelector((state: RootState) => state.filters);

  // Fetch RTM matrix using React Query
  const { data: rtm = [], isLoading, error } = useQuery({
    queryKey: ['rtmMatrix', filters.projectId],
    queryFn: async () => {
      const res = await api.get(`/testcases/rtm/matrix?project_id=${filters.projectId}`);
      return res.data;
    },
    enabled: !!filters.projectId,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontFamily: 'Outfit', fontWeight: 800 }}>Requirement Traceability Matrix</Typography>
        <Typography variant="body2" color="text.secondary">Trace end-to-end alignment: Requirement ➔ Scenario ➔ Test Case ➔ Execution Run ➔ Linked Defect.</Typography>
      </Box>

      {!filters.projectId ? (
        <Alert severity="info">Please select a Project from the toolbar filters to inspect the Traceability Matrix.</Alert>
      ) : error ? (
        <Alert severity="error">Error loading traceability data.</Alert>
      ) : rtm.length === 0 ? (
        <Alert severity="warning">No requirements logged under this project. Set up requirements in the Admin Panel.</Alert>
      ) : (
        <TableContainer component={Paper} sx={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4 }}>
          <Table aria-label="RTM matrix table">
            <TableHead sx={{ backgroundColor: 'background.paper' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Requirement</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Test Scenarios</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Test Cases</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Last Run Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Linked Defect</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 220 }}>QA Pass Coverage</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rtm.map((row: any) => {
                const totalTcs = row.total_test_cases;
                const passed = row.passed_test_cases;
                const coverage = row.coverage_percentage;
                
                // Determine progress color
                let progressColor: 'success' | 'warning' | 'error' = 'success';
                if (coverage < 50) progressColor = 'error';
                else if (coverage < 90) progressColor = 'warning';

                return (
                  <TableRow key={row.requirement_internal_id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    {/* Requirement Column */}
                    <TableCell component="th" scope="row" sx={{ verticalAlign: 'top', py: 3 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        {row.requirement_id}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {row.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, maxWidth: 200 }}>
                        {row.description}
                      </Typography>
                    </TableCell>

                    {/* Scenarios Column */}
                    <TableCell sx={{ verticalAlign: 'top', py: 3 }}>
                      {row.scenarios.length === 0 ? (
                        <Typography variant="caption" color="text.secondary">No scenarios linked</Typography>
                      ) : (
                        row.scenarios.map((sc: any) => (
                          <Box key={sc.id} sx={{ mb: 2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, color: 'warning.main' }}>
                              {sc.scenario_id}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {sc.title}
                            </Typography>
                          </Box>
                        ))
                      )}
                    </TableCell>

                    {/* Test Cases Column */}
                    <TableCell sx={{ verticalAlign: 'top', py: 3 }}>
                      {row.scenarios.map((sc: any) => (
                        <Box key={sc.id} sx={{ mb: 2 }}>
                          {sc.test_cases.length === 0 ? (
                            <Typography variant="caption" color="text.secondary">No cases mapped</Typography>
                          ) : (
                            sc.test_cases.map((tc: any) => (
                              <Box key={tc.id} sx={{ mb: 0.5 }}>
                                <Typography variant="body2">
                                  {tc.test_case_id}: {tc.title}
                                </Typography>
                              </Box>
                            ))
                          )}
                        </Box>
                      ))}
                    </TableCell>

                    {/* Execution status Column */}
                    <TableCell sx={{ verticalAlign: 'top', py: 3 }}>
                      {row.scenarios.map((sc: any) => (
                        <Box key={sc.id} sx={{ mb: 2 }}>
                          {sc.test_cases.map((tc: any) => {
                            const badgeColor: any = { Passed: 'success', Failed: 'error', Blocked: 'warning', Untested: 'default' };
                            return (
                              <Box key={tc.id} sx={{ mb: 0.5 }}>
                                <Chip label={tc.status} color={badgeColor[tc.status]} size="small" variant="outlined" sx={{ height: 20 }} />
                              </Box>
                            );
                          })}
                        </Box>
                      ))}
                    </TableCell>

                    {/* Linked defect Column */}
                    <TableCell sx={{ verticalAlign: 'top', py: 3 }}>
                      {row.scenarios.map((sc: any) => (
                        <Box key={sc.id} sx={{ mb: 2 }}>
                          {sc.test_cases.map((tc: any) => (
                            <Box key={tc.id} sx={{ mb: 0.5, height: 20, display: 'flex', alignItems: 'center' }}>
                              {tc.defect_code ? (
                                <Tooltip title="Inspect linked defect">
                                  <Chip
                                    label={tc.defect_code}
                                    color="error"
                                    size="small"
                                    icon={<BugReport />}
                                    sx={{ height: 20, cursor: 'pointer' }}
                                  />
                                </Tooltip>
                              ) : (
                                <Typography variant="caption" color="text.secondary">-</Typography>
                              )}
                            </Box>
                          ))}
                        </Box>
                      ))}
                    </TableCell>

                    {/* Pass Coverage column */}
                    <TableCell sx={{ verticalAlign: 'top', py: 3 }}>
                      <Stack spacing={1}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {coverage}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={coverage}
                          color={progressColor}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {passed} of {totalTcs} passed
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default Traceability;
