import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Play, Pause } from 'lucide-react';
import FieldMultiSelect from '../components/FieldMultiSelect';
import ObjectSelect from '../components/ObjectSelect';
import { formatMissingLabel } from '../utils/format';
import { apiFetch } from '../utils/api';
import cronstrue from 'cronstrue';

const SCHEDULE_TYPES = [
  { value: 'hourly', label: 'Hourly (every hour)' },
  { value: 'everyXMinutes', label: 'Every X minutes' },
  { value: 'everyXHours', label: 'Every X hours' },
  { value: 'daily', label: 'Daily at time' },
  { value: 'alternateDay', label: 'Every N days at time' },
  { value: 'weekly', label: 'Weekly on day/time' },
  { value: 'alternateWeek', label: 'Every N weeks (on Monday) at time' },
  { value: 'monthly', label: 'Monthly on day/time' },
  { value: 'alternateMonth', label: 'Every N months (on 1st) at time' },
  { value: 'quarterly', label: 'Quarterly (Jan/Apr/Jul/Oct 1st) at time' },
  { value: 'yearly', label: 'Yearly (Jan 1st) at time' },
  { value: 'custom', label: 'Custom cron pattern' }
];

function autoFormatCronInput(input) {
  // Auto-insert space after * or / or number if not already spaced
  return input
    .replace(/\s+/g, ' ')
    .replace(/(\*|\d+|\d+\/\d+)(?!\s|$)/g, '$1 ')
    .trim();
}

