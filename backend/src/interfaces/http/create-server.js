const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const PLANS = require('../../domain/plans');
const { CATALOG } = require('../../domain/resume-policy');
const { presentUser } = require('../../application/user-presenter');
const { resumeDto } = require('../../application/resume-use-cases');
const { parseCookies, setSessionCookie, clearSessionCookie } = require('./session-cookies');
const { renderResumeHtml } = require('./resume-html');
const { createDocx } = require('../../infrastructure/exporters/docx');
const { createPdf } = require('../../infrastructure/exporters/pdf');
const { toText } = require('../../../../js/resume-rendering');

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
function sendStatic(req,res,urlPath) {
  let pathname = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  const full = path.resolve(config.rootDir, '.' + pathname);
  if (full !== config.rootDir && !full.startsWith(config.rootDir + path.sep)) return false;
  const relative=path.relative(config.rootDir,full).split(path.sep);
  if (!(relative.length===1&&relative[0]==='index.html')&&!['pages','css','js'].includes(relative[0])) return false;
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

      if(method==='GET' && p==='/api/models') return json(res,200,{models:CATALOG});
      if(method==='GET' && p==='/api/plans') return json(res,200,{plans:Object.values(PLANS)});
      if(method==='GET' && p==='/api/dev/demo-resume'){
        if(config.nodeEnv==='production')return json(res,404,{error:'Demonstração indisponível.'});
        const demo=JSON.parse(fs.readFileSync(path.join(config.rootDir,'backend/test/fixtures/demo-resume.json'),'utf8'));
        res.setHeader('Cache-Control','no-store');
        return json(res,200,{resume:demo});
      }
      const user=auth.currentUser(parseCookies(req).cf_session); if(!user) return json(res,401,{error:'Faça login para continuar.'});
      if(method==='GET' && p==='/api/usage')return json(res,200,usage.summary(user));
      if(method==='GET' && p==='/api/resumes') return json(res,200,{resumes:resumes.list(user)});
      if(method==='POST' && p==='/api/resumes') { const result=resumes.create(user,await body(req));if(result?.error)return json(res,result.status,{error:result.error,code:result.code,details:result.details});return json(res,201,{resume:result}); }
      const match=p.match(/^\/api\/resumes\/([^/]+)$/); if(match){const resumeId=match[1];if(method==='GET'){const item=resumes.get(user,resumeId);return item?json(res,200,{resume:item}):json(res,404,{error:'Currículo não encontrado.'});}if(method==='PATCH'){const result=resumes.update(user,resumeId,await body(req));if(!result)return json(res,404,{error:'Currículo não encontrado.'});if(result.error)return json(res,result.status,{error:result.error});return json(res,200,{resume:result});}if(method==='DELETE')return resumes.remove(user,resumeId)?noContent(res):json(res,404,{error:'Currículo não encontrado.'});}
      const exportMatch=p.match(/^\/api\/resumes\/([^/]+)\/export$/);
      if(method==='POST'&&exportMatch){
        const format=u.searchParams.get('format')||'pdf';
        if(!['pdf','word','txt','print'].includes(format))return json(res,400,{error:'Formato de exportação inválido.'});
        const item=resumes.get(user,exportMatch[1]);
        if(!item)return json(res,404,{error:'Currículo não encontrado.'});
        if(!usage.consume(user,'exports'))return json(res,429,{error:'Seu limite diário de exportações foi atingido.'});
        if(format==='print')return html(res,200,renderResumeHtml(item));
        if(format==='pdf'){
          const file=await createPdf(item);
          res.statusCode=200;res.setHeader('Content-Type','application/pdf');
          res.setHeader('Content-Disposition',`attachment; filename="curriculo-${item.id}.pdf"`);
          return res.end(file);
        }
        if(format==='txt'){
          res.statusCode=200;res.setHeader('Content-Type','text/plain; charset=utf-8');
          res.setHeader('Content-Disposition',`attachment; filename="curriculo-${item.id}.txt"`);
          return res.end(toText(item));
        }
        const file=await createDocx(item);
        res.statusCode=200;res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition',`attachment; filename="curriculo-${item.id}.docx"`);
        return res.end(file);
      }
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
  if(method==='GET' && p.startsWith('/share/')) { const share=p.split('/')[2],item=resumeDto(repositories.resumes.findByShareToken(share));if(!item)return html(res,404,'<h1>Currículo não encontrado</h1>');return html(res,200,renderResumeHtml(item,true)); }
  if(method==='GET' && sendStatic(req,res,p)) return;
  return json(res,404,{error:'Página não encontrada.'});
}

const server=http.createServer((req,res)=>route(req,res));
return server;
}

module.exports={createHttpServer};

