import React, { useState } from 'react';
import { Plus, Edit, Trash2, CheckCircle } from 'lucide-react';
import StatusIcon from '../components/StatusIcon';
import { formatDate, formatDuration } from '../utils/format';

const API_BASE = '/api';

const InstancesTab = ({ instances, onReload }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingInstance, setEditingInstance] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    loginUrl: 'https://test.salesforce.com',
    username: 'sfdcadmin.airbus@niit.com.srt',
    password: 'XWUu@KXB2Brc#yc1YtZSn1',
    securityToken: '',
    apiVersion: '59.0',
    dbType: 'postgresql',
    dbUri: '',
    dbName: ''
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const uriRegex = {
    postgresql: /^postgres(?:ql)?:\/\/([^:@]+)(:[^@]*)?@([^:/]+)(:\d+)?$/i,
    mongodb: /^mongodb(?:\+srv)?:\/\/([^:@]+)(:[^@]*)?@([^/]+)$/i
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name) errors.name = 'Name is required';
    if (!formData.loginUrl) errors.loginUrl = 'Login URL is required';
    if (!formData.username) errors.username = 'Username is required';
    if (!formData.password && !editingInstance) errors.password = 'Password is required';
    if (!formData.apiVersion) errors.apiVersion = 'API Version is required';
    if (!formData.dbUri) errors.dbUri = 'Database URI is required';
    if (!formData.dbName) errors.dbName = 'Database name is required';
    if (formData.dbUri && !uriRegex[formData.dbType].test(formData.dbUri)) {
      errors.dbUri = `Invalid ${formData.dbType === 'postgresql' ? 'PostgreSQL' : 'MongoDB'} URI`;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleTestConnection = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setTestingConnection(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/instances/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({ salesforce: false, db: false, salesforceError: '', dbError: error.message });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
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
        apiVersion: '59.0',
        dbType: 'postgresql',
        dbUri: '',
        dbName: ''
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
      apiVersion: instance.apiVersion,
      dbType: instance.dbType || 'postgresql',
      dbUri: instance.dbUri || '',
      dbName: instance.dbName || ''
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Database Type *</label>
              <select
                name="dbType"
                required
                value={formData.dbType}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="postgresql">PostgreSQL</option>
                <option value="mongodb">MongoDB</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Database URI *</label>
              <input
                type="text"
                name="dbUri"
                required
                value={formData.dbUri}
                onChange={handleInputChange}
                className={`w-full border ${formErrors.dbUri ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2`}
                placeholder="e.g. postgres://user:pass@host:port/db or mongodb://user:pass@host:port/db"
              />
              {formErrors.dbUri && <div className="text-xs text-red-500 mt-1">{formErrors.dbUri}</div>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Database Name *</label>
              <input
                type="text"
                name="dbName"
                required
                value={formData.dbName}
                onChange={handleInputChange}
                className={`w-full border ${formErrors.dbName ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2`}
                placeholder="Database name"
              />
              {formErrors.dbName && <div className="text-xs text-red-500 mt-1">{formErrors.dbName}</div>}
            </div>
            <div className="col-span-2 flex justify-between items-center mt-4">
              <button
                type="button"
                onClick={handleTestConnection}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 flex items-center"
                disabled={testingConnection}
              >
                {testingConnection ? (
                  <span className="animate-spin mr-2 h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></span>
                ) : null}
                Test Connection
              </button>
              <div className="flex space-x-2">
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
            </div>
            {testResult && (
              <div className="col-span-2 mt-4">
                <div className="p-3 rounded border text-sm" style={{ background: '#f9fafb' }}>
                  <div><b>Salesforce:</b> {testResult.salesforce ? <span className="text-green-600">Connected</span> : <span className="text-red-600">Failed</span>} {testResult.salesforceError && <span className="text-xs text-red-500 ml-2">{testResult.salesforceError}</span>}</div>
                  <div><b>Database:</b> {testResult.db ? <span className="text-green-600">Connected</span> : <span className="text-red-600">Failed</span>} {testResult.dbError && <span className="text-xs text-red-500 ml-2">{testResult.dbError}</span>}</div>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-auto">
        {instances.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Login URL</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API Version</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DB Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DB URI</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DB Name</th>
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
                    {instance.dbType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate" title={instance.dbUri}>
                    {instance.dbUri}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {instance.dbName}
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

export default InstancesTab; 