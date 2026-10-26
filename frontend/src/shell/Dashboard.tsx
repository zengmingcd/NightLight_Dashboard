import { StatusWidget } from '../widgets/status/StatusWidget';
import { WeatherWidget } from '../widgets/weather/WeatherWidget';

export function Dashboard() {
  return (
    <main class="dashboard">
      <h1>NightLight Dashboard</h1>
      <div class="dashboard-widgets">
        <WeatherWidget />
        <StatusWidget />
      </div>
    </main>
  );
}
