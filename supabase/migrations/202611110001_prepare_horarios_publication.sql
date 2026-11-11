-- Etapa 5: preparação aditiva para publicação por turma.
-- Revise a estrutura, faça backup e execute manualmente no Supabase SQL Editor.
-- Esta migração não preenche turma, não remove registros e não altera RLS.

ALTER TABLE public.horarios
  ADD COLUMN IF NOT EXISTS turma VARCHAR(20);

-- Uma UNIQUE constraint permite múltiplos NULLs nos registros legados e é
-- compatível com upsert(..., { onConflict: 'turma' }). Ela falhará se já
-- existirem turmas não nulas duplicadas; corrija esse caso manualmente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.horarios'::regclass
      AND conname = 'horarios_turma_unique'
  ) THEN
    ALTER TABLE public.horarios
      ADD CONSTRAINT horarios_turma_unique UNIQUE (turma);
  END IF;
END $$;
