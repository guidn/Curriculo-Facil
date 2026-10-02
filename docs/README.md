# Currículo Fácil — Full Stack

Projeto completo em HTML, CSS, JavaScript e Node.js, sem React e sem pasta `assets/`.

## Estrutura

- `index.html` — entrada pública.
- `css/` — estilos globais, componentes e páginas.
- `js/` — lógica do frontend e comunicação com a API.
- `pages/` — páginas organizadas por função.
- `backend/src/` — servidor HTTP, autenticação, regras de plano e API.
- `backend/data/` — banco SQLite criado automaticamente.
- `docs/` — documentação.

## Backend

Requer Node.js 22.5+ porque o projeto usa `node:sqlite` para manter o backend sem dependências externas obrigatórias.

```bash
node backend/src/server.js
```

Abra `http://localhost:3000`.

Para desenvolvimento:

```bash
npm run dev
```

O arquivo `.env.example` mostra as configurações disponíveis. Copie para `.env` se quiser alterar porta, URL ou duração de sessão.

## Funcionalidades implementadas

- Cadastro e login com sessão HTTP-only.
- Senhas protegidas com `scrypt`.
- Recuperação de senha em modo de desenvolvimento.
- SQLite com usuários, sessões, currículos, uso diário e assinaturas.
- CRUD de currículos.
- Três modelos conceituais: Moderno, Clássico e Minimal.
- Editor de currículo com preview ao vivo.
- Exportação em formato imprimível com botão `Salvar em PDF`.
- Compartilhamento por link público.
- Limites por plano: Gratuito 2, Básico 5, Premium ilimitado.
- Espaço reservado para publicidade no fluxo de exportação gratuito.
- Endpoint de checkout preparado para integração com gateway.
- Endpoint de ativação de plano somente para desenvolvimento/testes.
- Proteções básicas: cookies HTTP-only, SameSite, checagem de origem e rate limit em memória.

## O que ainda depende de conta externa

O código está preparado para conectar um gateway de pagamento e uma rede de anúncios, mas não usa credenciais fictícias nem finge que pagamentos reais já estão ativos. Para produção, é necessário criar as contas nesses serviços, configurar as credenciais e implementar os webhooks do provedor escolhido.
