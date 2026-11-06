// Minimal Chrome DevTools Protocol driver for headless verification.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const BIN = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

export async function launch({ width = 820, height = 1180, mobile = true, touch = true, scale = 1, port = 9300 + Math.floor(Math.random() * 500), clearStorage = true } = {}) {
  const dir = fs.mkdtempSync('/tmp/claude-0/cdp-');
  const proc = spawn(BIN, [
    `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-sandbox',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  // Never leave a browser running if the test script crashes or exits early.
  const kill = () => { try { proc.kill('SIGKILL'); } catch {} };
  process.once('exit', kill);
  process.once('uncaughtException', (e) => { kill(); console.error(e); process.exit(1); });
  let wsUrl;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const pg = list.find((t) => t.type === 'page');
      if (pg) wsUrl = pg.webSocketDebuggerUrl;
    } catch {}
  }
  if (!wsUrl) throw new Error('chrome did not start');
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const listeners = [];
  const logs = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    else if (m.method) {
      if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
      if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
      if (m.method === 'Log.entryAdded') logs.push('log ' + m.params.entry.level + ': ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
      for (const l of listeners) l(m);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  const page = {
    send, logs, proc,
    async viewport(w, h, mob = mobile, tch = touch, s = scale) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: s, mobile: mob });
      await send('Emulation.setTouchEmulationEnabled', tch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    },
    async goto(url) {
      const loaded = new Promise((r) => { const f = (m) => { if (m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(f), 1); r(); } }; listeners.push(f); });
      await send('Page.navigate', { url }); await loaded; await page.sleep(300);
    },
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    async tap(x, y, hold = 60) {
      if (touch) {
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await page.sleep(hold);
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await page.sleep(hold);
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      }
      await page.sleep(40);
    },
    async drag(x0, y0, x1, y1, steps = 12, stepMs = 16) {
      if (touch) {
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
        for (let i = 1; i <= steps; i++) { await page.sleep(stepMs); await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps, id: 1 }] }); }
        await page.sleep(stepMs);
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 });
        for (let i = 1; i <= steps; i++) { await page.sleep(stepMs); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps, button: 'left', buttons: 1 }); }
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 });
      }
      await page.sleep(60);
    },
    async shot(path) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path, Buffer.from(r.data, 'base64'));
      return path;
    },
    async close() { try { ws.close(); } catch {} proc.kill('SIGKILL'); },
  };
  await page.viewport(width, height, mobile, touch, scale);
  return page;
}
