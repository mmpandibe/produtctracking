import { TestBed } from '@angular/core/testing';
import { DataStore } from './core/data-store';
import { migrateV10, migrateV9 } from './core/migrate';
import { slaClock } from './core/sla';
import { barFor, packLanes, rangeAround, shiftIso, shiftRange, ticksFor } from './core/timeline';
import { can } from './core/roles';
import { seedData } from './core/seed';
import { ExternalStore } from './core/external-store';
import { matchScore, searchAll } from './core/search';
import { AUTOMATION_ID, allConditionsMatch, ruleProblem } from './core/automation';
import { homeFor } from './layout/nav';
import { diffState } from './core/state-diff';
import { contrastRatio, readableColor } from './shared/readable';

describe('DataStore', () => {
  beforeEach(() => localStorage.clear());

  it('loads demo data', () => {
    const store = TestBed.inject(DataStore);
    expect(store.products().length).toBe(3);
    expect(store.issues().every((i) => store.products().some((p) => p.id === i.productId))).toBe(true);
  });

  it('creates a product with an uppercase key', () => {
    const store = TestBed.inject(DataStore);
    const p = store.createProduct({
      name: ' Support Desk ', key: 'sd', version: ' 1.0 ', lifecycle: 'planning',
      leadId: 'u1', clientIds: ['c1'], color: '#000',
    });
    expect(p.key).toBe('SD');
    expect(p.name).toBe('Support Desk');
    expect(p.version).toBe('1.0');
    expect(store.products().some((x) => x.id === p.id)).toBe(true);
  });

  it('deletes a product together with its tickets', () => {
    const store = TestBed.inject(DataStore);
    store.deleteProduct('p1');
    expect(store.products().some((p) => p.id === 'p1')).toBe(false);
    expect(store.issues().some((i) => i.productId === 'p1')).toBe(false);
  });
});

describe('DataStore tickets', () => {
  beforeEach(() => localStorage.clear());

  it('creates a ticket keyed from its product and bumps the counter', () => {
    const store = TestBed.inject(DataStore);
    const before = store.products().find((p) => p.id === 'p1')!.issueCounter;
    const t = store.createIssue({ productId: 'p1', type: 'bug', summary: '  Broken link  ', priority: 'high' });
    expect(t.key).toBe(`WEB-${before}`);
    expect(t.summary).toBe('Broken link');
    expect(t.statusId).toBe('new'); // first workflow status
    expect(t.reporterId).toBe('u1'); // current user
    expect(store.products().find((p) => p.id === 'p1')!.issueCounter).toBe(before + 1);
    const next = store.createIssue({ productId: 'p1', type: 'task', summary: 'Next', priority: 'low' });
    expect(next.key).toBe(`WEB-${before + 1}`);
  });

  it('stamps start and end times when the status moves', () => {
    const store = TestBed.inject(DataStore);
    const t = store.createIssue({ productId: 'p2', type: 'task', summary: 'Ship it', priority: 'medium' });
    store.updateIssue(t.id, { statusId: 'dev' });
    const started = store.issues().find((i) => i.id === t.id)!;
    expect(started.startAt).toBeTruthy();
    expect(started.endAt).toBeUndefined();
    store.updateIssue(t.id, { statusId: 'live' });
    expect(store.issues().find((i) => i.id === t.id)!.endAt).toBeTruthy();
    store.updateIssue(t.id, { statusId: 'testing' }); // reopened
    expect(store.issues().find((i) => i.id === t.id)!.endAt).toBeUndefined();
  });

  it('deletes a ticket', () => {
    const store = TestBed.inject(DataStore);
    store.deleteIssue('i1');
    expect(store.issues().some((i) => i.id === 'i1')).toBe(false);
  });
});

describe('DataStore statuses, parents, comments, attachments', () => {
  beforeEach(() => localStorage.clear());

  it('has the delivery workflow statuses in order', () => {
    const store = TestBed.inject(DataStore);
    expect(store.workflowFor('p1').statuses.map((s) => s.name)).toEqual([
      'New', 'Development In Progress', 'Testing', 'Ready for UAT', 'UAT In Progress', 'Ready for QA',
      'QA In Progress', 'Ready for Live', 'Live', 'Hold', 'Closed',
    ]);
  });

  it('does not stamp a start time when a new ticket goes on Hold', () => {
    const store = TestBed.inject(DataStore);
    const t = store.createIssue({ productId: 'p1', type: 'support', summary: 'Waiting on client', priority: 'low' });
    store.updateIssue(t.id, { statusId: 'hold' });
    expect(store.issues().find((i) => i.id === t.id)!.startAt).toBeUndefined();
  });

  it('stores a parent and clears it when the parent is deleted', () => {
    const store = TestBed.inject(DataStore);
    const parent = store.createIssue({ productId: 'p1', type: 'epic', summary: 'Checkout v2', priority: 'high' });
    const child = store.createIssue({ productId: 'p1', type: 'task', summary: 'Card form', priority: 'medium', parentId: parent.id });
    const grandchild = store.createIssue({ productId: 'p1', type: 'task', summary: 'Validation', priority: 'low', parentId: child.id });
    // a ticket cannot become a child of its own descendant
    const options = store.parentCandidates('p1', parent.id).map((i) => i.id);
    expect(options).not.toContain(parent.id);
    expect(options).not.toContain(child.id);
    expect(options).not.toContain(grandchild.id);
    store.deleteIssue(parent.id);
    expect(store.issues().find((i) => i.id === child.id)!.parentId).toBeUndefined();
  });

  it('adds comments in order and ignores blank ones', () => {
    const store = TestBed.inject(DataStore);
    expect(store.addComment('i3', '   ')).toBeUndefined();
    store.addComment('i3', 'First remark');
    store.addComment('i3', 'Second remark');
    expect(store.commentsFor('i3').map((c) => c.body)).toEqual(['First remark', 'Second remark']);
    store.deleteIssue('i3');
    expect(store.commentsFor('i3').length).toBe(0);
  });

  it('rejects attachments over 10 MB', async () => {
    const store = TestBed.inject(DataStore);
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.bin');
    await expect(store.addAttachment('i3', big)).rejects.toThrow(/larger than 10 MB/);
    expect(store.attachmentsFor('i3').length).toBe(0);
  });
});

describe('DataStore sprints, time logs, timer, history', () => {
  beforeEach(() => localStorage.clear());

  it('lists a product\'s open sprints and keeps a closed one only when asked', () => {
    const store = TestBed.inject(DataStore);
    expect(store.sprintsFor('p1').map((s) => s.name)).toEqual(['WEB Sprint 13', 'WEB Sprint 12']);
    expect(store.sprintsFor('p1', 's0').some((s) => s.id === 's0')).toBe(true);
  });

  it('logs hours by hand with an activity and rejects bad amounts', () => {
    const store = TestBed.inject(DataStore);
    const before = store.loggedMinutes('i3');
    store.addWorkLog('i3', { date: new Date().toISOString(), minutes: 90, activity: 'analysis', note: ' scoping ' });
    expect(store.loggedMinutes('i3')).toBe(before + 90);
    const log = store.workLogsFor('i3')[0]!;
    expect(log.activity).toBe('analysis');
    expect(log.note).toBe('scoping');
    expect(() => store.addWorkLog('i3', { date: new Date().toISOString(), minutes: 0, activity: 'design' })).toThrow();
    expect(() => store.addWorkLog('i3', { date: new Date().toISOString(), minutes: 25 * 60, activity: 'design' })).toThrow();
  });

  it('start/stop timer logs at least one minute and stamps the start time', () => {
    const store = TestBed.inject(DataStore);
    store.startTimer('i3', 'development');
    expect(store.activeTimer()?.issueId).toBe('i3');
    expect(store.issues().find((i) => i.id === 'i3')!.startAt).toBeTruthy();
    const log = store.stopTimer()!;
    expect(log.minutes).toBeGreaterThanOrEqual(1);
    expect(log.fromTimer).toBe(true);
    expect(store.activeTimer()).toBeUndefined();
  });

  it('records which fields changed in the history', () => {
    const store = TestBed.inject(DataStore);
    store.updateIssue('i3', { priority: 'highest', sprintId: 's2', progress: 40 });
    const last = store.activitiesFor('i3')[0]!;
    expect(last.action).toBe('updated');
    expect(last.to).toBe('priority, sprint, progress');
  });
});

