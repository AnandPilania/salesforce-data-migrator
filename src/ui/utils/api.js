const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('jwt');
  const url = path.startsWith('http') ? path : API_BASE + (path.startsWith('/') ? path : '/' + path);
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let err;
    try { err = await res.json(); } catch { err = { error: res.statusText }; }
    throw new Error(err.error || 'API error');
  }
  return res.json();
} 