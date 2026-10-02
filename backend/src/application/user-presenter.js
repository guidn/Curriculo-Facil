'use strict';

function presentUser(user) {
  if(!user)return null;
  return {id:user.id,name:user.name,email:user.email,plan:user.plan,createdAt:user.createdAt,resumeProfile:user.resumeProfile||{}};
}

module.exports={presentUser};
