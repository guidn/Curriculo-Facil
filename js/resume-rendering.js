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
    const css = `.resume-paper{--accent:${escape(resume.accent || '#742cff')};box-sizing:border-box;width:210mm;min-height:297mm;margin:0 auto;padding:18mm 19mm;background:#fff;color:#202027;font:10.5pt/1.48 Arial,Helvetica,sans-serif}.resume-paper *{box-sizing:border-box}.resume-header{padding-bottom:15px;border-bottom:2px solid var(--accent)}.resume-header h1{margin:0;font-size:28pt;line-height:1.08;letter-spacing:-.03em}.resume-headline{margin:7px 0 0;font-size:13pt;font-weight:600}.resume-contact{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:11px;font-size:9pt;color:#4c4a50}.resume-section{margin-top:18px;break-inside:auto}.resume-section h2{margin:0 0 8px;color:var(--accent);font-size:12pt;line-height:1.2;text-transform:uppercase;letter-spacing:.08em}.resume-section p{margin:4px 0}.resume-item{margin:0 0 11px;break-inside:avoid}.resume-item-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px}.resume-item h3{margin:0;font-size:11pt}.resume-item-heading>span,.resume-meta{color:#5c5961;font-size:9.5pt}.resume-item-heading>a{font-size:8.5pt;color:inherit;overflow-wrap:anywhere}.resume-paper ul{margin:0;padding-left:19px}.resume-skills{columns:2;column-gap:28px}.resume-skills li{break-inside:avoid;margin:2px 0}.resume-paper.template-classic{font-family:Cambria,Georgia,serif;padding-top:20mm}.template-classic .resume-header{text-align:center;border-bottom:1px solid #777}.template-classic .resume-header h1{font-size:25pt}.template-classic .resume-section h2{color:#222;letter-spacing:.02em;border-bottom:1px solid #bbb;padding-bottom:4px}.template-minimal{font-family:Calibri,Arial,sans-serif;padding:23mm 22mm}.template-minimal .resume-header{border:0;padding-bottom:4px}.template-minimal .resume-header h1{font-size:31pt;font-weight:500}.template-minimal .resume-section{margin-top:22px}.template-minimal .resume-section h2{color:#333;font-size:10pt;letter-spacing:.16em}.template-executive{font-family:Cambria,Georgia,serif;padding-top:21mm}.template-executive .resume-header{border-bottom:3px double var(--accent);padding-bottom:18px}.template-executive .resume-header h1{font-size:27pt;letter-spacing:.015em}.template-executive .resume-headline{color:var(--accent)}.template-executive .resume-section h2{font-family:Arial,sans-serif;font-size:10.5pt;letter-spacing:.12em}.template-creative{font-family:Arial,Helvetica,sans-serif;border-top:8px solid var(--accent);padding-top:15mm}.template-creative .resume-header{border:0;padding-left:15px;border-left:5px solid var(--accent)}.template-creative .resume-header h1{font-size:30pt}.template-creative .resume-section h2{display:flex;align-items:center;gap:10px}.template-creative .resume-section h2:after{content:"";height:1px;flex:1;background:color-mix(in srgb,var(--accent),white 65%)}@media print{@page{size:A4;margin:0}body{margin:0;background:#fff}.resume-paper{width:210mm;min-height:297mm;margin:0;box-shadow:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}}@media(max-width:700px){.resume-paper{width:100%;min-height:0;padding:26px 22px}.resume-item-heading{display:block}.resume-item-heading>span{display:block}}`;
    const body = renderBody(resume.data || {}, { title:resume.title });
    if (options.fragment) return `<article class="resume-paper template-${template}" style="--accent:${escape(resume.accent || '#742cff')}">${body}</article>`;
    const action = options.publicMode ? '' : `<div class="no-print export-actions"><button onclick="window.print()">Salvar como PDF</button><button onclick="window.close()">Fechar</button></div>`;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(resume.title || 'Currículo')}</title><style>body{margin:0;background:#ececf0;font-family:Arial,sans-serif}.export-actions{position:sticky;top:0;display:flex;justify-content:center;gap:8px;padding:12px;background:#17131d}.export-actions button{padding:10px 15px;border:0;border-radius:8px;background:#742cff;color:#fff;font-weight:700;cursor:pointer}${css}</style></head><body>${action}<article class="resume-paper template-${template}">${body}</article></body></html>`;
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