describe('DataStore board moves', () => {
  beforeEach(() => localStorage.clear());

  it('moves a ticket to another status between two neighbours', () => {
    const store = TestBed.inject(DataStore);
    const i3 = store.issues().find((i) => i.id === 'i3')!; // WEB-3, New
    const a = store.issues().find((i) => i.id === 'i1')!;
    const b = store.issues().find((i) => i.id === 'i5')!;
    expect(store.moveIssue('i3', 'testing', a, b)).toBe(true);
    const moved = store.issues().find((i) => i.id === 'i3')!;
    expect(moved.statusId).toBe('testing');
    const r = store.rankOf(moved);
    const [lo, hi] = [store.rankOf(a), store.rankOf(b)].sort((x, y) => x - y);
    expect(r).toBeGreaterThan(lo);
    expect(r).toBeLessThan(hi);
    expect(moved.startAt).toBeTruthy(); // moved into an in-progress status
    expect(store.activitiesFor('i3')[0]!.action).toBe('changed status');
    expect(i3.statusId).toBe('new');
  });

  it('reorders within a column without a history entry', () => {
    const store = TestBed.inject(DataStore);
    const before = store.activitiesFor('i6').length;
    const top = store.issues().find((i) => i.id === 'i3')!;
    expect(store.moveIssue('i6', 'new', undefined, top)).toBe(true);
    expect(store.rankOf(store.issues().find((i) => i.id === 'i6')!)).toBeLessThan(store.rankOf(top));
    expect(store.activitiesFor('i6').length).toBe(before);
  });

  it('refuses moves the workflow does not allow', () => {
    const store = TestBed.inject(DataStore);
    // Simulate a rule: from New you may only go to Development In Progress
    (store as unknown as { state: { update: (fn: (s: never) => unknown) => void } }).state.update((s: never) => {
      const st = s as { workflows: { transitions: Record<string, string[]> }[] };
      return { ...st, workflows: st.workflows.map((w) => ({ ...w, transitions: { new: ['dev'] } })) } as never;
    });
    expect(store.canTransition('p1', 'new', 'live')).toBe(false);
    expect(store.moveIssue('i3', 'live')).toBe(false);
    expect(store.issues().find((i) => i.id === 'i3')!.statusId).toBe('new');
    expect(store.moveIssue('i3', 'dev')).toBe(true);
  });
});

describe('DataStore sprint lifecycle', () => {
  beforeEach(() => localStorage.clear());

  it('suggests the next sprint name and creates a planned sprint', () => {
    const store = TestBed.inject(DataStore);
    expect(store.nextSprintName('p1')).toBe('WEB Sprint 14');
    const sp = store.createSprint('p1', { name: ' WEB Sprint 14 ', goal: ' Payments ' });
    expect(sp.state).toBe('planned');
    expect(sp.name).toBe('WEB Sprint 14');
    expect(sp.goal).toBe('Payments');
  });

  it('allows only one active sprint per product and records committed points', () => {
    const store = TestBed.inject(DataStore);
    expect(store.startSprint('s2')).toBe(false); // WEB Sprint 12 is already active
    store.updateIssue('i3', { storyPoints: 5 });
    store.completeSprint('s1');
    store.moveToSprint('i3', 's2');
    expect(store.startSprint('s2')).toBe(true);
    const s2 = store.sprintById('s2')!;
    expect(s2.state).toBe('active');
    expect(s2.committedPoints).toBe(5);
    expect(s2.endDate).toBeTruthy();
  });

  it('completing a sprint keeps done tickets and moves unfinished ones', () => {
    const store = TestBed.inject(DataStore);
    store.updateIssue('i3', { storyPoints: 3 });
    store.updateIssue('i2', { statusId: 'live', storyPoints: 2 }); // finished
    const moved = store.completeSprint('s1', 's2');
    expect(moved).toBe(1);
    expect(store.issues().find((i) => i.id === 'i3')!.sprintId).toBe('s2');
    expect(store.issues().find((i) => i.id === 'i2')!.sprintId).toBe('s1');
    const s1 = store.sprintById('s1')!;
    expect(s1.state).toBe('closed');
    expect(s1.completedPoints).toBe(2);
  });

  it('velocity averages completed points of closed sprints', () => {
    const store = TestBed.inject(DataStore);
    expect(store.velocity('p1')).toBe(5); // seeded WEB Sprint 11
    store.updateIssue('i2', { statusId: 'closed', storyPoints: 3 });
    store.completeSprint('s1');
    expect(store.velocity('p1')).toBe(4); // (5 + 3) / 2
  });

  it('deleting a planned sprint returns its tickets to the backlog', () => {
    const store = TestBed.inject(DataStore);
    store.moveToSprint('i3', 's2');
    expect(store.deleteSprint('s1')).toBe(false); // active sprints can't be deleted
    expect(store.deleteSprint('s2')).toBe(true);
    expect(store.issues().find((i) => i.id === 'i3')!.sprintId).toBeUndefined();
  });

  it('sprint stats count tickets, points and unestimated ones', () => {
    const store = TestBed.inject(DataStore);
    const st = store.sprintStats('p2', 's3'); // MOB-1 (8 pts, testing) + MOB-2 (3 pts, closed)
    expect(st).toEqual({ total: 2, done: 1, points: 11, donePoints: 3, unestimated: 0 });
  });
});

describe('Time tracking helpers', () => {
  beforeEach(() => localStorage.clear());

  it('logs time for another team member when asked', () => {
    const store = TestBed.inject(DataStore);
    const log = store.addWorkLog('i3', { date: new Date().toISOString(), minutes: 30, activity: 'testing' }, false, 'u3');
    expect(log.userId).toBe('u3');
  });

  it('returns work logs in a date range, optionally for one person', () => {
    const store = TestBed.inject(DataStore);
    const from = new Date(Date.now() - 4 * 86400000);
    const to = new Date(Date.now() + 86400000);
    const all = store.workLogsBetween(from, to);
    expect(all.map((w) => w.id).sort()).toEqual(['w1', 'w2', 'w3']); // w4 is 18 days old
    expect(store.workLogsBetween(from, to, 'u4').map((w) => w.id).sort()).toEqual(['w1', 'w2']);
  });
});

describe('Week helpers', () => {
  it('finds Monday and builds local day keys', async () => {
    const { startOfWeek, addDays, dayKey } = await import('./core/utils');
    const wed = new Date(2026, 10, 25, 15, 30); // Wed 25 Nov 2026
    const mon = startOfWeek(wed);
    expect(dayKey(mon)).toBe('2026-11-23');
    expect(dayKey(addDays(mon, 6))).toBe('2026-11-29');
    expect(dayKey(startOfWeek(new Date(2026, 10, 29)))).toBe('2026-11-23'); // Sunday belongs to the same week
  });
});

