'use strict';

const config=require('./config');
const db=require('./infrastructure/sqlite/database');
const plans=require('./domain/plans');
const security=require('./infrastructure/security/crypto');
const emailService=require('./infrastructure/email/resend-mailer');
const {createRepositories}=require('./infrastructure/sqlite/repositories');
const {createAuthUseCases}=require('./application/auth-use-cases');
const {createProfileUseCases}=require('./application/profile-use-cases');
const {createResumeUseCases}=require('./application/resume-use-cases');
const {createUsageUseCases}=require('./application/usage-use-cases');
const {createBillingUseCases}=require('./application/billing-use-cases');
const {createHttpServer}=require('./interfaces/http/create-server');

const repositories=createRepositories(db);
const auth=createAuthUseCases({users:repositories.users,sessions:repositories.sessions,passwordResets:repositories.passwordResets,security,mailer:emailService,settings:config});
const profiles=createProfileUseCases({users:repositories.users});
const resumes=createResumeUseCases({resumes:repositories.resumes,plans,makeId:security.id});
const usage=createUsageUseCases({usage:repositories.usage,plans,resumeCapacity:resumes.capacity,today:security.today});
const billing=createBillingUseCases({users:repositories.users,subscriptions:repositories.subscriptions,plans,makeId:security.id});
const server=createHttpServer({config,repositories,auth,profiles,resumes,usage,billing,security});

server.listen(config.port,()=>console.log(`Currículo Fácil rodando em ${config.appUrl}`));
