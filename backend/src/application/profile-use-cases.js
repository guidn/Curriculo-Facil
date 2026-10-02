'use strict';

const { normalizeResumeProfile } = require('../domain/profile');
const { presentUser } = require('./user-presenter');

function createProfileUseCases({ users, now=()=>new Date().toISOString() }) {
  return {
    get(user) { return presentUser(user); },
    update(user,input) {
      const name=String(input.name??user.name).trim();
      if(name.length<2) return {error:'Nome inválido.',status:400};
      let resumeProfile;
      try { resumeProfile=normalizeResumeProfile(input.resumeProfile??user.resumeProfile); }
      catch(error) { return {error:error.message,status:400}; }
      users.updateProfile(user.id,name,resumeProfile,now());
      return presentUser(users.findById(user.id));
    }
  };
}

module.exports = { createProfileUseCases };