describe('Clients and SLA policies', () => {
  beforeEach(() => localStorage.clear());

  it('creates a client and links it to products', () => {
    const store = TestBed.inject(DataStore);
    const c = store.createClient({ name: ' Umbrella ', contactEmail: ' ops@umbrella.test ' }, ['p1', 'p3']);
    expect(c.name).toBe('Umbrella');
    expect(c.contactEmail).toBe('ops@umbrella.test');
    expect(store.clientProducts(c.id).map((p) => p.id).sort()).toEqual(['p1', 'p3']);
    store.updateClient(c.id, { name: 'Umbrella Inc' }, ['p2']);
    expect(store.clientProducts(c.id).map((p) => p.id)).toEqual(['p2']);
    expect(store.clients().find((x) => x.id === c.id)!.name).toBe('Umbrella Inc');
  });

  it('deleting a client unlinks its tickets and products', () => {
    const store = TestBed.inject(DataStore);
    store.deleteClient('c1');
    expect(store.issues().some((i) => i.clientId === 'c1')).toBe(false);
    expect(store.products().some((p) => p.clientIds.includes('c1'))).toBe(false);
  });

  it('has an SLA target for every support level and priority, editable with validation', () => {
    const store = TestBed.inject(DataStore);
    expect(store.slaPolicies().length).toBe(15);
    expect(store.slaFor('l1', 'highest')).toMatchObject({ responseMinutes: 15, resolutionMinutes: 240 });
    store.setSlaPolicy('l3', 'low', 120, 600);
    expect(store.slaFor('l3', 'low')).toMatchObject({ responseMinutes: 120, resolutionMinutes: 600 });
    expect(() => store.setSlaPolicy('l3', 'low', 700, 600)).toThrow();
    expect(() => store.setSlaPolicy('l3', 'low', 0, 600)).toThrow();
    store.resetSlaPolicies();
    expect(store.slaFor('l3', 'low')).toMatchObject({ responseMinutes: 1440, resolutionMinutes: 7200 });
  });
});

describe('Report calculations', () => {
  const base = { labels: [], customFields: {}, productId: 'p1', type: 'task' as const, statusId: 'new', priority: 'medium' as const, reporterId: 'u1' };
  const issue = (over: Record<string, unknown>) => ({ id: 'x', key: 'X-1', summary: 's', createdAt: '2026-11-02T10:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z', ...base, ...over }) as never;

  it('computes cycle and lead time in days', async () => {
    const { cycleDays, leadDays } = await import('./core/reports');
    const i = issue({ startAt: '2026-11-03T10:00:00.000Z', endAt: '2026-11-05T10:00:00.000Z' });
    expect(cycleDays(i)).toBe(2);
    expect(leadDays(i)).toBe(3);
    expect(cycleDays(issue({}))).toBeUndefined();
  });

  it('average, median and histogram buckets', async () => {
    const { average, median, cycleHistogram } = await import('./core/reports');
    expect(average([1, 2, 6])).toBe(3);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(average([])).toBeUndefined();
    expect(cycleHistogram([0.5, 2, 2.5, 10, 30])).toEqual([1, 2, 0, 1, 1]);
  });

  it('builds a burndown: ideal line to zero, actual drops when tickets finish', async () => {
    const { burndown } = await import('./core/reports');
    const sprint = { id: 's', productId: 'p1', name: 'S', state: 'active' as const, startDate: '2026-11-02T00:00:00', endDate: '2026-11-05T23:00:00' };
    const a = issue({ id: 'a', storyPoints: 3, endAt: '2026-11-03T12:00:00' });
    const b = issue({ id: 'b', storyPoints: 5 });
    const r = burndown(sprint, [a, b], (i: { id: string }) => i.id === 'a', new Date('2026-11-04T09:00:00'));
    expect(r.total).toBe(8);
    expect(r.days.length).toBe(4);
    expect(r.ideal[0]).toBe(8);
    expect(r.ideal[3]).toBe(0);
    expect(r.actual).toEqual([8, 5, 5, null]); // a finished on day 2; day 4 is in the future
  });

  it('weekly created vs resolved trend', async () => {
    const { weeklyTrend } = await import('./core/reports');
    const p = { from: new Date('2026-11-02T00:00:00'), to: new Date('2026-11-16T00:00:00') };
    const r = weeklyTrend([issue({ createdAt: '2026-11-03T10:00:00', endAt: '2026-11-10T10:00:00' }), issue({ createdAt: '2026-11-11T10:00:00' })], p);
    expect(r.weeks.length).toBe(2);
    expect(r.created).toEqual([1, 1]);
    expect(r.resolved).toEqual([0, 1]);
  });

  it('writes CSV with quoting', async () => {
    const { toCsv } = await import('./core/reports');
    expect(toCsv([['Name', 'Note'], ['Acme', 'a, "b"']])).toBe('Name,Note\nAcme,"a, ""b"""');
  });
});

describe('Month-wise hours matrix', () => {
  it('sums minutes per person and client in a month, with totals and shares', async () => {
    const { hoursMatrix, monthRange, monthKey, NO_CLIENT, pct } = await import('./core/reports');
    const log = (userId: string, issueId: string, iso: string, minutes: number) => ({ id: iso + userId, issueId, userId, startedAt: iso, minutes, activity: 'development' as const });
    const clients: Record<string, string | undefined> = { a: 'acme', b: 'globex', c: undefined };
    const p = monthRange('2026-11');
    expect(monthKey(new Date(2026, 10, 15))).toBe('2026-11');
    const m = hoursMatrix(
      [
        log('u1', 'a', '2026-11-03T12:00:00', 120),
        log('u1', 'b', '2026-11-04T12:00:00', 60),
        log('u1', 'c', '2026-11-05T12:00:00', 60),
        log('u2', 'a', '2026-11-06T12:00:00', 240),
        log('u1', 'a', '2026-10-31T12:00:00', 999), // previous month: ignored
      ],
      (id) => clients[id],
      p,
    );
    expect(m.cell('u1', 'acme')).toBe(120);
    expect(m.cell('u1', NO_CLIENT)).toBe(60);
    expect(m.rowTotal('u1')).toBe(240);
    expect(m.colTotal('acme')).toBe(360);
    expect(m.grand).toBe(480);
    expect(pct(m.cell('u1', 'acme'), m.rowTotal('u1'))).toBe(50);
    expect(pct(0, 0)).toBe(0);
  });
});

describe('CXO period summary', () => {
  const base = { labels: [], customFields: {}, productId: 'p1', type: 'task' as const, statusId: 'new', priority: 'medium' as const, reporterId: 'u1', key: 'K', summary: 's', updatedAt: '2026-11-01T00:00:00' };
  const issue = (id: string, over: Record<string, unknown>) => ({ id, createdAt: '2026-11-01T10:00:00', ...base, ...over }) as never;

  it('counts created, resolved, open at period end, overdue and hours', async () => {
    const { periodSummary, changePct } = await import('./core/reports');
    const p = { from: new Date('2026-11-09T00:00:00'), to: new Date('2026-11-16T00:00:00') };
    const issues = [
      issue('a', { createdAt: '2026-11-10T10:00:00', startAt: '2026-11-10T10:00:00', endAt: '2026-11-12T10:00:00', storyPoints: 3 }), // created + resolved in week
      issue('b', { createdAt: '2026-11-02T10:00:00', dueDate: '2026-11-11T00:00:00' }), // open, overdue
      issue('c', { createdAt: '2026-11-20T10:00:00' }), // created after the week: not counted
    ];
    const done = (i: { id: string }) => i.id === 'a';
    const logs = [{ id: 'w', issueId: 'b', userId: 'u1', startedAt: '2026-11-11T12:00:00', minutes: 90, activity: 'testing' as const }];
    const s = periodSummary(issues, logs, p, done);
    expect(s).toMatchObject({ created: 1, resolved: 1, open: 1, overdue: 1, minutes: 90, resolvedPoints: 3 });
    expect(s.avgCycleDays).toBe(2);
    expect(changePct(6, 4)).toBe(50);
    expect(changePct(2, 0)).toBeUndefined();
    expect(changePct(0, 0)).toBe(0);
  });

  it('stores commentary per period and clears it when emptied', () => {
    localStorage.clear();
    const store = TestBed.inject(DataStore);
    store.setSummaryNote('week:2026-11-23', 'Release slipped one day.');
    expect(store.summaryNote('week:2026-11-23')).toBe('Release slipped one day.');
    store.setSummaryNote('week:2026-11-23', '   ');
    expect(store.summaryNote('week:2026-11-23')).toBe('');
  });
});

