import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import './style.css';

declare const __BUILD_ID__: string;
const fast = new URLSearchParams(location.search).get('fast') === '1';
const heartbeatMs = fast ? 100 : 1000;
const pollMs = fast ? 250 : 5000;
const started = Date.now();
const session = new Date(started).toISOString();
const diagnostic = {
  mounts: 0, unmounts: 0, ticks: 0, events: 0,
  componentTimers: 0, componentListeners: 0,
  requests: 0, successes: 0, failures: 0, timeouts: 0,
  abortsRequested: 0, abortRejections: 0, lateResponses: 0,
  outstanding: 0, maxOutstanding: 0, errors: 0, maxTimerDelayMs: 0
};
let history: string[] = [];
function log(message: string) {
  history = [new Date().toISOString().slice(11, 19) + ' ' + message, ...history].slice(0, 30);
}
window.addEventListener('error', () => { diagnostic.errors++; log('window error'); });
window.addEventListener('unhandledrejection', () => { diagnostic.errors++; log('unhandled rejection'); });

function Probe({ mode }: { mode: string }) {
  const [count, setCount] = useState(0);
  const [ticks, setTicks] = useState(0);
  const [events, setEvents] = useState(0);
  const [status, setStatus] = useState('Ready');
  const [value, setValue] = useState('No data yet');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    diagnostic.mounts++;
    log('mount');
    const onEvent = () => { diagnostic.events++; setEvents(n => n + 1); };
    window.addEventListener('spike-ping', onEvent);
    window.addEventListener('resize', onEvent);
    diagnostic.componentListeners += 2;
    return () => {
      diagnostic.unmounts++;
      log('unmount');
      window.removeEventListener('spike-ping', onEvent);
      window.removeEventListener('resize', onEvent);
      diagnostic.componentListeners -= 2;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    let suspended = document.hidden;
    let interval: number | undefined;
    let nextPoll = 0;
    let previousTick = Date.now();
    let cancelRequest: (() => void) | undefined;

    async function request() {
      // Also guards across component generations if abort does not actually work.
      if (!alive || suspended || diagnostic.outstanding !== 0) return;
      diagnostic.outstanding++;
      diagnostic.maxOutstanding = Math.max(diagnostic.maxOutstanding, diagnostic.outstanding);
      diagnostic.requests++;
      setStatus('Loading');
      let expired = false;
      let cancelled = false;
      const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
      const abort = () => {
        if (controller && !controller.signal.aborted) {
          diagnostic.abortsRequested++;
          controller.abort();
        }
      };
      const timeout = window.setTimeout(() => {
        timeoutActive = false;
        diagnostic.componentTimers--;
        expired = true;
        diagnostic.timeouts++;
        if (alive && !suspended) setStatus('Error: timeout; awaiting request settlement');
        log('request timeout');
        abort();
      }, 1500);
      diagnostic.componentTimers++;
      let timeoutActive = true;
      const clearDeadline = () => {
        if (timeoutActive) {
          window.clearTimeout(timeout);
          diagnostic.componentTimers--;
          timeoutActive = false;
        }
      };
      cancelRequest = () => { cancelled = true; clearDeadline(); abort(); };
      try {
        const response = await fetch('/fixture?mode=' + encodeURIComponent(mode), {
          cache: 'no-store', signal: controller ? controller.signal : undefined
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data: { value?: string } = await response.json();
        if (!alive || suspended || expired || cancelled) {
          diagnostic.lateResponses++;
          log('late response ignored');
          return;
        }
        // Deliberate syntax-lowering probe: neither operator should remain in dist.
        setValue(data?.value ?? 'Missing value');
        diagnostic.successes++;
        setStatus('Success');
      } catch (error) {
        const name = error instanceof Error ? error.name : '';
        if (name === 'AbortError') diagnostic.abortRejections++;
        if (!cancelled) diagnostic.failures++;
        if (alive && !suspended && !cancelled) {
          setStatus(expired ? 'Error: timeout' : 'Error: ' + (error instanceof Error ? error.message : String(error)));
          log(expired ? 'timeout settled' : 'request failed');
        }
      } finally {
        clearDeadline();
        diagnostic.outstanding--;
        cancelRequest = undefined;
        nextPoll = Date.now() + pollMs;
      }
    }

    function stop() {
      if (interval !== undefined) {
        window.clearInterval(interval);
        interval = undefined;
        diagnostic.componentTimers--;
      }
      if (cancelRequest) cancelRequest();
    }
    function start() {
      if (!alive || suspended || interval !== undefined) return;
      previousTick = Date.now();
      nextPoll = 0;
      void request();
      interval = window.setInterval(() => {
        const now = Date.now();
        diagnostic.maxTimerDelayMs = Math.max(diagnostic.maxTimerDelayMs, now - previousTick - heartbeatMs);
        previousTick = now;
        diagnostic.ticks++;
        setTicks(n => n + 1);
        if (now >= nextPoll) void request();
      }, heartbeatMs);
      diagnostic.componentTimers++;
    }
    function lifecycle(event: Event) {
      log(event.type + (event.type === 'pageshow' ? ' persisted=' + String((event as PageTransitionEvent).persisted) : ''));
      suspended = event.type === 'pagehide' || document.hidden;
      if (suspended) stop();
      else start();
    }
    function network(event: Event) {
      log(event.type + ' (hint only)');
      if (event.type === 'online') { nextPoll = 0; void request(); }
    }
    document.addEventListener('visibilitychange', lifecycle);
    window.addEventListener('pagehide', lifecycle);
    window.addEventListener('pageshow', lifecycle);
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    diagnostic.componentListeners += 5;
    start();
    return () => {
      alive = false;
      stop();
      document.removeEventListener('visibilitychange', lifecycle);
      window.removeEventListener('pagehide', lifecycle);
      window.removeEventListener('pageshow', lifecycle);
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
      diagnostic.componentListeners -= 5;
    };
  }, [mode, retry]);

  return <section data-testid="probe">
    <h2>Removable component</h2>
    <button onClick={() => setCount(n => n + 1)}>Increment</button>
    <button onClick={() => setRetry(n => n + 1)}>Retry now</button>
    <p>State: <b data-testid="count">{count}</b> · Ticks: <b data-testid="ticks">{ticks}</b> · Events: <b data-testid="events">{events}</b></p>
    <p role="status">{status}</p>
    <p>Last good data (retained on error): <span data-testid="value">{value}</span></p>
  </section>;
}

function App() {
  const [mounted, setMounted] = useState(true);
  const [mode, setMode] = useState('ok');
  const [auto, setAuto] = useState(false);
  const [light, setLight] = useState(false);
  const [, refresh] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => refresh(n => n + 1), 500);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setMounted(n => !n);
    }, fast ? 400 : 2000);
    return () => window.clearInterval(timer);
  }, [auto]);
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', light ? '#ffd28b' : '#8bdcc3');
  }, [light]);

  return <main>
    <h1>Frontend compatibility spike</h1>
    <p>iOS 12.5.8 validation pending. {fast ? 'Accelerated mode' : 'Normal mode: 1s heartbeat / 5s polling'}</p>
    <p class="small">Build: {__BUILD_ID__}<br/>Session: <span data-testid="session">{session}</span><br/>{navigator.userAgent}</p>
    <div class="controls">
      <button onClick={() => setMounted(n => !n)}>{mounted ? 'Unmount' : 'Mount'}</button>
      <button onClick={() => setAuto(n => !n)}>{auto ? 'Stop cycles' : 'Start cycles'}</button>
      <button onClick={() => window.dispatchEvent(new Event('spike-ping'))}>Send event</button>
      <button onClick={() => setLight(n => !n)}>Change accent</button>
      <label>Response: <select aria-label="Response" value={mode} onChange={e => setMode(e.currentTarget.value)}>
        <option value="ok">Success</option><option value="delay">Delayed success (800ms)</option>
        <option value="fail">HTTP 503</option><option value="slow">Timeout (4s response)</option>
      </select></label>
    </div>
    <div class="grid">
      {mounted ? <Probe mode={mode}/> : <section><h2>Component unmounted</h2><p>Component timers/listeners must reach zero. Send event must not increment its counter.</p></section>}
      <section>
        <h2>Diagnostics</h2>
        <p class="small">Uptime: {Math.floor((Date.now() - started) / 1000)}s · Hidden: {String(document.hidden)} · DOM elements: <span data-testid="dom-count">{document.getElementsByTagName('*').length}</span></p>
        <pre data-testid="diagnostics">{JSON.stringify(diagnostic, null, 2)}</pre>
        <p class="small">Counts cover explicitly instrumented component resources, not heap usage or framework internals. Outstanding stays capped at one even if abort fails. Log capped at 30 entries.</p>
        <ol data-testid="log">{history.map((entry, i) => <li key={i}>{entry}</li>)}</ol>
      </section>
    </div>
  </main>;
}

const root = document.getElementById('app')!;
root.textContent = '';
render(<App/>, root);
