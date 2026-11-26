import { defaultAutomations } from './automation';
import type { Activity, DataState, Issue, Priority, Roadmap, SlaPolicy, Sprint, SupportLevel, SupportLevelConfig, Workflow, WorkLog } from './models';

const t = (daysAgo: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
/** A moment a number of hours ago (support tickets need exact times for their SLA clocks) */
const h = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600_000).toISOString();

export const defaultWorkflow: Workflow = {
  id: 'wf-default',
  name: 'Delivery workflow',
  statuses: [
    { id: 'new', name: 'New', category: 'todo', color: '#64748b' },
    { id: 'dev', name: 'Development In Progress', category: 'in_progress', color: '#2563eb' },
    { id: 'testing', name: 'Testing', category: 'in_progress', color: '#7c3aed' },
    { id: 'ready_uat', name: 'Ready for UAT', category: 'in_progress', color: '#0891b2' },
    { id: 'uat', name: 'UAT In Progress', category: 'in_progress', color: '#0e7490' },
    { id: 'ready_qa', name: 'Ready for QA', category: 'in_progress', color: '#d97706' },
    { id: 'qa', name: 'QA In Progress', category: 'in_progress', color: '#b45309' },
    { id: 'ready_live', name: 'Ready for Live', category: 'in_progress', color: '#059669' },
    { id: 'live', name: 'Live', category: 'done', color: '#16a34a' },
    { id: 'hold', name: 'Hold', category: 'hold', color: '#dc2626' },
    { id: 'closed', name: 'Closed', category: 'done', color: '#475569' },
  ],
  transitions: {},
};

/** Default SLA targets in minutes: [response, resolution] per support level and priority */
const SLA_DEFAULTS: Record<SupportLevel, Record<Priority, [number, number]>> = {
  l1: { highest: [15, 240], high: [30, 480], medium: [60, 1440], low: [240, 2880], lowest: [480, 4320] },
  l2: { highest: [30, 480], high: [60, 960], medium: [240, 2880], low: [480, 4320], lowest: [1440, 7200] },
  l3: { highest: [60, 1440], high: [120, 2880], medium: [480, 4320], low: [1440, 7200], lowest: [2880, 10080] },
};

export function defaultSlaPolicies(): SlaPolicy[] {
  return (Object.keys(SLA_DEFAULTS) as SupportLevel[]).flatMap((level) =>
    (Object.keys(SLA_DEFAULTS[level]) as Priority[]).map((priority) => ({
      id: `sla-${level}-${priority}`,
      level,
      priority,
      responseMinutes: SLA_DEFAULTS[level][priority][0],
      resolutionMinutes: SLA_DEFAULTS[level][priority][1],
    })),
  );
}

export function defaultSupportLevels(): SupportLevelConfig[] {
  return [
    { level: 'l1', name: 'Service desk', description: 'First contact: triage, known fixes, how-to questions' },
    { level: 'l2', name: 'Product support', description: 'Product team: configuration, data fixes, deeper analysis' },
    { level: 'l3', name: 'Engineering', description: 'Code changes, infrastructure, vendor escalations' },
  ];
}

const base = { labels: [], customFields: {} };