describe('Roadmaps, ticket benefits, product links', () => {
  beforeEach(() => localStorage.clear());

  it('creates a roadmap with sprints and computes progress from story points', () => {
    const store = TestBed.inject(DataStore);
    const r = store.createRoadmap('p2', { name: ' Mobile v2 ', status: 'planned' }, ['s3']);
    expect(r.name).toBe('Mobile v2');
    expect(store.sprints().find((s) => s.id === 's3')!.roadmapId).toBe(r.id);
    // MOB-1 (8 pts, testing) + MOB-2 (3 pts, closed) => 3/11 = 27%
    expect(store.roadmapProgress(r.id)).toMatchObject({ sprints: 1, tickets: 2, points: 11, donePoints: 3, pct: 27 });
  });

  it('stamps the completed date when a roadmap is completed and clears it when reopened', () => {
    const store = TestBed.inject(DataStore);
    store.updateRoadmap('r3', { name: 'Analytics stability', status: 'completed', achievedBenefits: 'Exports fixed' });
    const done = store.roadmaps().find((r) => r.id === 'r3')!;
    expect(done.completedAt).toBeTruthy();
    expect(done.achievedBenefits).toBe('Exports fixed');
    store.updateRoadmap('r3', { name: 'Analytics stability', status: 'in_progress' });
    expect(store.roadmaps().find((r) => r.id === 'r3')!.completedAt).toBeUndefined();
  });

  it('deleting a roadmap keeps its sprints', () => {
    const store = TestBed.inject(DataStore);
    store.deleteRoadmap('r1');
    expect(store.sprints().find((s) => s.id === 's1')!.roadmapId).toBeUndefined();
    expect(store.sprints().some((s) => s.id === 's1')).toBe(true);
  });

  it('saves ticket benefits and round, and product links', () => {
    const store = TestBed.inject(DataStore);
    const t = store.createIssue({ productId: 'p1', type: 'story', summary: 'Faster checkout', priority: 'high', round: 2, estimatedBenefits: ' Higher conversion ' });
    expect(t.round).toBe(2);
    expect(t.estimatedBenefits).toBe('Higher conversion');
    const p = store.createProduct({ name: 'Docs', key: 'DOC', lifecycle: 'active', leadId: 'u1', clientIds: [], color: '#000', githubUrl: 'https://github.com/x/docs', websiteUrl: ' https://docs.example.com ' });
    expect(p.githubUrl).toBe('https://github.com/x/docs');
    expect(p.websiteUrl).toBe('https://docs.example.com');
  });
});

describe('Workflows & custom fields (Step 10)', () => {
  beforeEach(() => localStorage.clear());

  it('edits, adds and reorders statuses', () => {
    const store = TestBed.inject(DataStore);
    store.updateStatus('wf-default', 'testing', { name: '  QA Testing ', color: '#000000', category: 'hold' });
    expect(store.workflowFor('p1').statuses.find((s) => s.id === 'testing')).toMatchObject({ name: 'QA Testing', color: '#000000', category: 'hold' });
    store.updateStatus('wf-default', 'testing', { name: '   ' }); // blank names are ignored
    expect(store.workflowFor('p1').statuses.find((s) => s.id === 'testing')!.name).toBe('QA Testing');
    const st = store.addStatus('wf-default', { name: 'Code review', category: 'in_progress', color: '#123456' });
    expect(store.workflowFor('p1').statuses.at(-1)!.id).toBe(st.id);
    store.moveStatus('wf-default', store.workflowFor('p1').statuses.length - 1, 1);
    expect(store.workflowFor('p1').statuses[1]!.id).toBe(st.id);
  });

  it('deletes a status, moving its tickets to the replacement', () => {
    const store = TestBed.inject(DataStore);
    expect(store.statusUsage('wf-default', 'new')).toBe(3); // WEB-3, ANL-1, MOB-3
    expect(() => store.deleteStatus('wf-default', 'new')).toThrow();
    const moved = store.deleteStatus('wf-default', 'new', 'dev');
    expect(moved).toBe(3);
    expect(store.workflowFor('p1').statuses.some((s) => s.id === 'new')).toBe(false);
    expect(store.issues().find((i) => i.id === 'i3')!.statusId).toBe('dev');
    expect(store.activitiesFor('i3')[0]).toMatchObject({ action: 'changed status', from: 'New', to: 'Development In Progress' });
    // An unused status needs no replacement
    expect(store.deleteStatus('wf-default', 'ready_uat')).toBe(0);
  });

  it('restricts transitions with a matrix and exposes allowed statuses', () => {
    const store = TestBed.inject(DataStore);
    const issue = () => store.issues().find((i) => i.id === 'i3')!; // in New
    expect(store.allowedStatuses(issue()).length).toBe(11); // rules off
    store.setRestricted('wf-default', true);
    expect(store.allowedStatuses(issue()).length).toBe(11); // on, everything allowed to start with
    store.setTransition('wf-default', 'new', 'live', false);
    expect(store.canTransition('p1', 'new', 'live')).toBe(false);
    expect(store.allowedStatuses(issue()).some((s) => s.id === 'live')).toBe(false);
    store.setAllTransitions('wf-default', false);
    expect(store.allowedStatuses(issue()).map((s) => s.id)).toEqual(['new']); // only stay where it is
    expect(store.moveIssue('i3', 'dev')).toBe(false);
    store.setTransition('wf-default', 'new', 'dev', true);
    expect(store.moveIssue('i3', 'dev')).toBe(true);
    store.setRestricted('wf-default', false);
    expect(store.workflowById('wf-default')!.transitions).toEqual({});
  });

  it('copies a workflow and assigns it to a product, mapping statuses by category', () => {
    const store = TestBed.inject(DataStore);
    const wf = store.createWorkflow('Support flow', 'wf-default');
    expect(wf.statuses.length).toBe(11);
    // Remove "Testing" from the copy: MOB-1 (Testing, in progress) maps to the first in-progress status
    store.deleteStatus(wf.id, 'testing');
    expect(store.assignWorkflow('p2', wf.id)).toBe(1);
    expect(store.products().find((p) => p.id === 'p2')!.workflowId).toBe(wf.id);
    expect(store.issues().find((i) => i.id === 'i4')!.statusId).toBe('dev');
    expect(store.issues().find((i) => i.id === 'i5')!.statusId).toBe('closed'); // kept
    expect(store.deleteWorkflow(wf.id)).toBe(false); // in use
    store.assignWorkflow('p2', 'wf-default');
    expect(store.deleteWorkflow(wf.id)).toBe(true);
    expect(store.deleteWorkflow('wf-default')).toBe(false); // last one
  });

  it('manages custom fields and their ticket values', () => {
    const store = TestBed.inject(DataStore);
    expect(() => store.createCustomField({ name: 'Browser', type: 'select', options: [' ', ''] })).toThrow();
    const f = store.createCustomField({ name: ' Browser ', type: 'select', options: ['Chrome', ' Safari ', 'Chrome'], required: true, productId: 'p1' });
    expect(f).toMatchObject({ name: 'Browser', options: ['Chrome', 'Safari'], required: true, productId: 'p1' });
    expect(store.customFieldsFor('p1').map((x) => x.id)).toContain(f.id);
    expect(store.customFieldsFor('p2').map((x) => x.id)).not.toContain(f.id);
    const t = store.createIssue({ productId: 'p1', type: 'bug', summary: 'X', priority: 'low', customFields: { [f.id]: 'Safari', 'cf-env': '' } });
    expect(t.customFields).toEqual({ [f.id]: 'Safari' }); // empty values dropped
    store.updateIssue(t.id, { customFields: { [f.id]: 'Chrome' } });
    expect(store.activitiesFor(t.id).some((a) => a.action === 'updated' && a.to === 'custom fields')).toBe(true);
    expect(store.customFieldUsage(f.id)).toBe(1);
    store.deleteCustomField(f.id);
    expect(store.issues().find((i) => i.id === t.id)!.customFields).toEqual({});
  });
});

