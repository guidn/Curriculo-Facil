'use strict';

const {presentUser}=require('./user-presenter');

function createAuthUseCases({ users, sessions, passwordResets, security, mailer, settings, clock=()=>new Date() }) {
  function createSession(userId) {
    const raw=security.token(32), now=clock(), expires=new Date(now.getTime()+settings.sessionDays*86400000);
    sessions.create({id:security.token(16),userId,tokenHash:security.hashToken(raw),expiresAt:expires.toISOString(),createdAt:now.toISOString()});
    return raw;
  }

  return {
    async register(input) {
      const name=String(input.name||'').trim(), email=String(input.email||'').trim().toLowerCase(), password=String(input.password||'');
      if(name.length<2||email.length<5||!email.includes('@')||password.length<8) return {error:'Nome, e-mail válido e senha de pelo menos 8 caracteres são obrigatórios.',status:400};
      if(users.findByEmail(email)) return {error:'Este e-mail já está cadastrado.',status:409};
      const now=clock().toISOString(), userId=security.id();
      users.create({id:userId,name,email,passwordHash:security.hashPassword(password),createdAt:now,updatedAt:now});
      const user=users.findById(userId);
      return {user:presentUser(user),sessionToken:createSession(userId)};
    },
    async login(input) {
      const email=String(input.email||'').trim().toLowerCase(), password=String(input.password||''), user=users.findByEmail(email);
      if(!user||!security.verifyPassword(password,user.passwordHash)) return {error:'E-mail ou senha inválidos.',status:401};
      return {user:presentUser(user),sessionToken:createSession(user.id)};
    },
    currentUser(rawToken) { return rawToken ? sessions.findUser(security.hashToken(rawToken)) : null; },
    logout(rawToken) { if(rawToken)sessions.remove(security.hashToken(rawToken)); },
    async requestPasswordReset(emailInput) {
      if(settings.nodeEnv==='production'&&!mailer.configured()) return {error:'A recuperação por e-mail ainda não está configurada. Tente novamente mais tarde.',status:503};
      const email=String(emailInput||'').trim().toLowerCase(), user=users.findByEmail(email); let developmentCode;
      if(user) {
        const code=String(security.randomInt(0,1000000)).padStart(6,'0'), now=clock(), expires=new Date(now.getTime()+settings.resetTokenMinutes*60000);
        passwordResets.removeForUser(user.id);
        passwordResets.create({id:security.id(),userId:user.id,tokenHash:security.hashToken(code),expiresAt:expires.toISOString()});
        if(mailer.configured()) {
          try { await mailer.sendPasswordResetCode(email,code); }
          catch(error) { console.error('Falha ao enviar e-mail de recuperação:',error.message); }
        } else if(settings.nodeEnv!=='production') developmentCode=code;
      }
      return {message:'Se o e-mail existir, enviaremos um código de recuperação.',...(developmentCode?{developmentCode}:{})};
    },
    resetPassword(input) {
      const code=String(input.code??input.token??'').trim(), password=String(input.password||'');
      if(password.length<8) return {error:'A senha deve ter pelo menos 8 caracteres.',status:400};
      if(!/^\d{6}$/.test(code)) return {error:'Informe o código de 6 dígitos.',status:400};
      const reset=passwordResets.findUsable(security.hashToken(code));
      if(!reset) return {error:'Código inválido ou expirado.',status:400};
      const userId=reset.userId;
      users.updatePassword(userId,security.hashPassword(password),clock().toISOString());
      sessions.removeForUser(userId);
      passwordResets.markUsed(reset.id,clock().toISOString());
      return {ok:true};
    }
  };
}

module.exports = { createAuthUseCases };
