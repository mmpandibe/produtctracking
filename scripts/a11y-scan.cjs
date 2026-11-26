// WCAG 2.2 AA regression check: runs axe-core (WCAG 2.0 / 2.1 / 2.2 A + AA + best practices) on every nPro screen and a few
// dialogs in headless Edge (or Chrome) through the DevTools protocol, and flags pages that scroll sideways (1.4.10 Reflow).
// Start the app first (npm.cmd start; without the API it runs the local demo as the admin), then:
//   node scripts/a11y-scan.cjs [desktop|mobile] [report.json]      (mobile = 320 px wide)
// Env: A11Y_BASE (default http://localhost:4200), A11Y_BROWSER (path to msedge.exe / chrome.exe).
// Exit code 1 when any violation or overflow is found.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.env.A11Y_BASE || 'http://localhost:4200';
const EDGE = process.env.A11Y_BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const mode = process.argv[2] || 'desktop';
const outFile = process.argv[3];
const PORT = 9333 + (mode === 'mobile' ? 1 : 0);

// Screens, plus a few states with a dialog or menu open (selector clicked after load)
const PAGES = process.env.A11Y_PAGES ? process.env.A11Y_PAGES.split(',').map((p) => [p]) : [
  ['/dashboard'], ['/products'], ['/tickets'], ['/tickets/WEB-2'], ['/board'], ['/backlog'], ['/time'], ['/attendance'],
  ['/attendance?tab=productivity'], ['/attendance?tab=requests'], ['/gantt'], ['/gantt?tab=roadmap'], ['/support'], ['/support?tab=report'],
  ['/support?tab=settings'], ['/reports'], ['/cxo-summary'], ['/clients'], ['/workflows'], ['/organisation'], ['/organisation?tab=people'],
  ['/organisation?tab=vendors'], ['/organisation?tab=roles'], ['/integrations'], ['/automation'], ['/my-requests'],
  ['/tickets', 'button.btn-primary'], // new ticket dialog
  ['/automation', 'button.btn-primary'], // new rule dialog
  ['/organisation?tab=people', 'button.btn-primary'], // add person dialog
  ['/attendance', 'button.btn-primary'], // apply leave dialog
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'npro-axe-'));
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    let target;
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(250);
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
        target = list.find((t) => t.type === 'page');
      } catch {}
    }
    if (!target) throw new Error('Edge did not start');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((ok) => ws.addEventListener('open', ok, { once: true }));
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m);
        pending.delete(m.id);
      }
    });
    const send = (method, params = {}) =>
      new Promise((ok) => {
        const n = ++id;
        pending.set(n, ok);
        ws.send(JSON.stringify({ id: n, method, params }));
      });
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed');
      return r.result?.result?.value;
    };

    await send('Page.enable');
    await send('Runtime.enable');
    if (mode === 'mobile') {
      await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 720, deviceScaleFactor: 2, mobile: true });
    } else {
      await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 860, deviceScaleFactor: 1, mobile: false });
    }

    const results = {};
    let problems = 0;
    for (const [route, click] of PAGES) {
      await send('Page.navigate', { url: BASE + route });
      await sleep(2500);
      if (click) {
        await evaluate(`document.querySelector(${JSON.stringify(click)})?.click(); true`);
        await sleep(800);
      }
      const hasAxe = await evaluate('typeof window.axe');
      if (hasAxe !== 'object') await evaluate(AXE + '; true');
      const res = await evaluate(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice'] } })
        .then(r => ({ url: location.pathname + location.search, violations: r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help,
          nodes: v.nodes.map(n => ({ target: n.target.join(' '), html: n.html.slice(0, 160), msg: (n.any[0]?.message || n.all[0]?.message || n.none[0]?.message || '').slice(0, 160) })) })) }))`);
      const overflow = await evaluate(`(() => { const w = document.documentElement.clientWidth; const wide = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > w + 1 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map(e => e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 50)); return { scroll: document.documentElement.scrollWidth, w, wide }; })()`);
      res.overflow = overflow;
      const key = route + (click ? ' + dialog' : '');
      results[key] = res;
      problems += res.violations.length + (overflow.scroll > overflow.w ? 1 : 0);
      const count = res.violations.reduce((s, v) => s + v.nodes.length, 0);
      console.log(`${key.padEnd(40)} ${res.violations.length} rules, ${count} nodes${overflow.scroll > overflow.w ? '  OVERFLOW ' + overflow.scroll + '>' + overflow.w + ' ' + overflow.wide.join(' | ') : ''}`);
    }
    if (outFile) fs.writeFileSync(outFile, JSON.stringify(results, null, 1));
    console.log(problems ? `\n${problems} problem(s) found` : '\nNo WCAG 2.2 AA violations found by axe, no horizontal scrolling.');
    process.exitCode = problems ? 1 : 0;
  } finally {
    try { ws?.close(); } catch {}
    edge.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