describe('Organisation (Step 11)', () => {
  beforeEach(() => localStorage.clear());

  it('builds divisions → teams → people from the demo data', () => {
    const store = TestBed.inject(DataStore);
    expect(store.divisions().length).toBe(2);
    expect(store.teamsOf('d1').map((t) => t.id)).toEqual(['t1', 't2', 't4']);
    expect(store.userDivision('u4')?.id).toBe('d1');
    expect(store.userDivision('u2')?.id).toBe('d1'); // division head, not in a team
    expect(store.divisionMembers('d2').map((u) => u.id).sort()).toEqual(['u10', 'u5', 'u7']);
    // Meera's reports, direct and indirect (Jordan reports to Sam)
    expect(store.reportsOf('u6').map((u) => u.id).sort()).toEqual(['u13', 'u3', 'u4', 'u8', 'u9']);
    expect(store.userProducts('u10').map((p) => p.key)).toEqual(['ANL']);
  });

  it('validates people: unique email, vendor/client company, no reporting loops; client users are production users', () => {
    const store = TestBed.inject(DataStore);
    expect(() => store.createUser({ name: 'X', email: 'SAM@example.com', kind: 'internal', role: 'developer' })).toThrow(/email/);
    expect(() => store.createUser({ name: 'X', email: 'x@v.test', kind: 'vendor', role: 'developer' })).toThrow(/vendor/);
    const c = store.createUser({ name: ' Kim ', email: 'Kim@Acme.test', kind: 'client', role: 'tech_lead', clientId: 'c1', teamId: 't1' });
    expect(c).toMatchObject({ name: 'Kim', email: 'kim@acme.test', role: 'production_user', teamId: undefined, clientId: 'c1' });
    expect(store.clientUsers('c1').map((u) => u.id)).toContain(c.id);
    // Meera (u6) can't report to Jordan, who reports to her through Sam
    expect(() => store.updateUser('u6', { name: 'Meera Iyer', email: 'meera@example.com', employeeId: 'EMP-006', kind: 'internal', role: 'assistant_manager', managerId: 'u4' })).toThrow(/report/);
  });

  it('adds people to teams, deletes teams and guards division / vendor deletes', () => {
    const store = TestBed.inject(DataStore);
    const t = store.createTeam({ name: 'Platform', divisionId: 'd2', managerId: 'u7' });
    expect(() => store.createTeam({ name: 'platform', divisionId: 'd2' })).toThrow(/already/);
    const p = store.createUser({ name: 'New Dev', email: 'new@example.com', employeeId: 'EMP-100', kind: 'internal', role: 'developer' });
    store.addTeamMembers(t.id, [p.id]);
    expect(store.userById(p.id)).toMatchObject({ teamId: t.id, managerId: 'u7' });
    store.deleteTeam(t.id);
    expect(store.userById(p.id)!.teamId).toBeUndefined();
    expect(() => store.deleteDivision('d2')).toThrow(/first/);
    expect(() => store.deleteVendor('v1')).toThrow(/staff/);
    const d = store.createDivision({ name: 'Research', color: '#000' });
    store.deleteDivision(d.id);
    expect(store.divisionById(d.id)).toBeUndefined();
  });

  it('only deletes people without history; others are deactivated', () => {
    const store = TestBed.inject(DataStore);
    expect(() => store.deleteUser('u4')).toThrow(/deactivate/);
    expect(() => store.setUserActive('u1', false)).toThrow(/yourself/);
    store.setUserActive('u4', false);
    expect(store.activeUsers().some((u) => u.id === 'u4')).toBe(false);
    const p = store.createUser({ name: 'Temp', email: 'temp@example.com', employeeId: 'EMP-101', kind: 'internal', role: 'tester', managerId: 'u6' });
    store.setUserProducts(p.id, ['p1', 'p2']);
    expect(store.userProducts(p.id).length).toBe(2);
    store.deleteUser(p.id);
    expect(store.products().some((x) => x.memberIds.includes(p.id))).toBe(false);
  });

  it('upgrades storage v9 data: new roles, a starter division and product members', () => {
    const old = seedData();
    old.users = [
      { id: 'u1', name: 'A', email: 'a@x.test', role: 'admin' as never, color: '#000' } as never,
      { id: 'u2', name: 'B', email: 'b@x.test', role: 'manager' as never, color: '#000' } as never,
      { id: 'u4', name: 'D', email: 'd@x.test', role: 'member' as never, color: '#000' } as never,
    ];
    old.products = old.products.map((p) => ({ ...p, divisionId: undefined, memberIds: undefined as never }));
    const s = migrateV9({ ...old, divisions: undefined as never, teams: undefined as never });
    expect(s.users.map((u) => u.role)).toEqual(['admin', 'assistant_manager', 'developer']);
    expect(s.users.every((u) => u.kind === 'internal')).toBe(true);
    expect(s.teams[0]!.managerId).toBe('u2');
    expect(s.users.find((u) => u.id === 'u4')).toMatchObject({ teamId: 't-migrated', managerId: 'u2' });
    expect(s.products.every((p) => p.divisionId === 'd-migrated')).toBe(true);
    expect(s.products.find((p) => p.id === 'p1')!.memberIds).toContain('u4');
    expect(can('tech_lead', 'roadmaps')).toBe(false);
    expect(can('business_analyst', 'roadmaps')).toBe(true);
  });
});

describe('Roles & access (Step 12)', () => {
  beforeEach(() => localStorage.clear());
  const keys = (store: DataStore) => store.products().map((p) => p.key).sort();

  it('scopes products, people and tickets by role', () => {
    const store = TestBed.inject(DataStore);
    expect(keys(store)).toEqual(['ANL', 'MOB', 'WEB']); // admin
    store.switchUser('u5'); // Ravi, head of Enterprise Solutions
    expect(keys(store)).toEqual(['ANL']);
    expect(store.users().some((u) => u.id === 'u7')).toBe(true);
    expect(store.users().some((u) => u.id === 'u8')).toBe(false); // Lena works in the other division
    expect(store.issues().every((i) => i.productId === 'p3')).toBe(true);
    store.switchUser('u10'); // vendor developer: only assigned products
    expect(keys(store)).toEqual(['ANL']);
    store.switchUser('u6'); // Meera, assistant manager: her products + her reports
    expect(keys(store)).toEqual(['MOB', 'WEB']);
    expect(store.users().map((u) => u.id)).toEqual(expect.arrayContaining(['u3', 'u4', 'u8', 'u9']));
  });

  it('production users see only tickets they raised or their client raised', () => {
    const store = TestBed.inject(DataStore);
    store.switchUser('u11'); // Dana, Acme (c1) client user
    expect(keys(store)).toEqual(['MOB', 'WEB']); // products Acme uses
    expect(store.issues().every((i) => i.clientId === 'c1' || i.reporterId === 'u11')).toBe(true);
    expect(store.users().map((u) => u.id)).toEqual(['u11']);
    expect(store.clients().map((c) => c.id)).toEqual(['c1']);
    expect(store.userById('u4')?.name).toBe('Jordan Diaz'); // names on her tickets still resolve
    store.switchUser('u12'); // internal production user without products
    expect(store.issues()).toEqual([]);
  });

  it('checks capabilities per product', () => {
    const store = TestBed.inject(DataStore);
    store.switchUser('u3'); // tech lead
    expect(store.canDo('sprints', 'p1')).toBe(true);
    expect(store.canDo('roadmaps', 'p1')).toBe(false);
    store.switchUser('u8'); // business analyst on WEB only
    expect(store.canDo('roadmaps', 'p1')).toBe(true);
    expect(store.canDo('roadmaps', 'p3')).toBe(false);
    const i2 = store.issues().find((i) => i.id === 'i2')!;
    expect(store.canEditIssue(i2)).toBe(true);
    expect(store.canDeleteIssue(i2)).toBe(false);
    store.switchUser('u2'); // division head of Digital Products
    expect(store.canRemoveProduct('p1')).toBe(true);
    expect(store.canRemoveProduct('p3')).toBe(false);
    store.switchUser('u11');
    expect(store.canEditIssue(i2)).toBe(false);
    expect(store.canDo('tickets', 'p1')).toBe(true);
  });

  it('developers only see their own time; inactive people cannot be signed in as', () => {
    const store = TestBed.inject(DataStore);
    store.switchUser('u3');
    expect(store.workLogs().every((w) => w.userId === 'u3')).toBe(false); // tech lead sees the team's time
    store.switchUser('u4');
    expect(store.workLogs().length).toBeGreaterThan(0);
    expect(store.workLogs().every((w) => w.userId === 'u4')).toBe(true);
    store.switchUser('u1');
    store.setUserActive('u9', false);
    expect(() => store.switchUser('u9')).toThrow();
  });
});

