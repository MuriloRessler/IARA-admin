# IARA-admin

O módulo **Gerenciamento de Impressões** está disponível na navegação administrativa: fila de pedidos confirmados, histórico, download temporário e marcação como impresso com confirmação humana. Reutiliza a autenticação e o cliente administrativo existentes. Configure `PRINTING_STORAGE_BUCKET` no backend e confira o esquema real antes do uso; consulte [configuração e diagnóstico de impressões](supabase/PRINTING.md). Não foram aplicadas migrações nem criados registros automaticamente.

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

A migração não foi executada. Antes de aplicá-la, revise a estrutura real de `public."Horarios"`, faça backup e execute o SQL somente mediante aprovação explícita. Não use `db push` ou `db reset` contra produção. Durante a transição, registros antigos podem manter `turma = NULL` e URLs em `horario`, enquanto registros novos terão uma grade por turma. O n8n só deverá mudar de consulta depois da validação das 49 grades.

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

Reconhecimento especializado de anotações manuscritas, aprovação humana integrada ao fluxo e publicação segura no Supabase. A extração automática agora é assistida por IA, mas continua sem publicação automática.

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
      periodos: [{ inicio: '07:30', disciplina: '', professor: '', sala: '' }],
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
## Etapa 4 — extração automática assistida

Após selecionar o curso e um PDF, o administrador pode solicitar **Processar PDF**. O backend valida assinatura, extensão, MIME, tamanho de até 20 MB e até 30 páginas, analisa a estrutura visual localmente, recorta células e executa OCR por célula. O fluxo padrão não envia o documento para a OpenAI.

O resultado é convertido para o mesmo modelo da grade manual. Turmas não reconhecidas não são atribuídas automaticamente; dias em branco continuam pendentes; campos ausentes e incertezas geram avisos. O administrador escolhe as turmas a importar e cada grade extraída inicia como `nao_revisado`. Edições invalidam a revisão, avisos precisam ser conferidos e a prévia final continua bloqueada enquanto houver pendências.

### Configuração da extração

Preencha `backend/.env` somente no ambiente local ou de deploy:

```env
EXTRACTION_ENGINE=local
PDF_MAX_SIZE_MB=20
PDF_MAX_PAGES=30
EXTRACTION_TIMEOUT_MS=120000
PDF_RENDER_SCALE=1.5
OCR_LANGUAGES=por+eng
OCR_CACHE_PATH=
```

`EXTRACTION_ENGINE=local` é obrigatório para o novo fluxo. O provider OpenAI permanece somente como compatibilidade opt-in quando `EXTRACTION_ENGINE=openai` for configurado conscientemente no backend; ele não é chamado automaticamente.

Na primeira execução, o Tesseract.js pode baixar os dados `por` e `eng` para `OCR_CACHE_PATH`. O diretório é criado pelo backend quando necessário e deve ter permissão de escrita. Falhas de inicialização do worker retornam `503` tratado, sem encerrar o processo Node.js.

O endpoint `POST /api/schedules/extract` exige o mesmo Bearer token administrativo de `/api/auth/me`, recebe `course` e o arquivo multipart no campo `file`, e retorna apenas dados provisórios para conferência. Não há upload persistente, migração Supabase, alteração da tabela `horarios` ou integração n8n nesta etapa.

### Limites e validação

- Respostas de erro usam códigos específicos para curso/arquivo inválido, PDF grande ou ilegível, rate limit, indisponibilidade e timeout.
- O provider OpenAI está isolado por uma interface injetável, portanto os testes usam mocks e não enviam documentos reais.
- O arquivo de referência `Horário Info 14.09.26 (1).pdf` só deve ser usado quando existir no workspace; a ausência dele não é mascarada por um arquivo inventado.

## Auditoria da Etapa 4

