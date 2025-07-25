import React, { useState } from 'react';
import { Play } from 'lucide-react';
import StatusIcon from '../components/StatusIcon';
import { formatDate, formatDuration } from '../utils/format';
import FieldMultiSelect from '../components/FieldMultiSelect';
import ObjectSelect from '../components/ObjectSelect';

const API_BASE = '/api';

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
      setObjects(data.length > 0 ? data.map((obj) => {
        obj.label = obj.label.startsWith('__MISSING LABEL__') ? obj.name : obj.label;
        return obj;
      }) : data);
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
      setFields(data.length > 0 ? data.map((field) => {
        field.label = field.label.startsWith('__MISSING LABEL__') ? field.name : field.label;
        return field;
      }) : data);
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
    const objectName = e;
    setSelectedObject(objectName);
    setSelectedFields([]);
    loadFields(selectedInstance, objectName);
  };

  const handleManualSync = async () => {
    if (!selectedInstance || !selectedObject || selectedFields.length === 0) {
      alert('Please select instance, object, and at least one field');
      return;
    }
    setIsSyncing(true);
    try {
      const selectedFieldObjs = fields.filter(f => selectedFields.includes(f.name));
      const response = await fetch(`${API_BASE}/sync/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedInstance,
          objectName: selectedObject,
          fields: selectedFieldObjs,
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

  const selectedInstanceObj = instances.find(i => i.id === selectedInstance);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Manual Data Sync</h2>
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          {/* Show object/field counts if present */}
          <div className="flex space-x-6 mb-4">
            {objects.length > 0 && (
              <span className="text-sm text-gray-600">Objects: <b>{objects.length}</b></span>
            )}
            {fields.length > 0 && (
              <span className="text-sm text-gray-600">Fields: <b>{fields.length}</b></span>
            )}
          </div>
          {/* Show selected instance DB config */}
          {selectedInstanceObj && (
            <div className="mb-4 p-3 bg-gray-50 border rounded">
              <div className="text-xs text-gray-500 mb-1">Target Database for this Instance:</div>
              <div className="text-sm"><b>Type:</b> {selectedInstanceObj.dbType}</div>
              <div className="text-sm"><b>URI:</b> <span title={selectedInstanceObj.dbUri}>{selectedInstanceObj.dbUri}</span></div>
              <div className="text-sm"><b>Name:</b> {selectedInstanceObj.dbName}</div>
            </div>
          )}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Object
                {objects.length > 0 && (
              <span className="text-sm text-gray-600"> ({objects.length})</span>
            )}
            </label>
              <ObjectSelect
                objects={objects}
                value={selectedObject}
                onChange={handleObjectChange}
              />
            </div>

            <div>
              <FieldMultiSelect
                fields={fields}
                selectedFields={selectedFields}
                onChange={setSelectedFields}
                label="Fields"
              />
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

export default SyncTab; 