const baseIssues: Issue[] = [
  { ...base, id: 'i1', key: 'WEB-1', productId: 'p1', type: 'story', summary: 'New homepage layout', statusId: 'live', priority: 'high', assigneeId: 'u3', reporterId: 'u2', clientId: 'c1', storyPoints: 5, startAt: t(20, 9), endAt: t(15, 17), createdAt: t(22), updatedAt: t(15) },
  { ...base, id: 'i2', key: 'WEB-2', productId: 'p1', type: 'bug', summary: 'Login button misaligned on Safari', statusId: 'dev', customFields: { 'cf-env': 'Production' }, parentId: 'i1', priority: 'medium', assigneeId: 'u4', reporterId: 'u2', clientId: 'c1', storyPoints: 2, startAt: t(3, 11), createdAt: t(5), updatedAt: t(1) },
  { ...base, id: 'i3', key: 'WEB-3', productId: 'p1', type: 'task', summary: 'Set up analytics tracking', statusId: 'new', priority: 'low', reporterId: 'u1', clientId: 'c2', createdAt: t(2), updatedAt: t(2) },
  { ...base, id: 'i4', key: 'MOB-1', productId: 'p2', type: 'story', summary: 'Push notifications', statusId: 'testing', priority: 'high', assigneeId: 'u3', reporterId: 'u1', clientId: 'c2', storyPoints: 8, startAt: t(8, 10), createdAt: t(10), updatedAt: t(1) },
  { ...base, id: 'i5', key: 'MOB-2', productId: 'p2', type: 'bug', summary: 'Crash on Android 12 startup', statusId: 'closed', priority: 'highest', assigneeId: 'u4', reporterId: 'u1', clientId: 'c1', storyPoints: 3, startAt: t(6, 9), endAt: t(5, 18), createdAt: t(7), updatedAt: t(5) },
  { ...base, id: 'i6', key: 'ANL-1', productId: 'p3', type: 'request', summary: 'Monthly revenue export is empty', statusId: 'new', priority: 'high', reporterId: 'u3', clientId: 'c3', supportLevel: 'l1', createdAt: t(1), updatedAt: t(1) },
  { ...base, id: 'i7', key: 'ANL-2', productId: 'p3', type: 'support', summary: 'Client cannot log in to the dashboard', statusId: 'hold', priority: 'highest', assigneeId: 'u4', reporterId: 'u3', clientId: 'c2', labels: ['access'], supportLevel: 'l2', firstResponseAt: t(2, 11), createdAt: t(2), updatedAt: t(1) },
  { ...base, id: 'i8', key: 'WEB-4', productId: 'p1', type: 'support', summary: 'Password reset email not arriving', statusId: 'dev', priority: 'high', assigneeId: 'u13', reporterId: 'u12', supportLevel: 'l1', firstResponseAt: h(2.6), startAt: h(2.6), createdAt: h(3), updatedAt: h(2.6) },
  { ...base, id: 'i9', key: 'MOB-3', productId: 'p2', type: 'bug', summary: 'App crashes when uploading a photo', description: 'Happens on iPhone 13 with iOS 18 when the photo is larger than 10 MB.', statusId: 'new', priority: 'medium', reporterId: 'u11', clientId: 'c1', supportLevel: 'l1', createdAt: h(0.8), updatedAt: h(0.8) },
  { ...base, id: 'i10', key: 'WEB-5', productId: 'p1', type: 'support', summary: 'Invoice PDF shows the wrong VAT rate', statusId: 'closed', priority: 'medium', assigneeId: 'u4', reporterId: 'u11', clientId: 'c1', supportLevel: 'l2', firstResponseAt: h(95), startAt: h(95), endAt: h(74), progress: 100, createdAt: h(96), updatedAt: h(74) },
];

/** Demo escalations, shown in the ticket history */
const escalations: Activity[] = [
  { id: 'a-esc1', issueId: 'i7', productId: 'p3', userId: 'u13', action: 'escalated', from: 'L1', to: 'L2', createdAt: t(2, 12) },
  { id: 'a-esc2', issueId: 'i10', productId: 'p1', userId: 'u13', action: 'escalated', from: 'L1', to: 'L2', createdAt: h(93) },
];

/** Planning fields layered onto the demo tickets */
const planning: Record<string, Partial<Issue>> = {
  i1: { sprintId: 's0', startDate: t(20), dueDate: t(15), progress: 100, round: 1, estimatedBenefits: 'Higher sign-up conversion from the homepage', achievedBenefits: 'Sign-ups up 12% in the first two weeks' },
  i2: { sprintId: 's1', startDate: t(3), dueDate: t(-2), progress: 60, estimateMinutes: 480, round: 2, estimatedBenefits: 'Fewer failed logins on Safari (about 8% of sessions)' },
  i3: { sprintId: 's1', dueDate: t(-5), progress: 0, estimateMinutes: 240 },
  i4: { sprintId: 's3', startDate: t(8), dueDate: t(-1), progress: 80, estimateMinutes: 960, round: 1, estimatedBenefits: 'Re-engage inactive users' },
  i5: { sprintId: 's3', startDate: t(6), dueDate: t(5), progress: 100 },
  i6: { sprintId: 's5', dueDate: t(1), progress: 0 },
  i7: { sprintId: 's5', startDate: t(1), dueDate: t(-3), progress: 20 },
};
const issues: Issue[] = baseIssues.map((i) => ({ ...i, ...planning[i.id] }));

const roadmaps: Roadmap[] = [
  { id: 'r1', productId: 'p1', name: 'Web App 2026 revamp', description: 'New homepage, login fixes and analytics', startDate: t(28), dueDate: t(-21), status: 'in_progress', createdAt: t(30), achievedBenefits: 'Homepage redesign live; sign-ups up 12%' },
  { id: 'r2', productId: 'p2', name: 'Mobile v1 launch', description: 'First public release on iOS and Android', startDate: t(10), dueDate: t(-18), status: 'in_progress', createdAt: t(12) },
  { id: 'r3', productId: 'p3', name: 'Analytics stability', description: 'Fix export and access issues for enterprise clients', startDate: t(5), dueDate: t(-9), status: 'planned', createdAt: t(6) },
];

