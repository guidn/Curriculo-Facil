'use strict';

const {capacity,presentationIsValid}=require('../domain/resume-policy');
const {normalizeResumeData}=require('../domain/resume-data');

function resumeDto(row) {
  if(!row)return null;
  return {id:row.id,title:row.title,template:row.template,accent:row.accent,data:normalizeResumeData(row.data),createdAt:row.createdAt,updatedAt:row.updatedAt,shared:!!row.shareToken,sharedAt:row.sharedAt};
}

function createResumeUseCases({ resumes, plans, makeId, now=()=>new Date().toISOString() }) {
  const planFor=user=>plans[user.plan]||plans.free;
  const getCapacity=user=>capacity(resumes.countForUser(user.id),planFor(user));
  return {
    capacity:getCapacity,
    list:user=>resumes.listForUser(user.id).map(resumeDto),
    get(user,id) { const resume=resumes.findForUser(id,user.id); return resumeDto(resume); },
    create(user,input) {
      const title=String(input.title||'Meu currículo').trim().slice(0,100)||'Meu currículo',template=String(input.template||'modern'),accent=String(input.accent||'#742cff');
      if(!presentationIsValid(template,accent))return {error:'Modelo ou cor inválidos.',status:400};
      const available=getCapacity(user);
      if(available.available===0)return {error:`Você já atingiu o limite de ${available.limit} currículos salvos. Exclua um currículo para liberar espaço ou confira os planos.`,code:'RESUME_LIMIT_REACHED',details:available,status:409};
      const id=makeId(),timestamp=now(),data=normalizeResumeData(input.data);
      resumes.create({id,userId:user.id,title,template,accent,data,createdAt:timestamp,updatedAt:timestamp});
      return resumeDto(resumes.findForUser(id,user.id));
    },
    update(user,id,input) {
      const row=resumes.findForUser(id,user.id); if(!row)return null;
      const current=resumeDto(row),template=String(input.template??current.template),accent=String(input.accent??current.accent);
      if(!presentationIsValid(template,accent))return {error:'Modelo ou cor inválidos.',status:400};
      const updated={id,userId:user.id,title:String(input.title??current.title).trim().slice(0,100)||current.title,template,accent,data:input.data&&typeof input.data==='object'?normalizeResumeData(input.data):current.data,updatedAt:now()};
      resumes.update(updated); return resumeDto(resumes.findForUser(id,user.id));
    },
    remove:(user,id)=>resumes.remove(id,user.id)
  };
}

module.exports={createResumeUseCases,resumeDto};