describe('Support desk & SLA (Step 13)', () => {
  beforeEach(() => localStorage.clear());

  it('runs SLA clocks: running, at risk, breached, met', () => {
    const t0 = '2026-11-26T10:00:00.000Z';
    const at = (min: number) => Date.parse(t0) + min * 60_000;
    expect(slaClock(t0, 60, undefined, at(10)).state).toBe('running');
    expect(slaClock(t0, 60, undefined, at(50))).toMatchObject({ state: 'at_risk', leftMinutes: 10 });
    expect(slaClock(t0, 60, undefined, at(90))).toMatchObject({ state: 'breached', leftMinutes: -30 });
    expect(slaClock(t0, 60, new Date(at(25)).toISOString(), at(500))).toMatchObject({ state: 'met', takenMinutes: 25 });
    expect(slaClock(t0, 60, new Date(at(75)).toISOString(), at(500)).state).toBe('breached');
  });

  it('puts support tickets on L1 and stops the response clock on the first staff reply', () => {
    const store = TestBed.inject(DataStore);
    const t = store.createIssue({ productId: 'p1', type: 'support', summary: 'VPN down', priority: 'high' });
    expect(t.supportLevel).toBe('l1');
    expect(store.createIssue({ productId: 'p1', type: 'task', summary: 'Refactor', priority: 'low' }).supportLevel).toBeUndefined();
    expect(store.createIssue({ productId: 'p1', type: 'task', summary: 'Plain', priority: 'low', supportLevel: null }).supportLevel).toBeUndefined();
    store.switchUser('u11'); // a production user's own bug report is a support ticket too
    expect(store.createIssue({ productId: 'p1', type: 'bug', summary: 'Broken', priority: 'medium' }).supportLevel).toBe('l1');
    store.switchUser('u13');
    expect(store.slaOf(store.issues().find((i) => i.id === t.id)!)!.response.state).toBe('running');
    store.addComment(t.id, 'Looking into it');
    const after = store.issues().find((i) => i.id === t.id)!;
    expect(after.firstResponseAt).toBeDefined();
    expect(store.slaOf(after)!.response.state).toBe('met');
  });

  it('escalates L1 → L2 → L3 into the next queue, with history and a comment', () => {
    const store = TestBed.inject(DataStore);
    expect(store.escalate('i9', 'Needs the mobile team')).toBe('l2');
    const i9 = store.issues().find((i) => i.id === 'i9')!;
    expect(i9).toMatchObject({ supportLevel: 'l2', assigneeId: undefined });
    expect(store.commentsFor('i9').at(-1)!.body).toBe('Escalated to L2: Needs the mobile team');
    expect(store.activitiesFor('i9').some((a) => a.action === 'escalated' && a.from === 'L1' && a.to === 'L2')).toBe(true);
    store.escalate('i9');
    expect(() => store.escalate('i9')).toThrow(/L3/);
    expect(() => store.escalate('i3')).toThrow(/support/);
  });

  it('reads the demo desk: breached, met and resolved clocks', () => {
    const store = TestBed.inject(DataStore);
    const get = (id: string) => store.slaOf(store.issues().find((i) => i.id === id)!)!;
    expect(get('i6').response.state).toBe('breached'); // L1 high, no reply for a day
    expect(get('i8').response.state).toBe('met'); // replied after 24 minutes (target 30)
    expect(get('i10').resolution.state).toBe('met'); // L2 medium resolved in 22h (target 48h)
    expect(store.supportLevel('l1')?.teamId).toBe('t4');
    store.updateSupportLevel('l1', { name: 'Help desk', teamId: '' });
    expect(store.supportLevel('l1')).toMatchObject({ name: 'Help desk', teamId: undefined });
  });

  it('upgrades storage v10 data: tiers dropped, support tickets on L1', () => {
    const old = seedData();
    old.clients = old.clients.map((c) => ({ ...c, slaTier: 'premium' }) as never);
    old.issues = old.issues.map((i) => ({ ...i, supportLevel: undefined, firstResponseAt: undefined }));
    const s = migrateV10({ ...old, supportLevels: undefined as never });
    expect(s.clients.every((c) => !('slaTier' in c))).toBe(true);
    expect(s.supportLevels.map((l) => l.level)).toEqual(['l1', 'l2', 'l3']);
    expect(s.issues.find((i) => i.id === 'i7')!.supportLevel).toBe('l1'); // support
    expect(s.issues.find((i) => i.id === 'i1')!.supportLevel).toBeUndefined(); // story
    expect(s.slaPolicies[0]!.level).toBe('l1');
  });
});

describe('Gantt & roadmap timeline (Step 14)', () => {
  beforeEach(() => localStorage.clear());
  const day = (s: string) => new Date(s + 'T00:00:00').getTime();

  it('places bars in the visible window and clips the ones that run past it', () => {
    const r = { start: day('2026-11-02'), days: 14 };
    expect(barFor(day('2026-11-02'), day('2026-11-08'), r)).toMatchObject({ left: 0, width: 50, clipStart: false, clipEnd: false });
    expect(barFor(day('2026-10-20'), day('2026-11-04'), r)).toMatchObject({ left: 0, clipStart: true, clipEnd: false });
    expect(barFor(day('2026-11-10'), day('2026-12-30'), r)).toMatchObject({ clipStart: false, clipEnd: true });
    expect(barFor(day('2026-12-01'), day('2026-12-05'), r)).toBeUndefined();
    expect(barFor(day('2026-11-05'), day('2026-11-05'), r)!.width).toBeCloseTo(100 / 14);
  });

  it('builds windows, ticks and lanes', () => {
    const r = rangeAround(day('2026-11-26'), 'quarter');
    expect(new Date(r.start).getDay()).toBe(1); // starts on a Monday
    expect(r.start).toBeLessThan(day('2026-11-26'));
    expect(shiftRange(r, 1).start).toBeGreaterThan(r.start);
    expect(ticksFor({ start: day('2026-11-02'), days: 14 }, 'weeks')).toHaveLength(14);
    expect(ticksFor({ start: day('2026-11-02'), days: 42 }, 'month').every((t) => t.label.length > 0)).toBe(true);
    const lanes = packLanes([{ start: 1, end: 5 }, { start: 3, end: 8 }, { start: 6, end: 9 }]);
    expect(lanes.map((l) => l.length)).toEqual([2, 1]);
    expect(shiftIso('2026-11-02T10:30:00.000Z', 3)).toBe('2026-11-05T10:30:00.000Z');
  });

  it('reschedules roadmaps, sprints and tickets, respecting roles and order', () => {
    const store = TestBed.inject(DataStore);
    store.reschedule('roadmap', 'r1', '2026-11-01T00:00:00.000Z', '2026-12-20T00:00:00.000Z');
    expect(store.roadmaps().find((r) => r.id === 'r1')).toMatchObject({ startDate: '2026-11-01T00:00:00.000Z', dueDate: '2026-12-20T00:00:00.000Z' });
    expect(() => store.reschedule('sprint', 's2', '2026-12-10T00:00:00.000Z', '2026-12-01T00:00:00.000Z')).toThrow(/before/);
    expect(() => store.reschedule('sprint', 's0', '2026-12-01T00:00:00.000Z', '2026-12-10T00:00:00.000Z')).toThrow(/Completed/);
    store.reschedule('issue', 'i3', '2026-12-01T00:00:00.000Z', '2026-12-03T00:00:00.000Z');
    expect(store.issues().find((i) => i.id === 'i3')!.dueDate).toBe('2026-12-03T00:00:00.000Z');
    store.switchUser('u4'); // developer: tickets yes, sprints and roadmaps no
    expect(() => store.reschedule('sprint', 's2', '2026-12-01T00:00:00.000Z', '2026-12-10T00:00:00.000Z')).toThrow();
    expect(() => store.reschedule('roadmap', 'r1', undefined, undefined)).toThrow();
    store.reschedule('issue', 'i3', '2026-12-02T00:00:00.000Z', '2026-12-04T00:00:00.000Z');
  });
});

