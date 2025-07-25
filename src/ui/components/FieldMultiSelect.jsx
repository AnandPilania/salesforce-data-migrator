import React, { useState } from 'react';

export default function FieldMultiSelect({ fields, selectedFields, onChange, label }) {
  const [search, setSearch] = useState('');

  const filteredFields = fields.filter(f =>
    f.label.toLowerCase().includes(search.toLowerCase()) ||
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = filteredFields.length > 0 && filteredFields.every(f => selectedFields.includes(f.name));
  const noneSelected = filteredFields.every(f => !selectedFields.includes(f.name));

  const handleToggle = (fieldName) => {
    if (selectedFields.includes(fieldName)) {
      onChange(selectedFields.filter(f => f !== fieldName));
    } else {
      onChange([...selectedFields, fieldName]);
    }
  };

  const handleSelectAll = () => {
    const toAdd = filteredFields.map(f => f.name).filter(f => !selectedFields.includes(f));
    onChange([...selectedFields, ...toAdd]);
  };

  const handleDeselectAll = () => {
    const toKeep = selectedFields.filter(f => !filteredFields.map(f => f.name).includes(f));
    onChange(toKeep);
  };

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search fields..."
        className="w-full border border-gray-300 rounded-md px-2 py-1 mb-2 text-sm"
      />
      <div className="flex space-x-2 mb-2">
        <button
          type="button"
          className="text-xs px-2 py-1 border rounded bg-gray-100 hover:bg-gray-200"
          onClick={handleSelectAll}
          disabled={allSelected || filteredFields.length === 0}
        >
          Select All
        </button>
        <button
          type="button"
          className="text-xs px-2 py-1 border rounded bg-gray-100 hover:bg-gray-200"
          onClick={handleDeselectAll}
          disabled={noneSelected || filteredFields.length === 0}
        >
          Deselect All
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2 bg-white">
        {filteredFields.length > 0 ? (
          filteredFields.map(field => (
            <div key={field.name} className="flex items-center mb-1">
              <input
                type="checkbox"
                id={`field-multiselect-${field.name}`}
                checked={selectedFields.includes(field.name)}
                onChange={() => handleToggle(field.name)}
                className="mr-2"
              />
              <label htmlFor={`field-multiselect-${field.name}`} className="text-sm">
                {field.label} ({field.name})
              </label>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">No fields found</p>
        )}
      </div>
    </div>
  );
} 