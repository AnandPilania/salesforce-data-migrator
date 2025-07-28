import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

function InstanceMultiSelect({ instances, value, onChange }) {
  const toggle = id => {
    if (value.includes(id)) {
      onChange(value.filter(i => i !== id));
    } else {
      onChange([...value, id]);
    }
  };
  return (
    <div className="border rounded p-2 bg-gray-50">
      {instances.map(inst => (
        <label key={inst.id} className="flex items-center text-xs mb-1 cursor-pointer">
          <input
            type="checkbox"
            checked={value.includes(inst.id)}
            onChange={() => toggle(inst.id)}
            className="mr-2"
          />
          {inst.name}
        </label>
      ))}
      <div className="text-xs text-gray-500 mt-1">(Check to assign. Uncheck to revoke. No checks = no access.)</div>
    </div>
  );
}

export default function UsersTab({ instances, token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', instanceIds: [] });
  const [submitting, setSubmitting] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ email: '', password: '', instanceIds: [] });
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => { loadUsers(); }, []);
  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/users`);
      setUsers(data);
    } catch (e) { setError('Failed to load users'); }
    setLoading(false);
  };

  const handleRegister = async e => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      const res = await apiFetch(`/auth/register`, {
        method: 'POST', 
        body: JSON.stringify({ ...form, instanceIds: form.instanceIds })
      });
      setShowForm(false); setForm({ email: '', password: '', instanceIds: [] });
      loadUsers();
    } catch (e) { setError(e.message); }
    setSubmitting(false);
  };

  const handleAssign = async (userId, instanceIds) => {
    await apiFetch(`/users/${userId}/assign`, {
      method: 'POST', 
      body: JSON.stringify({ instanceIds })
    });
    loadUsers();
  };

  const handleDelete = async userId => {
    if (!window.confirm('Delete this user?')) return;
    await apiFetch(`/users/${userId}`, { method: 'DELETE' });
    loadUsers();
  };

  const openEdit = user => {
    setEditUser(user);
    setEditForm({ email: user.email, password: '', instanceIds: user.instanceIds || [] });
  };
  const closeEdit = () => { setEditUser(null); setEditForm({ email: '', password: '', instanceIds: [] }); };
  const handleEdit = async e => {
    e.preventDefault();
    setEditSubmitting(true); setError('');
    try {
      await apiFetch(`/users/${editUser._id}/edit`, {
        method: 'POST',
        body: JSON.stringify({ email: editForm.email, password: editForm.password, instanceIds: editForm.instanceIds })
      });
      closeEdit();
      loadUsers();
    } catch (e) { setError(e.message); }
    setEditSubmitting(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">User Management</h2>
        <button onClick={() => setShowForm(f => !f)} className="bg-blue-600 text-white px-4 py-2 rounded">Register New User</button>
      </div>
      {showForm && (
        <form onSubmit={handleRegister} className="bg-white p-4 rounded shadow mb-6">
          <div className="mb-2">
            <label className="block text-sm font-medium">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full border px-2 py-1 rounded" required />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium">Password</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full border px-2 py-1 rounded" required />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium">Assign Instances</label>
            <InstanceMultiSelect instances={instances} value={form.instanceIds} onChange={ids => setForm(f => ({ ...f, instanceIds: ids }))} />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded" disabled={submitting}>{submitting ? 'Registering...' : 'Register'}</button>
          <button type="button" className="ml-2 px-4 py-2 rounded bg-gray-200" onClick={() => setShowForm(false)}>Cancel</button>
        </form>
      )}
      {editUser && (
        <form onSubmit={handleEdit} className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">Edit User</h3>
            <div className="mb-2">
              <label className="block text-sm font-medium">Email</label>
              <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="w-full border px-2 py-1 rounded" required />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium">Password (leave blank to keep unchanged)</label>
              <input type="password" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} className="w-full border px-2 py-1 rounded" />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium">Assign Instances</label>
              <InstanceMultiSelect instances={instances} value={editForm.instanceIds} onChange={ids => setEditForm(f => ({ ...f, instanceIds: ids }))} />
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button type="button" className="px-4 py-2 bg-gray-200 rounded-md" onClick={closeEdit} disabled={editSubmitting}>Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md" disabled={editSubmitting}>{editSubmitting ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </form>
      )}
      {error && <div className="text-red-600 mb-2">{error}</div>}
      {loading ? <div>Loading users...</div> : (
        <table className="min-w-full bg-white border">
          <thead>
            <tr>
              <th className="px-2 py-1 border-b text-xs text-gray-700">Email</th>
              <th className="px-2 py-1 border-b text-xs text-gray-700">Role</th>
              <th className="px-2 py-1 border-b text-xs text-gray-700">Instances</th>
              <th className="px-2 py-1 border-b text-xs text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user._id}>
                <td className="px-2 py-1 border-b text-xs text-gray-900">{user.email}</td>
                <td className="px-2 py-1 border-b text-xs text-gray-900">{user.role}</td>
                <td className="px-2 py-1 border-b text-xs text-gray-900">
                  <InstanceMultiSelect
                    instances={instances}
                    value={user.instanceIds || []}
                    onChange={ids => handleAssign(user._id, ids)}
                  />
                </td>
                <td className="px-2 py-1 border-b text-xs text-gray-900">
                  <button onClick={() => openEdit(user)} className="px-2 py-1 bg-yellow-500 text-white rounded text-xs mr-2">Edit</button>
                  <button onClick={() => handleDelete(user._id)} className="px-2 py-1 bg-red-500 text-white rounded text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
