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
  const menuButton = document.querySelector('[data-menu]');
  const sidebar = document.querySelector('.sidebar');
  if (menuButton && sidebar) {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.focus();
      }
    });
  }
});

