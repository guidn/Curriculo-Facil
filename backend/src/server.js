const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const config = require('./config');
const db = require('./db');
const PLANS = require('./plans');
const { hashPassword, verifyPassword, token, hashToken, id, today } = require('./security');
const { setSession, clearSession, getUser, requireUser, parseCookies } = require('./auth');
const { resumeCapacity } = require('./services/resume-service');
const { normalizeResumeProfile } = require('./services/profile-service');

const MIME = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml' };
const rate = new Map();
const RATE_WINDOW = 60_000, RATE_MAX = 120;
const AUTH_RATE_WINDOW = 15 * 60_000, AUTH_RATE_MAX = 10;
const ACCENTS = new Set(['#742cff','#1769aa','#16805c','#1f3a5f','#d35f12']);
const TEMPLATES = new Set(['modern','classic','minimal','executive','creative']);

function json(res, status, data) { res.statusCode=status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(data)); }
function html(res, status, data) { res.statusCode=status; res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(data); }
function noContent(res) { res.statusCode=204; res.end(); }
function now() { return new Date().toISOString(); }
function body(req) { return new Promise((resolve,reject)=>{ let raw=''; req.on('data',c=>{raw+=c; if(raw.length>1e6) req.destroy();}); req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch(e){reject(new Error('JSON inválido.'));}}); req.on('error',reject); }); }
function cleanUser(u) { return { id:u.id, name:u.name, email:u.email, plan:u.plan, createdAt:u.created_at, resumeProfile:JSON.parse(u.resume_profile_json||'{}') }; }
function planFor(u) { return PLANS[u.plan] || PLANS.free; }
function usageRow(userId) { const d=today(); db.prepare('INSERT OR IGNORE INTO usage_daily(user_id,usage_date) VALUES(?,?)').run(userId,d); return db.prepare('SELECT * FROM usage_daily WHERE user_id=? AND usage_date=?').get(userId,d); }
function consume(user, field) { const p=planFor(user); if(p.dailyLimit===null) return true; const u=usageRow(user.id); if(u[field] >= p.dailyLimit) return false; db.prepare(`UPDATE usage_daily SET ${field}=${field}+1 WHERE user_id=? AND usage_date=?`).run(user.id,today()); return true; }
function resumeData(row) { return { id:row.id, title:row.title, template:row.template, accent:row.accent, data:JSON.parse(row.data_json), createdAt:row.created_at, updatedAt:row.updated_at, shared:!!row.shared_token, sharedAt:row.shared_at }; }
function esc(v='') { return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function resumeHtml(r, publicMode=false, plan='free') {
  const d=r.data||{}; const template=TEMPLATES.has(r.template)?r.template:'modern'; const contact=[d.email,d.phone,d.city].filter(Boolean).map(esc).join(' · ');
  const templateCss=template==='classic'?'.paper.template-classic .head{border-bottom:0;border-left:5px solid var(--accent);padding:0 0 0 14px}.paper.template-classic .section h2{text-transform:none;letter-spacing:0;font-size:15px;border-bottom:1px solid #ddd;padding-bottom:5px}':template==='minimal'?'.paper.template-minimal{box-shadow:none}.paper.template-minimal .head{border-bottom:1px solid #ddd}.paper.template-minimal .section h2{text-transform:none;letter-spacing:0}':template==='executive'?'.paper.template-executive .head{background:var(--accent);color:#fff;padding:22px;border:0}.paper.template-executive .head .muted{color:#e8edf4}.paper.template-executive .section h2{border-bottom:1px solid #ccd4df;padding-bottom:6px}':template==='creative'?'.paper.template-creative{border-top:10px solid var(--accent)}.paper.template-creative .head{border-bottom:0}.paper.template-creative .section h2{display:inline-block;background:#fff2e8;padding:5px 9px;border-radius:4px}':'';
  const period=x=>{if(x.period)return x.period;const fmt=value=>{if(!value)return '';const date=new Date(`${String(value).slice(0,10)}T00:00:00`);return Number.isNaN(date.valueOf())?'':date.toLocaleDateString('pt-BR',{month:'short',year:'numeric'})};return [fmt(x.startDate),x.current?'Atual':fmt(x.endDate)].filter(Boolean).join(' – ')};
  const exp=(d.experiences||[]).map(x=>`<div class="item"><h3>${esc(x.role)}${x.company?` — ${esc(x.company)}`:''}</h3><p class="muted">${esc(period(x))}</p><p>${esc(x.description)}</p></div>`).join('');
  const edu=(d.education||[]).map(x=>`<div class="item"><h3>${esc(x.course)}</h3><p class="muted">${esc(x.school)}${period(x)?` · ${esc(period(x))}`:''}</p></div>`).join('');
  const skills=(d.skills||[]).filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(r.title)} — Currículo Fácil</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;background:#ececf0;font-family:Arial,sans-serif;color:#202027}.paper{width:210mm;min-height:297mm;margin:24px auto;background:#fff;padding:24mm 20mm;box-shadow:0 10px 35px #0002;--accent:${esc(r.accent)} }.head{border-bottom:3px solid var(--accent);padding-bottom:18px}.head h1{margin:0 0 6px;font-size:30px}.head p{margin:4px 0}.muted{color:#666}.section{margin-top:22px}.section h2{font-size:13px;text-transform:uppercase;letter-spacing:1.4px;color:var(--accent);margin:0 0 10px}.item{margin:0 0 14px}.item h3{margin:0 0 3px;font-size:15px}.item p{margin:3px 0;line-height:1.5}.skills{display:flex;gap:7px;flex-wrap:wrap}.skills span{border:1px solid #ddd;border-radius:999px;padding:5px 9px;font-size:12px}@media print{body{background:#fff}.paper{margin:0;box-shadow:none}}${publicMode?'':'button{position:fixed;top:16px;right:16px;padding:10px 14px;border:0;border-radius:9px;background:#742cff;color:#fff;font-weight:700;cursor:pointer}@media print{button,.ad{display:none}}.ad{position:fixed;top:12px;left:50%;transform:translateX(-50%);padding:7px 12px;border-radius:999px;background:#f3f1f8;color:#6d6875;font-size:11px;border:1px solid #ddd;z-index:5}' }${templateCss}</style></head><body>${(!publicMode && plan==='free')?'<div class="ad">Publicidade · espaço reservado para a rede de anúncios</div>':''}<button onclick="print()">Salvar em PDF</button><article class="paper template-${template}"><header class="head"><h1>${esc(d.name||r.title)}</h1><p>${esc(d.role||'Profissional')}</p><p class="muted">${contact}</p></header>${d.summary?`<section class="section"><h2>Resumo</h2><p>${esc(d.summary)}</p></section>`:''}${exp?`<section class="section"><h2>Experiência</h2>${exp}</section>`:''}${edu?`<section class="section"><h2>Formação</h2>${edu}</section>`:''}${skills?`<section class="section"><h2>Habilidades</h2><div class="skills">${skills}</div></section>`:''}</article></body></html>`;
}
function sendStatic(req,res,urlPath) {
  let pathname = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  const full = path.resolve(config.rootDir, '.' + pathname);
  if (full !== config.rootDir && !full.startsWith(config.rootDir + path.sep)) return false;
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) return false;
  const ext=path.extname(full); res.statusCode=200; res.setHeader('Content-Type',MIME[ext]||'application/octet-stream'); fs.createReadStream(full).pipe(res); return true;
}
function originAllowed(req) {
  const origin=req.headers.origin;
  if (!origin) return !['POST','PUT','PATCH','DELETE'].includes(req.method);
  return origin===config.appUrl || origin==='http://127.0.0.1:'+config.port || origin==='http://localhost:'+config.port;
}
let rateChecks = 0;
function limited(req,res) {
  const ip=req.socket.remoteAddress||'unknown', n=Date.now(), pathname=new URL(req.url,config.appUrl).pathname;
  const buckets=[[`all:${ip}`,RATE_WINDOW,RATE_MAX]];
  if(req.method==='POST'&&/^\/api\/auth\/(login|register|forgot-password|reset-password)$/.test(pathname)) buckets.push([`auth:${ip}:${pathname}`,AUTH_RATE_WINDOW,AUTH_RATE_MAX]);
  let blocked=false;
  for(const [key,window,max] of buckets) {
    const r=rate.get(key)||{start:n,count:0,window};
    if(n-r.start>window){r.start=n;r.count=0;}
    r.count++;r.window=window;rate.set(key,r);
    if(r.count>max)blocked=true;
  }
  if(rate.size>5000||(++rateChecks%128===0)) { for(const [key,value] of rate) if(n-value.start>value.window) rate.delete(key); while(rate.size>5000) rate.delete(rate.keys().next().value); }
  if(blocked){json(res,429,{error:'Muitas requisições. Tente novamente em instantes.'});return true;}
  return false;
}

