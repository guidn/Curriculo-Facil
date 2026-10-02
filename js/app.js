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

async function initLanding() {
  if (!$('[data-public-home]')) return;
  if (await currentUser()) go('pages/app/dashboard.html');
}

function initHomeLinks() {
  const links = $$('[data-home-link]');
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
  if (register) register.addEventListener('submit', async e => { e.preventDefault(); const f=new FormData(register); const name=f.get('name')?.trim(),email=f.get('email')?.trim(),password=f.get('password'),confirm=f.get('confirmPassword'); if(password!==confirm)return toast('As senhas não coincidem.','error'); if(!f.get('terms'))return toast('Aceite os termos para continuar.','error'); const btn=$('button',register);btn.disabled=true;try{await api('/auth/register',{method:'POST',body:JSON.stringify({name,email,password})});go('../builder/novo-curriculo.html?onboarding=1')}catch(err){toast(err.message,'error')}finally{btn.disabled=false;} });
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
  const user = await currentUser();
  if (!user) return go('../auth/login.html');
  const nameField = $('[name="name"]', form), emailField = $('[name="email"]', form);
  if (nameField && !nameField.value) nameField.value = user.name || '';
  if (emailField && !emailField.value) emailField.value = user.email || '';
  if (new URLSearchParams(location.search).get('onboarding') === '1') {
    const title = $('[data-builder-title]', form);
    if (title) title.textContent = 'Vamos preparar seu primeiro currículo.';
  }

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
  form.addEventListener('change', event => {
    const field = event.target;
    if (field.matches('[name$="Current"]')) {
      const end = field.closest('fieldset')?.querySelector('input[type="date"][name$="EndDate"]');
      if (end) { end.disabled = field.checked; if (field.checked) end.value = ''; }
    }
    if (field.matches('input[type="date"][name$="StartDate"]')) {
      const end = field.closest('fieldset')?.querySelector('input[type="date"][name$="EndDate"]');
      if (end) end.min = field.value;
    }
  });
  form.addEventListener('click', event => {
    const chip = event.target.closest('[data-skill-chip]');
    if (chip) { chip.classList.toggle('selected'); chip.setAttribute('aria-pressed', String(chip.classList.contains('selected'))); }
  });
  form.addEventListener('input', updateTemplatePreviews);
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
  if (['modern', 'classic', 'minimal', 'executive', 'creative'].includes(requestedTemplate)) {
    const radio = form.querySelector(`input[name="template"][value="${requestedTemplate}"]`);
    if (radio) radio.checked = true;
  }
  updateTemplatePreviews();
  showStep(0);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!validateStep(activeStep)) return;
    const fields = new FormData(form);
    const template = fields.get('template') || 'modern';
    const accent = { modern: '#742cff', classic: '#1769aa', minimal: '#16805c', executive: '#1f3a5f', creative: '#d35f12' }[template] || '#742cff';
    const experiences = $$('[data-experience-entry]', form).map(row => ({
      role: $('[name="experienceRole"]', row).value.trim(),
      company: $('[name="experienceCompany"]', row).value.trim(),
      startDate: $('[name="experienceStartDate"]', row).value,
      endDate: $('[name="experienceEndDate"]', row).value,
      current: $('[name="experienceCurrent"]', row).checked,
      description: $('[name="experienceDescription"]', row).value.trim()
    })).filter(item => item.role || item.company || item.startDate || item.description);
    const education = $$('[data-education-entry]', form).map(row => ({
      course: $('[name="educationCourse"]', row).value.trim(),
      school: $('[name="educationSchool"]', row).value.trim(),
      startDate: $('[name="educationStartDate"]', row).value,
      endDate: $('[name="educationEndDate"]', row).value,
      current: $('[name="educationCurrent"]', row).checked
    })).filter(item => item.course || item.school || item.startDate);
    const skills = [...$$('[data-skill-chip].selected', form).map(button => button.dataset.skillChip), ...String(fields.get('customSkills') || '').split(',').map(skill => skill.trim()).filter(Boolean)];
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

