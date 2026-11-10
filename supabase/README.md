# Supabase — contexto e migração

## Estado atual

Nenhuma operação remota foi executada nesta etapa. A tabela existente `public.horarios` possui `id`, `curso` e `horario`; os registros atuais podem conter URLs de PDFs utilizadas pelo chatbot n8n.

## Migração preparada

O arquivo `migrations/202611090001_add_turma_to_horarios.sql` adiciona `turma VARCHAR(20)` com `IF NOT EXISTS` e cria um índice único parcial para códigos não nulos. A abordagem é aditiva: não remove colunas, não altera conteúdo, não apaga registros, não preenche turmas e não muda RLS, grants ou políticas.

Revise o SQL contra a estrutura real do projeto, faça backup e obtenha aprovação antes de aplicá-lo. Não execute `db push` ou `db reset` contra produção automaticamente.

## Transição planejada

Durante a transição, a tabela poderá conter registros antigos (`turma = NULL`, `horario` com URL) e registros novos (`turma` preenchida, `horario` com a grade semanal). O chatbot atual deve continuar funcionando. O fluxo n8n só deverá ser alterado depois de as 49 grades serem importadas, conferidas e validadas.
