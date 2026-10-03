'use strict';

const PDFDocument = require('pdfkit');
const { normalize } = require('../../../../js/resume-rendering');

const palettes={modern:'#742cff',classic:'#303038',minimal:'#34343a',executive:'#1f3a5f',creative:'#d35f12'};
const safeUrl=value=>/^https?:\/\//i.test(String(value||''))?String(value):'';

function createPdf(resume) {
  return new Promise((resolve,reject)=>{
    const data=normalize(resume.data||{}),doc=new PDFDocument({size:'A4',margins:{top:52,bottom:52,left:58,right:58},bufferPages:true,info:{Title:resume.title||'Currículo',Author:'Currículo Fácil',Subject:'Currículo profissional'}}),chunks=[];
    const template=resume.template||'modern',accent=palettes[template]||palettes.modern,serif=['classic','executive'].includes(template),regular=serif?'Times-Roman':'Helvetica',bold=serif?'Times-Bold':'Helvetica-Bold';
    const width=doc.page.width-doc.page.margins.left-doc.page.margins.right,bottom=()=>doc.page.height-doc.page.margins.bottom;
    doc.on('data',chunk=>chunks.push(chunk));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
    const pageIfNeeded=(height=28)=>{if(doc.y+height>bottom())doc.addPage();};
    const measure=(value,size,font=regular)=>{doc.font(font).fontSize(size);return doc.heightOfString(String(value||''),{width,lineGap:2});};
    const write=(value,{size=10.5,font=regular,color='#202027',after=5,indent=0,link=null}={})=>{
      if(!value)return;
      doc.font(font).fontSize(size);const h=doc.heightOfString(String(value),{width:width-indent,lineGap:2});pageIfNeeded(h+after);
      const options={width:width-indent,lineGap:2,paragraphGap:0};if(link)options.link=link;
      doc.fillColor(color).text(String(value),doc.page.margins.left+indent,doc.y,options);doc.moveDown(0);doc.y+=after;
    };
    const heading=value=>{
      pageIfNeeded(42);doc.moveDown(template==='minimal'?1:.6);doc.font(bold).fontSize(template==='minimal'?10.5:11.5).fillColor(template==='classic'?'#24242a':accent).text(value.toLocaleUpperCase('pt-BR'),doc.page.margins.left,doc.y,{width,characterSpacing:template==='executive'?1:0});doc.moveDown(.4);
      if(template==='classic'||template==='executive'){
        doc.strokeColor(template==='classic'?'#b7b7bd':accent).lineWidth(template==='executive'?.8:.55).moveTo(doc.page.margins.left,doc.y).lineTo(doc.page.margins.left+width,doc.y).stroke();
        if(template==='executive')doc.moveTo(doc.page.margins.left,doc.y+2).lineTo(doc.page.margins.left+width,doc.y+2).stroke();
      }else if(template==='modern'||template==='creative')doc.strokeColor(accent).lineWidth(template==='creative'?1.4:.55).moveTo(doc.page.margins.left,doc.y).lineTo(doc.page.margins.left+width,doc.y).stroke();
      doc.y+=template==='minimal'?10:7;
    };
    const dateRange=item=>item.period||[item.startDate,item.current?'Atual':item.endDate].filter(Boolean).map(value=>{
      if(value==='Atual')return value;
      const parsed=new Date(`${String(value).slice(0,10)}T00:00:00`);return Number.isNaN(parsed.valueOf())?String(value):parsed.toLocaleDateString('pt-BR',{month:'short',year:'numeric'});
    }).join(' – ');
    const itemTitle=(title,period)=>{
      pageIfNeeded(40);const y=doc.y,titleHeight=measure(title||'',10.5,bold),periodHeight=period?measure(period,9,regular):0;
      doc.font(bold).fontSize(10.5).fillColor('#202027').text(title||'',doc.page.margins.left,y,{width:period?width*.68:width,lineGap:2});
      if(period)doc.font(regular).fontSize(9).fillColor('#55515b').text(period,doc.page.margins.left+width*.69,y,{width:width*.31,align:'right'});
      doc.y=y+Math.max(titleHeight,periodHeight)+5;
    };

    const name=data.personal.name||resume.title||'Currículo';
    const centered=template==='classic';
    doc.font(template==='minimal'?'Helvetica':serif?regular:bold).fontSize(template==='executive'?25:template==='minimal'?29:27).fillColor('#202027').text(name,{width,align:centered?'center':'left',characterSpacing:template==='executive'?1:0});
    if(data.personal.headline)write(data.personal.headline,{size:13,font:bold,color:template==='classic'?'#303038':accent,after:7});
    const contacts=[data.personal.email,data.personal.phone,[data.personal.city,data.personal.state].filter(Boolean).join(' - '),data.personal.linkedin,data.personal.github,data.personal.portfolio].filter(Boolean);
    if(contacts.length)write(contacts.join('  |  '),{size:8.8,color:'#514d56',after:12});
    if(template==='executive'){
      doc.strokeColor(accent).lineWidth(1.2).moveTo(doc.page.margins.left,doc.y).lineTo(doc.page.margins.left+width,doc.y).stroke();
      doc.moveTo(doc.page.margins.left,doc.y+3).lineTo(doc.page.margins.left+width,doc.y+3).stroke();
    }else if(template!=='minimal')doc.strokeColor(accent).lineWidth(template==='creative'?3:template==='classic'?.7:1.2).moveTo(doc.page.margins.left,doc.y).lineTo(doc.page.margins.left+width,doc.y).stroke();
    doc.y+=template==='minimal'?18:10;
    if(data.summary){heading('Resumo profissional');write(data.summary,{after:1});}
    if(data.experiences.length){heading('Experiência profissional');for(const item of data.experiences){itemTitle([item.role,item.company].filter(Boolean).join(' · '),dateRange(item));if(item.location)write(item.location,{size:9,color:'#5c5961',after:3});for(const line of (Array.isArray(item.description)?item.description:[item.description]).filter(Boolean))write(`•  ${line}`,{indent:8,after:3});doc.y+=3;}}
    if(data.education.length){heading('Formação acadêmica');for(const item of data.education){itemTitle([item.course,item.institution||item.school].filter(Boolean).join(' · '),dateRange(item));if(item.location)write(item.location,{size:9,color:'#5c5961',after:3});if(item.description)write(item.description,{after:4});}}
    const listSection=(title,items,mapper)=>{if(!items.length)return;heading(title);items.forEach(item=>write(`•  ${mapper(item)}`,{indent:8,after:4}));};
    listSection('Cursos',data.courses,x=>[x.name||x.course,x.institution,x.date].filter(Boolean).join(' · '));
    listSection('Habilidades',data.skills,x=>x);
    listSection('Idiomas',data.languages,x=>[x.name,x.proficiency||x.level].filter(Boolean).join(' · '));
    listSection('Certificações',data.certifications,x=>[x.name,x.issuer,x.date].filter(Boolean).join(' · '));
    if(data.projects.length){heading('Projetos');for(const item of data.projects){itemTitle(item.name,'');if(item.description)write(item.description,{after:3});if(item.technologies.length)write(`Tecnologias: ${item.technologies.join(', ')}`,{size:9,color:'#5c5961'});const url=safeUrl(item.url);if(url)write(url,{size:9,color:accent,link:url});}}
    doc.end();
  });
}

module.exports={createPdf};

