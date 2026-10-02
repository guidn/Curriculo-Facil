'use strict';

function mapUser(row) {
  if(!row)return null;
  return {id:row.id,name:row.name,email:row.email,passwordHash:row.password_hash,plan:row.plan,createdAt:row.created_at,updatedAt:row.updated_at,resumeProfile:JSON.parse(row.resume_profile_json||'{}')};
}

function mapResume(row) {
  if(!row)return null;
  return {id:row.id,userId:row.user_id,title:row.title,template:row.template,accent:row.accent,data:JSON.parse(row.data_json),createdAt:row.created_at,updatedAt:row.updated_at,shareToken:row.shared_token,sharedAt:row.shared_at};
}

function createRepositories(db) {
  return {
    users: {
      findByEmail: email => mapUser(db.prepare('SELECT * FROM users WHERE email=?').get(email)),
      findById: id => mapUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)),
      create: user => db.prepare('INSERT INTO users(id,name,email,password_hash,plan,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(user.id,user.name,user.email,user.passwordHash,'free',user.createdAt,user.updatedAt),
      updatePassword: (userId, passwordHash, updatedAt) => db.prepare('UPDATE users SET password_hash=?,updated_at=? WHERE id=?').run(passwordHash,updatedAt,userId),
      updateProfile: (userId, name, profile, updatedAt) => db.prepare('UPDATE users SET name=?,resume_profile_json=?,updated_at=? WHERE id=?').run(name,JSON.stringify(profile),updatedAt,userId),
      updatePlan: (userId, plan, updatedAt) => db.prepare('UPDATE users SET plan=?,updated_at=? WHERE id=?').run(plan,updatedAt,userId)
    },
    sessions: {
      create: session => db.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)').run(session.id,session.userId,session.tokenHash,session.expiresAt,session.createdAt),
      findUser: tokenHash => mapUser(db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > datetime('now')`).get(tokenHash)),
      remove: tokenHash => db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash),
      removeForUser: userId => db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId)
    },
    passwordResets: {
      removeForUser: userId => db.prepare('DELETE FROM password_resets WHERE user_id=?').run(userId),
      create: reset => db.prepare('INSERT INTO password_resets(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)').run(reset.id,reset.userId,reset.tokenHash,reset.expiresAt),
      findUsable: tokenHash => {const row=db.prepare(`SELECT * FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at > datetime('now')`).get(tokenHash);return row?{id:row.id,userId:row.user_id,tokenHash:row.token_hash,expiresAt:row.expires_at,usedAt:row.used_at}:null;},
      markUsed: (resetId, usedAt) => db.prepare('UPDATE password_resets SET used_at=? WHERE id=?').run(usedAt,resetId)
    },
    resumes: {
      listForUser: userId => db.prepare('SELECT * FROM resumes WHERE user_id=? ORDER BY updated_at DESC').all(userId).map(mapResume),
      findForUser: (resumeId,userId) => mapResume(db.prepare('SELECT * FROM resumes WHERE id=? AND user_id=?').get(resumeId,userId)),
      findByShareToken: value => mapResume(db.prepare('SELECT * FROM resumes WHERE shared_token=?').get(value)),
      countForUser: userId => db.prepare('SELECT COUNT(*) AS count FROM resumes WHERE user_id=?').get(userId).count,
      create: resume => db.prepare('INSERT INTO resumes(id,user_id,title,template,accent,data_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(resume.id,resume.userId,resume.title,resume.template,resume.accent,JSON.stringify(resume.data),resume.createdAt,resume.updatedAt),
      update: resume => db.prepare('UPDATE resumes SET title=?,template=?,accent=?,data_json=?,updated_at=? WHERE id=? AND user_id=?').run(resume.title,resume.template,resume.accent,JSON.stringify(resume.data),resume.updatedAt,resume.id,resume.userId),
      remove: (resumeId,userId) => db.prepare('DELETE FROM resumes WHERE id=? AND user_id=?').run(resumeId,userId).changes>0,
      setShare: (resumeId,shareToken,sharedAt) => db.prepare('UPDATE resumes SET shared_token=?,shared_at=? WHERE id=?').run(shareToken,sharedAt,resumeId)
    },
    usage: {
      getForToday(userId, date) {
        db.prepare('INSERT OR IGNORE INTO usage_daily(user_id,usage_date) VALUES(?,?)').run(userId,date);
        const row=db.prepare('SELECT * FROM usage_daily WHERE user_id=? AND usage_date=?').get(userId,date);
        return {exports:row.exports,shares:row.shares,resumeCreates:row.resume_creates};
      },
      increment(metric,userId,date) {
        const columns={exports:'exports',shares:'shares'},column=columns[metric];
        if(!column)throw new Error('Métrica de uso inválida.');
        return db.prepare(`UPDATE usage_daily SET ${column}=${column}+1 WHERE user_id=? AND usage_date=?`).run(userId,date);
      }
    },
    subscriptions: {
      create: subscription => db.prepare('INSERT INTO subscriptions(id,user_id,plan,status,provider,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(subscription.id,subscription.userId,subscription.plan,subscription.status,subscription.provider,subscription.createdAt,subscription.updatedAt)
    }
  };
}

module.exports = { createRepositories };
