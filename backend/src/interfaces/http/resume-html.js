'use strict';

const {TEMPLATES}=require('../../domain/resume-policy');

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}

function formatPeriod(item) {
  if(item.period)return item.period;
  const format=value=>{
    if(!value)return '';
    const date=new Date(`${String(value).slice(0,10)}T00:00:00`);
    return Number.isNaN(date.valueOf())?'':date.toLocaleDateString('pt-BR',{month:'short',year:'numeric'});
  };
  return [format(item.startDate),item.current?'Atual':format(item.endDate)].filter(Boolean).join(' – ');
}

function renderResumeHtml(resume,publicMode=false,plan='free') {
  const data=resume.data||{};
  const template=TEMPLATES.has(resume.template)?resume.template:'modern';
  const contact=[data.email,data.phone,data.city].filter(Boolean).map(escapeHtml).join(' · ');
  const templateCss={
    classic:'.paper.template-classic .head{border-bottom:0;border-left:5px solid var(--accent);padding:0 0 0 14px}.paper.template-classic .section h2{text-transform:none;letter-spacing:0;font-size:15px;border-bottom:1px solid #ddd;padding-bottom:5px}',
    minimal:'.paper.template-minimal{box-shadow:none}.paper.template-minimal .head{border-bottom:1px solid #ddd}.paper.template-minimal .section h2{text-transform:none;letter-spacing:0}',
    executive:'.paper.template-executive .head{background:var(--accent);color:#fff;padding:22px;border:0}.paper.template-executive .head .muted{color:#e8edf4}.paper.template-executive .section h2{border-bottom:1px solid #ccd4df;padding-bottom:6px}',
    creative:'.paper.template-creative{border-top:10px solid var(--accent)}.paper.template-creative .head{border-bottom:0}.paper.template-creative .section h2{display:inline-block;background:#fff2e8;padding:5px 9px;border-radius:4px}'
  }[template]||'';
  const experiences=(data.experiences||[]).map(item=>`<div class="item"><h3>${escapeHtml(item.role)}${item.company?` — ${escapeHtml(item.company)}`:''}</h3><p class="muted">${escapeHtml(formatPeriod(item))}</p><p>${escapeHtml(item.description)}</p></div>`).join('');
  const education=(data.education||[]).map(item=>`<div class="item"><h3>${escapeHtml(item.course)}</h3><p class="muted">${escapeHtml(item.school)}${formatPeriod(item)?` · ${escapeHtml(formatPeriod(item))}`:''}</p></div>`).join('');
  const skills=(data.skills||[]).filter(Boolean).map(skill=>`<span>${escapeHtml(skill)}</span>`).join('');
  const printCss=publicMode?'':'button{position:fixed;top:16px;right:16px;padding:10px 14px;border:0;border-radius:9px;background:#742cff;color:#fff;font-weight:700;cursor:pointer}@media print{button,.ad{display:none}}.ad{position:fixed;top:12px;left:50%;transform:translateX(-50%);padding:7px 12px;border-radius:999px;background:#f3f1f8;color:#6d6875;font-size:11px;border:1px solid #ddd;z-index:5}';
  const ad=!publicMode&&plan==='free'?'<div class="ad">Publicidade · espaço reservado para a rede de anúncios</div>':'';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(resume.title)} — Currículo Fácil</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;background:#ececf0;font-family:Arial,sans-serif;color:#202027}.paper{width:210mm;min-height:297mm;margin:24px auto;background:#fff;padding:24mm 20mm;box-shadow:0 10px 35px #0002;--accent:${escapeHtml(resume.accent)}}.head{border-bottom:3px solid var(--accent);padding-bottom:18px}.head h1{margin:0 0 6px;font-size:30px}.head p{margin:4px 0}.muted{color:#666}.section{margin-top:22px}.section h2{font-size:13px;text-transform:uppercase;letter-spacing:1.4px;color:var(--accent);margin:0 0 10px}.item{margin:0 0 14px}.item h3{margin:0 0 3px;font-size:15px}.item p{margin:3px 0;line-height:1.5}.skills{display:flex;gap:7px;flex-wrap:wrap}.skills span{border:1px solid #ddd;border-radius:999px;padding:5px 9px;font-size:12px}@media print{body{background:#fff}.paper{margin:0;box-shadow:none}}${printCss}${templateCss}</style></head><body>${ad}<button onclick="print()">Salvar em PDF</button><article class="paper template-${template}"><header class="head"><h1>${escapeHtml(data.name||resume.title)}</h1><p>${escapeHtml(data.role||'Profissional')}</p><p class="muted">${contact}</p></header>${data.summary?`<section class="section"><h2>Resumo</h2><p>${escapeHtml(data.summary)}</p></section>`:''}${experiences?`<section class="section"><h2>Experiência</h2>${experiences}</section>`:''}${education?`<section class="section"><h2>Formação</h2>${education}</section>`:''}${skills?`<section class="section"><h2>Habilidades</h2><div class="skills">${skills}</div></section>`:''}</article></body></html>`;
}

module.exports={renderResumeHtml};
