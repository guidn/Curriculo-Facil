# Arquitetura e padrões do Currículo Fácil

## Direção escolhida

O projeto é um app pequeno em HTML, CSS, JavaScript sem framework, Node.js e SQLite. A arquitetura mantém esse stack e separa responsabilidades por camadas, sem adicionar infraestrutura ou abstrações que não resolvem um problema atual.

```text
Páginas HTML + CSS
        ↓ eventos e estado da tela
Controladores de interface (js/app.js)
        ↓ HTTP/JSON
Rotas da API (backend/src/server.js)
        ↓ regras de aplicação e domínio
Serviços (backend/src/services/)
        ↓ SQL
SQLite (backend/src/db.js)
```

As dependências seguem essa direção: a persistência não conhece a interface. A API continua responsável pela sessão, autorização e composição da resposta HTTP. As regras reutilizáveis, como normalizar os dados profissionais e calcular a capacidade de currículos salvos, ficam fora do código de apresentação.

## Padrões usados

- **Presentation–Domain–Data**: páginas e controladores apresentam e recolhem dados; serviços aplicam regras do produto; SQLite persiste os registros. A separação é deliberadamente leve e adequada ao volume atual do projeto.
- **Service Layer**: `resume-service.js` calcula vagas ocupadas e disponíveis; `profile-service.js` normaliza o perfil profissional antes de persistir. Os handlers da API coordenam esses serviços com a autenticação e o banco.
- **Transaction Script**: cada rota da API executa um caso de uso HTTP claro (criar, consultar, atualizar ou excluir). Isso evita introduzir um ORM ou um repositório genérico sem necessidade.
- **Data Mapper na borda**: `cleanUser` e `resumeData` convertem linhas SQLite em objetos públicos da API. Campos internos como hashes de senha e tokens de sessão não atravessam essa borda.
- **Single source of truth para padrões**: os dados profissionais ficam no perfil; cada currículo recebe uma cópia inicial que pode divergir sem sobrescrever o perfil automaticamente.

Referências conceituais: [Presentation–Domain–Data Layering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html), [Service Layer](https://martinfowler.com/eaaCatalog/serviceLayer.html) e as recomendações OWASP para [validar entrada no servidor](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) e [verificar autorização em cada requisição](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Fluxo dos currículos

1. O perfil guarda valores padrão de contato e carreira, além de habilidades, experiências e formação. O criador copia esses padrões para um novo documento; editar um currículo não altera o perfil.
2. A capacidade é calculada com a quantidade de currículos ainda salvos: Gratuito permite 2, Básico 5 e Premium não tem limite. Excluir um registro libera uma vaga imediatamente.
3. Toda leitura, alteração e exclusão continua vinculada ao usuário autenticado na consulta SQLite. Um ID fornecido pelo cliente nunca substitui a verificação de propriedade.
4. O editor atualiza a prévia enquanto a pessoa digita; o salvamento automático reduz perda de trabalho, e “Salvar e visualizar” abre uma leitura limpa do documento sem consumir a cota de exportação.

## Persistência e evolução

`resume_profile_json` foi adicionado por uma migração aditiva: bancos existentes recebem a coluna apenas quando ela ainda não existe e preservam as contas atuais. O objeto de perfil tem campos permitidos, limites de tamanho e listas limitadas. Os currículos existentes continuam independentes e mantêm seus períodos legados.

Para adicionar uma regra de negócio, primeiro coloque-a no serviço apropriado e teste o serviço/rota. Para campos novos, atualize o normalizador, o formulário de perfil e o teste de round-trip. Só extraia novos módulos quando houver uma responsabilidade reutilizável clara.
