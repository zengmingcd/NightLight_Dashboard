import { useEffect, useRef, useState } from 'preact/hooks';
import './status.css';

const REQUEST_TIMEOUT_MS = 10000;
// Feature-local guard survives replacement when cancellation is ineffective.
let outstanding: Promise<void> | undefined;

export function StatusWidget() {
  const [state, setState] = useState<'loading' | 'success' | 'failure'>('loading');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(true);
  const retry = useRef<() => void>(() => {});

  useEffect(() => {
    let alive = true;
    let cancel: (() => void) | undefined;

    async function run() {
      if (!alive) { outstanding = undefined; return; }
      let expired = false;
      let failureMessage = 'Unable to reach the application.';
      const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
      const timer = window.setTimeout(() => {
        expired = true;
        if (alive) {
          setState('failure');
          setMessage('The status request timed out.');
        }
        if (controller) controller.abort();
      }, REQUEST_TIMEOUT_MS);
      cancel = () => {
        window.clearTimeout(timer);
        if (controller) controller.abort();
      };
      try {
        const response = await fetch('/api/widgets/status', {
          cache: 'no-store', signal: controller ? controller.signal : undefined
        });
        if (!response.ok) {
          failureMessage = 'The status request failed (HTTP ' + response.status + ').';
          throw new Error(failureMessage);
        }
        failureMessage = 'The server returned an invalid status response.';
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || Array.isArray(data) ||
            (data as { status?: unknown }).status !== 'ok') {
          throw new Error(failureMessage);
        }
        if (alive && !expired) setState('success');
      } catch {
        if (alive && !expired) {
          setState('failure');
          setMessage(failureMessage);
        }
      } finally {
        window.clearTimeout(timer);
        cancel = undefined;
        outstanding = undefined;
        if (alive) setBusy(false);
      }
    }

    function request() {
      if (!alive || outstanding) return;
      setState('loading');
      setMessage('');
      setBusy(true);
      // Acquire the guard before run, including a synchronous fetch failure.
      outstanding = Promise.resolve().then(run);
    }
    retry.current = request;
    if (outstanding) {
      setState('failure');
      setMessage('A previous status request is still finishing.');
      void outstanding.then(() => { if (alive) setBusy(false); });
    } else {
      request();
    }
    return () => {
      alive = false;
      retry.current = () => {};
      if (cancel) cancel();
    };
  }, []);

  return (
    <section class="status-widget" aria-labelledby="status-heading">
      <h2 id="status-heading">Status</h2>
      <p role="status">{state === 'loading' ? 'Checking application status…' :
        state === 'success' ? 'Application reachable — status: ok' : message}</p>
      {state === 'failure' && <div>
        {busy && <p>Waiting for the request to finish before retrying. If it remains stuck, reload the dashboard.</p>}
        <button type="button" disabled={busy} onClick={() => retry.current()}>Retry</button>
      </div>}
    </section>
  );
}
