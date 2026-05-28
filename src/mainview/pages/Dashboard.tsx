export default function Dashboard() {
  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-app-primary mb-4">Dashboard</h2>
      <p className="text-app-secondary mb-6">
        Welcome to Scheduline. Manage your events and schedules efficiently.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-app-secondary-light rounded-lg p-4 border border-app">
          <h3 className="text-lg font-semibold text-app-primary mb-2">
            Total Events
          </h3>
          <p className="text-3xl font-bold text-app-primary">0</p>
        </div>
        <div className="bg-app-secondary-light rounded-lg p-4 border border-app">
          <h3 className="text-lg font-semibold text-app-primary mb-2">
            This Week
          </h3>
          <p className="text-3xl font-bold text-app-primary">0</p>
        </div>
        <div className="bg-app-secondary-light rounded-lg p-4 border border-app">
          <h3 className="text-lg font-semibold text-app-primary mb-2">
            Upcoming
          </h3>
          <p className="text-3xl font-bold text-app-primary">0</p>
        </div>
      </div>
    </div>
  );
}
