# IARA-admin

O IARA-admin é o painel administrativo da IARA (Inteligência Artificial de Resposta e Atendimento), um chatbot de atendimento escolar. O painel será responsável pelo gerenciamento dos horários escolares consultados pelo chatbot.

## Objetivo

O projeto oferece uma interface administrativa protegida por Supabase Auth e uma API Express que valida, no backend, a identidade e a autorização do único administrador configurado. A importação, interpretação, conferência e publicação de horários continuam reservadas para etapas futuras.

## Tecnologias

- React 19, Vite e JSX
- Node.js 24 ou 26, Express 5 e módulos ES
- Supabase JS para autenticação
- npm workspaces e `concurrently`
- CSS com variáveis nativas
- Testes com Vitest, Testing Library, `node:test` e Supertest

## Arquitetura

O monorepo contém dois workspaces. O frontend usa Supabase Auth para manter a sessão e realiza login por email e senha. Depois do login, envia o access token para `GET /api/auth/me`. O backend valida o token com `supabase.auth.getUser(token)` e só libera o painel quando o ID corresponde exatamente a `ADMIN_USER_ID`.

```text
frontend/             aplicação React, autenticação e interface administrativa
backend/              API Express, middleware de autorização e testes
supabase/             migração revisável e documentação, sem execução remota
```

## Pré-requisitos

Instale Node.js 24 LTS ou 26 LTS e npm. O arquivo `.nvmrc` registra a versão 24 como referência compatível.

## Instalação

Na raiz do projeto:

```bash
npm install
```

Crie `frontend/.env` a partir de `frontend/.env.example` e `backend/.env` a partir de `backend/.env.example`.

### Variáveis do frontend

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

`VITE_SUPABASE_URL` é a URL do projeto no Supabase. A publishable key pode ser localizada em **Project Settings > API**. Somente valores públicos devem ser usados no frontend.

### Variáveis do backend

```env
PORT=3001
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
ADMIN_USER_ID=
```

Nesta etapa, `SUPABASE_SECRET_KEY` é reservada para operações privilegiadas futuras e pode permanecer vazia. Ela nunca deve ser enviada ao navegador. `ADMIN_USER_ID` deve conter o UUID do único usuário autorizado; sem ele, as rotas administrativas respondem `503` e permanecem bloqueadas.

## Configuração do administrador no Supabase

1. Copie a URL do projeto e a publishable key no painel Supabase e configure os arquivos `.env` conforme acima.
2. Em **Authentication > Users**, crie manualmente o usuário administrador com email e senha.
3. Abra o usuário criado e copie o UUID.
4. Configure esse UUID em `ADMIN_USER_ID` no `.env` do backend.
5. Reinicie o backend e teste o login pela interface.

O IARA-admin não possui cadastro público, criação automática de contas, login social ou recuperação de senha. Se o projeto Supabase não precisar de cadastro para outros sistemas, avalie desabilitar a inscrição pública nas configurações de Authentication. Não compartilhe senhas ou chaves secretas por mensagens ou commits.

## Execução

```bash
npm run dev                 # frontend e backend
npm run dev:frontend       # somente frontend: http://localhost:5173
npm run dev:backend        # somente backend: http://localhost:3001
npm run build              # build de produção do frontend
npm test                   # testes automatizados
```

Com o Supabase configurado, acesse `http://localhost:5173`, informe as credenciais do administrador e use o botão **Sair** para encerrar a sessão. Sem configuração do Supabase, a interface informa que o login está pendente de configuração; não há autenticação simulada.

## Segurança da autenticação

- A sessão é mantida e renovada pelo SDK oficial do Supabase.
- O callback `onAuthStateChange` apenas atualiza o estado; a autorização é verificada em fluxo assíncrono separado.
- O frontend nunca decide sozinho quem é administrador.
- O backend exige `Authorization: Bearer TOKEN`, valida o token no Supabase e compara o UUID com `ADMIN_USER_ID`.
- Token ausente ou inválido retorna `401`; usuário autenticado sem autorização retorna `403`; configuração ausente ou indisponibilidade do serviço retorna `503`.
- `GET /api/health` continua público.

## Migração SQL preparada