const sprints: Sprint[] = [
  { id: 's0', productId: 'p1', roadmapId: 'r1', name: 'WEB Sprint 11', goal: 'Homepage redesign', state: 'closed', startDate: t(28), endDate: t(14), committedPoints: 8, completedPoints: 5, completedAt: t(14) },
  { id: 's1', productId: 'p1', roadmapId: 'r1', name: 'WEB Sprint 12', goal: 'Login and analytics fixes', state: 'active', startDate: t(7), endDate: t(-7) },
  { id: 's2', productId: 'p1', roadmapId: 'r1', name: 'WEB Sprint 13', state: 'planned', startDate: t(-7), endDate: t(-21) },
  { id: 's3', productId: 'p2', roadmapId: 'r2', name: 'MOB Sprint 3', goal: 'Release candidate', state: 'active', startDate: t(10), endDate: t(-4) },
  { id: 's4', productId: 'p2', roadmapId: 'r2', name: 'MOB Sprint 4', state: 'planned', startDate: t(-4), endDate: t(-18) },
  { id: 's5', productId: 'p3', roadmapId: 'r3', name: 'ANL Sprint 8', state: 'active', startDate: t(5), endDate: t(-9) },
];

const workLogs: WorkLog[] = [
  { id: 'w1', issueId: 'i2', userId: 'u4', startedAt: t(3, 11), minutes: 180, activity: 'development', note: 'CSS fix for Safari flexbox' },
  { id: 'w2', issueId: 'i2', userId: 'u4', startedAt: t(2, 10), minutes: 60, activity: 'analysis' },
  { id: 'w3', issueId: 'i4', userId: 'u3', startedAt: t(1, 14), minutes: 120, activity: 'testing', note: 'Android + iOS smoke test' },
  { id: 'w4', issueId: 'i1', userId: 'u3', startedAt: t(18, 9), minutes: 240, activity: 'design' },
];

