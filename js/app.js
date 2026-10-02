const API = '/api';

async function api(path, options = {}) {
  const res = await fetch(API + path, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data?.error || 'Não foi possível concluir a operação.');
  return data;
}

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let currentUserRequest;
async function currentUser() {
  if (!currentUserRequest) currentUserRequest = api('/auth/me').then(r => r.user).catch(() => null);
  return currentUserRequest;
}
function toast(message, type='info') { let el=$('.cf-toast'); if(!el){el=document.createElement('div');el.className='cf-toast';document.body.appendChild(el)} el.textContent=message;el.dataset.type=type; setTimeout(()=>el.remove(),3200); }
function go(path){ window.location.href=path; }

function initHomeLinks() {
  const links = $('[data-home-link]');
  if (!links.length) return;
  currentUser().then(user => links.forEach(link => {
    link.href = user ? (link.dataset.memberHome || link.href) : (link.dataset.guestHome || link.href);
  }));
}

async function initAuth() {
  const login = $('[data-login-form]');
  const register = $('[data-register-form]');
  if (!login && !register) return;
  if (await currentUser()) return go('../app/dashboard.html');
  if (login) login.addEventListener('submit', async e => { e.preventDefault(); const email=$('[name=email]',login).value.trim(), password=$('[name=password]',login).value; const btn=$('button',login); btn.disabled=true; try{await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})}); go('../app/dashboard.html')}catch(err){toast(err.message,'error')}finally{btn.disabled=false;} });
  if (register) register.addEventListener('submit', async e => { e.preventDefault(); const f=new FormData(register); const name=f.get('name')?.trim(),email=f.get('email')?.trim(),password=f.get('password'),confirm=f.get('confirmPassword'); if(password!==confirm)return toast('As senhas não coincidem.','error'); if(!f.get('terms'))return toast('Aceite os termos para continuar.','error'); const btn=$('button',register);btn.disabled=true;try{await api('/auth/register',{method:'POST',body:JSON.stringify({name,email,password})});go('../app/dashboard.html')}catch(err){toast(err.message,'error')}finally{btn.disabled=false;} });
}

async function initDashboard(){
  if(!$('[data-user-name]')&&!$('[data-resume-count]')&&!$('[data-resume-list]'))return;
  const user=await currentUser(); if(!user)return go('../auth/login.html');
  const name=$('[data-user-name]'); if(name) name.textContent=user.name.split(' ')[0];
  const plan=$('[data-user-plan]'); if(plan)plan.textContent={free:'Gratuito',basic:'Básico',premium:'Premium'}[user.plan];
  try{const [r,u]=await Promise.all([api('/resumes'),api('/usage')]); $('[data-resume-count]').textContent=r.resumes.length; $('[data-usage]').textContent=u.remaining.exports===null?'Ilimitado':`${u.remaining.exports}/${u.plan.dailyLimit}`; renderResumeList(r.resumes);}catch(err){toast(err.message,'error')}
}
function renderResumeList(resumes){const box=$('[data-resume-list]');if(!box)return;box.innerHTML=resumes.length?resumes.slice(0,3).map(r=>`<div class="resume-row"><div class="resume-info"><div class="resume-thumb"></div><div><strong>${escapeHtml(r.title)}</strong><span>${new Date(r.updatedAt).toLocaleDateString('pt-BR')} · ${escapeHtml(r.template)}</span></div></div><a class="button button-secondary button-small" href="../builder/editor.html?id=${encodeURIComponent(r.id)}">Editar</a></div>`).join(''):'<p class="muted">Você ainda não criou nenhum currículo.</p>';}

