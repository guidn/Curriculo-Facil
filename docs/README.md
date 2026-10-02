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

O arquivo `.env.example` mostra as configurações disponíveis. Copie para `.env` se quiser alterar porta, URL ou duração de sessão. Em produção (`NODE_ENV=production`), o cookie de sessão usa `Secure` por padrão; mantenha HTTPS habilitado.

## Verificação

`npm run check` verifica a sintaxe dos arquivos JavaScript. `npm test` executa os testes de integração nativos do Node.js para páginas públicas, autenticação, sessões, recuperação de senha, autorização de currículos e limites de requisições. Os testes usam um banco SQLite temporário.

O SQLite de desenvolvimento é criado automaticamente em `backend/data/`. O arquivo local do banco é ignorado pelo Git para evitar versionar dados de usuários. A variável opcional `DB_FILE` permite escolher outro caminho, por exemplo para testes.

## Funcionalidades implementadas

- Cadastro e login com sessão HTTP-only.
- Senhas protegidas com `scrypt`.
- Recuperação de senha em modo de desenvolvimento.
- SQLite com usuários, sessões, currículos, uso diário e assinaturas.
- Perfil com dados profissionais reutilizáveis ao iniciar novos currículos.
- CRUD de currículos.
- Criação guiada em quatro etapas: informações, experiência, formação e modelo.
- Cinco modelos (Moderno, Clássico, Minimal, Executivo e Criativo), com estilos visíveis no editor e na exportação.
- Editor de currículo com preview ao vivo, salvamento automático e modo de visualização.
- Exportação em formato imprimível com botão `Salvar em PDF`.
- Compartilhamento por link público.
- Currículos salvos por plano: Gratuito 2, Básico 5, Premium ilimitado; apagar um libera espaço.
- Arquitetura em camadas e padrões adotados: veja [`architecture.md`](architecture.md).
- Espaço reservado para publicidade no fluxo de exportação gratuito.
- Endpoint de checkout preparado para integração com gateway.
- Endpoint de ativação de plano somente para desenvolvimento/testes.
- Proteções básicas: cookies HTTP-only, SameSite, checagem de origem e rate limit em memória.

## O que ainda depende de conta externa

O checkout real e a entrega de e-mails de recuperação ainda dependem de serviços externos. O fluxo de redefinição gera um token somente em desenvolvimento; em produção é necessário integrar um provedor de e-mail. O gateway de pagamento e a rede de anúncios também não estão conectados. Para pagamentos reais, configure as credenciais e implemente os webhooks do provedor escolhido.
