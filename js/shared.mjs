const API = '/api';
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let currentUserRequest;
export function cacheCurrentUser(user) { currentUserRequest = Promise.resolve(user); }
export function clearCurrentUserCache() { currentUserRequest = null; }
export async function api(path, options = {}) {
  const response = await fetch(API + path, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) { const error = new Error(data?.error || 'Não foi possível concluir a operação.'); error.code = data?.code; error.details = data?.details; throw error; }
  return data;
}
export async function currentUser() {
  if (!currentUserRequest) currentUserRequest = api('/auth/me').then(result => result.user).catch(() => null);
  return currentUserRequest;
}
export function toast(message, type = 'info') {
  let element = $('.cf-toast');
  if (!element) { element = document.createElement('div'); element.className = 'cf-toast'; document.body.appendChild(element); }
  element.textContent = message; element.dataset.type = type;
  setTimeout(() => element.remove(), 3200);
}
export function go(path) { window.location.href = path; }
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
}