`npm audit --omit=dev` terminou com zero vulnerabilidades em 10/11/2026. O `npm audit` completo mantém seis vulnerabilidades em ferramentas de desenvolvimento (três moderadas, uma alta e duas críticas), principalmente Vitest 2.1.9 e dependências aninhadas de Vite, esbuild, tinypool e @vitest/mocker. A correção automática proposta exige o upgrade major para Vitest 5.1.0 e não foi aplicada sem avaliação de compatibilidade.

## Etapa 4.1 — precisão estrutural da extração

A extração agora representa cada linha da tabela como uma posição individual. O campo `posicao` mantém a ordem mesmo quando duas ou mais linhas possuem a mesma disciplina, professor e sala. Não existe deduplicação por texto, agrupamento de intervalos ou uso do início seguinte como término.

### Regras de horário

As regras de início ficam centralizadas em `shared/schedule-rules.js` e são consumidas pelo backend e frontend. O perfil de referência do PDF de Informática reconhece, quando a estrutura é detectada, as dez posições `07:30`, `08:20`, `09:10`, `10:10`, `11:00`, `13:00`, `13:50`, `14:40`, `15:40` e `16:30`. Esses valores não são aplicados a documentos com outra estrutura.

O modelo não possui horário de término. Quando o início não é reconhecido, a célula permanece no editor com pendência; nenhum horário é inventado a partir de duração ou do início seguinte.

### Estados e auditoria

Cada posição pode ser `reconhecido`, `vazio_documento`, `nao_reconhecido` ou `parcial`. Uma disciplina ilegível não elimina a linha: ela permanece editável, com horário, posição, página e aviso quando disponíveis. A interface permite corrigir a leitura e marcar uma célula como vazia somente após conferência.

Depois da extração local, o backend compara posições retornadas, esperadas, vazias, preenchidas, ilegíveis, duplicadas, fora de ordem e possivelmente omitidas. O resumo aparece na importação e também é mantido no diagnóstico da turma. Avisos de cobertura não são resolvidos copiando dados de outra turma.

O PDF real `Horário Info 14.09.26 (1).pdf` não está disponível neste workspace. A validação realizada usa fixtures sintéticas e não representa uma aprovação da extração real. Quando o arquivo for disponibilizado, execute o teste controlado comparando as sete turmas, quatro páginas, dez posições por dia, dias parcialmente vazios e anotações manuscritas.

## Etapa 4.3 — processamento local por estrutura e OCR

O processamento padrão deixou de usar a API multimodal. O backend usa `pdfjs-dist` e `@napi-rs/canvas` para inspecionar e renderizar cada página, `sharp` para análise de pixels, pré-processamento e recorte das células, e `tesseract.js` para OCR reutilizável em português e inglês. O OCR é executado por célula, não sobre uma página inteira seguida de reconstrução textual.

O detector procura cabeçalhos de turmas do catálogo, limites relativos da região, rótulos de dias, horários de início, linhas horizontais e separações verticais. Cada célula recebe página, posição, início, estado de leitura, texto original e caixa de origem. Quando a geometria não é confiável, a célula não é descartada: o diagnóstico registra a pendência e a turma permanece para conferência.

O painel de calibração permite ajustar os limites horizontais das regiões detectadas e reenviar o mesmo PDF com essa calibração, sem modificar ou armazenar o documento. As coordenadas são relativas às dimensões da página. A visualização **Ver célula** envia o PDF novamente a uma rota administrativa temporária, retorna somente o recorte solicitado em memória e não persiste arquivos.

Os dados de período agora contêm somente horário de início. O editor, a divisão manual, as validações, a prévia textual e os rascunhos não calculam nem exigem término. Rascunhos versão 1 que contenham `fim` são aceitos, têm esse campo removido na migração para a versão 2 e preservam os demais dados. Períodos repetidos continuam sendo linhas independentes.

O provider OpenAI anterior permanece no código apenas para compatibilidade explícita. A rota seleciona o extrator local por padrão (`EXTRACTION_ENGINE=local`) e só usa OpenAI quando esse valor é alterado manualmente no backend. Não há chamada externa no fluxo padrão.