const SchedulesTab = ({ schedules, instances, onReload }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [formData, setFormData] = useState({
    instanceId: '',
    objectName: '',
    fields: [],
    targetDatabase: 'postgres',
    scheduleType: 'hourly',
    time: '00:00',
    dayOfWeek: '1',
    dayOfMonth: '1',
    customPattern: '',
    everyX: '15',
    alternate: '2',
    active: true
  });
  const [objects, setObjects] = useState([]);
  const [fields, setFields] = useState([]);
  const [editLoading, setEditLoading] = useState(false);

  const loadObjects = async (instanceId) => {
    if (!instanceId) return;
    setLoadingObjects(true);
    try {
      const data = await apiFetch(`/instances/${instanceId}/objects`);
      setObjects(formatMissingLabel(data));
    } catch (error) {
      console.error('Error loading objects:', error);
    } finally {
    setLoadingObjects(false);
  }
  };

  const loadFields = async (instanceId, objectName) => {
    if (!instanceId || !objectName) return;
    try {
      const data = await apiFetch(`/instances/${instanceId}/objects/${objectName}/fields`);
      setFields(formatMissingLabel(data));
    } catch (error) {
      console.error('Error loading fields:', error);
    }
  };

  // Enhanced cron pattern generator
  const getPattern = () => {
    if (formData.scheduleType === 'hourly') {
      return '0 * * * *';
    } else if (formData.scheduleType === 'everyXMinutes') {
      return `*/${formData.everyX} * * * *`;
    } else if (formData.scheduleType === 'everyXHours') {
      return `0 */${formData.everyX} * * *`;
    } else if (formData.scheduleType === 'daily') {
      const [h, m] = formData.time.split(':');
      return `${parseInt(m, 10)} ${parseInt(h, 10)} * * *`;
    } else if (formData.scheduleType === 'alternateDay') {
      const [h, m] = formData.time.split(':');
      return `${parseInt(m, 10)} ${parseInt(h, 10)} */${formData.alternate} * *`;
    } else if (formData.scheduleType === 'weekly') {
      const [h, m] = formData.time.split(':');
      return `${parseInt(m, 10)} ${parseInt(h, 10)} * * ${formData.dayOfWeek}`;
    } else if (formData.scheduleType === 'alternateWeek') {
      const [h, m] = formData.time.split(':');
      // Not standard cron, but simulate: run on Monday every N weeks
      return `${parseInt(m, 10)} ${parseInt(h, 10)} * * 1/${formData.alternate}`;
    } else if (formData.scheduleType === 'monthly') {
      const [h, m] = formData.time.split(':');
      return `${parseInt(m, 10)} ${parseInt(h, 10)} ${formData.dayOfMonth} * *`;
    } else if (formData.scheduleType === 'alternateMonth') {
      const [h, m] = formData.time.split(':');
      return `${parseInt(m, 10)} ${parseInt(h, 10)} 1 */${formData.alternate} *`;
    } else if (formData.scheduleType === 'quarterly') {
      const [h, m] = formData.time.split(':');
      return `${parseInt(m, 10)} ${parseInt(h, 10)} 1 1,4,7,10 *`;
    } else if (formData.scheduleType === 'yearly') {
      const [h, m] = formData.time.split(':');
      return `${parseInt(m, 10)} ${parseInt(h, 10)} 1 1 *`;
    } else if (formData.scheduleType === 'custom') {
      return formData.customPattern.trim();
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const selectedFieldObjs = fields.filter(f => formData.fields.includes(f.name));
      const url = editingSchedule
        ? `/schedules/${editingSchedule.id}`
        : `/schedules`;
      const method = editingSchedule ? 'PUT' : 'POST';
      const pattern = getPattern();
      if (!pattern) throw new Error('Invalid schedule pattern');
      await apiFetch(url, {
        method,
        body: JSON.stringify({
          ...formData,
          fields: selectedFieldObjs,
          pattern,
          // Remove UI-only fields
          scheduleType: undefined,
          dayOfWeek: undefined,
          dayOfMonth: undefined,
          customPattern: undefined,
          time: undefined,
          everyX: undefined,
          alternate: undefined
        })
      });
      setShowForm(false);
      setEditingSchedule(null);
      setFormData({
        instanceId: '',
        objectName: '',
        fields: [],
        targetDatabase: 'postgres',
        scheduleType: 'hourly',
        time: '00:00',
        dayOfWeek: '1',
        dayOfMonth: '1',
        customPattern: '',
        everyX: '15',
        alternate: '2',
        active: true
      });
      onReload();
    } catch (error) {
      alert(error.message || 'Error saving schedule');
    }
  };

  // Enhanced edit logic for retaining instance/object/fields
  const handleEdit = async (schedule) => {
    setEditLoading(true);
    setEditingSchedule(schedule);
    // Set instanceId first
    setFormData(f => ({
      ...f,
      instanceId: schedule.instanceId,
      scheduleType: 'hourly', // will be set below
      time: '00:00',
      dayOfWeek: '1',
      dayOfMonth: '1',
      customPattern: '',
      everyX: '15',
      alternate: '2',
      active: schedule.active
    }));
    // Load objects for instance
    await loadObjects(schedule.instanceId);
    // Set objectName
    setFormData(f => ({ ...f, objectName: schedule.objectName }));
    // Load fields for object
    await loadFields(schedule.instanceId, schedule.objectName);
    // Set fields
    setFormData(f => ({ ...f, fields: schedule.fields }));
    // Parse cron pattern to UI fields
    let scheduleType = 'custom', time = '00:00', dayOfWeek = '1', dayOfMonth = '1', customPattern = schedule.pattern || '', everyX = '15', alternate = '2';
    if (schedule.pattern === '0 * * * *') {
      scheduleType = 'hourly';
    } else {
      const parts = (schedule.pattern || '').split(' ');
      if (parts.length === 5) {
        if (parts[0].startsWith('*/')) { scheduleType = 'everyXMinutes'; everyX = parts[0].slice(2); }
        else if (parts[1].startsWith('*/')) { scheduleType = 'everyXHours'; everyX = parts[1].slice(2); }
        else if (parts[2].startsWith('*/')) { scheduleType = 'alternateDay'; alternate = parts[2].slice(2); }
        else if (parts[4].includes('/')) { scheduleType = 'alternateWeek'; alternate = parts[4].split('/')[1]; }
        else if (parts[3].includes('/')) { scheduleType = 'alternateMonth'; alternate = parts[3].split('/')[1]; }
        else if (parts[2] === '*' && parts[4] === '*') scheduleType = 'daily';
        else if (parts[2] === '*' && parts[4] !== '*') scheduleType = 'weekly';
        else if (parts[2] !== '*' && parts[4] === '*') scheduleType = 'monthly';
        else if (parts[2] === '1' && ['1','4','7','10'].includes(parts[3])) scheduleType = 'quarterly';
        else if (parts[2] === '1' && parts[3] === '1') scheduleType = 'yearly';
        if (scheduleType !== 'custom') {
          time = `${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')}`;
          if (scheduleType === 'weekly') dayOfWeek = parts[4];
          if (scheduleType === 'monthly') dayOfMonth = parts[2];
        }
      }
    }
    setFormData(f => ({
      ...f,
      scheduleType,
      time,
      dayOfWeek,
      dayOfMonth,
      customPattern,
      everyX,
      alternate
    }));
    setShowForm(true);
    setEditLoading(false);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      try {
        await apiFetch(`/schedules/${id}`, { method: 'DELETE' });
        onReload();
      } catch (error) {
        console.error('Error deleting schedule:', error);
      }
    }
  };

  const toggleSchedule = async (id) => {
    try {
      await apiFetch(`/schedules/${id}/toggle`, { method: 'POST' });
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

  // Load fields when object or instance changes
  useEffect(() => {
    if (formData.instanceId && formData.objectName) {
      loadFields(formData.instanceId, formData.objectName);
    } else {
      setFields([]);
    }
    // eslint-disable-next-line
  }, [formData.instanceId, formData.objectName]);

  // Live cron summary using cronstrue
  const pattern = getPattern();
  let summary = '';
  try {
    summary = cronstrue.toString(pattern, { throwExceptionOnParseError: false });
  } catch {
    summary = 'Invalid cron pattern';
  }

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
          <div className="flex space-x-6 mb-4">
            {objects.length > 0 && (
              <span className="text-sm text-gray-600">Objects: <b>{objects.length}</b></span>
            )}
            {fields.length > 0 && (
              <span className="text-sm text-gray-600">Fields: <b>{fields.length}</b></span>
            )}
          </div>
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

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
              <div className="flex flex-col space-y-2">
              <select
                  value={formData.scheduleType}
                  onChange={e => setFormData(f => ({ ...f, scheduleType: e.target.value }))}
                  className="border rounded px-2 py-1 w-full max-w-xs mb-2"
                >
                  {SCHEDULE_TYPES.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {formData.scheduleType === 'everyXMinutes' && (
                  <div className="flex items-center space-x-2">
                    <span>Every</span>
                    <input type="number" min="1" max="59" value={formData.everyX} onChange={e => setFormData(f => ({ ...f, everyX: e.target.value }))} className="border rounded px-2 py-1 w-16" />
                    <span>minutes</span>
                  </div>
                )}
                {formData.scheduleType === 'everyXHours' && (
                  <div className="flex items-center space-x-2">
                    <span>Every</span>
                    <input type="number" min="1" max="23" value={formData.everyX} onChange={e => setFormData(f => ({ ...f, everyX: e.target.value }))} className="border rounded px-2 py-1 w-16" />
                    <span>hours</span>
                  </div>
                )}
                {formData.scheduleType === 'daily' && (
                  <div className="flex items-center space-x-2">
                    <span>At</span>
                    <input type="time" value={formData.time} onChange={e => setFormData(f => ({ ...f, time: e.target.value }))} className="border rounded px-2 py-1" />
                  </div>
                )}
                {formData.scheduleType === 'alternateDay' && (
                  <div className="flex items-center space-x-2">
                    <span>Every</span>
                    <input type="number" min="2" max="31" value={formData.alternate} onChange={e => setFormData(f => ({ ...f, alternate: e.target.value }))} className="border rounded px-2 py-1 w-16" />
                    <span>days at</span>
                    <input type="time" value={formData.time} onChange={e => setFormData(f => ({ ...f, time: e.target.value }))} className="border rounded px-2 py-1" />
                  </div>
                )}
                {formData.scheduleType === 'weekly' && (
                  <div className="flex items-center space-x-2">
                    <span>On</span>
                    <select value={formData.dayOfWeek} onChange={e => setFormData(f => ({ ...f, dayOfWeek: e.target.value }))} className="border rounded px-2 py-1">
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
              </select>
                    <span>at</span>
                    <input type="time" value={formData.time} onChange={e => setFormData(f => ({ ...f, time: e.target.value }))} className="border rounded px-2 py-1" />
                  </div>
                )}
                {formData.scheduleType === 'alternateWeek' && (
                  <div className="flex items-center space-x-2">
                    <span>Every</span>
                    <input type="number" min="2" max="12" value={formData.alternate} onChange={e => setFormData(f => ({ ...f, alternate: e.target.value }))} className="border rounded px-2 py-1 w-16" />
                    <span>weeks (on Monday) at</span>
                    <input type="time" value={formData.time} onChange={e => setFormData(f => ({ ...f, time: e.target.value }))} className="border rounded px-2 py-1" />
                  </div>
                )}
                {formData.scheduleType === 'monthly' && (
                  <div className="flex items-center space-x-2">
                    <span>On day</span>
                    <input type="number" min="1" max="31" value={formData.dayOfMonth} onChange={e => setFormData(f => ({ ...f, dayOfMonth: e.target.value }))} className="border rounded px-2 py-1 w-16" />
                    <span>at</span>
                    <input type="time" value={formData.time} onChange={e => setFormData(f => ({ ...f, time: e.target.value }))} className="border rounded px-2 py-1" />
                  </div>
                )}
                {formData.scheduleType === 'alternateMonth' && (
                  <div className="flex items-center space-x-2">
                    <span>Every</span>
                    <input type="number" min="2" max="12" value={formData.alternate} onChange={e => setFormData(f => ({ ...f, alternate: e.target.value }))} className="border rounded px-2 py-1 w-16" />
                    <span>months (on 1st) at</span>
                    <input type="time" value={formData.time} onChange={e => setFormData(f => ({ ...f, time: e.target.value }))} className="border rounded px-2 py-1" />
                  </div>
                )}
                {formData.scheduleType === 'quarterly' && (
                  <div className="flex items-center space-x-2">
                    <span>Quarterly (Jan/Apr/Jul/Oct 1st) at</span>
                    <input type="time" value={formData.time} onChange={e => setFormData(f => ({ ...f, time: e.target.value }))} className="border rounded px-2 py-1" />
                  </div>
                )}
                {formData.scheduleType === 'yearly' && (
                  <div className="flex items-center space-x-2">
                    <span>Yearly (Jan 1st) at</span>
                    <input type="time" value={formData.time} onChange={e => setFormData(f => ({ ...f, time: e.target.value }))} className="border rounded px-2 py-1" />
            </div>
                )}
                {formData.scheduleType === 'custom' && (
                  <div className="flex items-center space-x-2">
                    <span>Cron pattern</span>
              <input
                      type="text"
                      value={formData.customPattern}
                      onChange={e => setFormData(f => ({ ...f, customPattern: autoFormatCronInput(e.target.value) }))}
                      className="ml-2 border rounded px-2 py-1 flex-1"
                      placeholder="* * * * *"
                    />
                    <span className="ml-2 text-xs text-gray-500">(min hour day month weekDay)</span>
                  </div>
                )}
                <div className="text-xs text-blue-700 mt-2">{summary}</div>
              </div>
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
      {editLoading && <div className="p-4 text-center text-blue-600">Loading schedule for edit...</div>}

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
                      {schedule.pattern ? new Date(schedule.pattern).toLocaleString() : 'N/A'}
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
