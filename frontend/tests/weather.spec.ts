import { expect, test, type Page } from '@playwright/test';

type Cancellation = 'native' | 'missing' | 'ineffective';
type Control = {
  calls: number;
  aborts: number;
  timers: () => number[];
  listeners: () => number;
  options: { url: string; cache?: RequestCache }[];
  throwNext: boolean;
  advance: (milliseconds: number) => void;
  shiftWall: (milliseconds: number) => void;
  visible: (value: boolean) => void;
  pagehide: () => void;
  pageshow: () => void;
  resolve: (value: unknown, status?: number) => void;
  reject: () => void;
  headers: (status?: number) => void;
  body: (value?: unknown) => void;
  rejectBody: () => void;
};
declare global { interface Window { weatherTest: Control } }

function forecast({
  served = '2026-10-23T11:15:00.123456Z', updated = served, count = 24, stale = false,
}: { served?: string; updated?: string; count?: number; stale?: boolean } = {}) {
  const now = new Date(served).getTime();
  const start = Math.floor(now / 3600000) * 3600000;
  return {
    location: 'Toronto, Ontario, Canada', timezone: 'America/Toronto',
    served_at: served, updated_at: updated,
    updated_label: 'Oct 23, 07:15 EDT',
    stale_after: new Date(new Date(updated).getTime() + 900000).toISOString(),
    stale, refresh_error: null as null | 'upstream_unavailable',
    hours: Array.from({ length: count }, (_, index) => {
      const time = start + index * 3600000;
      // Independent fixed 2026 Toronto transition instants for controlled fixtures.
      const daylight = time >= Date.UTC(2026, 2, 8, 7) && time < Date.UTC(2026, 10, 1, 6);
      const local = new Date(time - (daylight ? 4 : 5) * 3600000).toISOString();
      return {
        time: new Date(time).toISOString(), local_label: local.slice(11, 16),
        local_date: local.slice(0, 10), local_zone: daylight ? 'EDT' : 'EST',
        temperature_c: -5 + index as number | null,
        precipitation_probability_pct: index * 7 % 101 as number | null,
        weather_code: 2 as number | null, is_day: true as boolean | null,
      };
    }),
  };
}

