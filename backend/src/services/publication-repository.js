import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { createPublicationError } from './publication.js';

const schemaName = 'public';
const defaultTableName = 'Horarios';
const publicationColumns = 'id,turma,curso,horario';

const getStatus = (error) => error?.status ?? error?.statusCode ?? null;

const logSupabaseError = (logger, operation, error, tableName) => {
  if (typeof logger?.error !== 'function') return;
  logger.error('[Supabase] Falha na operação de publicação', {
    operation,
    schema: schemaName,
    table: tableName,
    code: error?.code ?? null,
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    status: getStatus(error),
  });
};

const suggestedTableFromHint = (hint) => {
  const match = typeof hint === 'string' ? hint.match(/table ['"]([^'"]+)['"]/i) : null;
  return match?.[1] || null;
};

const classifySupabaseError = (operation, error, tableName, logger) => {
  logSupabaseError(logger, operation, error, tableName);
  const code = String(error?.code || '');
  const status = getStatus(error);
  const message = String(error?.message || '').toLowerCase();
  const hint = String(error?.hint || '');
  const suggestedTable = suggestedTableFromHint(hint);
  let publicationCode = 'PUBLICATION_DATABASE_READ_FAILED';
  let userMessage = 'O Supabase não respondeu corretamente à consulta de publicação.';
  let statusCode = 503;

  if (code === 'PGRST205' || code === '42P01') {
    publicationCode = suggestedTable
      ? 'PUBLICATION_TABLE_NAME_MISMATCH'
      : code === 'PGRST205' ? 'PUBLICATION_SCHEMA_CACHE_STALE' : 'PUBLICATION_TABLE_NOT_FOUND';
    userMessage = suggestedTable
      ? `A tabela configurada public.${tableName} não corresponde ao nome exposto pelo Supabase. Verifique maiúsculas/minúsculas; a API indicou public.${suggestedTable}.`
      : code === 'PGRST205'
        ? `O PostgREST não encontrou public.${tableName} no cache de schema. Verifique o nome/schema e atualize o cache antes de publicar.`
        : `A tabela public.${tableName} não foi encontrada. Verifique o nome exato da tabela.`;
  } else if (code === 'PGRST204' || code === '42703' || message.includes('column')) {
    publicationCode = 'PUBLICATION_COLUMN_MISSING';
    userMessage = `A tabela public.${tableName} está acessível, mas uma das colunas exigidas (${publicationColumns}) não foi encontrada.`;
  } else if (status === 401 || message.includes('invalid api key') || message.includes('jwt')) {
    publicationCode = 'PUBLICATION_CREDENTIALS_INVALID';
    userMessage = 'A chave administrativa do backend foi rejeitada pelo Supabase. Confirme que ela pertence ao mesmo projeto da URL configurada.';
  } else if (code === '42501' || status === 403 || message.includes('permission denied')) {
    publicationCode = 'PUBLICATION_PERMISSION_DENIED';
    userMessage = `O cliente administrativo não tem permissão para consultar public.${tableName}. Revise a chave e as políticas do Supabase.`;
  } else if (!error?.code && (error?.name === 'TypeError' || message.includes('fetch') || message.includes('network') || message.includes('timeout'))) {
    publicationCode = 'PUBLICATION_CONNECTION_FAILED';
    userMessage = 'Não foi possível conectar ao Supabase. Verifique a URL e a rede do backend.';
  } else if (code === 'PGRST106' || message.includes('schema')) {
    publicationCode = 'PUBLICATION_SCHEMA_UNAVAILABLE';
    userMessage = 'O schema public não está disponível na API do Supabase. Revise a exposição do schema e o cache do PostgREST.';
  }

  const details = { cause: error?.message || 'unknown', operation, supabaseCode: code || null, status };
  if (suggestedTable) details.suggestedTable = suggestedTable;
  return createPublicationError(publicationCode, userMessage, statusCode, details);
};

const getTableClient = (client) => (typeof client.schema === 'function' ? client.schema(schemaName) : client);

const selectPublication = (client, tableName, limit = null) => {
  let query = getTableClient(client).from(tableName).select(publicationColumns);
  if (limit !== null) query = query.limit(limit);
  return query;
};

export const createPublicationRepository = ({ client = supabaseAdmin, config = env, logger = console } = {}) => {
  const tableName = config.supabaseHorariosTable || defaultTableName;
  const repository = {
    isConfigured: Boolean(client),
    publicationEnabled: Boolean(config.publicationEnabled),
    tableName,
    schemaName,
    uniqueColumn: 'turma',
    async verifyPublicationSchema() {
      if (!client) throw createPublicationError('PUBLICATION_DATABASE_UNAVAILABLE', 'O cliente administrativo do Supabase não está configurado.', 503);
      const { data, error } = await selectPublication(client, tableName, 1);
      if (error) throw classifySupabaseError('verify-publication-schema', error, tableName, logger);
      return { columnsAccessible: true, empty: (data || []).length === 0 };
    },
    async readAllRecords() {
      if (!client) throw createPublicationError('PUBLICATION_DATABASE_UNAVAILABLE', 'O cliente administrativo do Supabase não está configurado.', 503);
      const { data, error } = await getTableClient(client).from(tableName).select('*');
      if (error) throw classifySupabaseError('read-backup-records', error, tableName, logger);
      return data || [];
    },
    async readPublicationRecords() {
      if (!client) throw createPublicationError('PUBLICATION_DATABASE_UNAVAILABLE', 'O cliente administrativo do Supabase não está configurado.', 503);
      const { data, error } = await selectPublication(client, tableName);
      if (error) throw classifySupabaseError('read-publication-records', error, tableName, logger);
      return data || [];
    },
    async upsert(records) {
      if (!client) throw createPublicationError('PUBLICATION_DATABASE_UNAVAILABLE', 'O cliente administrativo do Supabase não está configurado.', 503);
      const { data, error } = await getTableClient(client)
        .from(tableName)
        .upsert(records.map(({ turma, curso, horario }) => ({ turma, curso, horario })), { onConflict: 'turma', ignoreDuplicates: false })
        .select(publicationColumns);
      if (error) {
        if (error.code === '42P10' || String(error.message || '').includes('no unique or exclusion constraint')) {
          throw createPublicationError('PUBLICATION_UNIQUE_CONSTRAINT_MISSING', 'A tabela está acessível, mas não possui uma restrição UNIQUE compatível com turma. A publicação foi bloqueada.', 503, { cause: error.message });
        }
        throw classifySupabaseError('upsert-publication-records', error, tableName, logger);
      }
      return data || [];
    },
  };
  return repository;
};
