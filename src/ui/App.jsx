import React, { useState, useEffect } from 'react';
import { Database, Settings, Clock, Play } from 'lucide-react';
import InstancesTab from './tabs/InstancesTab';
import SyncTab from './tabs/SyncTab';
import SchedulesTab from './tabs/SchedulesTab';
import LogsTab from './tabs/LogsTab';
import StatusIcon from './components/StatusIcon';
import { formatDate, formatDuration } from './utils/format';

const API_BASE = '/api';

const App = () => {
  const [activeTab, setActiveTab] = useState('instances');
  const [instances, setInstances] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [syncStatus, setSyncStatus] = useState({ active: [], history: [] });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInstances();
    loadSchedules();
    loadSyncStatus();
    loadLogs();
    const interval = setInterval(() => {
      loadSyncStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadInstances = async () => {
    try {
      const response = await fetch(`${API_BASE}/instances`);
      const data = await response.json();
      setInstances(data);
    } catch (error) {
      console.error('Error loading instances:', error);
    }
  };

  const loadSchedules = async () => {
    try {
      const response = await fetch(`${API_BASE}/schedules`);
      const data = await response.json();
      setSchedules(data);
    } catch (error) {
      console.error('Error loading schedules:', error);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/sync/status`);
      const data = await response.json();
      setSyncStatus(data);
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const loadLogs = async () => {
    try {
      const response = await fetch(`${API_BASE}/logs?limit=50`);
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Salesforce Data Migrator</h1>
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab('instances')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'instances'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Database className="inline h-4 w-4 mr-2" />
                Instances
              </button>
              <button
                onClick={() => setActiveTab('sync')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'sync'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Play className="inline h-4 w-4 mr-2" />
                Sync
              </button>
              <button
                onClick={() => setActiveTab('schedules')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'schedules'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Clock className="inline h-4 w-4 mr-2" />
                Schedules
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'logs'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Settings className="inline h-4 w-4 mr-2" />
                Logs
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'instances' && <InstancesTab instances={instances} onReload={loadInstances} />}
        {activeTab === 'sync' && <SyncTab instances={instances} syncStatus={syncStatus} onReload={loadSyncStatus} />}
        {activeTab === 'schedules' && <SchedulesTab schedules={schedules} instances={instances} onReload={loadSchedules} />}
        {activeTab === 'logs' && <LogsTab logs={logs} onReload={loadLogs} />}
      </div>
    </div>
  );
};

export default App;
