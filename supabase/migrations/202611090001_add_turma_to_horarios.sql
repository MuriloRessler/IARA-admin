-- Reviewed migration for a future controlled application.
-- Do not run this file against production automatically.

ALTER TABLE public.horarios
  ADD COLUMN IF NOT EXISTS turma VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS horarios_turma_unique_idx
  ON public.horarios (turma)
  WHERE turma IS NOT NULL;
