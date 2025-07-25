import React, { useState } from 'react';

export default function ObjectSelect({ objects, value, onChange, label }) {
  const [search, setSearch] = useState('');

  const filteredObjects = objects.filter(obj =>
    obj.label.toLowerCase().includes(search.toLowerCase()) ||
    obj.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search objects..."
        className="w-full border border-gray-300 rounded-md px-2 py-1 mb-2 text-sm"
      />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2"
      >
        <option value="">Select Object</option>
        {filteredObjects.map(obj => (
          <option key={obj.name} value={obj.name}>
            {obj.label} ({obj.name})
          </option>
        ))}
      </select>
    </div>
  );
} 