export function seedData(): DataState {
  return {
    currentUserId: 'u1',
    users: [
      { id: 'u1', name: 'Alex Morgan', email: 'alex@example.com', employeeId: 'EMP-001', role: 'admin', kind: 'internal', title: 'Head of delivery', color: '#f59a7e' },
      { id: 'u2', name: 'Priya Shah', email: 'priya@example.com', employeeId: 'EMP-002', role: 'division_head', kind: 'internal', title: 'Head of Digital Products', managerId: 'u1', color: '#7cb4f5' },
      { id: 'u5', name: 'Ravi Kumar', email: 'ravi@example.com', employeeId: 'EMP-005', role: 'division_head', kind: 'internal', title: 'Head of Enterprise Solutions', managerId: 'u1', color: '#b9a3f5' },
      { id: 'u6', name: 'Meera Iyer', email: 'meera@example.com', employeeId: 'EMP-006', role: 'assistant_manager', kind: 'internal', teamId: 't1', managerId: 'u2', color: '#f29bc4' },
      { id: 'u7', name: 'Tom Becker', email: 'tom@example.com', employeeId: 'EMP-007', role: 'assistant_manager', kind: 'internal', teamId: 't3', managerId: 'u5', color: '#8fd3d1' },
      { id: 'u8', name: 'Lena Fischer', email: 'lena@example.com', employeeId: 'EMP-008', role: 'business_analyst', kind: 'internal', teamId: 't1', managerId: 'u6', color: '#f5b971' },
      { id: 'u3', name: 'Sam Lee', email: 'sam@example.com', employeeId: 'EMP-003', role: 'tech_lead', kind: 'internal', teamId: 't1', managerId: 'u6', color: '#7ed98f' },
      { id: 'u4', name: 'Jordan Diaz', email: 'jordan@example.com', employeeId: 'EMP-004', role: 'developer', kind: 'internal', teamId: 't1', managerId: 'u3', color: '#f5c84a' },
      { id: 'u9', name: 'Chris Novak', email: 'chris@example.com', employeeId: 'EMP-009', role: 'tester', kind: 'internal', teamId: 't2', managerId: 'u6', color: '#a3c9f5' },
      { id: 'u10', name: 'Vikram Rao', email: 'vikram@nimbus.test', role: 'developer', kind: 'vendor', vendorId: 'v1', teamId: 't3', managerId: 'u7', title: 'Contract developer', color: '#d1b38f' },
      { id: 'u11', name: 'Dana White', email: 'dana@acme.test', role: 'production_user', kind: 'client', clientId: 'c1', title: 'IT manager, Acme', color: '#c7d98f' },
      { id: 'u12', name: 'Neha Gupta', email: 'neha@example.com', employeeId: 'EMP-012', role: 'production_user', kind: 'internal', title: 'Operations', color: '#e3a3a3' },
      { id: 'u13', name: 'Ana Costa', email: 'ana@example.com', employeeId: 'EMP-013', role: 'tester', kind: 'internal', teamId: 't4', managerId: 'u6', title: 'Support engineer', color: '#9fd8b4' },
    ],
    divisions: [
      { id: 'd1', name: 'Digital Products', description: 'Customer-facing web and mobile apps', headId: 'u2', color: '#7cb4f5' },
      { id: 'd2', name: 'Enterprise Solutions', description: 'Reporting and BI for enterprise clients', headId: 'u5', color: '#b9a3f5' },
    ],
    teams: [
      { id: 't1', divisionId: 'd1', name: 'Web & Mobile', managerId: 'u6' },
      { id: 't2', divisionId: 'd1', name: 'Quality Assurance', managerId: 'u6' },
      { id: 't3', divisionId: 'd2', name: 'Analytics', managerId: 'u7' },
      { id: 't4', divisionId: 'd1', name: 'Service Desk', description: 'First-line support for all products', managerId: 'u6' },
    ],
    vendors: [
      { id: 'v1', name: 'Nimbus Dev Labs', contactName: 'Arun Mehta', contactEmail: 'arun@nimbus.test', contactPhone: '+91 80 4000 1200', notes: 'Fixed-capacity contract: 2 developers' },
    ],
    products: [
      { id: 'p1', key: 'WEB', name: 'Web App', description: 'Customer-facing web application', version: '3.2', lifecycle: 'active', leadId: 'u2', divisionId: 'd1', memberIds: ['u6', 'u8', 'u3', 'u4', 'u9', 'u13'], clientIds: ['c1', 'c2'], workflowId: 'wf-default', color: '#f5c84a', githubUrl: 'https://github.com/example/web-app', websiteUrl: 'https://app.example.com', issueCounter: 6, createdAt: t(40) },
      { id: 'p2', key: 'MOB', name: 'Mobile App', description: 'iOS and Android apps', version: '1.0', lifecycle: 'planning', leadId: 'u6', divisionId: 'd1', memberIds: ['u3', 'u4', 'u9', 'u13'], clientIds: ['c1', 'c2'], workflowId: 'wf-default', color: '#f29bc4', githubUrl: 'https://github.com/example/mobile-app', issueCounter: 4, createdAt: t(25) },
      { id: 'p3', key: 'ANL', name: 'Analytics Suite', description: 'Reporting and BI module for enterprise clients', version: '5.8', lifecycle: 'maintenance', leadId: 'u7', divisionId: 'd2', memberIds: ['u10', 'u4', 'u3', 'u13'], clientIds: ['c2', 'c3'], workflowId: 'wf-default', color: '#7ed98f', issueCounter: 3, createdAt: t(12) },
    ],
    clients: [
      { id: 'c1', name: 'Acme Corp', contactName: 'Dana White', contactEmail: 'dana@acme.test', contactPhone: '+1 555 0100', notes: 'Key account. Escalate outages to Dana directly.' },
      { id: 'c2', name: 'Globex', contactName: 'Hank Scorpio', contactEmail: 'hank@globex.test', contactPhone: '+1 555 0142' },
      { id: 'c3', name: 'Initech', contactName: 'Bill L.', contactEmail: 'bill@initech.test' },
    ],
    workflows: [defaultWorkflow],
    issues,
    workLogs,
    timers: [],
    comments: [
      { id: 'cm1', issueId: 'i2', authorId: 'u2', body: 'Reproduced on Safari 17. Happens only on the login page.', createdAt: t(2, 15) },
      { id: 'cm2', issueId: 'i8', authorId: 'u13', body: 'Thanks Neha, checking the mail server logs now.', createdAt: h(2.6) },
    ],
    attachments: [],
    activities: [...escalations],
    roadmaps,
    sprints,
    customFields: [
      { id: 'cf-env', name: 'Environment', type: 'select', options: ['Production', 'Staging', 'Development'] },
      { id: 'cf-ref', name: 'Customer reference', type: 'text', productId: 'p3' },
    ],
    automations: defaultAutomations(new Date().toISOString(), 'u1'),
    automationLog: [],
    slaPolicies: defaultSlaPolicies(),
    supportLevels: [
      { ...defaultSupportLevels()[0]!, teamId: 't4' },
      { ...defaultSupportLevels()[1]!, teamId: 't1' },
      { ...defaultSupportLevels()[2]!, teamId: 't3' },
    ],
    summaryNotes: {},
  };
}
