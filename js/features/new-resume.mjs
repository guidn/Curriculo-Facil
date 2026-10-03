import { $, $$, api, currentUser, toast, go } from '../shared.mjs';

let templateCatalog=[];

export async function initNewResume() {
  const form = $('[data-resume-create]');
  if (!form) return;
  const user = await currentUser();
  if (!user) return go('../auth/login.html');
  try{templateCatalog=(await api('/models')).models;}
  catch(error){toast(error.message,'error');return;}
  $('[data-template-cards]').innerHTML=templateCatalog.map((template,index)=>`<label class="template-card"><input type="radio" name="template" value="${template.id}" ${index===0?'checked':''}><span class="template-preview template-preview-${template.id}" data-accent="${template.accent}"><article class="resume-preview-sheet template-${template.id}" style="--accent:${template.accent}"></article></span><strong>${template.name}</strong><small>${template.description}</small></label>`).join('');
  const profile=user.resumeProfile||{};
  const nameField = $('[name="name"]', form), emailField = $('[name="email"]', form);
  if (nameField && !nameField.value) nameField.value = user.name || '';
  if (emailField && !emailField.value) emailField.value = user.email || '';
  for(const key of ['role','phone','city','summary'])if(form.elements[key]&&!form.elements[key].value)form.elements[key].value=profile[key]||'';
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

  (profile.experiences||[]).forEach(item=>{addEntry('[data-experience-template]','[data-experience-list]');const row=$$('[data-experience-entry]',form).at(-1);for(const [key,value] of Object.entries({experienceRole:item.role,experienceCompany:item.company,experienceStartDate:item.startDate,experienceEndDate:item.endDate,experienceDescription:item.description})){const input=row.querySelector(`[name="${key}"]`);if(input&&value)input.value=value}const active=row.querySelector('[name="experienceCurrent"]');if(active){active.checked=!!item.current;const end=row.querySelector('[name="experienceEndDate"]');if(end)end.disabled=active.checked}});
  (profile.education||[]).forEach(item=>{addEntry('[data-education-template]','[data-education-list]');const row=$$('[data-education-entry]',form).at(-1);for(const [key,value] of Object.entries({educationCourse:item.course,educationSchool:item.school,educationStartDate:item.startDate,educationEndDate:item.endDate})){const input=row.querySelector(`[name="${key}"]`);if(input&&value)input.value=value}const active=row.querySelector('[name="educationCurrent"]');if(active){active.checked=!!item.current;const end=row.querySelector('[name="educationEndDate"]');if(end)end.disabled=active.checked}});
  const quickSkills=new Set();(profile.skills||[]).forEach(skill=>{const chip=$$('[data-skill-chip]',form).find(button=>button.dataset.skillChip.toLowerCase()===skill.toLowerCase());if(chip){chip.classList.add('selected');chip.setAttribute('aria-pressed','true')}else quickSkills.add(skill)});if(form.elements.customSkills)form.elements.customSkills.value=[...quickSkills].join(', ');

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
  if (templateCatalog.some(template=>template.id===requestedTemplate)) {
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
    const accent = templateCatalog.find(item=>item.id===template)?.accent || '#742cff';
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
      if(err.code==='RESUME_LIMIT_REACHED')$('[data-resume-limit]')?.removeAttribute('hidden');
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
  const data={name:String(values.get('name')||'').trim(),role:String(values.get('role')||'').trim(),email:String(values.get('email')||'').trim(),phone:String(values.get('phone')||'').trim(),city:String(values.get('city')||'').trim(),summary:String(values.get('summary')||'').trim(),experiences:$$('[data-experience-entry]',form).map(row=>({role:$('[name="experienceRole"]',row).value,company:$('[name="experienceCompany"]',row).value,startDate:$('[name="experienceStartDate"]',row).value,endDate:$('[name="experienceEndDate"]',row).value,current:$('[name="experienceCurrent"]',row).checked,description:$('[name="experienceDescription"]',row).value})).filter(x=>x.role||x.company||x.description),education:$$('[data-education-entry]',form).map(row=>({course:$('[name="educationCourse"]',row).value,school:$('[name="educationSchool"]',row).value,startDate:$('[name="educationStartDate"]',row).value,endDate:$('[name="educationEndDate"]',row).value})).filter(x=>x.course||x.school),skills};
  previews.forEach(preview=>{const template=preview.className.match(/template-preview-([a-z0-9-]+)/)?.[1]||'modern';preview.innerHTML=`<article class="resume-preview-sheet template-${template}" style="--accent:${preview.dataset.accent||'#742cff'}">${ResumeRendering.renderBody(data,{title:'Meu currículo'})}</article>`;});
}

