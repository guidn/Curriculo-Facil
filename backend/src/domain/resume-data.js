'use strict';

const text = (value, limit = 2000) => String(value ?? '').trim().slice(0, limit);
const list = (value, mapper, limit = 40) => (Array.isArray(value) ? value : []).slice(0, limit).map(mapper).filter(Boolean);

function normalizeResumeData(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const oldPersonal = source.personal || {};
  const personal = {
    name: text(oldPersonal.name ?? source.name, 120),
    headline: text(oldPersonal.headline ?? source.headline ?? source.role, 160),
    email: text(oldPersonal.email ?? source.email, 160),
    phone: text(oldPersonal.phone ?? source.phone, 50),
    city: text(oldPersonal.city ?? source.city, 100),
    state: text(oldPersonal.state ?? source.state, 100),
    linkedin: text(oldPersonal.linkedin ?? source.linkedin, 240),
    github: text(oldPersonal.github ?? source.github, 240),
    portfolio: text(oldPersonal.portfolio ?? source.portfolio, 240)
  };
  const entries = (key, mapper) => list(source[key], mapper, 40);
  return {
    personal,
    summary: text(source.summary, 3000),
    experiences: entries('experiences', item => ({
      company: text(item?.company, 160), role: text(item?.role, 160), location: text(item?.location, 120),
      startDate: text(item?.startDate, 10), endDate: item?.current ? '' : text(item?.endDate, 10), current: item?.current === true,
      period: text(item?.period, 100),
      description: Array.isArray(item?.description) ? list(item.description, value => text(value, 800), 20) : text(item?.description, 3000).split(/\r?\n/).map(value => text(value, 800)).filter(Boolean)
    })).filter(item => Object.values(item).some(value => Array.isArray(value) ? value.length : value !== '' && value !== false)),
    education: entries('education', item => ({
      institution: text(item?.institution ?? item?.school, 180), course: text(item?.course, 180), location: text(item?.location, 120),
      startDate: text(item?.startDate, 10), endDate: item?.current ? '' : text(item?.endDate, 10), current: item?.current === true,
      period: text(item?.period, 100),
      description: text(item?.description, 1200)
    })).filter(item => Object.values(item).some(value => value !== '' && value !== false)),
    courses: entries('courses', item => ({ name: text(item?.name ?? item?.course, 180), institution: text(item?.institution, 180), date: text(item?.date, 40), url: text(item?.url, 240) })).filter(item => Object.values(item).some(Boolean)),
    skills: list(Array.isArray(source.skills) ? source.skills : String(source.skills || '').split(','), value => text(value, 80)),
    languages: entries('languages', item => ({ name: text(item?.name, 100), proficiency: text(item?.proficiency ?? item?.level, 100) })).filter(item => Object.values(item).some(Boolean)),
    certifications: entries('certifications', item => ({ name: text(item?.name, 180), issuer: text(item?.issuer, 180), date: text(item?.date, 40), url: text(item?.url, 240) })).filter(item => Object.values(item).some(Boolean)),
    projects: entries('projects', item => ({ name: text(item?.name, 180), description: text(item?.description, 1600), technologies: list(item?.technologies, value => text(value, 80)), url: text(item?.url, 240) })).filter(item => Object.values(item).some(value => Array.isArray(value) ? value.length : Boolean(value)))
  };
}

module.exports = { normalizeResumeData };

