'use strict';

const {presentUser}=require('./user-presenter');

function createBillingUseCases({users,subscriptions,plans,makeId,now=()=>new Date().toISOString()}) {
  return {
    activatePlan(userId,plan) {
      if(!['free','basic','premium'].includes(plan))return {error:'Plano inválido.',status:400};
      users.updatePlan(userId,plan,now());
      return presentUser(users.findById(userId));
    },
    createPendingCheckout(user,plan) {
      if(!['basic','premium'].includes(plan)||!plans[plan])return {error:'Plano inválido.',status:400};
      const id=makeId(),timestamp=now();
      subscriptions.create({id,userId:user.id,plan,status:'pending',provider:'manual',createdAt:timestamp,updatedAt:timestamp});
      return {status:'pending',message:'Checkout externo ainda não foi conectado. O registro da assinatura foi criado para integração com o gateway.',subscriptionId:id};
    }
  };
}

module.exports={createBillingUseCases};
