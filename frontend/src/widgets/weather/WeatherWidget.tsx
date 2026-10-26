import { useEffect, useState } from 'preact/hooks';
import { forecastWindow, parseForecast, type Forecast } from './forecast';
import { WeatherIcon } from './WeatherIcon';
import './weather.css';

const MINUTE_MS = 60000;
const POLL_MS = 5 * MINUTE_MS;
const REQUEST_TIMEOUT_MS = 15000;
// Feature-local, as in Status: replacement must wait for actual body settlement.
let outstanding: Promise<void> | undefined;

type Snapshot = { forecast: Forecast; time: number; monotonic: number; provisional: boolean };

function serverNow(snapshot: Snapshot, monotonic = performance.now()): number {
  // Device wall-clock corrections must not move the visible forecast window.
  return snapshot.time + Math.max(0, monotonic - snapshot.monotonic);
}

export function WeatherWidget() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    let saved: Snapshot | undefined;
    let tickTimer: number | undefined;
    let cancel: (() => void) | undefined;
    let nextPoll = 0;
    let departed = false;
    let hiddenSince: { wall: number; monotonic: number } | undefined = document.hidden ?
      { wall: Date.now(), monotonic: performance.now() } : undefined;

    function updateClock() { if (alive) setNow(saved ? serverNow(saved) : Date.now()); }

    async function run() {
      if (!alive) { outstanding = undefined; return; }
      let expired = false;
      let failure = 'Unable to retrieve the hourly forecast.';
      const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
      const timer = window.setTimeout(() => {
        expired = true;
        if (alive) setMessage('The weather request timed out.');
        if (controller) controller.abort();
      }, REQUEST_TIMEOUT_MS);
      cancel = () => {
        window.clearTimeout(timer);
        if (controller) controller.abort();
      };
      try {
        const response = await fetch('/api/widgets/weather', {
          cache: 'no-store', signal: controller ? controller.signal : undefined,
        });
        if (!response.ok) {
          failure = 'The weather request failed (HTTP ' + response.status + ').';
          if (alive && !expired) setMessage(failure);
          // HTTP headers do not settle the transfer; keep the guard through body reading.
          await response.arrayBuffer();
          return;
        }
        failure = 'The server returned an invalid weather response.';
        const data: unknown = await response.json();
        if (alive && !expired) {
          const forecast = parseForecast(data);
          saved = { forecast, time: forecast.servedAt, monotonic: performance.now(), provisional: false };
          // A response received while hidden supersedes the elapsed interval
          // before its new server anchor. Only estimate the remainder on resume.
          hiddenSince = document.hidden || departed ? { wall: Date.now(), monotonic: saved.monotonic } : undefined;
          setSnapshot(saved);
          setNow(forecast.servedAt);
          setMessage('');
        }
      } catch {
        if (alive && !expired) setMessage(failure);
      } finally {
        window.clearTimeout(timer);
        cancel = undefined;
        outstanding = undefined;
        if (alive) setBusy(false);
      }
    }

    function request() {
      if (!alive || document.hidden || departed || outstanding) return;
      nextPoll = performance.now() + POLL_MS;
      setBusy(true);
      outstanding = Promise.resolve().then(run);
    }

    function schedule() {
      if (tickTimer !== undefined) window.clearTimeout(tickTimer);
      tickTimer = undefined;
      if (!alive || document.hidden || departed) return;
      tickTimer = window.setTimeout(() => {
        tickTimer = undefined;
        updateClock();
        if (performance.now() >= nextPoll) request();
        schedule();
      }, MINUTE_MS);
    }

    function resume() {
      if (!alive) return;
      if (document.hidden || departed) {
        if (!hiddenSince) hiddenSince = { wall: Date.now(), monotonic: performance.now() };
      } else if (hiddenSince) {
        if (saved) {
          const monotonic = performance.now();
          const elapsed = Math.max(0, monotonic - hiddenSince.monotonic);
          // iOS may pause performance.now while suspended. Estimate only the
          // missing hidden time; wall-clock changes here remain provisional
          // until a successful response supplies a fresh server anchor.
          const missing = Math.max(0, Date.now() - hiddenSince.wall - elapsed);
          saved = { ...saved, time: serverNow(saved, monotonic) + missing, monotonic, provisional: true };
          setSnapshot(saved);
        }
        // Consume once: visibilitychange and pageshow may both report resume.
        hiddenSince = undefined;
      }
      updateClock();
      if (!document.hidden) request();
      schedule();
    }

    function pageHide() {
      departed = true;
      // pagehide may arrive without a hidden visibility state. Preserve the
      // baseline and pause polling until pageshow explicitly restores the page.
      resume();
    }

    function pageShow() {
      departed = false;
      resume();
    }

    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pagehide', pageHide);
    window.addEventListener('pageshow', pageShow);
    if (outstanding) {
      setMessage('A previous weather request is still finishing.');
      setBusy(true);
      // The minute tick retries after settlement, without attaching accumulating
      // promise callbacks to a request whose cancellation may be ineffective.
    } else request();
    schedule();
    return () => {
      alive = false;
      if (tickTimer !== undefined) window.clearTimeout(tickTimer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pagehide', pageHide);
      window.removeEventListener('pageshow', pageShow);
      if (cancel) cancel();
    };
  }, []);

  const forecast = snapshot && snapshot.forecast;
  const slots = forecastWindow(forecast, now);
  const available = slots.filter(Boolean).length;
  const stale = forecast && (forecast.stale || snapshot.provisional || !!message || now >= forecast.staleAfter);
  return <section class="weather-widget" aria-labelledby="weather-heading">
    <h2 id="weather-heading">Toronto · Hourly forecast</h2>
    <p class="weather-status" role="status">{message || (busy && !forecast ?
      'Loading hourly forecast…' : 'Hourly forecasts, not live observations.')}</p>
    {stale && <p class="weather-notice">Forecast may be outdated.</p>}
    {forecast && available < 12 && <p class="weather-notice">{available === 0 ?
      'Forecast coverage has ended.' : 'Some forecast hours are unavailable.'}</p>}
    {busy && message && <p class="weather-notice">Waiting for the request to finish. If it remains stuck, reload the dashboard.</p>}
    <ol class="weather-grid" aria-label="Twelve hourly forecasts">
      {slots.map((hour, index) => <li class="weather-hour" key={index}>
        {hour ? <time dateTime={new Date(hour.time).toISOString()}>
          <span class="weather-hour-label">{hour.label}</span>
          <span class="weather-date">{hour.date.slice(5)} {hour.zone}</span>
        </time> : <span class="weather-hour-label" aria-label="Forecast hour unavailable">—</span>}
        <WeatherIcon code={hour ? hour.code : null} isDay={hour ? hour.isDay : null} />
        <span class="weather-temperature">{!hour || hour.temperature === null ? '—' : Math.round(hour.temperature) + '°C'}</span>
        <span class="weather-precipitation" aria-label={'Precipitation probability ' +
          (!hour || hour.precipitation === null ? 'unavailable' : Math.round(hour.precipitation) + ' percent')}>
          {!hour || hour.precipitation === null ? '—' : Math.round(hour.precipitation) + '%'}
        </span>
      </li>)}
    </ol>
    <footer class="weather-footer">
      <p>{forecast ? <>Forecast retrieved <time dateTime={new Date(forecast.updatedAt).toISOString()}>{forecast.updatedLabel}</time></> :
        'No forecast has been retrieved yet.'}</p>
      <p>Percentages show precipitation chance for the preceding hour.</p>
      <p><a href="https://open-meteo.com/">Weather data by Open-Meteo</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></p>
      <p>Values rounded; conditions grouped into icons.</p>
    </footer>
  </section>;
}