function updateTemplatePreviews() {
  const form = $('[data-resume-create]'); if (!form) return;
  const values = new FormData(form);
  const experiences = $$('[data-experience-entry]', form).map(row => $('[name="experienceRole"]', row).value.trim()).filter(Boolean);
  const education = $$('[data-education-entry]', form).map(row => $('[name="educationCourse"]', row).value.trim()).filter(Boolean);
  const skills = [...$$('[data-skill-chip].selected', form).map(button => button.dataset.skillChip), ...String(values.get('customSkills') || '').split(',').map(x => x.trim()).filter(Boolean)];
  const previews = $$('.template-preview', form);
  previews.forEach(preview => {
    const set = (selector, value, fallback) => { const node = $(selector, preview); if (node) node.textContent = value || fallback; };
    set('[data-preview-name]', values.get('name')?.trim(), 'Seu nome');
    set('[data-preview-role]', values.get('role')?.trim(), 'Cargo desejado');
    set('[data-preview-contact]', [values.get('email'), values.get('phone'), values.get('city')].filter(Boolean).join(' · '), 'Seu contato');
    set('[data-preview-summary]', values.get('summary')?.trim(), 'Resumo profissional');
    set('[data-preview-experience]', experiences[0], 'Experiência profissional');
    set('[data-preview-education]', education[0], 'Formação acadêmica');
    set('[data-preview-skills]', skills.slice(0, 3).join(' · '), 'Habilidades');
  });
}

