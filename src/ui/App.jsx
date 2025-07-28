import React, { useState, useEffect, createContext, useContext } from 'react';
import { Database, Settings, Clock, Play } from 'lucide-react';
import InstancesTab from './tabs/InstancesTab';
import SyncTab from './tabs/SyncTab';
import SchedulesTab from './tabs/SchedulesTab';
import RecordsTab from './tabs/RecordsTab';
import LogsTab from './tabs/LogsTab';
import UsersTab from './tabs/UsersTab';
import { apiFetch } from './utils/api';
import { useAuth, AuthProvider } from './contexts/auth-context';

function LoginPage() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try { await login(email, password); } catch (e) { setError(e.message); }
    setSubmitting(false);
  };
  if (loading) return <div className="p-8 text-center">Loading...</div>;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4">Login</h2>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full mb-2 px-3 py-2 border rounded" required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full mb-4 px-3 py-2 border rounded" required />
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded" disabled={submitting}>{submitting ? 'Logging in...' : 'Login'}</button>
      </form>
    </div>
  );
}

const App = () => {
  const [activeTab, setActiveTab] = useState('instances');
  const [instances, setInstances] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [syncStatus, setSyncStatus] = useState({ active: [], history: [] });
  const [logs, setLogs] = useState([]);
  const { user, logout, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!user) return;
    loadInstances();
    loadSchedules();
    loadSyncStatus();
    loadLogs();
    const interval = setInterval(() => { loadSyncStatus(); }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [user]);

  const loadInstances = async () => {
    try {
      const data = await apiFetch('/instances');
      setInstances(user.role === 'admin' ? data : data.filter(i => user.instanceIds.includes(i.id)));
    } catch (error) { console.error('Error loading instances:', error); }
  };
  const loadSchedules = async () => {
    try {
      const data = await apiFetch('/schedules');
      setSchedules(data);
    } catch (error) { console.error('Error loading schedules:', error); }
  };
  const loadSyncStatus = async () => {
    try {
      const data = await apiFetch('/sync/status');
      setSyncStatus(data);
    } catch (error) { console.error('Error loading sync status:', error); }
  };
  const loadLogs = async () => {
    try {
      const data = await apiFetch('/logs?limit=50');
      setLogs(data);
    } catch (error) { console.error('Error loading logs:', error); }
  };

  if (authLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!user) return <LoginPage />;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Salesforce Data Migrator</h1>
            <div className="flex space-x-4 items-center">
              <button
                onClick={() => setActiveTab('instances')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'instances' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Database className="inline h-4 w-4 mr-2" /> Instances
              </button>
              <button
                onClick={() => setActiveTab('sync')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'sync' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Play className="inline h-4 w-4 mr-2" /> Sync
              </button>
              <button
                onClick={() => setActiveTab('schedules')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'schedules' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Clock className="inline h-4 w-4 mr-2" /> Schedules
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'logs' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Settings className="inline h-4 w-4 mr-2" /> Logs
              </button>
              <button
                onClick={() => setActiveTab('records')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'records' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Database className="inline h-4 w-4 mr-2" /> Records
              </button>
              {user.role === 'admin' && (
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'users' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Manage Users
                </button>
              )}
              <span className="ml-6 text-sm text-gray-700">{user.email} ({user.role})</span>
              <button onClick={logout} className="ml-2 px-3 py-1 bg-gray-200 rounded text-sm">Logout</button>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'instances' && <InstancesTab instances={instances} onReload={loadInstances} user={user} />}
        {activeTab === 'sync' && <SyncTab instances={instances} syncStatus={syncStatus} onReload={loadSyncStatus} user={user} />}
        {activeTab === 'schedules' && <SchedulesTab schedules={schedules} instances={instances} onReload={loadSchedules} user={user} />}
        {activeTab === 'logs' && <LogsTab logs={logs} onReload={loadLogs} user={user} />}
        {activeTab === 'records' && <RecordsTab instances={instances} user={user} />}
        {activeTab === 'users' && user.role === 'admin' && <UsersTab instances={instances} token={user.token} />}
      </div>
      {user.role === 'admin' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          {/* Admin-only: user management UI */}
        </div>
      )}
    </div>
  );
};

export default function AppWithAuth() {
  return <AuthProvider><App /></AuthProvider>;
}
