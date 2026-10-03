import { $, $$, api, currentUser, toast, go, escapeHtml } from '../shared.mjs';
import { addEditorEntry, fillEditor, collectEditor, formatPeriod, saveEditor, renderPaper, exportResume, shareResume } from './resume-editor.mjs';

export async function initEditor(){
  const form=$('[data-editor-form]'); if(!form)return;
  if(!(await currentUser()))return go('../auth/login.html'); const id=new URLSearchParams(location.search).get('id'); if(!id)return go('novo-curriculo.html'); let r; try{r=(await api('/resumes/'+encodeURIComponent(id))).resume}catch(e){toast(e.message,'error');return}
  fillEditor(form,r);
  const templates=(await api('/models')).models;
  $('[data-template-options]').innerHTML=templates.map(item=>`<button type="button" class="template-choice" data-template="${escapeHtml(item.id)}"><i class="template-swatch" style="--template-accent:${escapeHtml(item.accent)}"></i><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small></span><b>✓</b></button>`).join('');
  const status=$('[data-save-status]'), workspace=$('.editor-workspace'); let saveTimer, zoom=.86;
  const showStatus=message=>{if(status)status.textContent=message};
  const save=async quiet=>{clearTimeout(saveTimer);showStatus('Salvando…');const updated=await saveEditor(form,r,{quiet});if(updated){r=updated;showStatus('Salvo agora')}else showStatus('Não foi possível salvar')};
  const scheduleSave=()=>{showStatus('Alterações pendentes');clearTimeout(saveTimer);saveTimer=setTimeout(()=>save(true),1100)};
  const refresh=()=>{renderPaper(form);scheduleSave()};
  $$('[data-editor-add]').forEach(button=>button.addEventListener('click',()=>{addEditorEntry(form,button.dataset.editorAdd);refresh();button.previousElementSibling?.scrollIntoView({behavior:'smooth',block:'nearest'})}));
  form.addEventListener('click',event=>{if(event.target.closest('[data-editor-remove]')){event.target.closest('[data-editor-entry]')?.remove();refresh()}});
  form.addEventListener('input',refresh);
  form.addEventListener('change',event=>{const field=event.target;if(field.matches('[data-current]')){const end=field.closest('[data-editor-entry]')?.querySelector('[data-entry-field="endDate"]');if(end){end.disabled=field.checked;if(field.checked)end.value=''}}if(field.matches('[data-entry-field="startDate"]')){const end=field.closest('[data-editor-entry]')?.querySelector('[data-entry-field="endDate"]');if(end)end.min=field.value}refresh()});
  $('[data-save]')?.addEventListener('click',()=>save(false)); $('[data-save-preview]')?.addEventListener('click',()=>save(false).then(saved=>{if(saved){workspace.classList.add('preview-mode');$('[data-save-preview]').hidden=true;$('[data-return-editor]').hidden=false;showStatus('Prévia pronta')}})); $('[data-return-editor]')?.addEventListener('click',()=>{workspace.classList.remove('preview-mode');$('[data-save-preview]').hidden=false;$('[data-return-editor]').hidden=true});
  const exportFile=format=>{clearTimeout(saveTimer);save(true).then(saved=>{if(saved)exportResume(r.id,format)})};
  $('[data-export]')?.addEventListener('click',()=>exportFile('pdf'));
  $$('[data-export-format]').forEach(button=>button.addEventListener('click',()=>exportFile(button.dataset.exportFormat)));
  $('[data-share]')?.addEventListener('click',()=>{clearTimeout(saveTimer);save(true).then(saved=>{if(saved)shareResume(r.id)})});
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save(false)}});
  $$('.color-choice').forEach(button=>button.addEventListener('click',()=>{form.elements.accent.value=button.dataset.color;$$('.color-choice').forEach(x=>x.classList.toggle('selected',x===button));refresh()}));
  $$('.template-choice').forEach(button=>button.addEventListener('click',()=>{form.elements.template.value=button.dataset.template;$$('.template-choice').forEach(x=>x.classList.toggle('selected',x===button));refresh()}));
  const paper=$('[data-paper]'),zoomLabel=$('[data-zoom-label]');const setZoom=value=>{zoom=Math.max(.45,Math.min(1.25,value));paper.style.zoom=String(zoom);if(zoomLabel)zoomLabel.textContent=`${Math.round(zoom*100)}%`};
  $$('[data-zoom]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.zoom==='in')setZoom(zoom+.1);else if(button.dataset.zoom==='out')setZoom(zoom-.1);else setZoom(Math.min(1,(($('.editor-canvas')?.clientWidth||850)-64)/760))}));
  $$('.template-choice').forEach(button=>button.classList.toggle('selected',button.dataset.template===r.template));$$('.color-choice').forEach(button=>button.classList.toggle('selected',button.dataset.color===r.accent));
  renderPaper(form);setZoom(Math.min(1,(($('.editor-canvas')?.clientWidth||850)-64)/760));
}