O arquivo `supabase/migrations/202611090001_add_turma_to_horarios.sql` apenas prepara, de forma aditiva, a coluna `turma VARCHAR(20)` e um índice único parcial para valores não nulos. Ele preserva os registros, IDs, cursos e URLs atuais.

A migração não foi executada. Antes de aplicá-la, revise a estrutura real de `public.horarios`, faça backup e execute o SQL somente mediante aprovação explícita. Não use `db push` ou `db reset` contra produção. Durante a transição, registros antigos podem manter `turma = NULL` e URLs em `horario`, enquanto registros novos terão uma grade por turma. O n8n só deverá mudar de consulta depois da validação das 49 grades.

## Implementado nesta etapa

- Login administrativo com `signInWithPassword`.
- Persistência, renovação, verificação e logout da sessão Supabase.
- Proteção visual do painel e estados de carregamento, erro e acesso negado.
- Middleware backend reutilizável e `GET /api/auth/me`.
- Configuração segura sem credenciais reais no repositório.
- Migração SQL versionada, sem execução remota.
- Testes com mocks do Supabase, sem depender de credenciais reais.
- Interface administrativa protegida com visão geral, importação e conferência.
- Seleção dos oito cursos e das 49 turmas a partir de um catálogo compartilhado.
- Seleção, validação e pré-visualização local de PDFs de até 20 MB.
- Grade semanal editável com disciplina, professor, sala e horários.
- Estados explícitos para dias com aulas, compartilhados, sem aulas e pendentes.
- Prévia do texto da coluna `horario`, sem publicação no banco.
- Exportação e importação de rascunhos JSON locais, com versão e validação.

## Próximas etapas

OCR, extração automática dos PDFs, reconhecimento de anotações manuscritas, aprovação humana integrada ao fluxo e publicação segura no Supabase. O upload desta etapa é somente local e não interpreta o documento automaticamente.

## Etapa 3 — uso da interface local

Após o login, use **Importar horários** para escolher o curso e selecionar um PDF. O arquivo fica apenas no navegador e pode ser visualizado em um painel nativo. Em seguida, abra **Conferir horários**, selecione qualquer turma e edite a grade manualmente.

Cada dia possui uma situação explícita. Dias vazios permanecem **pendentes** até que o administrador confirme **Sem aulas** ou escolha **Compartilhado** e uma turma de origem. A origem precisa ter aulas válidas, não pode ser a própria turma e referências circulares são rejeitadas. Períodos isolados vazios não geram compartilhamentos automáticos.

Use **Exportar rascunho** para baixar um JSON versionado e **Importar rascunho** para restaurá-lo. O JSON contém somente grades e vínculos de compartilhamento; não contém PDF, sessão, tokens ou credenciais. A prévia da coluna `horario` só é gerada quando a turma não possui pendências.

Os rascunhos permanecem locais. Nenhum botão desta etapa salva ou publica dados no Supabase.

### Estrutura interna da grade

```js
{
  curso: 'Informática',
  turma: '61 1',
  dias: {
    segunda: {
      situacao: 'com_aulas',
      periodos: [{ inicio: '07:30', fim: '', disciplina: '', professor: '', sala: '' }],
      compartilhamento: null,
    },
  },
}
```

O catálogo compartilhado está em `shared/courses.js`. As regras de validação, formatação e rascunhos ficam em `frontend/src/services/` para permanecerem independentes da interface.

## Auditoria de dependências

O `npm audit` foi executado em 10/11/2026 e encontrou seis vulnerabilidades transitivas no conjunto instalado: três moderadas, uma alta e duas críticas. O caminho afetado é de ferramentas de desenvolvimento, principalmente Vitest 2.1.9 e suas versões aninhadas de `vite`, `esbuild`, `tinypool` e `@vitest/mocker`; não há indicação de que o SDK do Supabase esteja envolvido.

O relatório indica correção automática por uma atualização major para Vitest 5.1.0. Essa atualização não foi aplicada nesta etapa porque pode exigir mudanças de compatibilidade no Vite e nos testes. Não executar `npm audit fix --force` sem avaliar a atualização e repetir toda a suíte.

Não foram realizadas alterações remotas no Supabase, no chatbot n8n ou em ambientes de produção.