async function initNewResume() {
  const form = $('[data-resume-create]');
  if (!form) return;
  if (!(await currentUser())) return go('../auth/login.html');

  const panels = $$('[data-wizard-step]', form);
  const indicators = $$('[data-wizard-nav]', form);
  const backButton = $('[data-step-back]', form);
  const nextButton = $('[data-step-next]', form);
  const submitButton = $('[data-step-submit]', form);
  const progress = $('[data-wizard-progress]', form);
  const progressBar = $('.progress', form);
  let activeStep = 0;

  function showStep(index) {
    activeStep = index;
    panels.forEach((panel, i) => { panel.hidden = i !== index; });
    indicators.forEach((button, i) => {
      button.disabled = i > index;
      button.classList.toggle('active', i === index);
      button.classList.toggle('is-complete', i < index);
      if (i === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    backButton.hidden = index === 0;
    nextButton.hidden = index === panels.length - 1;
    submitButton.hidden = index !== panels.length - 1;
    progress.style.width = `${((index + 1) / panels.length) * 100}%`;
    progressBar.setAttribute('aria-valuenow', String(index + 1));
  }

  function validateStep(index) {
    const fields = $$('input,textarea,select', panels[index]).filter(field => !field.disabled);
    const invalid = fields.find(field => !field.checkValidity());
    if (invalid) { invalid.reportValidity(); return false; }
    return true;
  }

  function addEntry(templateSelector, listSelector) {
    const template = $(templateSelector, form);
    const list = $(listSelector, form);
    const fragment = template.content.cloneNode(true);
    const entry = fragment.querySelector('fieldset');
    list.append(fragment);
    const firstInput = $('input', entry);
    firstInput?.focus();
  }

  $('[data-add-experience]', form).addEventListener('click', () => addEntry('[data-experience-template]', '[data-experience-list]'));
  $('[data-add-education]', form).addEventListener('click', () => addEntry('[data-education-template]', '[data-education-list]'));
  form.addEventListener('click', event => {
    const remove = event.target.closest('[data-remove-entry]');
    if (remove) remove.closest('fieldset')?.remove();
  });
  nextButton.addEventListener('click', () => {
    if (validateStep(activeStep)) showStep(Math.min(activeStep + 1, panels.length - 1));
  });
  backButton.addEventListener('click', () => showStep(Math.max(activeStep - 1, 0)));
  indicators.forEach((button, index) => button.addEventListener('click', () => {
    if (index <= activeStep && validateStep(activeStep)) showStep(index);
  }));

  const requestedTemplate = new URLSearchParams(location.search).get('template');
  if (['modern', 'classic', 'minimal'].includes(requestedTemplate)) {
    const radio = form.querySelector(`input[name="template"][value="${requestedTemplate}"]`);
    if (radio) radio.checked = true;
  }
  showStep(0);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!validateStep(activeStep)) return;
    const fields = new FormData(form);
    const template = fields.get('template') || 'modern';
    const accent = { modern: '#742cff', classic: '#1769aa', minimal: '#16805c' }[template] || '#742cff';
    const experiences = $$('[data-experience-entry]', form).map(row => ({
      role: $('[name="experienceRole"]', row).value.trim(),
      company: $('[name="experienceCompany"]', row).value.trim(),
      period: $('[name="experiencePeriod"]', row).value.trim(),
      description: $('[name="experienceDescription"]', row).value.trim()
    })).filter(item => item.role || item.company || item.period || item.description);
    const education = $$('[data-education-entry]', form).map(row => ({
      course: $('[name="educationCourse"]', row).value.trim(),
      school: $('[name="educationSchool"]', row).value.trim(),
      period: $('[name="educationPeriod"]', row).value.trim()
    })).filter(item => item.course || item.school || item.period);
    const skills = String(fields.get('skills') || '').split(',').map(skill => skill.trim()).filter(Boolean);
    const data = {
      name: String(fields.get('name') || '').trim(),
      role: String(fields.get('role') || '').trim(),
      email: String(fields.get('email') || '').trim(),
      phone: String(fields.get('phone') || '').trim(),
      city: String(fields.get('city') || '').trim(),
      summary: String(fields.get('summary') || '').trim(),
      experiences,
      education,
      skills
    };

    submitButton.disabled = true;
    try {
      const result = await api('/resumes', {
        method: 'POST',
        body: JSON.stringify({
          title: String(fields.get('title') || '').trim() || 'Meu currículo',
          template,
          accent,
          data
        })
      });
      go(`editor.html?id=${encodeURIComponent(result.resume.id)}`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      submitButton.disabled = false;
    }
  });
}

async function initEditor(){
  const form=$('[data-editor-form]'); if(!form)return;
  if(!(await currentUser()))return go('../auth/login.html'); const id=new URLSearchParams(location.search).get('id'); if(!id)return go('novo-curriculo.html'); let r; try{r=(await api('/resumes/'+encodeURIComponent(id))).resume}catch(e){toast(e.message,'error');return}
  fillEditor(form,r);
  form.addEventListener('input',()=>renderPaper(form)); $('[data-save]',form)?.addEventListener('click',()=>saveEditor(form,r)); $('[data-export]')?.addEventListener('click',()=>exportResume(r.id)); $('[data-share]')?.addEventListener('click',()=>shareResume(r.id)); $$('.color-choice').forEach(x=>x.addEventListener('click',()=>{form.elements.accent.value=x.dataset.color;renderPaper(form)})); $$('.template-choice').forEach(x=>x.addEventListener('click',()=>{form.elements.template.value=x.dataset.template;renderPaper(form)})); renderPaper(form);
}
function fillEditor(form,r){const d=r.data||{}; for(const key of ['title','accent','template'])if(form.elements[key])form.elements[key].value=r[key]||'';for(const key of ['name','role','email','phone','city','summary'])if(form.elements[key])form.elements[key].value=d[key]||''; if(form.elements.skills)form.elements.skills.value=(d.skills||[]).join(', '); if(form.elements.experience)form.elements.experience.value=(d.experiences||[]).map(x=>[x.role,x.company,x.period,x.description].filter(Boolean).join(' | ')).join('\n'); if(form.elements.education)form.elements.education.value=(d.education||[]).map(x=>[x.course,x.school,x.period].filter(Boolean).join(' | ')).join('\n'); }
function collectEditor(form){const d={};for(const key of ['name','role','email','phone','city','summary'])d[key]=form.elements[key]?.value.trim()||'';d.skills=(form.elements.skills?.value||'').split(',').map(x=>x.trim()).filter(Boolean);d.experiences=(form.elements.experience?.value||'').split('\n').map(line=>{const [role,company,period,description]=line.split('|').map(x=>x.trim());return role?{role,company,period,description}:null}).filter(Boolean);d.education=(form.elements.education?.value||'').split('\n').map(line=>{const [course,school,period]=line.split('|').map(x=>x.trim());return course?{course,school,period}:null}).filter(Boolean);return d;}
async function saveEditor(form,r){try{const out=await api('/resumes/'+r.id,{method:'PATCH',body:JSON.stringify({title:form.elements.title.value,template:form.elements.template.value,accent:form.elements.accent.value,data:collectEditor(form)})});r=out.resume; toast('Currículo salvo.','success')}catch(e){toast(e.message,'error')}}
function renderPaper(form){const d=collectEditor(form), paper=$('[data-paper]');if(!paper)return;paper.dataset.template=form.elements.template.value;paper.style.setProperty('--accent',form.elements.accent.value);paper.innerHTML=`<div class="paper-head"><h1>${escapeHtml(d.name||'Seu nome')}</h1><p>${escapeHtml(d.role||'Cargo desejado')}</p><small>${escapeHtml([d.email,d.phone,d.city].filter(Boolean).join(' · '))}</small></div>${d.summary?`<section><h2>Resumo</h2><p>${escapeHtml(d.summary)}</p></section>`:''}${d.experiences.length?`<section><h2>Experiência</h2>${d.experiences.map(x=>`<div><strong>${escapeHtml(x.role)}</strong><p>${escapeHtml([x.company,x.period].filter(Boolean).join(' · '))}</p><p>${escapeHtml(x.description||'')}</p></div>`).join('')}`:''}${d.education.length?`<section><h2>Formação</h2>${d.education.map(x=>`<div><strong>${escapeHtml(x.course)}</strong><p>${escapeHtml([x.school,x.period].filter(Boolean).join(' · '))}</p></div>`).join('')}`:''}${d.skills.length?`<section><h2>Habilidades</h2><p>${d.skills.map(x=>`<span class="skill-chip">${escapeHtml(x)}</span>`).join(' ')}</p></section>`:''}`;}
async function exportResume(id){try{const html=await fetch('/api/resumes/'+id+'/export',{method:'POST',credentials:'include'}).then(async r=>{if(!r.ok)throw new Error((await r.json()).error);return r.text()});const w=window.open('','_blank');w.document.write(html);w.document.close()}catch(e){toast(e.message,'error')}}
async function shareResume(id){try{const r=await api('/resumes/'+id+'/share',{method:'POST'});await navigator.clipboard?.writeText(r.url);toast(`Link copiado: ${r.url}`,'success')}catch(e){toast(e.message,'error')}}

async function initModels(){const box=$('[data-models]');if(!box)return;if(!(await currentUser()))return go('../auth/login.html');const r=await api('/models');box.innerHTML=r.models.map(m=>`<article class="model-card"><div class="model-preview ${m.key}"><div></div></div><div class="model-info"><h3>${m.name}</h3><p>${m.description}</p><a class="button button-primary button-small" href="novo-curriculo.html?template=${m.key}">Usar modelo</a></div></article>`).join('')}
async function initProfile(){const f=$('[data-profile-form]');if(!f)return;if(!(await currentUser()))return go('../auth/login.html');const u=await currentUser();f.elements.name.value=u.name;f.elements.email.value=u.email;f.addEventListener('submit',async e=>{e.preventDefault();try{await api('/profile',{method:'PATCH',body:JSON.stringify({name:f.elements.name.value})});toast('Perfil atualizado.','success')}catch(err){toast(err.message,'error')}})}
async function initPricing(){const box=$('[data-pricing]');if(!box)return;let u,plans;try{[u,plans]=await Promise.all([currentUser(),api('/plans').then(r=>r.plans)])}catch(e){toast(e.message,'error');return}box.querySelectorAll('[data-plan]').forEach(btn=>btn.addEventListener('click',async()=>{const plan=btn.dataset.plan;if(plan==='free')return go(u?'../app/dashboard.html':'../auth/cadastro.html');if(!u)return go('../auth/cadastro.html');try{const r=await api('/billing/checkout',{method:'POST',body:JSON.stringify({plan})});toast(r.message)}catch(e){toast(e.message,'error')}}))}
async function initLogout(){const btn=$('[data-logout]');if(btn)btn.addEventListener('click',async()=>{await api('/auth/logout',{method:'POST'});go('../../index.html')})}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

window.CurriculoFacil={api,toast,go};
document.addEventListener('DOMContentLoaded',()=>{initHomeLinks();initAuth();initDashboard();initNewResume();initEditor();initModels();initProfile();initPricing();initLogout(); const menu=$('[data-menu]'); if(menu)menu.addEventListener('click',()=>document.body.classList.toggle('menu-open'));});