async function initEditor(){
  const form=$('[data-editor-form]'); if(!form)return;
  if(!(await currentUser()))return go('../auth/login.html'); const id=new URLSearchParams(location.search).get('id'); if(!id)return go('novo-curriculo.html'); let r; try{r=(await api('/resumes/'+encodeURIComponent(id))).resume}catch(e){toast(e.message,'error');return}
  fillEditor(form,r);
  const status=$('[data-save-status]'), workspace=$('.editor-workspace'); let saveTimer, zoom=.86;
  const showStatus=message=>{if(status)status.textContent=message};
  const save=async quiet=>{clearTimeout(saveTimer);showStatus('Salvando…');const updated=await saveEditor(form,r,{quiet});if(updated){r=updated;showStatus('Salvo agora')}else showStatus('Não foi possível salvar')};
  const scheduleSave=()=>{showStatus('Alterações pendentes');clearTimeout(saveTimer);saveTimer=setTimeout(()=>save(true),1100)};
  const refresh=()=>{renderPaper(form);scheduleSave()};
  $$('[data-editor-add]').forEach(button=>button.addEventListener('click',()=>{refresh();button.previousElementSibling?.scrollIntoView({behavior:'smooth',block:'nearest'})}));
  form.addEventListener('click',event=>{if(event.target.closest('[data-editor-remove]')){event.target.closest('[data-editor-entry]')?.remove();refresh()}});
  form.addEventListener('input',refresh);
  form.addEventListener('change',event=>{const current=event.target;if(current.matches('[data-current]')){const end=current.closest('[data-editor-entry]')?.querySelector('[data-entry-field="endDate"]');if(end){end.disabled=current.checked;if(current.checked)end.value=''}refresh()}});
  $('[data-save]')?.addEventListener('click',()=>save(false)); $('[data-export]')?.addEventListener('click',()=>{clearTimeout(saveTimer);save(true).then(saved=>{if(saved)exportResume(r.id)})}); $('[data-share]')?.addEventListener('click',()=>{clearTimeout(saveTimer);save(true).then(saved=>{if(saved)shareResume(r.id)})});
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save(false)}});
  $$('.color-choice').forEach(button=>button.addEventListener('click',()=>{form.elements.accent.value=button.dataset.color;$$('.color-choice').forEach(x=>x.classList.toggle('selected',x===button));refresh()}));
  $$('.template-choice').forEach(button=>button.addEventListener('click',()=>{form.elements.template.value=button.dataset.template;$$('.template-choice').forEach(x=>x.classList.toggle('selected',x===button));refresh()}));
  $$('[data-editor-view]').forEach(button=>button.addEventListener('click',()=>{$$('[data-editor-view]').forEach(x=>{const active=x===button;x.classList.toggle('active',active);x.setAttribute('aria-selected',String(active))});workspace.dataset.activeView=button.dataset.editorView}));
  const paper=$('[data-paper]'),zoomLabel=$('[data-zoom-label]');const setZoom=value=>{zoom=Math.max(.45,Math.min(1.25,value));paper.style.zoom=String(zoom);if(zoomLabel)zoomLabel.textContent=`${Math.round(zoom*100)}%`};
  $$('[data-zoom]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.zoom==='in')setZoom(zoom+.1);else if(button.dataset.zoom==='out')setZoom(zoom-.1);else setZoom(Math.min(1,(($('.editor-canvas')?.clientWidth||850)-64)/760))}));
  $$('.template-choice').forEach(button=>button.classList.toggle('selected',button.dataset.template===r.template));$$('.color-choice').forEach(button=>button.classList.toggle('selected',button.dataset.color===r.accent));
  renderPaper(form);setZoom(Math.min(1,(($('.editor-canvas')?.clientWidth||850)-64)/760));
}
function addEditorEntry(form,type,item={}){const target=type==='experience'?'experiences':'education', fields=type==='experience'?[['role','Cargo'],['company','Empresa']]:[['course','Curso ou formação'],['school','Instituição']];const box=document.createElement('fieldset');box.className='editor-entry';box.dataset.editorEntry=type;box.innerHTML=`<legend>${type==='experience'?'Experiência':'Formação'}</legend>${fields.map(([key,label])=>`<label class="form-field"><span>${label}</span><input data-entry-field="${key}"></label>`).join('')}<label class="form-field"><span>Data de início</span><input type="date" data-entry-field="startDate"></label><label class="form-field"><span>Data de término</span><input type="date" data-entry-field="endDate"></label><label class="form-field current-field"><input type="checkbox" data-current><span>${type==='experience'?'Trabalho aqui atualmente':'Estou estudando atualmente'}</span></label>${type==='experience'?'<label class="form-field"><span>Atividades e resultados</span><textarea data-entry-field="description" rows="3"></textarea></label>':''}${item.period&&!item.startDate&&!item.endDate?`<label class="form-field"><span>Período já cadastrado (formato antigo)</span><input data-entry-field="period"></label>`:''}<button type="button" class="button button-ghost button-small" data-editor-remove>Remover</button>`;$(target==='experiences'?'[data-editor-experiences]':'[data-editor-education]',form).append(box);for(const [key,value] of Object.entries(item)){const field=$(`[data-entry-field="${key}"]`,box);if(field)field.value=value||''}const start=$('[data-entry-field="startDate"]',box),end=$('[data-entry-field="endDate"]',box),current=$('[data-current]',box);current.checked=!!item.current;end.disabled=current.checked;if(start.value)end.min=start.value;}
function parseLegacyDate(value){if(!value)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;if(/^\d{4}-\d{2}$/.test(value))return `${value}-01`;const m=String(value).match(/(\d{1,2})\s*\/\s*(\d{4})/);if(m)return `${m[2]}-${m[1].padStart(2,'0')}-01`;return '';}
function fillEditor(form,r){const d=r.data||{}; for(const key of ['title','accent','template'])if(form.elements[key])form.elements[key].value=r[key]||'';for(const key of ['name','role','email','phone','city','summary'])if(form.elements[key])form.elements[key].value=d[key]||''; if(form.elements.skills)form.elements.skills.value=(d.skills||[]).join(', '); (d.experiences||[]).forEach(item=>addEditorEntry(form,'experience',{...item,startDate:item.startDate||parseLegacyDate(item.period),endDate:item.endDate||''}));(d.education||[]).forEach(item=>addEditorEntry(form,'education',{...item,startDate:item.startDate||parseLegacyDate(item.period),endDate:item.endDate||''}));}
function collectEditor(form){const d={};for(const key of ['name','role','email','phone','city','summary'])d[key]=form.elements[key]?.value.trim()||'';d.skills=(form.elements.skills?.value||'').split(',').map(x=>x.trim()).filter(Boolean);const entries=type=>$$(`[data-editor-entry="${type}"]`,form).map(row=>{const item={};$$('[data-entry-field]',row).forEach(field=>item[field.dataset.entryField]=field.value.trim());item.startDate=item.startDate||'';item.endDate=item.endDate||'';item.current=$('[data-current]',row).checked;return item}).filter(item=>Object.entries(item).some(([key,value])=>!['current','startDate','endDate'].includes(key)&&value)||item.startDate);d.experiences=entries('experience');d.education=entries('education');return d;}
function formatPeriod(item){if(item.period)return item.period;const fmt=value=>{if(!value)return '';const date=new Date(`${value.slice(0,10)}T00:00:00`);return Number.isNaN(date.valueOf())?'':date.toLocaleDateString('pt-BR',{month:'short',year:'numeric'})};const start=fmt(item.startDate),end=item.current?'Atual':fmt(item.endDate);return [start,end].filter(Boolean).join(' – ')}
async function saveEditor(form,r,{quiet=false}={}){const button=$('[data-save]');if(button)button.disabled=true;try{const out=await api('/resumes/'+r.id,{method:'PATCH',body:JSON.stringify({title:form.elements.title.value,template:form.elements.template.value,accent:form.elements.accent.value,data:collectEditor(form)})});if(!quiet)toast('Currículo salvo.','success');return out.resume}catch(e){if(!quiet)toast(e.message,'error');return null}finally{if(button)button.disabled=false}}
function renderPaper(form){const d=collectEditor(form), paper=$('[data-paper]');if(!paper)return;paper.dataset.template=form.elements.template.value;paper.style.setProperty('--accent',form.elements.accent.value);paper.innerHTML=`<div class="paper-head"><h1>${escapeHtml(d.name||'Seu nome')}</h1><p>${escapeHtml(d.role||'Cargo desejado')}</p><small>${escapeHtml([d.email,d.phone,d.city].filter(Boolean).join(' · '))}</small></div>${d.summary?`<section><h2>Resumo</h2><p>${escapeHtml(d.summary)}</p></section>`:''}${d.experiences.length?`<section><h2>Experiência</h2>${d.experiences.map(x=>`<div><strong>${escapeHtml(x.role)}</strong><p>${escapeHtml([x.company,formatPeriod(x)].filter(Boolean).join(' · '))}</p><p>${escapeHtml(x.description||'')}</p></div>`).join('')}`:''}${d.education.length?`<section><h2>Formação</h2>${d.education.map(x=>`<div><strong>${escapeHtml(x.course)}</strong><p>${escapeHtml([x.school,formatPeriod(x)].filter(Boolean).join(' · '))}</p></div>`).join('')}`:''}${d.skills.length?`<section><h2>Habilidades</h2><p>${d.skills.map(x=>`<span class="skill-chip">${escapeHtml(x)}</span>`).join(' ')}</p></section>`:''}`;}
async function exportResume(id){try{const html=await fetch('/api/resumes/'+id+'/export',{method:'POST',credentials:'include'}).then(async r=>{if(!r.ok)throw new Error((await r.json()).error);return r.text()});const w=window.open('','_blank');w.document.write(html);w.document.close()}catch(e){toast(e.message,'error')}}
async function shareResume(id){try{const r=await api('/resumes/'+id+'/share',{method:'POST'});await navigator.clipboard?.writeText(r.url);toast(`Link copiado: ${r.url}`,'success')}catch(e){toast(e.message,'error')}}