describe('External productivity & attendance (Step 15)', () => {
  beforeEach(() => localStorage.clear());
  // A Wednesday afternoon, so this week has past days, today and future days
  const NOW = new Date(2026, 10, 25, 16, 0).getTime();
  const setup = () => {
    const ext = TestBed.inject(ExternalStore);
    ext.clock = () => NOW;
    return { ext, store: TestBed.inject(DataStore) };
  };
  const week = { from: '2026-11-23', to: '2026-11-29' };

  it('generates stable attendance and productivity that follows it', async () => {
    const { ext } = setup();
    await ext.load(week);
    const first = JSON.stringify(ext.attendance());
    await ext.load(week);
    expect(JSON.stringify(ext.attendance())).toBe(first);
    expect(ext.attendance().filter((a) => a.date === '2026-11-28').every((a) => a.status === 'weekend')).toBe(true);
    expect(ext.attendance().some((a) => a.date > '2026-11-25' && a.status !== 'weekend')).toBe(false);
    // Chris is on approved casual leave today; nobody tracked is a client or production user
    expect(ext.dayOf('u9', '2026-11-25')).toMatchObject({ status: 'leave', leaveType: 'casual' });
    expect(ext.attendance().some((a) => ['u11', 'u12'].includes(a.userId))).toBe(false);
    for (const p of ext.productivity()) {
      expect(p.productiveMinutes).toBeLessThanOrEqual(p.activeMinutes);
      expect(ext.dayOf(p.userId, p.date)?.punchIn).toBeTruthy();
    }
    expect(ext.productivity().some((p) => p.userId === 'u9' && p.date === '2026-11-25')).toBe(false);
  });

  it('applies leave, routes approval to the manager and updates the balance', async () => {
    const { ext, store } = setup();
    await ext.load(week);
    store.switchUser('u4'); // Jordan reports to Sam (u3) → Meera (u6)
    expect(ext.visibleUsers().map((u) => u.id)).toEqual(['u4']);
    await expect(ext.applyLeave({ type: 'casual', from: '2026-11-28', to: '2026-11-29', reason: 'x' })).rejects.toThrow(/weekend/);
    await ext.applyLeave({ type: 'casual', from: '2026-12-01', to: '2026-12-02', reason: 'Wedding' });
    await expect(ext.applyLeave({ type: 'sick', from: '2026-12-02', to: '2026-12-02', reason: 'x' })).rejects.toThrow(/already/);
    const req = ext.leaves().find((l) => l.userId === 'u4' && l.status === 'pending')!;
    expect(ext.canApprove('u4')).toBe(false);
    await expect(ext.decide('leave', req, 'approved')).rejects.toThrow();
    store.switchUser('u3');
    expect(ext.canApprove('u4')).toBe(true);
    expect(ext.canApprove('u9')).toBe(false); // Chris doesn't report to Sam
    const used = ext.balanceOf('u4')!.casual.used;
    await ext.decide('leave', req, 'approved');
    expect(ext.leaves().find((l) => l.id === req.id)!.status).toBe('approved');
    expect(ext.balanceOf('u4')!.casual.used).toBe(used + 2);
  });

  it('corrects a missed punch once approved', async () => {
    const { ext, store } = setup();
    await ext.load(week);
    // Seeded: Jordan asked to fix the day two weekdays ago (pending) → shown as a missed punch
    const pending = ext.regularisations().find((g) => g.userId === 'u4' && g.status === 'pending')!;
    expect(ext.dayOf('u4', pending.date)?.status).toBe('missed_punch');
    store.switchUser('u4');
    await expect(ext.requestRegularisation({ date: '2026-11-25', punchIn: '2026-11-25T09:00:00.000Z', punchOut: '2026-11-25T17:00:00.000Z', reason: 'x' })).rejects.toThrow(/over/);
    store.switchUser('u6');
    await ext.decide('regularisation', pending, 'approved');
    expect(ext.dayOf('u4', pending.date)).toMatchObject({ status: 'present', regularised: true, punchOut: pending.punchOut });
  });

  it('matches people by email or employee id and reports a live connection needs the backend', async () => {
    const { ext } = setup();
    expect(ext.employeeId({ id: 'u4', email: 'Jordan@Example.com' })).toBe('jordan@example.com');
    ext.setEmployeeCode('u4', 'EMP-004');
    expect(ext.employeeId(ext.trackedUsers().find((u) => u.id === 'u4')!)).toBe('emp-004');
    expect(() => ext.setEmployeeCode('u3', 'emp-004')).toThrow(/already used/);
    await ext.load(week);
    expect(ext.attendance().some((a) => a.userId === 'u4')).toBe(true);
    ext.updateConnector('attendance', { mode: 'api' });
    await ext.load(week);
    expect(ext.errors().attendance).toMatch(/backend/);
    expect(ext.attendance()).toHaveLength(0);
  });
});

describe('Global search & home (Step 16)', () => {
  beforeEach(() => localStorage.clear());

  it('ranks key matches first and groups tickets, products, people and pages', () => {
    const store = TestBed.inject(DataStore);
    expect(matchScore('Login button', 'log')).toBe(2);
    expect(matchScore('Set up analytics tracking', 'ana')).toBe(1);
    expect(matchScore('Webhook', 'zzz')).toBe(0);
    const hits = searchAll(store, 'web-2', [{ path: 'board', label: 'Board', icon: 'kanban' }]);
    expect(hits[0]).toMatchObject({ kind: 'ticket', link: ['/tickets', 'WEB-2'] });
    const kinds = searchAll(store, 'jordan').map((h) => h.kind);
    expect(kinds).toContain('person');
    expect(searchAll(store, 'jordan').find((h) => h.kind === 'person')!.query).toEqual({ assignee: 'u4' });
    expect(searchAll(store, 'boa', [{ path: 'board', label: 'Board', icon: 'kanban' }]).some((h) => h.kind === 'page')).toBe(true);
    expect(searchAll(store, '   ')).toEqual([]);
  });

  it('only finds what the signed-in person can see', () => {
    const store = TestBed.inject(DataStore);
    store.switchUser('u11'); // client production user (Acme)
    const hits = searchAll(store, 'a');
    expect(hits.every((h) => h.kind === 'ticket' || h.kind === 'page')).toBe(true);
    const visible = new Set(store.issues().map((i) => i.key));
    expect(hits.filter((h) => h.kind === 'ticket').every((h) => visible.has(h.link[1]!))).toBe(true);
    expect(homeFor('production_user')).toBe('/my-requests');
    expect(homeFor('developer')).toBe('/dashboard');
  });
});