async function setup(page: Page, mode: Cancellation = 'native', initiallyVisible = true) {
  await page.addInitScript(({ mode, initiallyVisible }) => {
    const nativeFetch = window.fetch.bind(window);
    const nativeTimeout = window.setTimeout.bind(window);
    const nativeClear = window.clearTimeout.bind(window);
    const jobs = new Map<number, { delay: number; due: number; callback: () => void }>();
    let nextId = 900000;
    let wall = Date.UTC(2035, 0, 1); // Deliberately wrong device clock.
    let monotonic = 0;
    let hidden = !initiallyVisible;
    const documentListeners = new Set<EventListenerOrEventListenerObject>();
    const windowListeners = new Set<EventListenerOrEventListenerObject>();
    Object.defineProperty(Date, 'now', { value: () => wall });
    Object.defineProperty(performance, 'now', { value: () => monotonic });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    if (mode === 'missing') Object.defineProperty(window, 'AbortController', { value: undefined });

    const documentAdd = document.addEventListener.bind(document);
    const documentRemove = document.removeEventListener.bind(document);
    const windowAdd = window.addEventListener.bind(window);
    const windowRemove = window.removeEventListener.bind(window);
    document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean) => {
      if (type === 'visibilitychange') documentListeners.add(listener);
      documentAdd(type, listener, options);
    }) as typeof document.addEventListener;
    document.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean) => {
      if (type === 'visibilitychange') documentListeners.delete(listener);
      documentRemove(type, listener, options);
    }) as typeof document.removeEventListener;
    window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean) => {
      if (type === 'pageshow' || type === 'pagehide') windowListeners.add(listener);
      windowAdd(type, listener, options);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean) => {
      if (type === 'pageshow' || type === 'pagehide') windowListeners.delete(listener);
      windowRemove(type, listener, options);
    }) as typeof window.removeEventListener;
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay === 60000 || delay === 15000) {
        const id = nextId++;
        jobs.set(id, { delay, due: monotonic + delay, callback: handler as () => void });
        return id;
      }
      return nativeTimeout(handler, delay, ...args);
    }) as typeof window.setTimeout;
    window.clearTimeout = (id?: number) => {
      if (id !== undefined && jobs.has(id)) jobs.delete(id);
      else nativeClear(id);
    };
    window.weatherTest = {
      calls: 0, aborts: 0, options: [], throwNext: false,
      timers: () => Array.from(jobs.values()).map(job => job.delay).sort(),
      listeners: () => documentListeners.size + windowListeners.size,
      advance: milliseconds => {
        wall += milliseconds;
        monotonic += milliseconds;
        const due = Array.from(jobs.entries()).filter(([, job]) => job.due <= monotonic)
          .sort((a, b) => a[1].due - b[1].due);
        for (const [id, job] of due) {
          if (jobs.delete(id)) job.callback();
        }
      },
      shiftWall: milliseconds => { wall += milliseconds; },
      visible: value => { hidden = !value; document.dispatchEvent(new Event('visibilitychange')); },
      pagehide: () => window.dispatchEvent(new Event('pagehide')),
      pageshow: () => window.dispatchEvent(new Event('pageshow')),
      resolve: () => {}, reject: () => {}, headers: () => {}, body: () => {}, rejectBody: () => {},
    };
    window.fetch = (input, options) => {
      if (input !== '/api/widgets/weather') return nativeFetch(input, options);
      const control = window.weatherTest;
      control.calls++;
      control.options.push({ url: String(input), cache: options?.cache });
      if (control.throwNext) { control.throwNext = false; throw new TypeError('Private network detail'); }
      return new Promise<Response>((resolve, reject) => {
        let rejectBody: ((reason: Error) => void) | undefined;
        control.resolve = (value, status = 200) => resolve(new Response(
          typeof value === 'string' ? value : JSON.stringify(value), { status },
        ));
        control.reject = () => reject(new TypeError('Private network detail'));
        control.headers = (status = 200) => {
          const response = new Response('{}', { status });
          response.json = () => new Promise((bodyResolve, bodyReject) => {
            rejectBody = bodyReject;
            control.body = value => bodyResolve(value);
            control.rejectBody = () => bodyReject(new TypeError('Private body detail'));
          });
          response.arrayBuffer = () => new Promise((bodyResolve, bodyReject) => {
            rejectBody = bodyReject;
            control.body = () => bodyResolve(new ArrayBuffer(0));
            control.rejectBody = () => bodyReject(new TypeError('Private body detail'));
          });
          resolve(response);
        };
        if (options?.signal) options.signal.addEventListener('abort', () => {
          control.aborts++;
          if (mode === 'native') {
            const error = new DOMException('Aborted', 'AbortError');
            reject(error);
            if (rejectBody) rejectBody(error);
          }
        });
      });
    };
  }, { mode, initiallyVisible });
  await page.goto('/tests/weather.html');
  await expect(page.getByRole('heading', { name: 'Toronto · Hourly forecast' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(initiallyVisible ? 1 : 0);
}

const cells = (page: Page) => page.locator('.weather-hour');

async function respond(page: Page, data = forecast()) {
  await page.evaluate(data => window.weatherTest.resolve(data), data);
  await expect.poll(() => page.evaluate(() => window.weatherTest.timers().indexOf(15000))).toBe(-1);
  await expect(page.getByText('No forecast has been retrieved yet.')).toHaveCount(0);
}

test('loading and twelve distinct hourly values use server time and local labels', async ({ page }) => {
  await setup(page);
  await expect(page.getByRole('status')).toHaveText('Loading hourly forecast…');
  await expect(cells(page)).toHaveCount(12);
  await respond(page);
  await expect(page.getByRole('status')).toHaveText('Hourly forecasts, not live observations.');
  await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('07:00');
  await expect(cells(page).last().locator('.weather-hour-label')).toHaveText('18:00');
  for (let index = 0; index < 12; index++) {
    await expect(cells(page).nth(index).locator('.weather-temperature')).toHaveText((-5 + index) + '°C');
    await expect(cells(page).nth(index).locator('.weather-precipitation')).toHaveText(index * 7 % 101 + '%');
  }
  await expect(page.getByText('Forecast retrieved')).toContainText('Oct 23, 07:15 EDT');
  await expect(page.getByRole('link', { name: 'Weather data by Open-Meteo' })).toHaveAttribute('href', 'https://open-meteo.com/');
  await expect(page.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
  expect(await page.evaluate(() => window.weatherTest.options)).toEqual([{ url: '/api/widgets/weather', cache: 'no-store' }]);
});

for (const [served, expected] of [
  ['2026-10-23T11:00:00Z', '07:00'], ['2026-10-23T11:00:01Z', '07:00'],
  ['2026-10-23T11:59:59Z', '07:00'], ['2026-10-23T12:00:00Z', '08:00'],
]) {
  test('current slot at ' + served, async ({ page }) => {
    await setup(page);
    await respond(page, forecast({ served }));
    await expect(cells(page).first().locator('.weather-hour-label')).toHaveText(expected);
  });
}

test('minute tick rolls values forward without moving old values into future slots', async ({ page }) => {
  await setup(page);
  await respond(page, forecast({ served: '2026-10-23T11:59:30Z' }));
  await page.evaluate(() => window.weatherTest.advance(60000));
  await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('08:00');
  await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-4°C');
  await expect(cells(page).first().locator('.weather-precipitation')).toHaveText('7%');
  await expect(cells(page).last().locator('.weather-temperature')).toHaveText('7°C');
  expect(await page.evaluate(() => window.weatherTest.calls)).toBe(1);
});

for (const [served, labels, zones, dates] of [
  ['2026-03-08T06:15:00Z', ['01:00', '03:00', '04:00'], ['EST', 'EDT', 'EDT'], ['03-08', '03-08', '03-08']],
  ['2026-11-01T05:15:00Z', ['01:00', '01:00', '02:00'], ['EDT', 'EST', 'EST'], ['11-01', '11-01', '11-01']],
  ['2026-10-24T03:15:00Z', ['23:00', '00:00', '01:00'], ['EDT', 'EDT', 'EDT'], ['10-23', '10-24', '10-24']],
] as const) {
  test('backend labels preserve DST or midnight at ' + served, async ({ page }) => {
    await setup(page);
    await respond(page, forecast({ served }));
    for (let index = 0; index < 3; index++) {
      await expect(cells(page).nth(index).locator('.weather-hour-label')).toHaveText(labels[index]);
      await expect(cells(page).nth(index).locator('.weather-date')).toHaveText(dates[index] + ' ' + zones[index]);
    }
  });
}

test('nullable measurements and missing future slots show dashes; unknown codes are safe', async ({ page }) => {
  await setup(page);
  const data = forecast({ count: 2 });
  data.hours[0].temperature_c = null;
  data.hours[0].precipitation_probability_pct = null;
  data.hours[0].weather_code = null;
  data.hours[0].is_day = null;
  data.hours[1].weather_code = 987654;
  await respond(page, data);
  await expect(cells(page)).toHaveCount(12);
  await expect(cells(page).first().locator('.weather-temperature')).toHaveText('—');
  await expect(cells(page).first().locator('.weather-precipitation')).toHaveText('—');
  await expect(cells(page).nth(2).locator('.weather-hour-label')).toHaveText('—');
  await expect(page.getByRole('img', { name: 'Condition unavailable', exact: true })).toHaveCount(11);
  await expect(page.getByRole('img', { name: 'Unknown weather condition' })).toBeVisible();
  await expect(page.getByText('Some forecast hours are unavailable.')).toBeVisible();
});

test('empty stale response retains retrieval metadata with twelve unavailable slots', async ({ page }) => {
  await setup(page);
  const data = forecast({ count: 0, stale: true });
  data.refresh_error = 'upstream_unavailable';
  await respond(page, data);
  await expect(cells(page)).toHaveCount(12);
  await expect(page.getByText('Forecast coverage has ended.')).toBeVisible();
  await expect(page.getByText('Forecast may be outdated.')).toBeVisible();
  await expect(page.getByText('Forecast retrieved')).toContainText(data.updated_label);
});

test('local SVG icons cover every documented code and day/night variants', async ({ page }) => {
  await setup(page);
  const codes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67,
    71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 97, 99];
  const labels = ['Clear sky', 'Mainly clear', 'Partly cloudy', 'Overcast', 'Fog', 'Depositing rime fog',
    'Light drizzle', 'Moderate drizzle', 'Dense drizzle', 'Light freezing drizzle', 'Dense freezing drizzle',
    'Slight rain', 'Moderate rain', 'Heavy rain', 'Light freezing rain', 'Heavy freezing rain',
    'Slight snowfall', 'Moderate snowfall', 'Heavy snowfall', 'Snow grains', 'Slight rain showers',
    'Moderate rain showers', 'Violent rain showers', 'Slight snow showers', 'Heavy snow showers',
    'Thunderstorm', 'Thunderstorm with slight hail', 'Heavy thunderstorm', 'Thunderstorm with heavy hail'];
  for (let start = 0; start < codes.length; start += 12) {
    if (start) await page.evaluate(() => window.weatherTest.pageshow());
    const data = forecast();
    codes.slice(start, start + 12).forEach((code, index) => { data.hours[index].weather_code = code; });
    await respond(page, data);
    for (let index = 0; index < Math.min(12, codes.length - start); index++) {
      await expect(cells(page).nth(index).getByRole('img')).toHaveAttribute('aria-label', labels[start + index]);
    }
  }
  await page.evaluate(() => window.weatherTest.pageshow());
  const night = forecast();
  night.hours[0].weather_code = 0;
  night.hours[0].is_day = false;
  await respond(page, night);
  await expect(cells(page).first().locator('svg path')).toHaveAttribute('d', /A12/);
});

for (const failure of ['http', 'network', 'json', 'sync'] as const) {
  test(failure + ' initial failure is sanitized and recovers on polling', async ({ page }) => {
    await setup(page);
    if (failure === 'http') await page.evaluate(() => window.weatherTest.resolve({ secret: 'PRIVATE' }, 503));
    else if (failure === 'network' || failure === 'sync') await page.evaluate(() => window.weatherTest.reject());
    else await page.evaluate(() => window.weatherTest.resolve('{broken'));
    await expect(page.getByRole('status')).toContainText(failure === 'http' ? 'HTTP 503' :
      failure === 'json' ? 'invalid weather response' : 'Unable to retrieve');
    await expect(page.locator('body')).not.toContainText('PRIVATE');
    if (failure === 'sync') {
      await page.evaluate(() => { window.weatherTest.throwNext = true; window.weatherTest.pageshow(); });
      await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(2);
      await expect(page.getByRole('status')).toContainText('Unable to retrieve');
    }
    await page.evaluate(() => window.weatherTest.advance(300000));
    await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(failure === 'sync' ? 3 : 2);
    await respond(page);
    await expect(page.getByRole('status')).toHaveText('Hourly forecasts, not live observations.');
  });
}

for (const invalid of ['null', 'array', 'location', 'timezone', 'timestamp', 'calendar', 'fraction',
  'freshness', 'error', 'missing value', 'temperature', 'probability', 'code', 'day', 'label',
  'local date', 'zone', 'length', 'gap', 'duplicate', 'old slot'] as const) {
  test('rejects invalid contract: ' + invalid, async ({ page }) => {
    await setup(page);
    const value: any = forecast();
    switch (invalid) {
      case 'location': value.location = 'Ottawa'; break;
      case 'timezone': value.timezone = 'UTC'; break;
      case 'timestamp': value.served_at = '2026-10-23T11:15:00'; break;
      case 'calendar': value.served_at = '2026-02-30T11:15:00Z'; break;
      case 'fraction': value.served_at = '2026-10-23T11:15:00.1234567Z'; break;
      case 'freshness': value.stale_after = value.updated_at; break;
      case 'error': value.refresh_error = 'private internal detail'; break;
      case 'missing value': delete value.hours[0].temperature_c; break;
      case 'temperature': value.hours[0].temperature_c = '12'; break;
      case 'probability': value.hours[0].precipitation_probability_pct = 101; break;
      case 'code': value.hours[0].weather_code = -1; break;
      case 'day': value.hours[0].is_day = 1; break;
      case 'label': value.hours[0].local_label = '25:00'; break;
      case 'local date': value.hours[0].local_date = '2026-02-30'; break;
      case 'zone': value.hours[0].local_zone = 'UTC'; break;
      case 'length': value.hours.push(value.hours[0]); break;
      case 'gap': value.hours.splice(1, 1); break;
      case 'duplicate': value.hours[1].time = value.hours[0].time; break;
      case 'old slot': value.hours[0].time = '2026-10-23T10:00:00Z'; break;
    }
    await page.evaluate(data => window.weatherTest.resolve(data), invalid === 'null' ? null : invalid === 'array' ? [] : value);
    await expect(page.getByRole('status')).toContainText('invalid weather response');
    await expect(page.getByText('No forecast has been retrieved yet.')).toBeVisible();
    await expect(cells(page)).toHaveCount(12);
  });
}

test('five-minute polling retains stale data on failure and clears errors on recovery', async ({ page }) => {
  await setup(page);
  await respond(page);
  await page.evaluate(() => window.weatherTest.advance(299999));
  expect(await page.evaluate(() => window.weatherTest.calls)).toBe(1);
  await page.evaluate(() => window.weatherTest.advance(60000));
  await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(2);
  await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-5°C');
  await page.evaluate(() => window.weatherTest.reject());
  await expect(page.getByText('Forecast may be outdated.')).toBeVisible();
  await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-5°C');
  await page.evaluate(() => window.weatherTest.pageshow());
  await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(3);
  await respond(page, forecast({ served: '2026-10-23T11:21:00Z' }));
  await expect(page.getByText('Forecast may be outdated.')).toHaveCount(0);
});

test('retrieval freshness expires independently of remaining coverage', async ({ page }) => {
  await setup(page);
  await respond(page);
  await page.evaluate(() => window.weatherTest.advance(900000));
  await expect(page.getByText('Forecast may be outdated.')).toBeVisible();
  await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-5°C');
});

test('backend stale flag preserves future coverage and successful retrieval metadata', async ({ page }) => {
  await setup(page);
  const data = forecast({ stale: true });
  data.refresh_error = 'upstream_unavailable';
  await respond(page, data);
  await expect(page.getByText('Forecast may be outdated.')).toBeVisible();
  await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-5°C');
  await expect(page.getByText('Forecast retrieved')).toContainText(data.updated_label);
});

test('invalid refresh retains last valid forecast and retrieval timestamp', async ({ page }) => {
  await setup(page);
  await respond(page);
  await page.evaluate(() => window.weatherTest.pageshow());
  await page.evaluate(() => window.weatherTest.resolve({ hours: [] }));
  await expect(page.getByRole('status')).toContainText('invalid weather response');
  await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-5°C');
  await expect(page.getByText('Forecast retrieved')).toContainText('Oct 23, 07:15 EDT');
});

test('hidden page pauses tick and polling; resume rolls retained values and requests once', async ({ page }) => {
  await setup(page);
  await respond(page);
  await page.evaluate(() => { window.weatherTest.visible(false); window.weatherTest.advance(3600000); });
  expect(await page.evaluate(() => window.weatherTest.calls)).toBe(1);
  expect(await page.evaluate(() => window.weatherTest.timers())).toEqual([]);
  await page.evaluate(() => { window.weatherTest.visible(true); window.weatherTest.pageshow(); });
  await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(2);
  await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('08:00');
  await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-4°C');
  expect(await page.evaluate(() => window.weatherTest.timers())).toEqual([15000, 60000]);
});

test('mounting hidden waits for visibility without polling', async ({ page }) => {
  await setup(page, 'native', false);
  expect(await page.evaluate(() => window.weatherTest.timers())).toEqual([]);
  await page.evaluate(() => window.weatherTest.visible(true));
  await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(1);
  await respond(page);
});

test('suspended monotonic clock uses elapsed wall time on resume', async ({ page }) => {
  await setup(page);
  await respond(page);
  await page.evaluate(() => { window.weatherTest.visible(false); window.weatherTest.shiftWall(3600000); window.weatherTest.visible(true); });
  await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('08:00');
});

test('backward device clock adjustment cannot rewind retained forecast selection', async ({ page }) => {
  await setup(page);
  await respond(page);
  await page.evaluate(() => { window.weatherTest.advance(3600000); window.weatherTest.shiftWall(-7200000); window.weatherTest.advance(60000); });
  await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('08:00');
});

for (const correction of [7200000, -7200000]) {
  test('visible clock correction ' + correction + ' and restoration do not alter selection after a failed refresh', async ({ page }) => {
    await setup(page);
    await respond(page, forecast({ served: '2026-10-23T11:59:30Z' }));
    await page.evaluate(correction => {
      window.weatherTest.shiftWall(correction);
      window.weatherTest.advance(60000);
      window.weatherTest.pageshow();
    }, correction);
    await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('08:00');
    await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-4°C');
    await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(2);
    await page.evaluate(() => window.weatherTest.reject());
    await expect(page.getByRole('status')).toContainText('Unable to retrieve');
    await page.evaluate(correction => {
      window.weatherTest.shiftWall(-correction);
      window.weatherTest.advance(60000);
    }, correction);
    await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('08:00');
    await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-4°C');
    await expect(page.getByText('Forecast retrieved')).toContainText('Oct 23, 07:15 EDT');
    await expect(page.getByText('Forecast may be outdated.')).toBeVisible();
  });
}

for (const paused of [true, false]) {
  test('hidden interval is applied once with monotonic clock ' + (paused ? 'paused' : 'running'), async ({ page }) => {
    await setup(page);
    await respond(page);
    await page.evaluate(paused => {
      // A correction while visible must not leak into the subsequent hidden interval.
      window.weatherTest.shiftWall(7200000);
      window.weatherTest.visible(false);
      window.weatherTest.visible(false);
      if (paused) window.weatherTest.shiftWall(3600000);
      else window.weatherTest.advance(3600000);
      window.weatherTest.visible(true);
      window.weatherTest.pageshow();
      window.weatherTest.visible(true);
      window.weatherTest.pageshow();
    }, paused);
    await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('08:00');
    await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-4°C');
    await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(2);
    expect(await page.evaluate(() => window.weatherTest.timers())).toEqual([15000, 60000]);
    await page.evaluate(() => window.weatherTest.reject());
    await expect(page.getByRole('status')).toContainText('Unable to retrieve');
    await page.evaluate(() => {
      window.weatherTest.shiftWall(-7200000);
      window.weatherTest.advance(60000);
      window.weatherTest.pageshow();
      window.weatherTest.pageshow();
    });
    await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('08:00');
    await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(3);
    await respond(page, forecast({ served: '2026-10-23T12:16:00Z' }));
    await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-5°C');
    await expect(page.getByText('Forecast may be outdated.')).toHaveCount(0);
  });
}

test('provisional hidden clock correction is reconciled by server time', async ({ page }) => {
  await setup(page);
  await respond(page);
  await page.evaluate(() => {
    window.weatherTest.visible(false);
    window.weatherTest.shiftWall(7200000);
    window.weatherTest.visible(true);
  });
  await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('09:00');
  await expect(page.getByText('Forecast may be outdated.')).toBeVisible();
  await respond(page, forecast({ served: '2026-10-23T11:16:00Z' }));
  await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('07:00');
  await expect(page.getByText('Forecast may be outdated.')).toHaveCount(0);
  await page.evaluate(() => {
    window.weatherTest.shiftWall(-7200000);
    window.weatherTest.advance(60000);
  });
  await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('07:00');
});

test('short hidden interval remains provisional until a successful server response', async ({ page }) => {
  await setup(page);
  await respond(page, forecast({ served: '2026-10-23T11:59:30Z' }));
  await page.evaluate(() => {
    window.weatherTest.visible(false);
    window.weatherTest.shiftWall(60000);
    window.weatherTest.visible(true);
    window.weatherTest.pageshow();
  });
  await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('08:00');
  await expect(page.getByText('Forecast may be outdated.')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(2);
  await respond(page, forecast({ served: '2026-10-23T12:00:30Z' }));
  await expect(page.getByText('Forecast may be outdated.')).toHaveCount(0);
});

test('backward wall correction while hidden preserves monotonic elapsed time', async ({ page }) => {
  await setup(page);
  await respond(page);
  await page.evaluate(() => {
    window.weatherTest.visible(false);
    window.weatherTest.advance(3600000);
    window.weatherTest.shiftWall(-7200000);
    window.weatherTest.visible(true);
    window.weatherTest.pageshow();
  });
  await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('08:00');
  await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(2);
});

test('response received while hidden resets the remaining hidden interval', async ({ page }) => {
  await setup(page);
  await respond(page);
  await page.evaluate(() => window.weatherTest.pageshow());
  await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(2);
  await page.evaluate(() => {
    window.weatherTest.visible(false);
    window.weatherTest.shiftWall(3600000);
  });
  await respond(page, forecast({ served: '2026-10-23T12:15:00Z' }));
  await page.evaluate(() => {
    window.weatherTest.shiftWall(3600000);
    window.weatherTest.visible(true);
    window.weatherTest.pageshow();
  });
  await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('09:00');
  await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-4°C');
  await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(3);
});

for (const paused of [true, false]) {
  test('pagehide without visibility change preserves rollover after failed refresh with clock ' + (paused ? 'paused' : 'running'), async ({ page }) => {
    await setup(page);
    await respond(page);
    await page.evaluate(paused => {
      window.weatherTest.pagehide();
      if (paused) window.weatherTest.shiftWall(1800000);
      else window.weatherTest.advance(1800000);
      window.weatherTest.pagehide(); // Must not replace the original baseline.
      if (paused) window.weatherTest.shiftWall(1800000);
      else window.weatherTest.advance(1800000);
    }, paused);
    expect(await page.evaluate(() => window.weatherTest.timers())).toEqual([]);
    expect(await page.evaluate(() => window.weatherTest.calls)).toBe(1);
    await page.evaluate(() => { window.weatherTest.pageshow(); window.weatherTest.pageshow(); });
    await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('08:00');
    await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-4°C');
    await expect(cells(page).first().locator('.weather-precipitation')).toHaveText('7%');
    await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(2);
    await page.evaluate(() => window.weatherTest.reject());
    await expect(page.getByRole('status')).toContainText('Unable to retrieve');
    await page.evaluate(() => {
      window.weatherTest.shiftWall(-3600000);
      window.weatherTest.advance(60000);
    });
    await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('08:00');
    await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-4°C');
    await expect(page.getByText('Forecast retrieved')).toContainText('Oct 23, 07:15 EDT');
    await expect(page.getByText('Forecast may be outdated.')).toBeVisible();
    await page.evaluate(() => window.weatherTest.pageshow());
    await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(3);
    await respond(page, forecast({ served: '2026-10-23T12:16:00Z' }));
    await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-5°C');
    await expect(page.getByText('Forecast may be outdated.')).toHaveCount(0);
  });
}

test('response after pagehide resets only the remaining departed interval', async ({ page }) => {
  await setup(page);
  await respond(page);
  await page.evaluate(() => window.weatherTest.pageshow());
  await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(2);
  await page.evaluate(() => {
    window.weatherTest.pagehide();
    window.weatherTest.shiftWall(3600000);
  });
  await respond(page, forecast({ served: '2026-10-23T12:15:00Z' }));
  await page.evaluate(() => {
    window.weatherTest.shiftWall(3600000);
    window.weatherTest.visible(true); // Visibility alone must not end page departure.
  });
  expect(await page.evaluate(() => window.weatherTest.timers())).toEqual([]);
  expect(await page.evaluate(() => window.weatherTest.calls)).toBe(2);
  await page.evaluate(() => window.weatherTest.pageshow());
  await expect(cells(page).first().locator('.weather-hour-label')).toHaveText('09:00');
  await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-4°C');
  await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(3);
});

test('offline retained coverage eventually ends without reusing expired hours', async ({ page }) => {
  await setup(page, 'missing');
  await respond(page);
  await page.evaluate(() => { window.weatherTest.visible(false); window.weatherTest.advance(24 * 3600000); window.weatherTest.visible(true); });
  await expect(page.getByText('Forecast coverage has ended.')).toBeVisible();
  await expect(cells(page).locator('.weather-temperature')).toHaveText(Array(12).fill('—'));
  await expect(page.getByText('Forecast retrieved')).toContainText('Oct 23, 07:15 EDT');
});

for (const mode of ['native', 'missing', 'ineffective'] as const) {
  for (const stage of ['headers', 'json', 'http body'] as const) {
    test(mode + ' cancellation during ' + stage + ' timeout holds guard through settlement', async ({ page }) => {
      await setup(page, mode);
      if (stage !== 'headers') await page.evaluate(status => window.weatherTest.headers(status), stage === 'http body' ? 503 : 200);
      if (stage === 'http body') await expect(page.getByRole('status')).toContainText('HTTP 503');
      await page.evaluate(() => window.weatherTest.advance(15000));
      await expect(page.getByRole('status')).toContainText('timed out');
      expect(await page.evaluate(() => window.weatherTest.aborts)).toBe(mode === 'missing' ? 0 : 1);
      if (mode !== 'native') {
        await page.evaluate(() => { window.weatherTest.pageshow(); window.weatherTest.advance(300000); });
        expect(await page.evaluate(() => window.weatherTest.calls)).toBe(1);
        await expect(page.getByText(/If it remains stuck/)).toBeVisible();
        await page.evaluate(({ data, stage }) => {
          if (stage === 'headers') window.weatherTest.resolve(data);
          else window.weatherTest.body(data);
        }, { data: forecast(), stage });
      }
      await expect(page.getByText(/Waiting for the request/)).toHaveCount(0);
      await expect(page.getByRole('status')).toContainText('timed out');
      await expect(page.getByText('No forecast has been retrieved yet.')).toBeVisible();
      await page.evaluate(() => window.weatherTest.pageshow());
      await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(2);
      await respond(page);
    });
  }

  for (const status of [200, 503]) {
    test(mode + ' cancellation on unmount during HTTP ' + status + ' cleans up and blocks replacement until settlement', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await setup(page, mode);
      await page.evaluate(status => window.weatherTest.headers(status), status);
      await page.getByRole('button', { name: 'Unmount', exact: true }).click();
      await expect(page.locator('.weather-widget')).toHaveCount(0);
      expect(await page.evaluate(() => window.weatherTest.timers())).toEqual([]);
      expect(await page.evaluate(() => window.weatherTest.listeners())).toBe(0);
      await page.getByRole('button', { name: 'Mount', exact: true }).click();
      if (mode !== 'native') {
        await expect(page.getByRole('status')).toContainText('previous weather request');
        expect(await page.evaluate(() => window.weatherTest.calls)).toBe(1);
        await page.evaluate(data => window.weatherTest.body(data), forecast());
        await page.evaluate(() => window.weatherTest.advance(60000));
      }
      await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(2);
      await expect(page.getByText('No forecast has been retrieved yet.')).toBeVisible();
      await respond(page);
      expect(errors).toEqual([]);
    });
  }
}

for (const status of [200, 503]) {
  test('body rejection after headers (HTTP ' + status + ') releases guard and retains data', async ({ page }) => {
    await setup(page, 'missing');
    await respond(page);
    await page.evaluate(() => window.weatherTest.pageshow());
    await page.evaluate(status => window.weatherTest.headers(status), status);
    await page.evaluate(() => window.weatherTest.rejectBody());
    await expect(page.getByRole('status')).toContainText(status === 200 ? 'invalid weather response' : 'HTTP 503');
    await expect(cells(page).first().locator('.weather-temperature')).toHaveText('-5°C');
    await page.evaluate(() => window.weatherTest.pageshow());
    await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(3);
  });
}

test('repeated mounts retain only one tick, deadline and three lifecycle listeners', async ({ page }) => {
  await setup(page);
  for (let index = 0; index < 12; index++) {
    await respond(page);
    expect(await page.evaluate(() => window.weatherTest.timers())).toEqual([60000]);
    expect(await page.evaluate(() => window.weatherTest.listeners())).toBe(3);
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await expect(page.locator('.weather-widget')).toHaveCount(0);
    expect(await page.evaluate(() => window.weatherTest.timers())).toEqual([]);
    expect(await page.evaluate(() => window.weatherTest.listeners())).toBe(0);
    await page.getByRole('button', { name: 'Mount', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.weatherTest.calls)).toBe(index + 2);
  }
});

test('landscape and portrait remain two by six with no horizontal scrolling', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await setup(page);
  await respond(page);
  for (const [width, height] of [[1024, 768], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    const rectangles = await cells(page).evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, left: rect.left, right: rect.right };
    }));
    expect(rectangles.slice(0, 6).every(rect => rect.top === rectangles[0].top)).toBe(true);
    expect(rectangles.slice(6).every(rect => rect.top === rectangles[6].top)).toBe(true);
    expect(rectangles[6].top).toBeGreaterThan(rectangles[0].top);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('weather-' + width + '.png') });
  }
});