O PDF real `Horário Info 14.09.26 (1).pdf` não está disponível neste workspace. Portanto, não foi declarada validação das sete turmas, das 350 posições ou da turma 63 2. Os testes atuais usam PDFs sintéticos, mocks de OCR e fixtures estruturais; a precisão real do OCR ainda precisa ser comparada com um gabarito humano quando o arquivo for disponibilizado.

## Etapa 4.2 — períodos independentes e conferência célula a célula

Cada linha extraída possui identidade própria, posição, horário, conteúdo, página, estado de reconhecimento e revisão. A resposta estruturada pode declarar `posicoesAssociadas` somente quando o PDF comprovar visualmente uma célula mesclada; com um perfil de horário confirmado, o backend expande esse bloco em períodos independentes usando as posições configuradas. A duração aparente do bloco nunca é usada sozinha para inventar posições. Sem evidência suficiente, o bloco permanece preservado e pendente de decisão humana.

### Importação HTML estruturada

O fluxo principal da Etapa 4.4 aceita um arquivo `.html` ou `.htm` exportado pelo sistema de horários. O backend decodifica o documento em memória, sem executar scripts ou carregar recursos externos, expande células com `rowspan`, valida cinco dias com dez posições e lê todas as turmas em uma única tabela. As colunas de coordenação e reunião são ignoradas.

As turmas são reconhecidas exclusivamente pelo catálogo compartilhado em `shared/courses.js`. Cabeçalhos desconhecidos, classes ausentes, células vazias (`-`), células ilegíveis e dias totalmente vazios permanecem identificados no diagnóstico para conferência humana. Cada posição é preservada individualmente; o importador não cria horários de término, não agrupa disciplinas repetidas e não publica dados no Supabase.

O endpoint protegido é `POST /api/schedules/import-html`, com o arquivo multipart no campo `file`. O limite é configurado por `HTML_MAX_SIZE_MB` (10 MB por padrão). O frontend apresenta o resumo por curso e permite filtrar e selecionar turmas antes de reutilizar o editor existente. O HTML importado nunca é renderizado com `dangerouslySetInnerHTML`.

Na conferência, o botão **Editar aula** abre um formulário com salvar/cancelar para o período selecionado. Horários, posição, disciplina, professor, sala, estado de reconhecimento e página podem ser corrigidos; sobreposições, limites inválidos e campos pendentes bloqueiam a gravação. Toda alteração invalida a revisão do dia e do período.

O botão **Dividir período** apresenta as posições aplicáveis do perfil conhecido ou permite informar manualmente os limites quando a estrutura não é conhecida. A divisão exige confirmação, preserva os valores reconhecidos, impede posições duplicadas e remove o registro agrupado apenas depois de criar as células independentes. Células vazias e ilegíveis continuam editáveis e não são descartadas.

O compartilhamento entre turmas continua referenciando o dia inteiro sem copiar ou agrupar períodos. A prévia textual e os rascunhos JSON mantêm todas as ocorrências individuais. Nenhuma alteração desta etapa publica dados no Supabase ou modifica o n8n. O PDF real de referência continua ausente neste workspace; a validação desta etapa usa fixtures e testes sintéticos.

### Complementação de aulas compartilhadas

A Etapa 4.6 mantém as aulas importadas como dados originais e reconhece automaticamente os 24 pares oficiais do catálogo. A comparação usa turma, dia, posição e início; uma aula própria nunca é substituída e duas posições vazias continuam vazias. A turma 61 3 permanece independente.

As complementações são bidirecionais, idempotentes e não usam dados herdados como fonte. Um dia totalmente vazio pode receber somente as aulas originais correspondentes da parceira. Em dias com uma a três aulas próprias, a complementação fica limitada aos turnos que já possuem aula própria; um turno inteiro vazio é tratado como folga. Dias com quatro ou mais aulas próprias não recebem complementação automática. Aulas próprias, rejeições e substituições manuais têm prioridade.

