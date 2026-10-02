import { $, $$, api, currentUser, toast, go } from '../shared.mjs';

export async function initLanding() {
  if (!$('[data-public-home]')) return;
  if (await currentUser()) go('pages/app/dashboard.html');
}

export function initHomeLinks() {
  const links = $$('[data-home-link]');
  if (!links.length) return;
  currentUser().then(user => links.forEach(link => {
    link.href = user ? (link.dataset.memberHome || link.href) : (link.dataset.guestHome || link.href);
  }));
}

export async function initAuth() {
  const login = $('[data-login-form]');
  const register = $('[data-register-form]');
  if (!login && !register) return;
  if (await currentUser()) return go('../app/dashboard.html');
  if (login) login.addEventListener('submit', async e => { e.preventDefault(); const email=$('[name=email]',login).value.trim(), password=$('[name=password]',login).value; const btn=$('button',login); btn.disabled=true; try{await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})}); go('../app/dashboard.html')}catch(err){toast(err.message,'error')}finally{btn.disabled=false;} });
  if (register) register.addEventListener('submit', async e => { e.preventDefault(); const f=new FormData(register); const name=f.get('name')?.trim(),email=f.get('email')?.trim(),password=f.get('password'),confirm=f.get('confirmPassword'); if(password!==confirm)return toast('As senhas não coincidem.','error'); if(!f.get('terms'))return toast('Aceite os termos para continuar.','error'); const btn=$('button',register);btn.disabled=true;try{await api('/auth/register',{method:'POST',body:JSON.stringify({name,email,password})});go('../builder/novo-curriculo.html?onboarding=1')}catch(err){toast(err.message,'error')}finally{btn.disabled=false;} });
}

export function initForgotPassword() {
  const form=$('[data-forgot-form]'); if(!form)return;
  const button=$('button[type="submit"]',form),message=$('[data-message]',form),code=$('[data-dev-code]',form),next=$('[data-reset-next]',form);
  form.addEventListener('submit',async event=>{
    event.preventDefault(); button.disabled=true; message.textContent='Solicitando código…'; code.hidden=true; next.hidden=true;
    try {
      const result=await api('/auth/forgot-password',{method:'POST',body:JSON.stringify({email:form.elements.email.value})});
      sessionStorage.setItem('passwordResetEmail',form.elements.email.value.trim());
      message.textContent=result.message;
      if(result.developmentCode){code.hidden=false;code.textContent=`Código de desenvolvimento: ${result.developmentCode}`;}
      next.hidden=false;
    } catch(error) { message.textContent=error.message; }
    finally { button.disabled=false; }
  });
}

export function initResetPassword() {
  const form=$('[data-reset-form]'); if(!form)return;
  const button=$('button[type="submit"]',form),message=$('[data-message]',form),destination=$('[data-reset-destination]');
  const email=sessionStorage.getItem('passwordResetEmail');
  if(destination&&email)destination.textContent=`Digite o código enviado para ${email}.`;
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const password=form.elements.password.value;
    if(password!==form.elements.confirm.value){message.textContent='As senhas não coincidem.';return;}
    button.disabled=true;message.textContent='Confirmando código…';
    try {
      await api('/auth/reset-password',{method:'POST',body:JSON.stringify({code:form.elements.code.value.trim(),password})});
      sessionStorage.removeItem('passwordResetEmail');message.textContent='Senha alterada. Redirecionando para o login…';
      setTimeout(()=>go('login.html'),1200);
    } catch(error) { message.textContent=error.message; }
    finally { button.disabled=false; }
  });
}
