const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const PLANS = require('../../domain/plans');
const { presentUser } = require('../../application/user-presenter');
const { resumeDto } = require('../../application/resume-use-cases');
const { TEMPLATES } = require('../../domain/resume-policy');
const { parseCookies, setSessionCookie, clearSessionCookie } = require('./session-cookies');

const MIME = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml' };
const rate = new Map();
const RATE_WINDOW = 60_000, RATE_MAX = 120;
const AUTH_RATE_WINDOW = 15 * 60_000, AUTH_RATE_MAX = 10;

function createHttpServer({config,repositories,auth,profiles,resumes,usage,billing,security}) {
function json(res, status, data) { res.statusCode=status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(data)); }
function html(res, status, data) { res.statusCode=status; res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(data); }
function noContent(res) { res.statusCode=204; res.end(); }
function now() { return new Date().toISOString(); }
function body(req) { return new Promise((resolve,reject)=>{ let raw=''; req.on('data',c=>{raw+=c; if(raw.length>1e6) req.destroy();}); req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch(e){reject(new Error('JSON inválido.'));}}); req.on('error',reject); }); }
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
        const result=await auth.register(await body(req));
        if(result.error)return json(res,result.status,{error:result.error});
        setSessionCookie(res,result.sessionToken,config);return json(res,201,{user:result.user});
      }
      if (method==='POST' && p==='/api/auth/login') {
        const result=await auth.login(await body(req));
        if(result.error)return json(res,result.status,{error:result.error});
        setSessionCookie(res,result.sessionToken,config);return json(res,200,{user:result.user});
      }
      if (method==='POST' && p==='/api/auth/logout') { auth.logout(parseCookies(req).cf_session);clearSessionCookie(res,config);return json(res,200,{ok:true}); }
      if (method==='GET' && p==='/api/auth/me') { const user=auth.currentUser(parseCookies(req).cf_session);return user?json(res,200,{user:presentUser(user)}):json(res,401,{error:'Não autenticado.'}); }
      if (method==='POST' && p==='/api/auth/forgot-password') {
        const result=await auth.requestPasswordReset((await body(req)).email);
        return result.error?json(res,result.status,{error:result.error}):json(res,200,result);
      }
      if (method==='POST' && p==='/api/auth/reset-password') {
        const result=auth.resetPassword(await body(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);
      }

      if(method==='GET' && p==='/api/models') return json(res,200,{models:[{key:'modern',name:'Moderno',description:'Visual limpo com destaque roxo.'},{key:'classic',name:'Clássico',description:'Estrutura tradicional e objetiva.'},{key:'minimal',name:'Minimal',description:'Tipografia leve e bastante espaço.'},{key:'executive',name:'Executivo',description:'Visual corporativo com faixa marinho.'},{key:'creative',name:'Criativo',description:'Composição expressiva em laranja.'}]});
      if(method==='GET' && p==='/api/plans') return json(res,200,{plans:Object.values(PLANS)});
      const user=auth.currentUser(parseCookies(req).cf_session); if(!user) return json(res,401,{error:'Faça login para continuar.'});
      if(method==='GET' && p==='/api/usage')return json(res,200,usage.summary(user));
      if(method==='GET' && p==='/api/resumes') return json(res,200,{resumes:resumes.list(user)});
      if(method==='POST' && p==='/api/resumes') { const result=resumes.create(user,await body(req));if(result?.error)return json(res,result.status,{error:result.error,code:result.code,details:result.details});return json(res,201,{resume:result}); }
      const match=p.match(/^\/api\/resumes\/([^/]+)$/); if(match){const resumeId=match[1];if(method==='GET'){const item=resumes.get(user,resumeId);return item?json(res,200,{resume:item}):json(res,404,{error:'Currículo não encontrado.'});}if(method==='PATCH'){const result=resumes.update(user,resumeId,await body(req));if(!result)return json(res,404,{error:'Currículo não encontrado.'});if(result.error)return json(res,result.status,{error:result.error});return json(res,200,{resume:result});}if(method==='DELETE')return resumes.remove(user,resumeId)?noContent(res):json(res,404,{error:'Currículo não encontrado.'});}
      const exportMatch=p.match(/^\/api\/resumes\/([^/]+)\/export$/); if(method==='POST'&&exportMatch){const item=resumes.get(user,exportMatch[1]);if(!item)return json(res,404,{error:'Currículo não encontrado.'});if(!usage.consume(user,'exports'))return json(res,429,{error:'Seu limite diário de exportações foi atingido.'});return html(res,200,resumeHtml(item,false,user.plan));}
      const shareMatch=p.match(/^\/api\/resumes\/([^/]+)\/share$/); if(method==='POST'&&shareMatch){const item=resumes.get(user,shareMatch[1]);if(!item)return json(res,404,{error:'Currículo não encontrado.'});if(!usage.consume(user,'shares'))return json(res,429,{error:'Seu limite diário de compartilhamentos foi atingido.'});const raw=security.token(18),t=now();repositories.resumes.setShare(item.id,raw,t);return json(res,200,{url:`${config.appUrl}/share/${raw}`});}
      if(method==='GET'&&p==='/api/profile')return json(res,200,{user:profiles.get(user)});
      if(method==='PATCH'&&p==='/api/profile'){const result=profiles.update(user,await body(req));if(result?.error)return json(res,result.status,{error:result.error});return json(res,200,{user:result});}
      if(method==='POST'&&p==='/api/billing/dev-activate'){
        if(config.nodeEnv==='production') return json(res,403,{error:'Rota de desenvolvimento desativada em produção.'});
        const result=billing.activatePlan(user.id,String((await body(req)).plan||''));return result.error?json(res,result.status,{error:result.error}):json(res,200,{user:result});
      }
      if(method==='POST'&&p==='/api/billing/checkout'){const result=billing.createPendingCheckout(user,String((await body(req)).plan||''));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
      return json(res,404,{error:'Rota não encontrada.'});
    } catch(e) { console.error(e); return json(res,500,{error:config.nodeEnv==='development'?e.message:'Erro interno do servidor.'}); }
  }
  if(method==='GET' && p.startsWith('/share/')) { const share=p.split('/')[2],item=resumeDto(repositories.resumes.findByShareToken(share));if(!item)return html(res,404,'<h1>Currículo não encontrado</h1>');return html(res,200,resumeHtml(item,true)); }
  if(method==='GET' && sendStatic(req,res,p)) return;
  return json(res,404,{error:'Página não encontrada.'});
}

const server=http.createServer((req,res)=>route(req,res));
return server;
}

module.exports={createHttpServer};
