const PLANS = {
  free: { key: 'free', name: 'Gratuito', price: 0, resumeLimit: 2, dailyLimit: 2, ads: true, description: 'Até 2 currículos salvos; 2 exportações e 2 compartilhamentos por dia.' },
  basic: { key: 'basic', name: 'Básico', price: 4.99, resumeLimit: 5, dailyLimit: 5, ads: false, description: 'Até 5 currículos salvos; 5 exportações e 5 compartilhamentos por dia.' },
  premium: { key: 'premium', name: 'Premium', price: 19.99, resumeLimit: null, dailyLimit: null, ads: false, description: 'Currículos, exportações e compartilhamentos ilimitados.' }
};
module.exports = PLANS;
