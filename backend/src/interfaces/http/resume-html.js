'use strict';

const { renderDocument } = require('../../../../js/resume-rendering');

function renderResumeHtml(resume, publicMode = false) {
  return renderDocument(resume, { publicMode });
}

module.exports = { renderResumeHtml };

