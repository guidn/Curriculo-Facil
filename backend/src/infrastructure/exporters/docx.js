'use strict';

const { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink, AlignmentType } = require('docx');
const { normalize } = require('../../../../js/resume-rendering');

function createDocx(resume) {
  const data = normalize(resume.data || {}), children = [];
  const text = (value, options = {}) => new Paragraph({ children:[new TextRun({text:String(value || ''),...options})], spacing:{after:100} });
  const heading = value => new Paragraph({text:value,heading:HeadingLevel.HEADING_2,spacing:{before:240,after:100}});
  const bullet = value => new Paragraph({text:value,bullet:{indent:360},spacing:{after:60}});
  children.push(new Paragraph({text:data.personal.name || resume.title || 'Currículo',heading:HeadingLevel.TITLE,alignment:AlignmentType.LEFT}));
  if(data.personal.headline) children.push(new Paragraph({text:data.personal.headline,heading:HeadingLevel.HEADING_2}));
  const contacts=[data.personal.email,data.personal.phone,[data.personal.city,data.personal.state].filter(Boolean).join(' - '),data.personal.linkedin,data.personal.github,data.personal.portfolio].filter(Boolean);
  if(contacts.length) children.push(text(contacts.join('  |  ')));
  const add=(name, items)=>{ if(items.length){children.push(heading(name));children.push(...items);} };
  if(data.summary) add('Resumo profissional',[text(data.summary)]);
  add('Experiência profissional',data.experiences.flatMap(x=>[text([x.role,x.company].filter(Boolean).join(' — '),{bold:true}),text([x.location,[x.startDate,x.current?'Atual':x.endDate].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')),...(Array.isArray(x.description)?x.description:[x.description]).filter(Boolean).map(bullet)]));
  add('Formação acadêmica',data.education.flatMap(x=>[text([x.course,x.institution || x.school].filter(Boolean).join(' — '),{bold:true}),text([x.location,[x.startDate,x.current?'Atual':x.endDate].filter(Boolean).join(' – '),x.description].filter(Boolean).join(' · '))]));
  add('Cursos',data.courses.map(x=>bullet([x.name || x.course,x.institution,x.date].filter(Boolean).join(' · '))));
  add('Habilidades',data.skills.map(bullet));
  add('Idiomas',data.languages.map(x=>bullet([x.name,x.proficiency || x.level].filter(Boolean).join(' · '))));
  add('Certificações',data.certifications.map(x=>bullet([x.name,x.issuer,x.date].filter(Boolean).join(' · '))));
  add('Projetos',data.projects.flatMap(x=>[text(x.name,{bold:true}),...(x.description?[text(x.description)]:[]),...(x.technologies.length?[text(`Tecnologias: ${x.technologies.join(', ')}`)]:[]),...(x.url?[new Paragraph({children:[new ExternalHyperlink({link:x.url,children:[new TextRun({text:x.url,style:'Hyperlink'})]})]})]:[])]));
  const document = new Document({sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,right:1077,bottom:1134,left:1077}}},children}],styles:{default:{document:{run:{font:'Arial',size:21},paragraph:{spacing:{line:276}}}}}});
  return Packer.toBuffer(document);
}

module.exports = { createDocx };