async function route(req,res) {
  if (limited(req,res)) return;
  if (!originAllowed(req)) return json(res,403,{error:'Origem não permitida.'});
  const u=new URL(req.url, config.appUrl); const p=u.pathname; const method=req.method;
  if (p.startsWith('/api/')) {
    try {
      if (method==='POST' && p==='/api/auth/register') {
        const b=await body(req); const name=String(b.name||'').trim(), email=String(b.email||'').trim().toLowerCase(), password=String(b.password||'');
        if(name.length<2||email.length<5||!email.includes('@')||password.length<8) return json(res,400,{error:'Nome, e-mail válido e senha de pelo menos 8 caracteres são obrigatórios.'});
        if(db.prepare('SELECT id FROM users WHERE email=?').get(email)) return json(res,409,{error:'Este e-mail já está cadastrado.'});
        const userId=id(), t=now(); db.prepare('INSERT INTO users(id,name,email,password_hash,plan,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(userId,name,email,hashPassword(password),'free',t,t); setSession(res,userId); return json(res,201,{user:cleanUser(db.prepare('SELECT * FROM users WHERE id=?').get(userId))});
      }
      if (method==='POST' && p==='/api/auth/login') {
        const b=await body(req), email=String(b.email||'').trim().toLowerCase(), password=String(b.password||''); const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
        if(!user||!verifyPassword(password,user.password_hash)) return json(res,401,{error:'E-mail ou senha inválidos.'}); setSession(res,user.id); return json(res,200,{user:cleanUser(user)});
      }
      if (method==='POST' && p==='/api/auth/logout') { const raw=parseCookies(req).cf_session; clearSession(res,raw); return json(res,200,{ok:true}); }
      if (method==='GET' && p==='/api/auth/me') { const user=getUser(req); return user?json(res,200,{user:cleanUser(user)}):json(res,401,{error:'Não autenticado.'}); }
      if (method==='POST' && p==='/api/auth/forgot-password') {
        const b=await body(req), email=String(b.email||'').trim().toLowerCase(), user=db.prepare('SELECT * FROM users WHERE email=?').get(email); let devToken=null;
        if(user){ const raw=token(32), expires=new Date(Date.now()+config.resetTokenMinutes*60000).toISOString(); db.prepare('DELETE FROM password_resets WHERE user_id=?').run(user.id); db.prepare('INSERT INTO password_resets(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)').run(id(),user.id,hashToken(raw),expires); if(config.nodeEnv!=='production') devToken=raw; }
        return json(res,200,{message:'Se o e-mail existir, um link de recuperação será disponibilizado.', ...(devToken?{developmentToken:devToken}: {})});
      }
      if (method==='POST' && p==='/api/auth/reset-password') {
        const b=await body(req), raw=String(b.token||''), password=String(b.password||''); if(password.length<8) return json(res,400,{error:'A senha deve ter pelo menos 8 caracteres.'}); const row=db.prepare(`SELECT * FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at > datetime('now')`).get(hashToken(raw)); if(!row) return json(res,400,{error:'Token inválido ou expirado.'}); db.prepare('UPDATE users SET password_hash=?,updated_at=? WHERE id=?').run(hashPassword(password),now(),row.user_id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id); db.prepare('UPDATE password_resets SET used_at=? WHERE id=?').run(now(),row.id); return json(res,200,{ok:true});
      }

      if(method==='GET' && p==='/api/models') return json(res,200,{models:[{key:'modern',name:'Moderno',description:'Visual limpo com destaque roxo.'},{key:'classic',name:'Clássico',description:'Estrutura tradicional e objetiva.'},{key:'minimal',name:'Minimal',description:'Tipografia leve e bastante espaço.'},{key:'executive',name:'Executivo',description:'Visual corporativo com faixa marinho.'},{key:'creative',name:'Criativo',description:'Composição expressiva em laranja.'}]});
      if(method==='GET' && p==='/api/plans') return json(res,200,{plans:Object.values(PLANS)});
      const user=requireUser(req,res); if(!user) return json(res,401,{error:'Faça login para continuar.'});
      if(method==='GET' && p==='/api/usage'){ const u=usageRow(user.id), plan=planFor(user), capacity=resumeCapacity(db,user.id,plan); return json(res,200,{plan,resumeCapacity:capacity,usage:{exports:u.exports,shares:u.shares,resumeCreates:u.resume_creates},remaining:{exports:plan.dailyLimit===null?null:Math.max(0,plan.dailyLimit-u.exports),shares:plan.dailyLimit===null?null:Math.max(0,plan.dailyLimit-u.shares),resumeCreates:capacity.available}}); }
      if(method==='GET' && p==='/api/resumes') { const rows=db.prepare('SELECT * FROM resumes WHERE user_id=? ORDER BY updated_at DESC').all(user.id); return json(res,200,{resumes:rows.map(resumeData)}); }
      if(method==='POST' && p==='/api/resumes') { const b=await body(req), title=String(b.title||'Meu currículo').trim().slice(0,100)||'Meu currículo', template=String(b.template||'modern'), accent=String(b.accent||'#742cff'); if(!TEMPLATES.has(template)||!ACCENTS.has(accent))return json(res,400,{error:'Modelo ou cor inválidos.'}); const capacity=resumeCapacity(db,user.id,planFor(user)); if(capacity.available===0)return json(res,409,{code:'RESUME_LIMIT_REACHED',error:`Você já atingiu o limite de ${capacity.limit} currículos salvos. Exclua um currículo para liberar espaço ou confira os planos.`,details:capacity}); const data=typeof b.data==='object'&&b.data?b.data:{}; const rid=id(),t=now(); db.prepare('INSERT INTO resumes(id,user_id,title,template,accent,data_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(rid,user.id,title,template,accent,JSON.stringify(data),t,t); return json(res,201,{resume:resumeData(db.prepare('SELECT * FROM resumes WHERE id=?').get(rid))}); }
      const match=p.match(/^\/api\/resumes\/([^/]+)$/); if(match){ const rid=match[1]; const row=db.prepare('SELECT * FROM resumes WHERE id=? AND user_id=?').get(rid,user.id); if(!row) return json(res,404,{error:'Currículo não encontrado.'}); if(method==='GET') return json(res,200,{resume:resumeData(row)}); if(method==='PATCH'){ const b=await body(req), current=resumeData(row), nextData=typeof b.data==='object'&&b.data?b.data:current.data, title=String(b.title??current.title).trim().slice(0,100)||current.title, template=String(b.template??current.template), accent=String(b.accent??current.accent); if(!TEMPLATES.has(template)||!ACCENTS.has(accent))return json(res,400,{error:'Modelo ou cor inválidos.'}); db.prepare('UPDATE resumes SET title=?,template=?,accent=?,data_json=?,updated_at=? WHERE id=?').run(title,template,accent,JSON.stringify(nextData),now(),rid); return json(res,200,{resume:resumeData(db.prepare('SELECT * FROM resumes WHERE id=?').get(rid))}); } if(method==='DELETE'){db.prepare('DELETE FROM resumes WHERE id=?').run(rid); return noContent(res);} }
      const exportMatch=p.match(/^\/api\/resumes\/([^/]+)\/export$/); if(method==='POST'&&exportMatch){ const row=db.prepare('SELECT * FROM resumes WHERE id=? AND user_id=?').get(exportMatch[1],user.id); if(!row) return json(res,404,{error:'Currículo não encontrado.'}); if(!consume(user,'exports')) return json(res,429,{error:'Seu limite diário de exportações foi atingido.'}); return html(res,200,resumeHtml(resumeData(row), false, user.plan)); }
      const shareMatch=p.match(/^\/api\/resumes\/([^/]+)\/share$/); if(method==='POST'&&shareMatch){ const row=db.prepare('SELECT * FROM resumes WHERE id=? AND user_id=?').get(shareMatch[1],user.id); if(!row) return json(res,404,{error:'Currículo não encontrado.'}); if(!consume(user,'shares')) return json(res,429,{error:'Seu limite diário de compartilhamentos foi atingido.'}); const raw=token(18),t=now(); db.prepare('UPDATE resumes SET shared_token=?,shared_at=? WHERE id=?').run(raw,t,row.id); return json(res,200,{url:`${config.appUrl}/share/${raw}`}); }
      if(method==='GET'&&p==='/api/profile'){return json(res,200,{user:cleanUser(user)})}
      if(method==='PATCH'&&p==='/api/profile'){const b=await body(req), name=String(b.name??user.name).trim(); if(name.length<2)return json(res,400,{error:'Nome inválido.'}); const profile=normalizeResumeProfile(b.resumeProfile??JSON.parse(user.resume_profile_json||'{}')); db.prepare('UPDATE users SET name=?,resume_profile_json=?,updated_at=? WHERE id=?').run(name,JSON.stringify(profile),now(),user.id); return json(res,200,{user:cleanUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id))});}
      if(method==='POST'&&p==='/api/billing/dev-activate'){
        if(config.nodeEnv==='production') return json(res,403,{error:'Rota de desenvolvimento desativada em produção.'});
        const b=await body(req), plan=String(b.plan||''); if(!['free','basic','premium'].includes(plan)) return json(res,400,{error:'Plano inválido.'}); db.prepare('UPDATE users SET plan=?,updated_at=? WHERE id=?').run(plan,now(),user.id); return json(res,200,{user:cleanUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id))});
      }
      if(method==='POST'&&p==='/api/billing/checkout'){const b=await body(req), plan=String(b.plan||''); if(!['basic','premium'].includes(plan))return json(res,400,{error:'Plano inválido.'}); const sid=id(),t=now(); db.prepare('INSERT INTO subscriptions(id,user_id,plan,status,provider,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(sid,user.id,plan,'pending','manual',t,t); return json(res,200,{status:'pending',message:'Checkout externo ainda não foi conectado. O registro da assinatura foi criado para integração com o gateway.',subscriptionId:sid});}
      return json(res,404,{error:'Rota não encontrada.'});
    } catch(e) { console.error(e); return json(res,500,{error:config.nodeEnv==='development'?e.message:'Erro interno do servidor.'}); }
  }
  if(method==='GET' && p.startsWith('/share/')) { const share=p.split('/')[2]; const row=db.prepare('SELECT * FROM resumes WHERE shared_token=?').get(share); if(!row) return html(res,404,'<h1>Currículo não encontrado</h1>'); return html(res,200,resumeHtml(resumeData(row),true)); }
  if(method==='GET' && sendStatic(req,res,p)) return;
  return json(res,404,{error:'Página não encontrada.'});
}

const server=http.createServer((req,res)=>route(req,res));
server.listen(config.port,()=>console.log(`Currículo Fácil rodando em ${config.appUrl}`));
