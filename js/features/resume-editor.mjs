import { $, $$, api, toast } from '../shared.mjs';

const DEFINITIONS = {
  experience:{label:'Experiência',fields:[['role','Cargo'],['company','Empresa'],['location','Localização'],['startDate','Data de início','date'],['endDate','Data de término','date'],['description','Atividades e resultados','textarea']],current:'Trabalho atualmente aqui'},
  education:{label:'Formação',fields:[['course','Curso ou formação'],['institution','Instituição'],['location','Localização'],['startDate','Data de início','date'],['endDate','Data de término','date'],['description','Detalhes','textarea']],current:'Estudo atualmente aqui'},
  course:{label:'Curso',fields:[['name','Nome do curso'],['institution','Instituição'],['date','Data de conclusão','date'],['url','Link do certificado']]},
  language:{label:'Idioma',fields:[['name','Idioma'],['proficiency','Nível']]},
  certification:{label:'Certificação',fields:[['name','Certificação'],['issuer','Emissor'],['date','Data de emissão','date'],['url','Link']]},
  project:{label:'Projeto',fields:[['name','Nome'],['description','Descrição','textarea'],['technologies','Tecnologias (separadas por vírgula)'],['url','Link do projeto']]}
};

function addEditorEntry(form,type,item={}) {
  const definition=DEFINITIONS[type]; if(!definition)return;
  const box=document.createElement('fieldset'); box.className='editor-entry'; box.dataset.editorEntry=type;
  const targetName={experience:'experiences',education:'education',course:'courses',language:'languages',certification:'certifications',project:'projects'}[type];
  const target=$(`[data-editor-${targetName}]`,form); if(!target)return;
  const fields=definition.fields.map(([key,label,inputType])=>`<label class="form-field"><span>${label}</span>${inputType==='textarea'?`<textarea data-entry-field="${key}" rows="3"></textarea>`:`<input ${inputType?`type="${inputType}"`:''} data-entry-field="${key}" ${['url'].includes(key)?'type="url"':''}>`}</label>`).join('');
  const legacyPeriod=item.period&&!item.startDate&&!item.endDate?`<label class="form-field"><span>Período já cadastrado</span><input data-entry-field="period"></label>`:'';
  box.innerHTML=`<legend>${definition.label}</legend>${fields}${legacyPeriod}${definition.current?`<label class="form-field current-field"><input type="checkbox" data-current><span>${definition.current}</span></label>`:''}<button type="button" class="button button-ghost button-small" data-editor-remove>Remover ${definition.label.toLowerCase()}</button>`;
  target.append(box);
  for(const [key,value] of Object.entries(item||{})){const field=$(`[data-entry-field="${key}"]`,box);if(field)field.value=Array.isArray(value)?value.join(', '):value||'';}
  const start=$('[data-entry-field="startDate"]',box),end=$('[data-entry-field="endDate"]',box),current=$('[data-current]',box);
  if(current){current.checked=!!item.current;if(end)end.disabled=current.checked;}
  if(start&&end&&start.value)end.min=start.value;
}

function parseLegacyDate(value){if(!value)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;if(/^\d{4}-\d{2}$/.test(value))return `${value}-01`;const m=String(value).match(/(\d{1,2})\s*\/(\d{4})/);return m?`${m[2]}-${m[1].padStart(2,'0')}-01`:'';}

function fillEditor(form,resume){
  const d=ResumeRendering.normalize(resume.data||{}),p=d.personal;
  for(const [key,value] of Object.entries({title:resume.title,accent:resume.accent,template:resume.template,name:p.name,role:p.headline,email:p.email,phone:p.phone,city:p.city,state:p.state,linkedin:p.linkedin,github:p.github,portfolio:p.portfolio,summary:d.summary}))if(form.elements[key])form.elements[key].value=value||'';
  if(form.elements.skills)form.elements.skills.value=d.skills.join(', ');
  for(const [type,items] of Object.entries({experience:d.experiences,education:d.education,course:d.courses,language:d.languages,certification:d.certifications,project:d.projects}))items.forEach(item=>addEditorEntry(form,type,{...item,startDate:item.startDate||parseLegacyDate(item.period),endDate:item.endDate||''}));
}

