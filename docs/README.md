# Currículo Fácil

Aplicação de currículos em HTML, CSS, JavaScript nativo, Node.js e SQLite.

## Executar

Requer Node.js 22.5+ (inclui `node:sqlite`).

```bash
npm run dev
```

Abra `http://localhost:3000`. O banco SQLite local é criado automaticamente em `backend/data/`; defina `DB_FILE` para usar outro local. Consulte `.env.example` para opções de execução e integração.

## Scripts

- `npm start` — inicia o servidor.
- `npm run dev` — inicia com reinicialização ao alterar arquivos.
- `npm test` — testes unitários de regras/casos de uso e testes integrados com SQLite temporário.
- `npm run check` — valida sintaxe dos arquivos `.js` e `.mjs`.

## Estrutura

- `index.html`, `pages/`, `css/` — telas e estilos.
- `js/app.mjs`, `js/shared.mjs`, `js/features/` — bootstrap, serviços de apresentação e controladores por fluxo.
- `backend/src/domain/` — políticas sem I/O.
- `backend/src/application/` — casos de uso independentes de HTTP e SQLite.
- `backend/src/infrastructure/` — SQLite, criptografia e e-mail.
- `backend/src/interfaces/http/` — protocolo HTTP, cookies, rotas e arquivos públicos.
- `backend/src/server.js` — raiz de composição.
- `backend/test/` — testes de arquitetura e integração.
- `docs/architecture.md` — limites das camadas e regras para manter a arquitetura.
- `docs/production-roadmap.md` — preparação para produção, e-mail e gateway.

## Funcionalidades

- Cadastro/login com sessão HTTP-only e senhas com scrypt.
- Recuperação com código de 6 dígitos, expiração e uso único; código local disponível em desenvolvimento. O e-mail real usa Resend quando configurado.
- Perfil com dados reutilizáveis, editor, salvamento e prévia.
- CRUD de currículos com conteúdo estruturado e cinco modelos selecionáveis sem duplicar dados.
- Seções editáveis de experiência, formação, cursos, habilidades, idiomas, certificações e projetos; campos vazios são omitidos na renderização.
- Exportação em HTML para impressão/PDF, DOCX editável e TXT. O PDF ainda depende do diálogo de impressão do navegador; consulte `architecture.md` antes de tratar a exportação como serviço de produção.
- Limites por plano e assinatura pendente de gateway.

O checkout ainda não realiza cobranças. O envio de e-mail real exige as variáveis secretas `RESEND_API_KEY` e `EMAIL_FROM`; não as adicione ao repositório. Para a integração de produção, siga `docs/production-roadmap.md`.

