# Gerenciamento de Impressões

Verificação de leitura em 13/11/2026: as seis colunas fundamentais estão acessíveis na API do projeto configurado, e o Storage contém o bucket privado `impressoes`. O backend local recebeu `PRINTING_STORAGE_BUCKET=impressoes`. Não foram alterados registros, esquema, políticas ou objetos do Storage. Tipos/constraints ainda devem ser conferidos pelo SQL abaixo; login real, download de documento real e impressão física não foram validados.

A fonte exclusiva é `public.impressoes`. O módulo não altera `impressao_pendentes`, horários, n8n ou arquivos. Somente `impresso` é atualizado após confirmação humana. Download não altera o pedido e não executa impressão física.

## Verificação manual antes de usar

Execute somente estas consultas de leitura no SQL Editor do projeto correto:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'impressoes'
order by ordinal_position;

select id, name, public from storage.buckets;
```

Confira `id uuid` (chave primária), `numero text`, `nome text`, `data timestamptz`, `impresso boolean`, `impressao text`. `nome_arquivo`, `tipo_arquivo` e `mensagem_id` são metadados opcionais; sua ausência não bloqueia a interface. Verifique também as permissões de SELECT/UPDATE do cliente administrativo e acesso aos objetos do Storage. O bucket deve ser privado para impedir acesso público aos documentos pessoais.

Se a tabela/colunas estiver ausente, prepare e revise o SQL conforme o esquema real, com backup, antes de qualquer execução manual. Não renomeie tabelas, converta tipos ou preencha registros antigos por suposição. Exemplo apenas para uma tabela já existente e previamente inspecionada, caso faltem somente os metadados:

```sql
-- Execução manual, somente após revisão e autorização.
alter table public.impressoes add column if not exists nome_arquivo text;
alter table public.impressoes add column if not exists tipo_arquivo text;
alter table public.impressoes add column if not exists mensagem_id text;
```

## Configuração e contrato

Configure `PRINTING_STORAGE_BUCKET` no `backend/.env` com o nome real do bucket e reinicie o backend. Reutiliza `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e a autenticação existente. Nenhuma chave secreta pertence ao frontend.

`impressao` deve conter um caminho relativo ao bucket (`pasta/documento.pdf`) ou prefixado com o bucket (`bucket/pasta/documento.pdf`). URLs completas não são abertas nem consultadas pelo servidor; se o workflow atual gravar URLs, revise o contrato manualmente antes de ativar downloads. O painel emite URLs assinadas de 60 segundos, sob autorização administrativa; trate esses links como temporariamente confidenciais.

Endpoints protegidos pelo token Supabase e comparação com `ADMIN_USER_ID`:

- `GET /api/printings?status=pending|printed&page=1`: valida as seis colunas fundamentais, consulta somente false/true e retorna páginas de 25 registros. Pendentes: pedidos antigos primeiro; histórico: pedidos recentes primeiro, pela data de solicitação. Não existe coluna de data de impressão neste contrato.
- `POST /api/printings/:id/download`: assina somente o caminho armazenado no pedido, no bucket configurado.
- `PATCH /api/printings/:id/printed`, JSON `{ "confirmed": true }`: atualiza exclusivamente `impresso` para true, de forma idempotente. Não há reversão nem exclusão nesta interface.

Falhas de esquema/configuração aparecem na página; não há criação automática de tabelas, buckets, políticas ou dados de demonstração. A verificação em execução confirma a disponibilidade das colunas pela API, mas não substitui a inspeção manual dos tipos, constraints e privacidade do bucket. Testes usam mocks, sem publicar horários, chamar OpenAI ou alterar produção.
