import React, { useState, useEffect } from 'react';
import { Plus, Database, Settings, Clock, Play, Pause, Trash2, Edit, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

const API_BASE = '/api';

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (duration) => {
    return `${Math.round(duration / 1000)}s`;
  };

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

  const StatusIcon = ({ status }) => {
    switch (status) {
      case 'active':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running':
        return <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'error':
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
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

const InstancesTab = ({ instances, onReload }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingInstance, setEditingInstance] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    loginUrl: 'https://test.salesforce.com',
    username: 'sfdcadmin.airbus@niit.com.srt',
    password: 'XWUu@KXB2Brc#yc1YtZSn1',
    securityToken: '',
    apiVersion: '59.0'
  });
  const [testingConnection, setTestingConnection] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingInstance
        ? `${API_BASE}/instances/${editingInstance.id}`
        : `${API_BASE}/instances`;
      const method = editingInstance ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setShowForm(false);
      setEditingInstance(null);
      setFormData({
        name: '',
        loginUrl: 'https://login.salesforce.com',
        username: '',
        password: '',
        securityToken: '',
        apiVersion: '59.0'
      });
      onReload();
    } catch (error) {
      console.error('Error saving instance:', error);
      alert(`Error saving instance: ${error.message}`);
    }
  };

  const handleEdit = (instance) => {
    setEditingInstance(instance);
    setFormData({
      name: instance.name,
      loginUrl: instance.loginUrl,
      username: instance.username,
      password: '',
      securityToken: '',
      apiVersion: instance.apiVersion
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this instance?')) {
      try {
        const response = await fetch(`${API_BASE}/instances/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        onReload();
      } catch (error) {
        console.error('Error deleting instance:', error);
        alert(`Error deleting instance: ${error.message}`);
      }
    }
  };

  const testConnection = async (id) => {
    setTestingConnection(true);
    try {
      const response = await fetch(`${API_BASE}/instances/${id}/test`, {
        method: 'POST'
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Connection failed');
      }
      alert(result.success ? 'Connection successful!' : `Connection failed: ${result.message}`);
    } catch (error) {
      console.error('Error testing connection:', error);
      alert(`Connection failed: ${error.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Salesforce Instances</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Instance
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h3 className="text-lg font-medium mb-4">
            {editingInstance ? 'Edit Instance' : 'Add New Instance'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="My Salesforce Org"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Login URL *</label>
              <input
                type="url"
                name="loginUrl"
                required
                value={formData.loginUrl}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="https://login.salesforce.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
              <input
                type="text"
                name="username"
                required
                value={formData.username}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password {!editingInstance && '*'}
              </label>
              <input
                type="password"
                name="password"
                required={!editingInstance}
                value={formData.password}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder={editingInstance ? 'Leave blank to keep current' : ''}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Security Token</label>
              <input
                type="text"
                name="securityToken"
                value={formData.securityToken}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Version *</label>
              <input
                type="text"
                name="apiVersion"
                required
                value={formData.apiVersion}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="59.0"
              />
            </div>
            <div className="col-span-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingInstance(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {editingInstance ? 'Update Instance' : 'Add Instance'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {instances.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Login URL</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API Version</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {instances.map(instance => (
                <tr key={instance.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {instance.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {instance.loginUrl}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {instance.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {instance.apiVersion}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => testConnection(instance.id)}
                        disabled={testingConnection}
                        className="text-green-600 hover:text-green-800 disabled:text-gray-400"
                        title="Test Connection"
                      >
                        {testingConnection ? (
                          <div className="h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(instance)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(instance.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6 text-center text-gray-500">
            No Salesforce instances configured yet. Click "Add Instance" to get started.
          </div>
        )}
      </div>
    </div>
  );
};

const SyncTab = ({ instances, syncStatus, onReload }) => {
  const [selectedInstance, setSelectedInstance] = useState('');
  const [selectedObject, setSelectedObject] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [objects, setObjects] = useState([]);
  const [fields, setFields] = useState([]);
  const [targetDatabase, setTargetDatabase] = useState('postgres');
  const [isSyncing, setIsSyncing] = useState(false);

  const loadObjects = async (instanceId) => {
    if (!instanceId) return;
    setLoadingObjects(true);
    try {
      const response = await fetch(`${API_BASE}/instances/${instanceId}/objects`);
      const data = await response.json();
      setObjects(data);
    } catch (error) {
      console.error('Error loading objects:', error);
    } finally {
        setLoadingObjects(false);
    }
  };

  const loadFields = async (instanceId, objectName) => {
    if (!instanceId || !objectName) return;
    try {
      const response = await fetch(`${API_BASE}/instances/${instanceId}/objects/${objectName}/fields`);
      const data = await response.json();
      setFields(data);
    } catch (error) {
      console.error('Error loading fields:', error);
    }
  };

  const handleInstanceChange = (e) => {
    const instanceId = e.target.value;
    setSelectedInstance(instanceId);
    setSelectedObject('');
    setSelectedFields([]);
    loadObjects(instanceId);
  };

  const handleObjectChange = (e) => {
    const objectName = e.target.value;
    setSelectedObject(objectName);
    setSelectedFields([]);
    loadFields(selectedInstance, objectName);
  };

  const handleFieldToggle = (fieldName) => {
    setSelectedFields(prev =>
      prev.includes(fieldName)
        ? prev.filter(f => f !== fieldName)
        : [...prev, fieldName]
    );
  };

  const handleManualSync = async () => {
    if (!selectedInstance || !selectedObject || selectedFields.length === 0) {
      alert('Please select instance, object, and at least one field');
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch(`${API_BASE}/sync/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedInstance,
          objectName: selectedObject,
          fields: selectedFields,
          targetDatabase
        })
      });
      const result = await response.json();
      alert(`Sync started: ${result.jobId}`);
      onReload();
    } catch (error) {
      console.error('Error starting sync:', error);
      alert(`Error starting sync: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Manual Data Sync</h2>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salesforce Instance</label>
              <select
                value={selectedInstance}
                onChange={handleInstanceChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Select Instance</option>
                {instances.map(instance => (
                  <option key={instance.id} value={instance.id}>{instance.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Database</label>
              <select
                value={targetDatabase}
                onChange={(e) => setTargetDatabase(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="sqlserver">SQL Server</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Object</label>
              <select
                value={selectedObject}
                onChange={handleObjectChange}
                disabled={!selectedInstance || loadingObjects}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                {loadingObjects ? (
                    <>
                    <option value="">Loading objects...</option>
                    <option disabled>Please wait...</option>
                    </>
                ) : objects.length > 0 ? (
                    <>
                    <option value="">Select Object</option>
                    {objects.map(obj => {
                        const displayName = obj.label.startsWith('__MISSING LABEL__')
                        ? obj.name
                        : obj.label;
                        return (
                        <option key={obj.name} value={obj.name}>
                            {displayName} ({obj.name})
                        </option>
                        );
                    })}
                    </>
                ) : (
                    <option value="">No objects available</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fields</label>
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
                {fields.length > 0 ? (
                  fields.map(field => (
                    <div key={field.name} className="flex items-center mb-1">
                      <input
                        type="checkbox"
                        id={`field-${field.name}`}
                        checked={selectedFields.includes(field.name)}
                        onChange={() => handleFieldToggle(field.name)}
                        className="mr-2"
                      />
                      <label htmlFor={`field-${field.name}`} className="text-sm">
                        {field.label} ({field.name})
                      </label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">
                    {selectedObject ? 'Loading fields...' : 'Select an object first'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleManualSync}
              disabled={isSyncing || !selectedInstance || !selectedObject || selectedFields.length === 0}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
            >
              {isSyncing ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Syncing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Sync
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Sync Status</h2>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-medium">Active Sync Jobs</h3>
          </div>
          {syncStatus.active.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Object</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {syncStatus.active.map(job => (
                  <tr key={job.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.objectName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(job.startedAt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full"
                          style={{ width: `${job.progress}%` }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4 text-center text-gray-500">No active sync jobs</div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
          <div className="p-4 border-b">
            <h3 className="font-medium">Sync History</h3>
          </div>
          {syncStatus.history.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Object</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Records</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {syncStatus.history.map(job => (
                  <tr key={job.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.objectName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        job.status === 'completed' ? 'bg-green-100 text-green-800' :
                        job.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(job.startedAt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDuration(job.duration)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.recordsProcessed || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4 text-center text-gray-500">No sync history</div>
          )}
        </div>
      </div>
    </div>
  );
};

const SchedulesTab = ({ schedules, instances, onReload }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [formData, setFormData] = useState({
    instanceId: '',
    objectName: '',
    fields: [],
    targetDatabase: 'postgres',
    frequency: 'daily',
    time: '00:00',
    active: true
  });
  const [objects, setObjects] = useState([]);
  const [fields, setFields] = useState([]);

  const loadObjects = async (instanceId) => {
    if (!instanceId) return;
    setLoadingObjects(true);
    try {
      const response = await fetch(`${API_BASE}/instances/${instanceId}/objects`);
      const data = await response.json();
      setObjects(data);
    } catch (error) {
      console.error('Error loading objects:', error);
    } finally {
    setLoadingObjects(false);
  }
  };

  const loadFields = async (instanceId, objectName) => {
    if (!instanceId || !objectName) return;
    try {
      const response = await fetch(`${API_BASE}/instances/${instanceId}/objects/${objectName}/fields`);
      const data = await response.json();
      setFields(data);
    } catch (error) {
      console.error('Error loading fields:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingSchedule
        ? `${API_BASE}/schedules/${editingSchedule.id}`
        : `${API_BASE}/schedules`;
      const method = editingSchedule ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      setShowForm(false);
      setEditingSchedule(null);
      setFormData({
        instanceId: '',
        objectName: '',
        fields: [],
        targetDatabase: 'postgres',
        frequency: 'daily',
        time: '00:00',
        active: true
      });
      onReload();
    } catch (error) {
      console.error('Error saving schedule:', error);
    }
  };

  const handleEdit = (schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      instanceId: schedule.instanceId,
      objectName: schedule.objectName,
      fields: schedule.fields,
      targetDatabase: schedule.targetDatabase,
      frequency: schedule.frequency,
      time: schedule.time.split(' ')[0],
      active: schedule.active
    });
    loadObjects(schedule.instanceId);
    loadFields(schedule.instanceId, schedule.objectName);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      try {
        await fetch(`${API_BASE}/schedules/${id}`, { method: 'DELETE' });
        onReload();
      } catch (error) {
        console.error('Error deleting schedule:', error);
      }
    }
  };

  const toggleSchedule = async (id) => {
    try {
      await fetch(`${API_BASE}/schedules/${id}/toggle`, { method: 'POST' });
      onReload();
    } catch (error) {
      console.error('Error toggling schedule:', error);
    }
  };

  const handleInstanceChange = (e) => {
    const instanceId = e.target.value;
    setFormData({ ...formData, instanceId, objectName: '', fields: [] });
    loadObjects(instanceId);
  };

  const handleObjectChange = (e) => {
    const objectName = e.target.value;
    setFormData({ ...formData, objectName, fields: [] });
    loadFields(formData.instanceId, objectName);
  };

  const handleFieldToggle = (fieldName) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.includes(fieldName)
        ? prev.fields.filter(f => f !== fieldName)
        : [...prev.fields, fieldName]
    }));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Scheduled Syncs</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Schedule
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h3 className="text-lg font-medium mb-4">
            {editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salesforce Instance</label>
              <select
                value={formData.instanceId}
                onChange={handleInstanceChange}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Select Instance</option>
                {instances.map(instance => (
                  <option key={instance.id} value={instance.id}>{instance.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Database</label>
              <select
                value={formData.targetDatabase}
                onChange={(e) => setFormData({ ...formData, targetDatabase: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="sqlserver">SQL Server</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Object</label>
              <select
  value={formData.objectName}
  onChange={handleObjectChange}
  disabled={!formData.instanceId || loadingObjects}
  required
  className="w-full border border-gray-300 rounded-md px-3 py-2"
>
  {loadingObjects ? (
    <>
      <option value="">Loading objects...</option>
      <option disabled>Please wait while we load objects</option>
    </>
  ) : objects.length > 0 ? (
    <>
      <option value="">Select Object</option>
      {objects.map(obj => {
        const displayName = obj.label.startsWith('__MISSING LABEL__')
          ? obj.name
          : obj.label;
        return (
          <option key={obj.name} value={obj.name}>
            {displayName} ({obj.name})
          </option>
        );
      })}
    </>
  ) : (
    <option value="">No objects available</option>
  )}
</select>

{/*!loadingObjects && objects.length === 0 && (
  <p className="mt-1 text-sm text-gray-500">
    No objects found for this instance
  </p>
)*/}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fields</label>
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
                {fields.length > 0 ? (
                  fields.map(field => (
                    <div key={field.name} className="flex items-center mb-1">
                      <input
                        type="checkbox"
                        id={`schedule-field-${field.name}`}
                        checked={formData.fields.includes(field.name)}
                        onChange={() => handleFieldToggle(field.name)}
                        className="mr-2"
                      />
                      <label htmlFor={`schedule-field-${field.name}`} className="text-sm">
                        {field.label} ({field.name})
                      </label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">
                    {formData.objectName ? 'Loading fields...' : 'Select an object first'}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div className="col-span-2 flex items-center">
              <input
                type="checkbox"
                id="schedule-active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="schedule-active" className="text-sm font-medium text-gray-700">
                Active
              </label>
            </div>

            <div className="col-span-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingSchedule(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {editingSchedule ? 'Update Schedule' : 'Add Schedule'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instance</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Object</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedule</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {schedules.length > 0 ? (
              schedules.map(schedule => {
                const instance = instances.find(i => i.id === schedule.instanceId);
                return (
                  <tr key={schedule.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {instance ? instance.name : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{schedule.objectName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{schedule.targetDatabase}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {schedule.frequency} at {schedule.time}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        schedule.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {schedule.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => toggleSchedule(schedule.id)}
                          className="text-gray-500 hover:text-gray-700"
                          title={schedule.active ? 'Pause' : 'Activate'}
                        >
                          {schedule.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleEdit(schedule)}
                          className="text-blue-500 hover:text-blue-700"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(schedule.id)}
                          className="text-red-500 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                  No schedules found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const LogsTab = ({ logs, onReload }) => {
  const [logLevel, setLogLevel] = useState('all');
  const [limit, setLimit] = useState(50);

  const filteredLogs = logLevel === 'all'
    ? logs
    : logs.filter(log => log.level === logLevel);

  const loadLogs = async () => {
    try {
      const response = await fetch(`${API_BASE}/logs?limit=${limit}&level=${logLevel}`);
      const data = await response.json();
      onReload(data);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Application Logs</h2>
        <div className="flex space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>
          <button
            onClick={loadLogs}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 self-end"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(log.timestamp)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      log.level === 'error' ? 'bg-red-100 text-red-800' :
                      log.level === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{log.message}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {log.error && (
                      <details>
                        <summary className="cursor-pointer text-blue-600">Details</summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.error, null, 2)}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                  No logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default App;
