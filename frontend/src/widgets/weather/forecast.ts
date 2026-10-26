export const HOUR_MS = 60 * 60 * 1000;

export type ForecastHour = {
  time: number;
  label: string;
  date: string;
  zone: string;
  temperature: number | null;
  precipitation: number | null;
  code: number | null;
  isDay: boolean | null;
};

export type Forecast = {
  servedAt: number;
  updatedAt: number;
  updatedLabel: string;
  staleAfter: number;
  stale: boolean;
  refreshError: 'upstream_unavailable' | null;
  hours: ForecastHour[];
};

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function invalid(): never { throw new Error('Invalid weather response'); }

// Python emits up to six fractional digits. Parse explicitly rather than relying
// on Safari's handling of non-millisecond ISO fractions or local date strings.
function utc(value: unknown): number {
  if (typeof value !== 'string') return invalid();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?Z$/.exec(value);
  if (!match) return invalid();
  const parts = match.slice(1, 7).map(Number);
  const milliseconds = Number(((match[7] || '') + '000').slice(0, 3));
  const result = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], milliseconds);
  const date = new Date(result);
  if (date.getUTCFullYear() !== parts[0] || date.getUTCMonth() !== parts[1] - 1 ||
      date.getUTCDate() !== parts[2] || date.getUTCHours() !== parts[3] ||
      date.getUTCMinutes() !== parts[4] || date.getUTCSeconds() !== parts[5]) return invalid();
  return result;
}

function measurement(value: unknown, probability = false): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) ||
      (probability && (value < 0 || value > 100))) return invalid();
  return value;
}

export function parseForecast(value: unknown): Forecast {
  if (!record(value) || value.location !== 'Toronto, Ontario, Canada' ||
      value.timezone !== 'America/Toronto' || typeof value.stale !== 'boolean' ||
      (value.refresh_error !== null && value.refresh_error !== 'upstream_unavailable') ||
      typeof value.updated_label !== 'string' || !value.updated_label.trim() ||
      value.updated_label.length > 80 || !Array.isArray(value.hours) || value.hours.length > 24) return invalid();
  const servedAt = utc(value.served_at);
  const updatedAt = utc(value.updated_at);
  const staleAfter = utc(value.stale_after);
  if (staleAfter !== updatedAt + 15 * 60 * 1000 ||
      (!value.stale && (servedAt >= staleAfter || value.refresh_error !== null))) return invalid();
  const hours = value.hours.map((entry: unknown, index: number): ForecastHour => {
    if (!record(entry) || typeof entry.local_label !== 'string' ||
        !/^([01]\d|2[0-3]):00$/.test(entry.local_label) ||
        typeof entry.local_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.local_date) ||
        (entry.local_zone !== 'EST' && entry.local_zone !== 'EDT') ||
        (entry.is_day !== null && typeof entry.is_day !== 'boolean')) return invalid();
    utc(entry.local_date + 'T00:00:00Z'); // Reject impossible local calendar dates.
    const time = utc(entry.time);
    if (time !== Math.floor(servedAt / HOUR_MS) * HOUR_MS + index * HOUR_MS) return invalid();
    const code = entry.weather_code;
    if (code !== null && (typeof code !== 'number' || !Number.isInteger(code) || code < 0)) return invalid();
    return {
      time, label: entry.local_label, date: entry.local_date, zone: entry.local_zone,
      temperature: measurement(entry.temperature_c),
      precipitation: measurement(entry.precipitation_probability_pct, true),
      code: code as number | null, isDay: entry.is_day as boolean | null,
    };
  });
  return {
    servedAt, updatedAt, updatedLabel: value.updated_label, staleAfter,
    stale: value.stale, refreshError: value.refresh_error, hours,
  };
}

export function forecastWindow(forecast: Forecast | undefined, now: number): (ForecastHour | undefined)[] {
  const start = Math.floor(now / HOUR_MS) * HOUR_MS;
  const slots: (ForecastHour | undefined)[] = [];
  for (let index = 0; index < 12; index++) {
    slots.push(forecast && forecast.hours.find(hour => hour.time === start + index * HOUR_MS));
  }
  return slots;
}
