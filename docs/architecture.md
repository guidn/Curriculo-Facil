# Arquitetura do Currículo Fácil

O projeto mantém HTML, CSS, JavaScript nativo, Node.js e SQLite. A estrutura segue Clean Architecture de forma proporcional ao produto: regras e casos de uso ficam no centro; HTTP, navegador, SQLite, criptografia e provedores externos são detalhes substituíveis nas bordas.

## Estrutura e direção das dependências

```text
Browser
  pages/*.html + css/
      ↓
  js/app.mjs (bootstrap) → js/features/*.mjs → js/shared.mjs (cliente HTTP)
      ↓ JSON/HTTP
backend/src/server.js (composition root)
      ↓ injeta adapters e casos de uso
backend/src/interfaces/http/create-server.js (HTTP, cookies, arquivos estáticos)
      ↓
backend/src/application/*-use-cases.js (casos de uso e portas)
      ↓
backend/src/domain/* (políticas puras)

Detalhes externos (não são importados pelo domínio ou pelos casos de uso):
infrastructure/sqlite/ → repositórios e banco
infrastructure/security/ → criptografia
infrastructure/email/ → Resend
```

A regra de dependência é voltada para dentro: domínio não importa HTTP, SQLite ou serviço de e-mail. Casos de uso recebem dependências como repositórios, relógio, gerador de IDs, segurança e mailer por parâmetro. A raiz de composição instancia as implementações concretas. O adaptador HTTP traduz request/response; o adaptador SQLite traduz operações para SQL.

## Responsabilidades

- `domain/`: regras determinísticas sem I/O, como normalização do perfil, apresentação permitida e capacidade por plano.
- `application/`: cadastro/login, recuperação de senha, atualização do perfil, CRUD de currículos e limites de uso. Cada caso de uso aceita portas que podem ser substituídas por fakes nos testes.
- `infrastructure/sqlite/`: esquema, migrações e implementação das portas de persistência.
- `infrastructure/security/`: hashing de senha, token, hash de token e datas/IDs aleatórios.
- `infrastructure/email/`: integração HTTP com Resend. A chave e o endereço remetente vêm da configuração do servidor.
- `interfaces/http/`: roteamento, rate limits, validação de origem, serialização JSON, cookies HTTP-only, conteúdo estático e presenter HTML do currículo exportado.
- `server.js`: composition root; cria banco e adapters, injeta-os nos casos de uso e inicia o servidor.
- `js/features/`: controladores de apresentação separados por fluxo. `shared.mjs` centraliza cliente API, estado de sessão, navegação e mensagens; `app.mjs` só inicializa os controladores.

## Limites preservados

- A API retorna DTOs públicos; hash de senha, hash de sessão e linhas SQL não são serializados para o navegador.
- A posse de currículo é verificada no repositório para cada leitura, alteração e exclusão.
- Exclusão e cota são regras de aplicação/domínio e continuam restaurando vagas conforme o plano.
- O perfil profissional é normalizado no domínio; a página de perfil apenas coleta e exibe valores.
- Senhas e códigos de recuperação nunca são persistidos em texto simples. A recuperação continua genérica para não revelar se o e-mail existe.
- O checkout permanece um placeholder; regras de pagamentos reais devem entrar como caso de uso e adapter de gateway, com ativação do plano baseada em webhook verificado.

## Como evoluir

1. Crie ou altere uma regra pura em `domain/` e cubra entradas válidas e inválidas.
2. Orquestre a ação em `application/` por meio de uma porta explícita; não importe SQLite, HTTP ou um provedor externo.
3. Implemente a porta no adapter apropriado em `infrastructure/`.
4. Faça o adaptador HTTP chamar o caso de uso e mapear seu resultado para status/body/cookie.
5. Adicione teste unitário do caso de uso com fakes e teste de integração HTTP/SQLite para a fronteira afetada.
6. Execute `npm test` e `npm run check`.

Essa aplicação não precisa de ORM, framework de injeção, barramento de eventos ou múltiplas camadas de repositório genérico. As portas existentes são pequenas e ligadas a necessidades concretas. A regra de dependência e o objetivo de manter regras testáveis seguem a [descrição original da Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html); a configuração segura do runtime deve continuar seguindo as [práticas de segurança do Node.js](https://nodejs.org/en/learn/getting-started/security-best-practices).
