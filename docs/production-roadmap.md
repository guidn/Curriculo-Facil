# Preparação para produção

Este projeto ainda é um MVP: o checkout dos planos não cobra de verdade. A recuperação de senha já tem telas de código e suporte ao envio transacional via Resend quando as variáveis `RESEND_API_KEY` e `EMAIL_FROM` forem configuradas no servidor.

## Recuperação de senha

1. Crie uma conta no provedor de e-mail (por exemplo, Resend), valide um domínio que você controla e gere uma chave de API.
2. Configure `RESEND_API_KEY` e `EMAIL_FROM` como variáveis secretas no ambiente do servidor. Não coloque valores reais no GitHub, HTML ou JavaScript do navegador.
3. Configure `NODE_ENV=production`, `APP_URL` com a URL HTTPS pública e `COOKIE_SECURE=true`.
4. Teste solicitação, código inválido, código expirado, reuso do código e revogação das sessões antigas. O código é armazenado somente como hash e expira conforme `RESET_TOKEN_MINUTES`.

## Assinaturas e gateway

O endpoint `/api/billing/checkout` atual é apenas um marcador de integração: grava uma assinatura pendente, mas não cria pagamento. Para os planos mensais já apresentados na interface, a API de Assinaturas do Mercado Pago é a opção que melhor combina com cobranças recorrentes.

1. Crie uma aplicação no painel de desenvolvedores do Mercado Pago e use credenciais de teste primeiro.
2. Implemente no backend a criação de assinatura `/preapproval`; o navegador deve receber apenas a URL de checkout. Os preços e nomes dos planos devem vir de configuração do servidor, nunca do valor enviado pelo cliente.
3. Guarde Access Token e segredo de assinatura de webhook em variáveis secretas. Configure uma URL HTTPS pública para notificações.
4. Valide a assinatura criptográfica do webhook, consulte o objeto de assinatura no Mercado Pago e atualize o plano local apenas após confirmar o estado no provedor. Torne o processamento idempotente, pois notificações podem ser repetidas.
5. Teste autorização, pagamento pendente/recusado, renovação, cancelamento, pausa e reenvio de webhook em sandbox. A URL de retorno do navegador não comprova pagamento.
6. Só então configure credenciais de produção, revise termos, política de privacidade, suporte e cancelamento e acompanhe os primeiros pagamentos.

## Antes de abrir ao público

- Hospedar o Node.js e o SQLite em ambiente persistente com backup automatizado; não usar disco efêmero para o banco.
- Servir exclusivamente por HTTPS e configurar domínio, cookies seguros, CORS/origem e limites de requisição para o domínio real.
- Revisar logs para não incluir senhas, códigos, tokens, dados de cartão ou chaves. Dados de cartão devem permanecer no provedor.
- Adicionar monitoramento de erros e rotina testada de restauração do banco.

Nenhuma chave ou conta externa é necessária para desenvolver localmente. A ativação real de envio e cobrança depende das contas e credenciais do proprietário do projeto.

