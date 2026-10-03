/* Shared semantic resume renderer for the editor preview, model cards and server export. */
(function (root) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const headings = { summary:'Resumo profissional', experiences:'Experiência profissional', education:'Formação acadêmica', courses:'Cursos', skills:'Habilidades', languages:'Idiomas', certifications:'Certificações', projects:'Projetos' };
  const safeUrl = value => /^https?:\/\//i.test(String(value || '')) ? String(value) : '';
  function normalize(input = {}) {
    const personal = input.personal || {};
    return {
      personal: { name:personal.name || input.name || '', headline:personal.headline || input.headline || input.role || '', email:personal.email || input.email || '', phone:personal.phone || input.phone || '', city:personal.city || input.city || '', state:personal.state || input.state || '', linkedin:personal.linkedin || input.linkedin || '', github:personal.github || input.github || '', portfolio:personal.portfolio || input.portfolio || '' },
      summary:input.summary || '', experiences:input.experiences || [], education:input.education || [], courses:input.courses || [], skills:Array.isArray(input.skills) ? input.skills : String(input.skills || '').split(',').map(x=>x.trim()).filter(Boolean), languages:input.languages || [], certifications:input.certifications || [], projects:input.projects || []
    };
  }
  function period(item) {
    const fmt = value => { if (!value) return ''; const date = new Date(`${String(value).slice(0,10)}T00:00:00`); return Number.isNaN(date.valueOf()) ? escape(value) : date.toLocaleDateString('pt-BR',{month:'short',year:'numeric'}); };
    return item.period || [fmt(item.startDate), item.current ? 'Atual' : fmt(item.endDate)].filter(Boolean).join(' – ');
  }
  function section(id, content) { return content ? `<section class="resume-section resume-${id}"><h2>${headings[id]}</h2>${content}</section>` : ''; }
  function renderBody(raw = {}, options = {}) {
    const d = normalize(raw), title = options.title || 'Meu currículo';
    const contact = [d.personal.email,d.personal.phone,[d.personal.city,d.personal.state].filter(Boolean).join(' - '),d.personal.linkedin,d.personal.github,d.personal.portfolio].filter(Boolean);
    const exp = d.experiences.map(x => `<article class="resume-item"><div class="resume-item-heading"><h3>${escape(x.role)}${x.company ? ` · ${escape(x.company)}` : ''}</h3><span>${escape(period(x))}</span></div>${x.location ? `<p class="resume-meta">${escape(x.location)}</p>` : ''}${(Array.isArray(x.description) ? x.description : [x.description]).filter(Boolean).map(text=>`<p>${escape(text)}</p>`).join('')}</article>`).join('');
    const edu = d.education.map(x => `<article class="resume-item"><div class="resume-item-heading"><h3>${escape(x.course)}</h3><span>${escape(period(x))}</span></div><p class="resume-meta">${escape(x.institution || x.school)}${x.location ? ` · ${escape(x.location)}` : ''}</p>${x.description ? `<p>${escape(x.description)}</p>` : ''}</article>`).join('');
    const simple = (items, mapper) => items.map(mapper).join('');
    const courses = simple(d.courses, x=>`<li><strong>${escape(x.name || x.course)}</strong>${x.institution ? ` · ${escape(x.institution)}` : ''}${x.date ? ` · ${escape(x.date)}` : ''}</li>`);
    const skills = d.skills.map(x=>`<li>${escape(x)}</li>`).join('');
    const languages = simple(d.languages,x=>`<li><strong>${escape(x.name)}</strong>${x.proficiency || x.level ? ` · ${escape(x.proficiency || x.level)}` : ''}</li>`);
    const certificates = simple(d.certifications,x=>`<li><strong>${escape(x.name)}</strong>${x.issuer ? ` · ${escape(x.issuer)}` : ''}${x.date ? ` · ${escape(x.date)}` : ''}</li>`);
    const projects = simple(d.projects,x=>`<article class="resume-item"><div class="resume-item-heading"><h3>${escape(x.name)}</h3>${safeUrl(x.url) ? `<a href="${escape(safeUrl(x.url))}">${escape(x.url)}</a>` : ''}</div>${x.description ? `<p>${escape(x.description)}</p>` : ''}${x.technologies?.length ? `<p class="resume-meta">${x.technologies.map(escape).join(' · ')}</p>` : ''}</article>`);
    const links = contact.map(item=>`<span>${escape(item)}</span>`).join('');
    return `<header class="resume-header"><h1>${escape(d.personal.name || title)}</h1>${d.personal.headline ? `<p class="resume-headline">${escape(d.personal.headline)}</p>` : ''}${links ? `<div class="resume-contact">${links}</div>` : ''}</header>${section('summary',d.summary ? `<p>${escape(d.summary)}</p>` : '')}${section('experiences',exp)}${section('education',edu)}${section('courses',courses ? `<ul>${courses}</ul>` : '')}${section('skills',skills ? `<ul class="resume-skills">${skills}</ul>` : '')}${section('languages',languages ? `<ul>${languages}</ul>` : '')}${section('certifications',certificates ? `<ul>${certificates}</ul>` : '')}${section('projects',projects)}`;
  }
  function renderDocument(resume, options = {}) {
    const template = /^[a-z0-9-]+$/.test(resume.template || '') ? resume.template : 'modern';
    const body = renderBody(resume.data || {}, { title:resume.title });
    if (options.fragment) return `<article class="paper resume-paper template-${template}" data-template="${template}" style="--accent:${escape(resume.accent || '#742cff')}">${body}</article>`;
    const action = options.publicMode ? '' : `<div class="no-print export-actions"><button onclick="window.print()">Salvar como PDF</button><button onclick="window.close()">Fechar</button></div>`;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(resume.title || 'Currículo')}</title><link rel="stylesheet" href="/css/pages/resume-renderer.css"><style>body{margin:0;background:#ececf0;font-family:Arial,sans-serif}.export-actions{position:sticky;top:0;display:flex;justify-content:center;gap:8px;padding:12px;background:#17131d}.export-actions button{padding:10px 15px;border:0;border-radius:8px;background:#742cff;color:#fff;font-weight:700;cursor:pointer}</style></head><body>${action}<article class="paper resume-paper template-${template}" data-template="${template}" style="--accent:${escape(resume.accent || '#742cff')}">${body}</article></body></html>`;
  }
  function toText(resume) {
    const d = normalize(resume.data || {}), location = [d.personal.city,d.personal.state].filter(Boolean).join(' - ');
    const contacts = [location,d.personal.phone,d.personal.email,d.personal.linkedin,d.personal.github,d.personal.portfolio].filter(Boolean).join('\n');
    const lines = [d.personal.name || resume.title, d.personal.headline, contacts ? `CONTATO\n${contacts}` : ''];
    const add = (heading, items) => { if(items) lines.push('',heading,items); };
    add('RESUMO PROFISSIONAL',d.summary);
    add('EXPERIÊNCIA PROFISSIONAL',d.experiences.map(x=>[x.role,x.company,[x.location,period(x)].filter(Boolean).join(' · '),...(Array.isArray(x.description)?x.description:[x.description])].filter(Boolean).join('\n')).join('\n\n'));
    add('FORMAÇÃO ACADÊMICA',d.education.map(x=>[x.course,x.institution || x.school,period(x),x.description].filter(Boolean).join('\n')).join('\n\n'));
    add('CURSOS',d.courses.map(x=>[x.name || x.course,x.institution,x.date].filter(Boolean).join(' · ')).join('\n'));
    add('HABILIDADES',d.skills.join(' · ')); add('IDIOMAS',d.languages.map(x=>[x.name,x.proficiency || x.level].filter(Boolean).join(' · ')).join('\n'));
    add('CERTIFICAÇÕES',d.certifications.map(x=>[x.name,x.issuer,x.date].filter(Boolean).join(' · ')).join('\n'));
    add('PROJETOS',d.projects.map(x=>[x.name,x.description,(x.technologies || []).join(', '),x.url].filter(Boolean).join('\n')).join('\n\n'));
    return lines.filter((value,index)=>value!=='' || lines[index-1]!=='').join('\n').trim()+'\n';
  }
  const api = { normalize, renderBody, renderDocument, toText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ResumeRendering = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

