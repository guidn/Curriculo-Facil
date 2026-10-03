import { $, api, currentUser } from '../shared.mjs';

export async function initDemoPreview(){
  const page=$('[data-demo-preview]');if(!page)return;
  const paper=$('[data-demo-paper]'),choices=$('[data-demo-templates]'),error=$('[data-demo-error]'),label=$('[data-demo-zoom-label]');
  let resume,zoom=1,fit=true;
  try{
    const [demo,catalog]=await Promise.all([api('/dev/demo-resume'),api('/models')]);
    resume=demo.resume;
    choices.innerHTML=catalog.models.map(item=>`<button class="demo-template-choice" type="button" data-template="${item.id}" aria-pressed="false">${item.name}</button>`).join('');
    const render=template=>{
      resume.template=template;
      const meta=catalog.models.find(item=>item.id===template);
      if(!meta)return;
      resume.accent=meta.accent;
      paper.dataset.template=template;
      paper.style.setProperty('--accent',meta.accent);
      paper.innerHTML=ResumeRendering.renderBody(resume.data,{title:resume.title});
      choices.querySelectorAll('[data-template]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.template===template)));
    };
    choices.addEventListener('click',event=>{const button=event.target.closest('[data-template]');if(button)render(button.dataset.template)});
    const fitValue=()=>Math.min(1.08,Math.max(.38,(paper.parentElement.clientWidth-40)/760));
    const setZoom=value=>{zoom=Math.min(1.25,Math.max(.38,value));paper.style.zoom=String(zoom);label.textContent=`${Math.round(zoom*100)}%`};
    page.querySelectorAll('[data-demo-zoom]').forEach(button=>button.addEventListener('click',()=>{
      if(button.dataset.demoZoom==='fit'){fit=true;setZoom(fitValue());return}
      fit=false;setZoom(zoom+(button.dataset.demoZoom==='in' ? .1 : -.1));
    }));
    window.addEventListener('resize',()=>{if(fit)setZoom(fitValue())});
    $('[data-demo-print]').addEventListener('click',()=>window.print());
    const create=$('[data-demo-create]');
    create.addEventListener('click',async event=>{
      event.preventDefault();
      if(await currentUser())location.href=`novo-curriculo.html?template=${encodeURIComponent(resume.template)}`;
      else location.href=`../auth/cadastro.html?template=${encodeURIComponent(resume.template)}`;
    });
    render(resume.template);
    setZoom(fitValue());
  }catch{
    error.hidden=false;
    page.querySelector('.demo-tools')?.setAttribute('hidden','');
    $('[data-demo-create]')?.setAttribute('hidden','');
  }
}

