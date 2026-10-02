import { initLanding, initHomeLinks, initAuth, initForgotPassword, initResetPassword } from './features/auth.mjs';
import { initDashboard, initLogout } from './features/dashboard.mjs';
import { initNewResume } from './features/new-resume.mjs';
import { initEditor } from './features/editor.mjs';
import { initModels, initPricing } from './features/billing.mjs';
import { initProfile } from './features/profile.mjs';

document.addEventListener('DOMContentLoaded', () => {
  initLanding();
  initHomeLinks();
  initAuth();
  initForgotPassword();
  initResetPassword();
  initDashboard();
  initNewResume();
  initEditor();
  initModels();
  initProfile();
  initPricing();
  initLogout();
  document.querySelector('[data-menu]')?.addEventListener('click', () => document.body.classList.toggle('menu-open'));
});
