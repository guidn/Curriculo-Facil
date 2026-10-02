const PLANS = {
  free: { key: 'free', name: 'Gratuito', price: 0, dailyLimit: 2, ads: true, description: 'Até 2 usos por recurso/dia.' },
  basic: { key: 'basic', name: 'Básico', price: 4.99, dailyLimit: 5, ads: false, description: 'Até 5 usos por recurso/dia.' },
  premium: { key: 'premium', name: 'Premium', price: 19.99, dailyLimit: null, ads: false, description: 'Uso ilimitado.' }
};
module.exports = PLANS;
