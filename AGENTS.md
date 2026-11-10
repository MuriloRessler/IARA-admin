# Orientações para futuras tarefas

- Utilize JavaScript, React, Node.js e Express; não introduza TypeScript sem decisão explícita.
- Preserve a organização em monorepo com npm workspaces.
- Mantenha a identidade visual baseada em verde-claro, verde-escuro, branco e cinza-claro.
- Preserve os dados e a estrutura existente do Supabase. Não execute migrações remotas, `db push` ou `db reset` sem autorização explícita.
- Mantenha a tabela `horarios` simples para que a consulta do chatbot continue direta.
- Exija aprovação humana antes de publicar horários.
- A autenticação e a autorização são responsabilidades diferentes: valide a sessão no Supabase e compare o UUID com `ADMIN_USER_ID` no backend.
- Nunca exponha credenciais, especialmente `SUPABASE_SECRET_KEY`, no frontend ou no repositório.
- Não crie cadastro público, contas administrativas automáticas ou autenticação própria.
- Diferencie claramente funcionalidades implementadas de funcionalidades futuras.
- Execute os testes relevantes e informe qualquer falha ou limitação na entrega.
- Não declare que o login real foi validado sem uma conta Supabase configurada; use os testes com mocks para a validação automatizada.
