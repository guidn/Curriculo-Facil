'use strict';

function text(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function date(value) {
  const candidate = text(value, 10);
  if (!candidate) return '';
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== candidate) {
    throw new Error('Informe datas válidas no formato de calendário.');
  }
  return candidate;
}

function normalizeResumeProfile(value = {}) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const list = (items, kind) => (Array.isArray(items) ? items : []).slice(0, 30).map(item => {
    const entry = item && typeof item === 'object' ? item : {};
    const startDate = date(entry.startDate);
    const current = entry.current === true;
    const endDate = current ? '' : date(entry.endDate);
    if (startDate && endDate && startDate > endDate) throw new Error('A data de término deve ser igual ou posterior à data de início.');
    const common = { startDate, endDate, current };
    return kind === 'experience'
      ? { ...common, role: text(entry.role, 120), company: text(entry.company, 120), description: text(entry.description, 1500), ...(entry.period ? { period: text(entry.period, 100) } : {}) }
      : { ...common, course: text(entry.course, 160), school: text(entry.school, 160), ...(entry.period ? { period: text(entry.period, 100) } : {}) };
  }).filter(entry => Object.values(entry).some(item => item !== '' && item !== false));
  const skills = (Array.isArray(input.skills) ? input.skills : String(input.skills || '').split(',')).slice(0, 40).map(skill => text(skill, 60)).filter(Boolean);
  return {
    role: text(input.role, 120),
    phone: text(input.phone, 40),
    city: text(input.city, 100),
    summary: text(input.summary, 2000),
    skills,
    experiences: list(input.experiences, 'experience'),
    education: list(input.education, 'education')
  };
}

module.exports = { normalizeResumeProfile };
