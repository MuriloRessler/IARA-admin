# IARA-admin

O IARA-admin é o painel administrativo da IARA (Inteligência Artificial de Resposta e Atendimento), um chatbot de atendimento escolar. Este projeto será responsável pelo gerenciamento dos horários escolares que serão consultados pelo chatbot.

## Objetivo

Esta primeira etapa prepara o frontend e o backend para o futuro fluxo de importação, conferência e publicação de horários. Nesta versão há apenas uma interface inicial e o endpoint de verificação do backend.

## Tecnologias

- React 19, Vite e JSX
- Node.js 24 ou 26, Express 5 e módulos ES
- npm workspaces e `concurrently`
- CSS com variáveis nativas
- Testes com `node:test` e Supertest

## Arquitetura

O monorepo contém dois workspaces independentes. O frontend consulta o backend por `GET /api/health` usando a Fetch API. O backend organiza configuração, rotas, controllers e middlewares, e permanece funcional sem credenciais do Supabase.

```text
frontend/             aplicação React e interface inicial
backend/              API Express e testes
supabase/             documentação da estrutura futura, sem migrações
```

## Pré-requisitos

Instale Node.js 24 LTS ou 26 LTS e npm. O arquivo `.nvmrc` registra a versão 24 como referência compatível.

## Instalação

Na raiz do projeto:

```bash
npm install
```

Copie `frontend/.env.example` para `frontend/.env` e `backend/.env.example` para `backend/.env` se quiser personalizar as variáveis. Os valores padrão permitem executar esta etapa sem conexão com o Supabase.

As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` são apenas preparadas para o futuro. A variável `SUPABASE_SECRET_KEY` pertence exclusivamente ao backend e nunca deve ser exposta ao frontend.

## Execução

```bash
npm run dev                 # frontend e backend
npm run dev:frontend       # somente frontend: http://localhost:5173
npm run dev:backend        # somente backend: http://localhost:3001
npm run build              # build de produção do frontend
npm test                   # testes automatizados
```

O endpoint `http://localhost:3001/api/health` retorna o estado do backend. A interface exibe “Backend conectado” quando essa consulta funciona.

## Implementado nesta etapa

- Monorepo com npm workspaces e scripts centralizados.
- API Express com CORS restrito, tratamento de erros e endpoint de saúde.
- Interface React responsiva com a identidade visual da IARA.
- Indicador de conexão entre frontend e backend.
- Documentação das turmas, do banco futuro e das regras previstas para processamento.
- Testes automatizados para o endpoint de saúde e rotas inexistentes.

## Próximas etapas

Login e autorização do administrador, integração segura com Supabase, upload e interpretação de PDFs, conferência das grades, aprovação humana e publicação. O processamento deverá considerar PDFs digitalizados, várias turmas por página, anotações manuscritas e possíveis compartilhamentos, sempre sinalizando dados não reconhecidos para revisão.

Não foram realizadas alterações no banco de dados, no chatbot n8n ou em ambientes de produção.
