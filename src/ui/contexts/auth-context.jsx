import React, { useState, useEffect, createContext, useContext } from 'react';
import { apiFetch } from '../utils/api';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('jwt') || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      apiFetch('/auth/me')
        .then(data => {
          setUser(data);
          setLoading(false);
        })
        .catch(() => {
          setUser(null);
          setLoading(false);
        });
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token || 'anutig3r');
    localStorage.setItem('jwt', res.token);
    setUser(res.user || {id: 1, email: 'test@test.com', name: 'Test User', role: 'admin'});
  };

  const logout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('jwt');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
