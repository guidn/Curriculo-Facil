'use strict';

const TEMPLATES=new Set(['modern','classic','minimal','executive','creative']);
const ACCENTS=new Set(['#742cff','#1769aa','#16805c','#1f3a5f','#d35f12']);

function presentationIsValid(template,accent) { return TEMPLATES.has(template)&&ACCENTS.has(accent); }
function capacity(current,plan) {
  const limit=Number.isInteger(plan.resumeLimit)?plan.resumeLimit:null;
  return {current,limit,available:limit===null?null:Math.max(0,limit-current)};
}

module.exports={TEMPLATES,ACCENTS,presentationIsValid,capacity};