function collectEditor(form){
  const personal={name:form.elements.name?.value.trim()||'',headline:form.elements.role?.value.trim()||'',email:form.elements.email?.value.trim()||'',phone:form.elements.phone?.value.trim()||'',city:form.elements.city?.value.trim()||'',state:form.elements.state?.value.trim()||'',linkedin:form.elements.linkedin?.value.trim()||'',github:form.elements.github?.value.trim()||'',portfolio:form.elements.portfolio?.value.trim()||''};
  const entries=type=>$$(`[data-editor-entry="${type}"]`,form).map(row=>{const item={};$$('[data-entry-field]',row).forEach(field=>{item[field.dataset.entryField]=field.value.trim()});if(item.technologies)item.technologies=item.technologies.split(',').map(x=>x.trim()).filter(Boolean);if(row.querySelector('[data-current]'))item.current=row.querySelector('[data-current]').checked;return item}).filter(item=>Object.values(item).some(v=>Array.isArray(v)?v.length:Boolean(v)));
  return {personal,summary:form.elements.summary?.value.trim()||'',experiences:entries('experience'),education:entries('education'),courses:entries('course'),languages:entries('language'),certifications:entries('certification'),projects:entries('project'),skills:(form.elements.skills?.value||'').split(',').map(x=>x.trim()).filter(Boolean)};
}

function formatPeriod(item){const fmt=value=>{if(!value)return '';const date=new Date(`${value.slice(0,10)}T00:00:00`);return Number.isNaN(date.valueOf())?'':date.toLocaleDateString('pt-BR',{month:'short',year:'numeric'})};return [fmt(item.startDate),item.current?'Atual':fmt(item.endDate)].filter(Boolean).join(' – ')}
async function saveEditor(form,resume,{quiet=false}={}){const button=$('[data-save]');if(button)button.disabled=true;try{const out=await api('/resumes/'+resume.id,{method:'PATCH',body:JSON.stringify({title:form.elements.title.value,template:form.elements.template.value,accent:form.elements.accent.value,data:collectEditor(form)})});if(!quiet)toast('Currículo salvo.','success');return out.resume}catch(e){if(!quiet)toast(e.message,'error');return null}finally{if(button)button.disabled=false}}
function renderPaper(form){const data=collectEditor(form),paper=$('[data-paper]');if(!paper)return;paper.dataset.template=form.elements.template.value;paper.style.setProperty('--accent',form.elements.accent.value);paper.innerHTML=ResumeRendering.renderBody(data,{title:form.elements.title.value});}

async function exportResume(id,format='pdf'){
  try{
    const response=await fetch(`/api/resumes/${encodeURIComponent(id)}/export?format=${encodeURIComponent(format)}`,{method:'POST',credentials:'include'});
    if(!response.ok)throw new Error((await response.json()).error||'Falha ao exportar.');
    if(format==='print'){const html=await response.text(),windowRef=window.open('','_blank');if(!windowRef)throw new Error('Permita abrir uma nova janela para imprimir o currículo.');windowRef.document.open();windowRef.document.write(html);windowRef.document.close();return;}
    const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`curriculo.${format==='word'?'docx':format}`;link.click();URL.revokeObjectURL(url);toast('Arquivo exportado.','success');
  }catch(e){toast(e.message,'error')}
}
async function shareResume(id){
  try{
    const r=await api('/resumes/'+encodeURIComponent(id)+'/share',{method:'POST'});
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(r.url);
      else {const input=document.createElement('textarea');input.value=r.url;input.setAttribute('readonly','');input.style.position='fixed';input.style.opacity='0';document.body.append(input);input.select();const copied=document.execCommand('copy');input.remove();if(!copied)throw new Error('');}
      toast('Link de compartilhamento copiado.','success');
    }catch{window.prompt('Copie o link do currículo:',r.url);}
  }catch(e){toast(e.message,'error')}
}

export { addEditorEntry, parseLegacyDate, fillEditor, collectEditor, formatPeriod, saveEditor, renderPaper, exportResume, shareResume };

