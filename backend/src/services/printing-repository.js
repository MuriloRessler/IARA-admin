import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';

const columns = 'id,numero,nome,data,impresso,impressao';
export const printingError = (code, message, statusCode = 503) => Object.assign(new Error(message), { code, statusCode, expose: true });
const check = ({ data, error }) => {
  if (error) {
    const schema = ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error.code);
    throw printingError(schema ? 'PRINTING_SCHEMA_MISSING' : 'PRINTING_DATABASE_FAILED', schema
      ? 'Verifique public.impressoes e as colunas id, numero, nome, data, impresso e impressao. Consulte supabase/PRINTING.md para o diagnóstico manual.'
      : 'Não foi possível acessar as impressões. Verifique a conexão, a chave administrativa e as permissões do Supabase.');
  }
  return data;
};

export function createPrintingRepository({ client = supabaseAdmin, config = env } = {}) {
  const table = () => {
    if (!client) throw printingError('PRINTING_NOT_CONFIGURED', 'Configure o cliente administrativo do Supabase no backend.');
    return client.schema('public').from('impressoes');
  };
  const get = async (id) => {
    const record = check(await table().select('*').eq('id', id).maybeSingle());
    if (!record) throw printingError('PRINTING_NOT_FOUND', 'Solicitação não encontrada.', 404);
    return record;
  };
  return {
    async list({ printed, page }) {
      // Probe required columns even when the table is empty; metadata remains optional.
      check(await table().select(columns).limit(0));
      const result = await table().select('*', { count: 'exact' }).eq('impresso', printed)
        .order('data', { ascending: !printed, nullsFirst: false }).order('id')
        .range((page - 1) * 25, page * 25 - 1);
      const records = check(result) || [];
      return { records: records.map(({ id, numero, nome, data, impresso, impressao, nome_arquivo, tipo_arquivo }) => ({
        id, numero, nome, data, impresso, hasFile: Boolean(impressao), nome_arquivo: nome_arquivo || null, tipo_arquivo: tipo_arquivo || null,
      })), total: result.count || 0, page, pageSize: 25 };
    },
    async markPrinted(id) {
      const records = check(await table().update({ impresso: true }).eq('id', id).eq('impresso', false).select('id,impresso'));
      if (records?.length) return records[0];
      const record = await get(id);
      if (record.impresso === true) return { id: record.id, impresso: true };
      throw printingError('PRINTING_CONFLICT', 'O estado da solicitação mudou. Atualize a lista.', 409);
    },
    async download(id) {
      const record = await get(id);
      const bucket = config.printingStorageBucket;
      if (!bucket) throw printingError('PRINTING_STORAGE_NOT_CONFIGURED', 'Configure PRINTING_STORAGE_BUCKET no backend com o bucket real dos documentos.');
      let path = record.impressao;
      if (typeof path !== 'string' || !path.trim()) throw printingError('PRINTING_FILE_MISSING', 'Esta solicitação não possui arquivo.', 404);
      if (path.startsWith(`${bucket}/`)) path = path.slice(bucket.length + 1);
      if (path.includes('://') || path.startsWith('/') || path.split('/').some((part) => !part || part === '..' || part === '.') || /[\\\x00-\x1f]/.test(path)) {
        throw printingError('PRINTING_FILE_PATH_INVALID', 'O caminho do arquivo não é válido. Use um caminho relativo ao bucket configurado.', 422);
      }
      const filename = (record.nome_arquivo || path.split('/').at(-1)).replace(/[\\/\x00-\x1f]/g, '_');
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60, { download: filename });
      if (error || !data?.signedUrl) throw printingError('PRINTING_DOWNLOAD_FAILED', 'Arquivo indisponível. Verifique o bucket, o caminho e as permissões do Storage.');
      return { url: data.signedUrl, expiresIn: 60 };
    },
  };
}