async function initModels(){const box=$('[data-models]');if(!box)return;if(!(await currentUser()))return go('../auth/login.html');const r=await api('/models');box.innerHTML=r.models.map(m=>`<article class="model-card"><div class="model-preview ${m.key}"><div></div></div><div class="model-info"><h3>${m.name}</h3><p>${m.description}</p><a class="button button-primary button-small" href="novo-curriculo.html?template=${m.key}">Usar modelo</a></div></article>`).join('')}
async function initProfile(){const f=$('[data-profile-form]');if(!f)return;if(!(await currentUser()))return go('../auth/login.html');const u=await currentUser();f.elements.name.value=u.name;f.elements.email.value=u.email;f.addEventListener('submit',async e=>{e.preventDefault();try{await api('/profile',{method:'PATCH',body:JSON.stringify({name:f.elements.name.value})});toast('Perfil atualizado.','success')}catch(err){toast(err.message,'error')}})}
async function initPricing(){const box=$('[data-pricing]');if(!box)return;let u,plans;try{[u,plans]=await Promise.all([currentUser(),api('/plans').then(r=>r.plans)])}catch(e){toast(e.message,'error');return}box.querySelectorAll('[data-plan]').forEach(btn=>btn.addEventListener('click',async()=>{const plan=btn.dataset.plan;if(plan==='free')return go(u?'../app/dashboard.html':'../auth/cadastro.html');if(!u)return go('../auth/cadastro.html');try{const r=await api('/billing/checkout',{method:'POST',body:JSON.stringify({plan})});toast(r.message)}catch(e){toast(e.message,'error')}}))}
async function initLogout(){const btn=$('[data-logout]');if(btn)btn.addEventListener('click',async()=>{await api('/auth/logout',{method:'POST'});go('../../index.html')})}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

window.CurriculoFacil={api,toast,go};
document.addEventListener('DOMContentLoaded',()=>{initLanding();initHomeLinks();initAuth();initDashboard();initNewResume();initEditor();initModels();initProfile();initPricing();initLogout(); const menu=$('[data-menu]'); if(menu)menu.addEventListener('click',()=>document.body.classList.toggle('menu-open'));});