As complementações aparecem imediatamente no editor com a origem da turma parceira, sem confirmação individual. O administrador ainda pode editar uma posição para criar uma substituição local, desfazer uma complementação específica ou restaurá-la depois, sem alterar a turma de origem. Ao recalcular, apenas períodos marcados como complementação automática podem ser removidos; períodos manuais não identificáveis não são apagados por suposição. A interface identifica os turnos de folga sem criar uma disciplina fictícia, e a prévia textual inclui aulas próprias, automáticas e substituições manuais, desde que a revisão geral da grade esteja concluída.

Os 24 pares oficiais são derivados do catálogo compartilhado e aplicados quando as duas turmas estiverem disponíveis. Parcerias manuais não oficiais preservadas em rascunhos antigos são sinalizadas para revisão e não substituem silenciosamente a regra oficial. Sugestões, rejeições e substituições são armazenadas somente no rascunho JSON local versão 3, com compatibilidade de leitura para versões anteriores.

## Etapa 5 — publicação segura no Supabase

A publicação usa exclusivamente o backend protegido por `ADMIN_USER_ID`. O frontend envia as grades consolidadas do editor, mas nunca recebe nem envia `SUPABASE_SECRET_KEY`. O backend usa um cliente Supabase administrativo separado do cliente usado para validar o token do administrador. O nome exato da tabela é configurado por `SUPABASE_HORARIOS_TABLE`; no projeto conectado atualmente, ele é `Horarios` com H maiúsculo.

Na tela **Revisar publicação**, o administrador deve gerar a prévia das 49 grades, conferir as diferenças, baixar o backup JSON atual, consultar o texto final de cada turma e confirmar explicitamente a publicação. A revisão individual completa é recomendada, mas não obrigatória: quando houver períodos ou dias não revisados, a interface exige o aceite explícito do risco e o backend revalida esse aceite. Os endpoints protegidos são `POST /api/schedules/publication/preview`, `GET /api/schedules/publication/backup` e `POST /api/schedules/publication/publish`.

A publicação exige a confirmação explícita, o checksum do backup, o checksum do estado consultado na prévia e a mesma versão da grade. O texto publicado possui um registro por turma em `public."Horarios"`, com `turma`, `curso` e `horario`. Ele inclui aulas próprias, complementações automáticas e substituições manuais, mas não inclui IDs internos, estados de revisão, origem da parceria ou horário de término.

Registros existentes são atualizados por `turma`, preservando o `id`; registros ausentes são criados. Registros legados sem turma e turmas fora do catálogo não são removidos. O backup inclui integralmente os registros retornados pela tabela e seu checksum é conferido novamente antes da gravação.

No `.env` do backend, mantenha a chave administrativa somente no backend. A prévia consulta o esquema real de forma independente da chave de habilitação; a publicação efetiva continua exigindo `PUBLICATION_ENABLED=true`, backup, prévia consistente e confirmação humana:

```ini
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
SUPABASE_HORARIOS_TABLE=Horarios
ADMIN_USER_ID=...
PUBLICATION_ENABLED=true
```

Se `PUBLICATION_ENABLED=false`, a prévia ainda informa o estado real do esquema, mas a publicação fica indisponível até que essa configuração seja alterada para `true` e o backend seja reiniciado. Antes disso, revise e aplique manualmente a migração, confirme a chave UNIQUE por `turma` e faça um backup. O sistema não executa migrações, `db push`, `db reset` ou publicações automaticamente.

O SQL preparado em `supabase/migrations/202611110001_prepare_horarios_publication.sql` adiciona `turma` de forma aditiva à tabela existente `public."Horarios"` e prepara uma `UNIQUE CONSTRAINT` compatível com `onConflict: 'turma'`. Revise duplicidades não nulas e faça o backup antes de executar o SQL no Supabase SQL Editor. Registros antigos com `turma IS NULL` são preservados e não recebem uma turma por adivinhação. Consultas por turma e por curso estão documentadas em `supabase/README.md`.
