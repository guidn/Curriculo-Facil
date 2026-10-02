const config = require('../config');

function configured() { return Boolean(config.resendApiKey && config.emailFrom); }

async function sendPasswordResetCode(email, code) {
  if (!configured()) throw new Error('O envio de e-mail não está configurado.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [email],
      subject: 'Seu código para trocar a senha',
      html: `<main style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#211b2c"><h1>Recuperação de senha</h1><p>Use este código para criar uma nova senha:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px">${code}</p><p>O código expira em ${config.resetTokenMinutes} minutos e só pode ser usado uma vez. Se você não pediu esta alteração, ignore esta mensagem.</p></main>`,
      text: `Seu código de recuperação é ${code}. Ele expira em ${config.resetTokenMinutes} minutos e só pode ser usado uma vez.`
    })
  });
  if (!response.ok) throw new Error(`O provedor de e-mail respondeu com HTTP ${response.status}.`);
}

module.exports = { configured, sendPasswordResetCode };

