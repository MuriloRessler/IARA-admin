import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { createPublicationError } from './publication.js';

const tableName = 'horarios';

export const createPublicationRepository = ({ client = supabaseAdmin, config = env } = {}) => ({
  isConfigured: Boolean(client),
  publicationEnabled: Boolean(config.publicationEnabled),
  async readAllRecords() {
    if (!client) throw createPublicationError('PUBLICATION_DATABASE_UNAVAILABLE', 'O cliente administrativo do Supabase não está configurado.', 503);
    const { data, error } = await client.from(tableName).select('*');
    if (error) throw createPublicationError('PUBLICATION_DATABASE_READ_FAILED', 'Não foi possível consultar os registros atuais de horarios.', 503, { cause: error.message });
    return data || [];
  },
  async readPublicationRecords() {
    if (!client) throw createPublicationError('PUBLICATION_DATABASE_UNAVAILABLE', 'O cliente administrativo do Supabase não está configurado.', 503);
    const { data, error } = await client.from(tableName).select('id,turma,curso,horario');
    if (error) throw createPublicationError('PUBLICATION_SCHEMA_UNAVAILABLE', 'A tabela horarios não está disponível com as colunas exigidas (id, turma, curso, horario). Revise a migração antes de publicar.', 503, { cause: error.message });
    return data || [];
  },
  async upsert(records) {
    if (!client) throw createPublicationError('PUBLICATION_DATABASE_UNAVAILABLE', 'O cliente administrativo do Supabase não está configurado.', 503);
    const { data, error } = await client
      .from(tableName)
      .upsert(records.map(({ turma, curso, horario }) => ({ turma, curso, horario })), { onConflict: 'turma', ignoreDuplicates: false })
      .select('id,turma,curso,horario');
    if (error) throw createPublicationError('PUBLICATION_WRITE_FAILED', 'O Supabase rejeitou a publicação. Verifique a coluna turma e a restrição UNIQUE usada pelo upsert.', 502, { cause: error.message });
    return data || [];
  },
});
