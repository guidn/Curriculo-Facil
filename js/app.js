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

async function currentUser() { try { return (await api('/auth/me')).user; } catch { return null; } }
function toast(message, type='info') { let el=$('.cf-toast'); if(!el){el=document.createElement('div');el.className='cf-toast';document.body.appendChild(el)} el.textContent=message;el.dataset.type=type; setTimeout(()=>el.remove(),3200); }
function go(path){ window.location.href=path; }

async function initAuth() {
  const login = $('[data-login-form]');
  const register = $('[data-register-form]');
  if (login) login.addEventListener('submit', async e => { e.preventDefault(); const email=$('[name=email]',login).value.trim(), password=$('[name=password]',login).value; const btn=$('button',login); btn.disabled=true; try{await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})}); go('../app/dashboard.html')}catch(err){toast(err.message,'error')}finally{btn.disabled=false;} });
  if (register) register.addEventListener('submit', async e => { e.preventDefault(); const f=new FormData(register); const name=f.get('name')?.trim(),email=f.get('email')?.trim(),password=f.get('password'),confirm=f.get('confirmPassword'); if(password!==confirm)return toast('As senhas não coincidem.','error'); if(!f.get('terms'))return toast('Aceite os termos para continuar.','error'); const btn=$('button',register);btn.disabled=true;try{await api('/auth/register',{method:'POST',body:JSON.stringify({name,email,password})});go('../app/dashboard.html')}catch(err){toast(err.message,'error')}finally{btn.disabled=false;} });
}

async function initDashboard(){
  const user=await currentUser(); if(!user)return go('../auth/login.html');
  const name=$('[data-user-name]'); if(name) name.textContent=user.name.split(' ')[0];
  const plan=$('[data-user-plan]'); if(plan)plan.textContent={free:'Gratuito',basic:'Básico',premium:'Premium'}[user.plan];
  try{const [r,u]=await Promise.all([api('/resumes'),api('/usage')]); $('[data-resume-count]').textContent=r.resumes.length; $('[data-usage]').textContent=u.remaining.exports===null?'Ilimitado':`${u.remaining.exports}/${u.plan.dailyLimit}`; renderResumeList(r.resumes);}catch(err){toast(err.message,'error')}
}
function renderResumeList(resumes){const box=$('[data-resume-list]');if(!box)return;box.innerHTML=resumes.length?resumes.slice(0,3).map(r=>`<div class="resume-row"><div class="resume-info"><div class="resume-thumb"></div><div><strong>${escapeHtml(r.title)}</strong><span>${new Date(r.updatedAt).toLocaleDateString('pt-BR')} · ${escapeHtml(r.template)}</span></div></div><a class="button button-secondary button-small" href="../builder/editor.html?id=${encodeURIComponent(r.id)}">Editar</a></div>`).join(''):'<p class="muted">Você ainda não criou nenhum currículo.</p>';}

async function initNewResume(){
  if(!(await currentUser()))return go('../auth/login.html'); const form=$('[data-resume-create]'); if(!form)return;
  form.addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));try{const r=await api('/resumes',{method:'POST',body:JSON.stringify({title:data.title||'Meu currículo',data:{name:data.name,role:data.role,email:data.email,phone:data.phone,city:data.city,summary:data.summary,experiences:[],education:[],skills:[]}})});go(`editor.html?id=${r.resume.id}`)}catch(err){toast(err.message,'error')}})
}

