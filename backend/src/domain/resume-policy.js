'use strict';

const CATALOG=require('../../../templates/catalog.json');
const TEMPLATES=new Set(CATALOG.map(template=>template.id));
const ACCENTS=new Set(CATALOG.map(template=>template.accent));

function presentationIsValid(template,accent) { return TEMPLATES.has(template)&&ACCENTS.has(accent); }
function capacity(current,plan) {
  const limit=Number.isInteger(plan.resumeLimit)?plan.resumeLimit:null;
  return {current,limit,available:limit===null?null:Math.max(0,limit-current)};
}

module.exports={CATALOG,TEMPLATES,ACCENTS,presentationIsValid,capacity};

