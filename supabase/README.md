# Supabase — contexto e migração

## Estado atual

Nenhuma operação remota foi executada nesta etapa. A tabela existente `public."Horarios"` possui `id`, `turma`, `curso` e `horario`; os registros atuais podem conter URLs de PDFs utilizadas pelo chatbot n8n.

## Migração preparada

O arquivo `migrations/202611110001_prepare_horarios_publication.sql` prepara `turma VARCHAR(20)` de forma aditiva na tabela existente `public."Horarios"`. O segundo cria a constraint `horarios_turma_unique`, compatível com `onConflict: 'turma'`; múltiplos registros legados com `turma IS NULL` continuam permitidos. A migração anterior usa o identificador não citado `public.horarios` e não deve ser aplicada cegamente neste projeto, pois o nome real conectado é sensível a maiúsculas/minúsculas. A abordagem não remove colunas, não altera conteúdo, não apaga registros, não preenche turmas e não muda RLS, grants ou políticas.

Revise o SQL contra a estrutura real do projeto, faça backup e obtenha aprovação antes de aplicá-lo. Não execute `db push` ou `db reset` contra produção automaticamente.

## Transição planejada

Durante a transição, a tabela poderá conter registros antigos (`turma = NULL`, `horario` com URL) e registros novos (`turma` preenchida, `horario` com a grade semanal). O chatbot atual deve continuar funcionando. O fluxo n8n só deverá ser alterado depois de as 49 grades serem importadas, conferidas e validadas.

## Publicação administrativa

O backend usa `SUPABASE_SECRET_KEY` somente no cliente administrativo do servidor. O frontend nunca recebe essa chave. `SUPABASE_HORARIOS_TABLE=Horarios` mantém o identificador real da tabela; o frontend nunca recebe essa configuração. A publicação permanece bloqueada enquanto `PUBLICATION_ENABLED=false`; altere para `true` somente depois de revisar o esquema e aplicar manualmente a migração aprovada.

Antes de publicar, use `GET /api/schedules/publication/backup` para baixar um JSON recuperável. O arquivo inclui a data, a tabela, as colunas relevantes, todos os registros retornados e um checksum. Registros sem turma são preservados integralmente e não são apagados nem preenchidos automaticamente.

`POST /api/schedules/publication/preview` compara as 49 grades finais com os registros atuais e informa criações, atualizações, itens inalterados, registros legados, extras e bloqueios. `POST /api/schedules/publication/publish` exige o checksum do backup, o checksum da prévia, a confirmação explícita e a revisão administrativa. O upsert em lote usa `turma` como conflito, não envia `id` e verifica os registros após a gravação.

Consultas previstas para a integração futura do chatbot:

```sql
-- Uma turma específica
SELECT id, turma, curso, horario
FROM public."Horarios"
WHERE turma = '63 2';

-- Todas as turmas de um curso
SELECT id, turma, curso, horario
FROM public."Horarios"
WHERE curso = 'Informática' AND turma IS NOT NULL
ORDER BY turma;

-- Todos os horários identificados por turma
SELECT id, turma, curso, horario
FROM public."Horarios"
WHERE turma IS NOT NULL
ORDER BY curso, turma;
```

Essas consultas são apenas documentação. O n8n não foi alterado nesta etapa e registros legados que dependem somente de `curso` continuam exigindo decisão própria antes da migração do fluxo.
