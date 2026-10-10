import { render } from 'preact';
import { Dashboard } from './shell/Dashboard';
import './shell/dashboard.css';

const root = document.getElementById('app')!;
root.textContent = '';
render(<Dashboard />, root);
