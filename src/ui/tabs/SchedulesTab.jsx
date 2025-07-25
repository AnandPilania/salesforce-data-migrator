import React, { useState } from 'react';
import { Plus, Edit, Trash2, Play, Pause } from 'lucide-react';
import StatusIcon from '../components/StatusIcon';
import { formatDate, formatDuration } from '../utils/format';
import FieldMultiSelect from '../components/FieldMultiSelect';
import ObjectSelect from '../components/ObjectSelect';

const API_BASE = '/api';

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
      const selectedFieldObjs = fields.filter(f => formData.fields.includes(f.name));
      const url = editingSchedule
        ? `${API_BASE}/schedules/${editingSchedule.id}`
        : `${API_BASE}/schedules`;
      const method = editingSchedule ? 'PUT' : 'POST';
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, fields: selectedFieldObjs })
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

  const selectedInstanceObj = instances.find(i => i.id === formData.instanceId);

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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Object
                {objects.length > 0 && (
              <span className="text-sm text-gray-600">Objects: <b>{objects.length}</b></span>
            )}
                </label>
              <ObjectSelect
  objects={objects}
  value={formData.objectName}
  onChange={objectName => setFormData(prev => ({ ...prev, objectName, fields: [] }))}
  label="Object"
/>

{/*!loadingObjects && objects.length === 0 && (
  <p className="mt-1 text-sm text-gray-500">
    No objects found for this instance
  </p>
)*/}
            </div>

            <FieldMultiSelect
  fields={fields}
  selectedFields={formData.fields}
  onChange={fieldsArr => setFormData(prev => ({ ...prev, fields: fieldsArr }))}
  label="Fields"
/>

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

export default SchedulesTab; 