describe('Automation rules (Step 17)', () => {
  beforeEach(() => localStorage.clear());
  const base = { conditions: [], productId: undefined };

  it('seeds demo rules and matches conditions', () => {
    const store = TestBed.inject(DataStore);
    expect(store.automations().length).toBe(4);
    expect(store.automations().filter((r) => r.enabled).map((r) => r.id)).toEqual(['ar1']);
    const issue = store.issues().find((i) => i.key === 'WEB-2')!;
    const facts = { issue, category: 'in_progress' as const, reporter: store.userById(issue.reporterId) };
    expect(allConditionsMatch(facts, [{ field: 'type', op: 'is', value: 'bug' }])).toBe(true);
    expect(allConditionsMatch(facts, [{ field: 'type', op: 'is_not', value: 'bug' }])).toBe(false);
    expect(allConditionsMatch(facts, [{ field: 'reporter_kind', op: 'is', value: 'staff' }])).toBe(true);
    expect(ruleProblem({ name: 'x', conditions: [], actions: [{ type: 'add_label', value: '' }] })).toMatch(/needs a value/);
  });

  it('runs on create as Automation, assigns in turn and logs each run', () => {
    const store = TestBed.inject(DataStore);
    store.setRuleEnabled('ar2', true); // support tickets → Service Desk (t4) in turn
    const a = store.createIssue({ productId: 'p1', type: 'support', priority: 'medium', summary: 'Printer down' });
    expect(a.assigneeId).toBe('u13'); // Ana Costa, the only Service Desk member
    expect(store.automationLog()[0]).toMatchObject({ ruleId: 'ar2', issueKey: a.key, outcome: 'done' });
    expect(store.activities().some((x) => x.issueId === a.id && x.userId === AUTOMATION_ID && x.action === 'ran rule')).toBe(true);
    expect(store.userById(AUTOMATION_ID)?.name).toBe('Automation');
    const b = store.createIssue({ productId: 'p1', type: 'task', priority: 'medium', summary: 'Not support' });
    expect(b.assigneeId).toBeUndefined();
    expect(store.automations().find((r) => r.id === 'ar2')!.runCount).toBe(1);
  });

  it('respects workflow transitions, chains rules without looping', () => {
    const store = TestBed.inject(DataStore);
    // Rule 1: a new bug is labelled and moved to Testing; rule 2: entering Testing adds a comment and moves it back to New
    store.createRule({ ...base, name: 'Bug triage', trigger: { type: 'issue_created' }, conditions: [{ field: 'type', op: 'is', value: 'bug' }], actions: [{ type: 'add_label', value: 'triage' }, { type: 'set_status', value: 'testing' }] });
    store.createRule({ ...base, name: 'Back to new', trigger: { type: 'status_changed', value: 'testing' }, actions: [{ type: 'add_comment', value: 'Needs another look' }, { type: 'set_status', value: 'new' }] });
    const bug = store.createIssue({ productId: 'p1', type: 'bug', priority: 'high', summary: 'Loop?' });
    const now = store.issues().find((i) => i.id === bug.id)!;
    expect(now.labels).toContain('triage');
    expect(now.statusId).toBe('new'); // second rule ran once; the first did not re-run in the same chain
    expect(store.commentsFor(bug.id).map((c) => c.authorId)).toEqual([AUTOMATION_ID]);
    // Restrict transitions: New may only go to Development In Progress → the set-status action is skipped and logged
    const wf = store.workflowFor('p1');
    store.setTransition(wf.id, 'new', 'testing', false);
    const bug2 = store.createIssue({ productId: 'p1', type: 'bug', priority: 'high', summary: 'Blocked move' });
    expect(store.issues().find((i) => i.id === bug2.id)!.statusId).toBe('new');
    const run = store.automationLog().find((r) => r.issueId === bug2.id)!;
    expect(run.outcome).toBe('partial');
    expect(run.details.some((d) => d.startsWith('Skipped') && /isn’t allowed/.test(d))).toBe(true);
  });

  it('fires time-based rules once per ticket and enforces who may manage rules', () => {
    const store = TestBed.inject(DataStore);
    const breachedL1 = store.issues().filter((i) => i.supportLevel === 'l1' && store.slaOf(i)?.resolution.state === 'breached' && !store.isResolved(i));
    expect(breachedL1.length).toBeGreaterThan(0);
    const runs = store.runTimedRules();
    expect(runs).toBeGreaterThanOrEqual(breachedL1.length);
    expect(store.issues().find((i) => i.id === breachedL1[0]!.id)!.supportLevel).toBe('l2');
    expect(store.runTimedRules()).toBe(0); // already fired for those tickets
    store.switchUser('u4'); // developer
    expect(store.canManageRule('p1')).toBe(false);
    expect(() => store.createRule({ ...base, name: 'x', trigger: { type: 'issue_created' }, actions: [{ type: 'unassign', value: '' }] })).toThrow();
    store.switchUser('u2'); // division head of Digital Products: own products only
    expect(store.canManageRule('p1')).toBe(true);
    expect(store.canManageRule(undefined)).toBe(false);
  });
});

describe('Server sync (Step 18b)', () => {
  beforeEach(() => localStorage.clear());

  it('finds exactly the records a store action changed', () => {
    const store = TestBed.inject(DataStore);
    const before = (store as unknown as { state: () => import('./core/models').DataState }).state();
    const issue = store.createIssue({ productId: 'p1', type: 'task', priority: 'low', summary: 'Diff me' });
    store.addComment(issue.id, 'Hello');
    store.setSummaryNote('week:2026-11-23', 'All good');
    const after = (store as unknown as { state: () => import('./core/models').DataState }).state();
    const changes = diffState(before, after);
    const by = (c: string) => changes.filter((x) => x.collection === c);
    expect(by('issues').map((c) => c.id)).toEqual([issue.id]);
    expect(by('products').map((c) => c.id)).toEqual(['p1']); // ticket counter
    expect(by('comments')).toHaveLength(1);
    expect(by('activities').length).toBeGreaterThanOrEqual(2);
    expect(by('summaryNotes')[0]).toMatchObject({ op: 'upsert', data: { text: 'All good' } });
    expect(changes.every((c) => c.op === 'upsert')).toBe(true);

    store.deleteComment(by('comments')[0]!.id);
    const removed = diffState(after, (store as unknown as { state: () => import('./core/models').DataState }).state());
    expect(removed).toEqual([{ collection: 'comments', op: 'delete', id: by('comments')[0]!.id }]);
    expect(store.remote()).toBe(false); // tests and the offline demo stay on local storage
  });
});

describe('Employee IDs for in-house people', () => {
  beforeEach(() => localStorage.clear());

  it('requires a unique employee ID for internal people only and keeps it upper-case', () => {
    const store = TestBed.inject(DataStore);
    expect(store.userById('u4')?.employeeId).toBe('EMP-004');
    expect(() => store.createUser({ name: 'No Id', email: 'noid@example.com', kind: 'internal', role: 'developer' })).toThrow(/Employee ID is required/);
    expect(() => store.createUser({ name: 'Dup', email: 'dup@example.com', employeeId: 'emp-004', kind: 'internal', role: 'developer' })).toThrow(/already used by Jordan Diaz/);
    expect(() => store.createUser({ name: 'Bad', email: 'bad@example.com', employeeId: 'E 1', kind: 'internal', role: 'developer' })).toThrow(/letters, digits or dashes/);
    const p = store.createUser({ name: 'Riya', email: 'riya@example.com', employeeId: ' emp-014 ', kind: 'internal', role: 'developer' });
    expect(p.employeeId).toBe('EMP-014');
    const v = store.createUser({ name: 'Vendor Dev', email: 'vd@nimbus.test', employeeId: 'EMP-099', kind: 'vendor', vendorId: 'v1', role: 'developer' });
    expect(v.employeeId).toBeUndefined(); // only in-house employees carry one
    expect(searchAll(store, 'emp-014').find((h) => h.kind === 'person')?.id).toBe(p.id);
  });
});

describe('Accessibility helpers (WCAG 2.2 AA)', () => {
  it('darkens data colours until text reaches 4.5:1 on the light panels and keeps readable ones', () => {
    const panel: [number, number, number] = [232, 241, 250];
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
    for (const c of ['#1677ff', '#1fa15a', '#d99a06', '#94a3b8', '#e2539a', '#ffffff']) {
      const out = readableColor(c)!;
      expect(contrastRatio(rgb(out), panel)).toBeGreaterThanOrEqual(4.5);
    }
    expect(readableColor('#475569')).toBe('#475569'); // already readable: unchanged
    expect(readableColor(undefined)).toBeNull();
    expect(readableColor('currentColor')).toBe('currentColor');
  });
});
