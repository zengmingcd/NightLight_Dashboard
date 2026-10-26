/** @jsxImportSource preact */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { WeatherWidget } from '../src/widgets/weather/WeatherWidget';
import '../src/shell/dashboard.css';

function Harness() {
  const [mounted, setMounted] = useState(true);
  return <main style={{ padding: '24px' }}>
    <button onClick={() => setMounted(value => !value)}>{mounted ? 'Unmount' : 'Mount'}</button>
    {mounted && <WeatherWidget />}
  </main>;
}
render(<Harness />, document.getElementById('fixture')!);
