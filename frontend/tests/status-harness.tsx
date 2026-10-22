/** @jsxImportSource preact */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { StatusWidget } from '../src/widgets/status/StatusWidget';

function Harness() {
  const [mounted, setMounted] = useState(true);
  return <main>
    <button onClick={() => setMounted(value => !value)}>{mounted ? 'Unmount' : 'Mount'}</button>
    {mounted && <StatusWidget />}
  </main>;
}
render(<Harness />, document.getElementById('fixture')!);
