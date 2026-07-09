const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

function saveSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function requireLogin() {
  if (!getToken()) {
    window.location.href = 'login.html';
  }
}

async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(API_BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    clearSession();
    window.location.href = 'login.html';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    throw new Error(data.message || 'Something went wrong');
  }
  return data;
}
