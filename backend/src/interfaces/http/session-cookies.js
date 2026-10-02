'use strict';

function serializeSessionCookie(value,maxAgeSeconds,secure) {
  const parts=[`cf_session=${value}`,'Path=/','HttpOnly','SameSite=Lax'];
  if(maxAgeSeconds!=null)parts.push(`Max-Age=${Math.max(0,Math.floor(maxAgeSeconds))}`);
  if(secure)parts.push('Secure');
  return parts.join('; ');
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie||'').split(';').filter(Boolean).map(part=>{
    const separator=part.indexOf('=');
    return [part.slice(0,separator).trim(),decodeURIComponent(part.slice(separator+1).trim())];
  }));
}

function setSessionCookie(response,rawToken,settings) {
  response.setHeader('Set-Cookie',serializeSessionCookie(rawToken,settings.sessionDays*86400,settings.cookieSecure));
}

function clearSessionCookie(response,settings) {
  response.setHeader('Set-Cookie',serializeSessionCookie('',0,settings.cookieSecure));
}

module.exports={parseCookies,setSessionCookie,clearSessionCookie};
