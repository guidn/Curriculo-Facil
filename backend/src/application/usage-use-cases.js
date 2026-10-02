'use strict';

function createUsageUseCases({usage,plans,resumeCapacity,today}) {
  function planFor(user) { return plans[user.plan]||plans.free; }
  function usageFor(userId) { return usage.getForToday(userId,today()); }
  return {
    summary(user) {
      const daily=usageFor(user.id),plan=planFor(user),capacity=resumeCapacity(user);
      return {plan,resumeCapacity:capacity,usage:{exports:daily.exports,shares:daily.shares,resumeCreates:daily.resumeCreates},remaining:{exports:plan.dailyLimit===null?null:Math.max(0,plan.dailyLimit-daily.exports),shares:plan.dailyLimit===null?null:Math.max(0,plan.dailyLimit-daily.shares),resumeCreates:capacity.available}};
    },
    consume(user,field) {
      const plan=planFor(user); if(plan.dailyLimit===null)return true;
      const daily=usageFor(user.id); if(!['exports','shares'].includes(field))return false;if(daily[field]>=plan.dailyLimit)return false;
      usage.increment(field,user.id,today()); return true;
    }
  };
}

module.exports={createUsageUseCases};
