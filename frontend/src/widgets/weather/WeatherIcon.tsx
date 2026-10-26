const descriptions: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  66: 'Light freezing rain', 67: 'Heavy freezing rain',
  71: 'Slight snowfall', 73: 'Moderate snowfall', 75: 'Heavy snowfall', 77: 'Snow grains',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail',
  97: 'Heavy thunderstorm', 99: 'Thunderstorm with heavy hail',
};

export function WeatherIcon({ code, isDay }: { code: number | null; isDay: boolean | null }) {
  const known = code !== null && Object.prototype.hasOwnProperty.call(descriptions, code);
  const label = code === null ? 'Condition unavailable' : known ? descriptions[code] : 'Unknown weather condition';
  const clear = code === 0;
  const partly = code === 1 || code === 2;
  const fog = code === 45 || code === 48;
  const snow = code !== null && [71, 73, 75, 77, 85, 86].indexOf(code) !== -1;
  const rain = code !== null && [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].indexOf(code) !== -1;
  const ice = code !== null && [56, 57, 66, 67].indexOf(code) !== -1;
  const thunder = code !== null && [95, 96, 97, 99].indexOf(code) !== -1;
  return <svg class="weather-icon" viewBox="0 0 40 40" width="36" height="36"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round" role="img" aria-label={label} focusable="false">
    {!known ? <><path d="M15 14a5 5 0 0 1 10 0c0 4-5 4-5 8" /><circle cx="20" cy="29" r="1" /></> : <>
      {(clear || partly) && (isDay === false ?
        <path d="M24 5a12 12 0 1 0 10 18A12 12 0 0 1 24 5Z" /> :
        <><circle cx="16" cy="15" r="7" /><path d="M16 3v2m0 20v2M4 15H2m28 0h-2M7 6l2 2m14 14 2 2M7 24l2-2M23 8l2-2" /></>)}
      {!clear && <path d="M10 27a7 7 0 0 1 0-14 10 10 0 0 1 19 1 7 7 0 0 1 1 13Z" fill="#17202d" />}
      {fog && <path d="M6 30h28M9 34h22M12 38h16" />}
      {rain && <path d={code !== null && code < 60 ? 'M12 31v1m8-1v1m8-1v1' : 'M12 30l-2 5m10-5-2 5m10-5-2 5'} />}
      {snow && <path d="M10 31v6m-3-3h6m7-3v6m-3-3h6m7-3v6m-3-3h6" />}
      {ice && <path d="m29 30 4 4-4 4-4-4Z" />}
      {thunder && <path d="m22 27-7 7h6l-3 5 10-8h-7l3-4" />}
      {(code === 96 || code === 99) && <><circle cx="9" cy="33" r="1" /><circle cx="32" cy="35" r="1" /></>}
    </>}
  </svg>;
}
