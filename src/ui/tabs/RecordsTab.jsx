import React, { useState, useEffect } from 'react';
import ObjectSelect from '../components/ObjectSelect';
import FieldMultiSelect from '../components/FieldMultiSelect';
import { formatMissingLabel } from '../utils/format';
import { apiFetch } from '../utils/api';

export default function RecordsTab({ instances }) {
  const [selectedInstance, setSelectedInstance] = useState('');
  const [mode, setMode] = useState('local');
  const [objects, setObjects] = useState([]);
  const [selectedObject, setSelectedObject] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [fields, setFields] = useState([]);
  const [showFieldDialog, setShowFieldDialog] = useState(false);
  const [selectedFields, setSelectedFields] = useState([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setObjects([]);
    setSelectedObject('');
    setRecords([]);
    setDiff(null);
    if (!selectedInstance) return;
    if (mode === 'local') {
      apiFetch(`/instances/${selectedInstance}/local-objects`)
        .then(setObjects)
        .catch(() => setObjects([]));
    } else if (mode === 'diff') {
      apiFetch(`/instances/${selectedInstance}/objects`)
        .then(res => res.json())
        .then(objs => setObjects(formatMissingLabel(objs)))
        .catch(() => setObjects([]));
    }
  }, [selectedInstance, mode]);

  useEffect(() => {
    setRecords([]);
    setDiff(null);
    if (!selectedInstance || !selectedObject) return;
    if (mode === 'local') {
      fetchRecords(selectedObject);
    } else if (mode === 'diff') {
      fetchDiff(selectedObject);
    }
    // eslint-disable-next-line
  }, [selectedObject]);

  const fetchFields = async (instanceId, objectName) => {
    if (!instanceId || !objectName) return;
    try {
      const data = await apiFetch(`/instances/${instanceId}/objects/${objectName}/fields`);
      setFields(formatMissingLabel(data));
    } catch (error) {
      setFields([]);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const selectedFieldObjs = fields.filter(f => selectedFields.includes(f.name));
      const response = await apiFetch(`/sync/manual`, {
        method: 'POST',
        body: JSON.stringify({
          instanceId: selectedInstance,
          objectName: selectedObject,
          fields: selectedFieldObjs
        })
      });
      setShowFieldDialog(false);
      setSelectedFields([]);
      fetchDiff(selectedObject);
    } catch (error) {
      alert('Error starting sync');
    }
    setSyncing(false);
  };

  const fetchRecords = async (objectName) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/instances/${selectedInstance}/objects/${objectName}/records`);
      setRecords(data);
    } catch {
      setRecords([]);
    }
    setLoading(false);
  };

  const fetchDiff = async (objectName) => {
    setDiffLoading(true);
    try {
      const data = await apiFetch(`/instances/${selectedInstance}/objects/${objectName}/diff`);
      setDiff(data);
    } catch {
      setDiff(null);
    }
    setDiffLoading(false);
  };

  return (
    <div>
      <div className="flex space-x-4 mb-4 items-end">
        <div className="w-1/3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Instance</label>
          <select
            value={selectedInstance}
            onChange={e => setSelectedInstance(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">Select Instance</option>
            {instances.map(inst => (
              <option key={inst.id || inst.name} value={inst.id || inst.name}>{inst.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end space-x-2">
          <button
            className={`px-3 py-2 rounded-md text-sm font-medium ${mode === 'local' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            onClick={() => setMode('local')}
            disabled={mode === 'local'}
          >
            Local Only
          </button>
          <button
            className={`px-3 py-2 rounded-md text-sm font-medium ${mode === 'diff' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            onClick={() => setMode('diff')}
            disabled={mode === 'diff'}
          >
            Salesforce + Diff
          </button>
        </div>
        <div className="w-1/3">
          <ObjectSelect
            objects={objects}
            value={selectedObject}
            onChange={setSelectedObject}
            label="Object"
          />
        </div>
      </div>
      {mode === 'local' && records.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr>
                {Object.keys(records[0]).map(key => (
                  <th key={key} className="px-2 py-1 border-b text-xs text-gray-700">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((rec, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {Object.keys(records[0]).map(key => (
                    <td key={key} className="px-2 py-1 border-b text-xs text-gray-900">{String(rec[key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mode === 'diff' && (
        <div>
          {diffLoading ? (
            <div className="text-gray-500 mt-4">Loading diff...</div>
          ) : diff ? (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border">
                <thead>
                  <tr>
                    <th className="px-2 py-1 border-b text-xs text-gray-700">Object</th>
                    <th className="px-2 py-1 border-b text-xs text-gray-700">In Salesforce</th>
                    <th className="px-2 py-1 border-b text-xs text-gray-700">In Local</th>
                    <th className="px-2 py-1 border-b text-xs text-gray-700">Salesforce Count</th>
                    <th className="px-2 py-1 border-b text-xs text-gray-700">Local Count</th>
                    <th className="px-2 py-1 border-b text-xs text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50">
                    <td className="px-2 py-1 border-b text-xs text-gray-900">{diff.label} ({diff.name})</td>
                    <td className="px-2 py-1 border-b text-xs text-gray-900 text-center">{diff.inSalesforce ? '✔️' : ''}</td>
                    <td className="px-2 py-1 border-b text-xs text-gray-900 text-center">{diff.inLocal ? '✔️' : ''}</td>
                    <td className="px-2 py-1 border-b text-xs text-gray-900 text-center">{diff.salesforceCount}</td>
                    <td className="px-2 py-1 border-b text-xs text-gray-900 text-center">{diff.localCount}</td>
                    <td className="px-2 py-1 border-b text-xs text-gray-900 text-center">
                      {diff.inLocal && (
                        <button
                          className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                          onClick={() => fetchRecords(diff.name)}
                        >
                          View Records
                        </button>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-gray-500 mt-4">No diff to display.</div>
          )}
          {records.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Records for <span className="font-mono">{selectedObject}</span></h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border">
                  <thead>
                    <tr>
                      {Object.keys(records[0]).map(key => (
                        <th key={key} className="px-2 py-1 border-b text-xs text-gray-700">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((rec, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {Object.keys(records[0]).map(key => (
                          <td key={key} className="px-2 py-1 border-b text-xs text-gray-900">{String(rec[key])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {diff && (
            <div className="mt-4 flex space-x-2">
              <button
                className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm"
                onClick={async () => {
                  await fetchFields(selectedInstance, selectedObject);
                  setShowFieldDialog(true);
                }}
                disabled={!diff.inSalesforce}
              >
                {diff.inLocal ? 'Re-sync' : 'Sync'}
              </button>
            </div>
          )}
          {/* Field selection dialog */}
          {showFieldDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-2">Select Fields to Sync</h3>
                <FieldMultiSelect
                  fields={fields}
                  selectedFields={selectedFields}
                  onChange={setSelectedFields}
                  label="Fields"
                />
                <div className="mt-4 flex justify-end space-x-2">
                  <button
                    className="px-4 py-2 bg-gray-200 rounded-md"
                    onClick={() => setShowFieldDialog(false)}
                    disabled={syncing}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded-md"
                    onClick={handleSync}
                    disabled={syncing || selectedFields.length === 0}
                  >
                    {syncing ? 'Syncing...' : 'Start Sync'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