async function initEditor(){
  if(!(await currentUser()))return go('../auth/login.html'); const id=new URLSearchParams(location.search).get('id'); if(!id)return go('novo-curriculo.html'); let r; try{r=(await api('/resumes/'+encodeURIComponent(id))).resume}catch(e){toast(e.message,'error');return}
  const form=$('[data-editor-form]'); if(!form)return; fillEditor(form,r);
  form.addEventListener('input',()=>renderPaper(form)); $('[data-save]',form)?.addEventListener('click',()=>saveEditor(form,r)); $('[data-export]')?.addEventListener('click',()=>exportResume(r.id)); $('[data-share]')?.addEventListener('click',()=>shareResume(r.id)); $$('.color-choice').forEach(x=>x.addEventListener('click',()=>{form.elements.accent.value=x.dataset.color;renderPaper(form)})); $$('.template-choice').forEach(x=>x.addEventListener('click',()=>{form.elements.template.value=x.dataset.template;renderPaper(form)})); renderPaper(form);
}
function fillEditor(form,r){const d=r.data||{}; for(const key of ['title','accent','template'])if(form.elements[key])form.elements[key].value=r[key]||'';for(const key of ['name','role','email','phone','city','summary'])if(form.elements[key])form.elements[key].value=d[key]||''; if(form.elements.skills)form.elements.skills.value=(d.skills||[]).join(', '); if(form.elements.experience)form.elements.experience.value=(d.experiences||[]).map(x=>[x.role,x.company,x.period,x.description].filter(Boolean).join(' | ')).join('\n'); if(form.elements.education)form.elements.education.value=(d.education||[]).map(x=>[x.course,x.school,x.period].filter(Boolean).join(' | ')).join('\n'); }
function collectEditor(form){const d={};for(const key of ['name','role','email','phone','city','summary'])d[key]=form.elements[key]?.value.trim()||'';d.skills=(form.elements.skills?.value||'').split(',').map(x=>x.trim()).filter(Boolean);d.experiences=(form.elements.experience?.value||'').split('\n').map(line=>{const [role,company,period,description]=line.split('|').map(x=>x.trim());return role?{role,company,period,description}:null}).filter(Boolean);d.education=(form.elements.education?.value||'').split('\n').map(line=>{const [course,school,period]=line.split('|').map(x=>x.trim());return course?{course,school,period}:null}).filter(Boolean);return d;}
async function saveEditor(form,r){try{const out=await api('/resumes/'+r.id,{method:'PATCH',body:JSON.stringify({title:form.elements.title.value,template:form.elements.template.value,accent:form.elements.accent.value,data:collectEditor(form)})});r=out.resume; toast('Currículo salvo.','success')}catch(e){toast(e.message,'error')}}
function renderPaper(form){const d=collectEditor(form), paper=$('[data-paper]');if(!paper)return;paper.style.setProperty('--accent',form.elements.accent.value);paper.innerHTML=`<div class="paper-head"><h1>${escapeHtml(d.name||'Seu nome')}</h1><p>${escapeHtml(d.role||'Cargo desejado')}</p><small>${escapeHtml([d.email,d.phone,d.city].filter(Boolean).join(' · '))}</small></div>${d.summary?`<section><h2>Resumo</h2><p>${escapeHtml(d.summary)}</p></section>`:''}${d.experiences.length?`<section><h2>Experiência</h2>${d.experiences.map(x=>`<div><strong>${escapeHtml(x.role)}</strong><p>${escapeHtml([x.company,x.period].filter(Boolean).join(' · '))}</p><p>${escapeHtml(x.description||'')}</p></div>`).join('')}`:''}${d.education.length?`<section><h2>Formação</h2>${d.education.map(x=>`<div><strong>${escapeHtml(x.course)}</strong><p>${escapeHtml([x.school,x.period].filter(Boolean).join(' · '))}</p></div>`).join('')}`:''}${d.skills.length?`<section><h2>Habilidades</h2><p>${d.skills.map(x=>`<span class="skill-chip">${escapeHtml(x)}</span>`).join(' ')}</p></section>`:''}`;}
async function exportResume(id){try{const html=await fetch('/api/resumes/'+id+'/export',{method:'POST',credentials:'include'}).then(async r=>{if(!r.ok)throw new Error((await r.json()).error);return r.text()});const w=window.open('','_blank');w.document.write(html);w.document.close()}catch(e){toast(e.message,'error')}}
async function shareResume(id){try{const r=await api('/resumes/'+id+'/share',{method:'POST'});await navigator.clipboard?.writeText(r.url);toast(`Link copiado: ${r.url}`,'success')}catch(e){toast(e.message,'error')}}

async function initModels(){if(!(await currentUser()))return go('../auth/login.html');const box=$('[data-models]');if(!box)return;const r=await api('/models');box.innerHTML=r.models.map(m=>`<article class="model-card"><div class="model-preview ${m.key}"><div></div></div><div class="model-info"><h3>${m.name}</h3><p>${m.description}</p><a class="button button-primary button-small" href="novo-curriculo.html?template=${m.key}">Usar modelo</a></div></article>`).join('')}
async function initProfile(){if(!(await currentUser()))return go('../auth/login.html');const f=$('[data-profile-form]');if(!f)return;const u=await currentUser();f.elements.name.value=u.name;f.elements.email.value=u.email;f.addEventListener('submit',async e=>{e.preventDefault();try{await api('/profile',{method:'PATCH',body:JSON.stringify({name:f.elements.name.value})});toast('Perfil atualizado.','success')}catch(err){toast(err.message,'error')}})}
async function initPricing(){const u=await currentUser();const box=$('[data-pricing]');if(!box)return;const plans=(await api('/plans')).plans;box.querySelectorAll('[data-plan]').forEach(btn=>btn.addEventListener('click',async()=>{const plan=btn.dataset.plan;if(plan==='free')return go(u?'../app/dashboard.html':'../auth/cadastro.html');if(!u)return go('../auth/cadastro.html');try{const r=await api('/billing/checkout',{method:'POST',body:JSON.stringify({plan})});toast(r.message)}catch(e){toast(e.message,'error')}}))}
async function initLogout(){const btn=$('[data-logout]');if(btn)btn.addEventListener('click',async()=>{await api('/auth/logout',{method:'POST'});go('../../index.html')})}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

window.CurriculoFacil={api,toast,go};
document.addEventListener('DOMContentLoaded',()=>{initAuth();initDashboard();initNewResume();initEditor();initModels();initProfile();initPricing();initLogout(); const menu=$('[data-menu]'); if(menu)menu.addEventListener('click',()=>document.body.classList.toggle('menu-open'));});
