import {
  comparePublicationRecords,
  createPublicationError,
  recordsChecksum,
  validatePublicationSchedules,
} from '../services/publication.js';

const databaseUnavailable = (repository, error = null) => ({
  available: false,
  schemaReady: false,
  publicationEnabled: Boolean(repository.publicationEnabled),
  reason: error?.message || (repository.isConfigured ? 'A tabela horarios não pôde ser consultada.' : 'Configure SUPABASE_SECRET_KEY no backend para consultar o banco.'),
  code: error?.code || 'PUBLICATION_DATABASE_UNAVAILABLE',
});

const readDatabase = async (repository) => {
  if (!repository.isConfigured) return databaseUnavailable(repository);
  try {
    const records = await repository.readPublicationRecords();
    return {
      available: true,
      schemaReady: true,
      publicationEnabled: Boolean(repository.publicationEnabled),
      records,
      currentChecksum: recordsChecksum(records),
    };
  } catch (error) {
    return databaseUnavailable(repository, error);
  }
};

const buildPreview = async (schedules, repository) => {
  const validation = validatePublicationSchedules(schedules);
  const database = await readDatabase(repository);
  const changes = database.available ? comparePublicationRecords(validation.records, database.records) : null;
  const databaseIssues = !database.available
    ? [{ code: database.code, path: 'database', message: database.reason }]
    : changes?.duplicateClasses?.map((turma) => ({
    code: 'DUPLICATE_TURMA_IN_DATABASE',
    path: `database.${turma}`,
    message: `O banco possui mais de um registro para a turma ${turma}.`,
  })) || [];
  if (database.available && !database.publicationEnabled) databaseIssues.push({ code: 'PUBLICATION_DISABLED', path: 'backend.PUBLICATION_ENABLED', message: 'A publicação está desabilitada até a revisão da migração e do esquema.' });
  const blockingIssues = [...validation.issues, ...databaseIssues];
  const warnings = [...validation.warnings];
  if (changes?.legacyRecords.length) warnings.push({ code: 'LEGACY_RECORDS_WITHOUT_CLASS', path: 'database', message: `${changes.legacyRecords.length} registro(s) legado(s) não possuem turma e serão preservados.` });
  if (changes?.extraRecords.length) warnings.push({ code: 'EXTRA_DATABASE_RECORDS', path: 'database', message: `${changes.extraRecords.length} registro(s) com turma fora do catálogo não serão removidos.` });
  const summary = {
    ...(validation.summary || { turmas: 0, cursos: 0, aulasProprias: 0, aulasCompartilhadas: 0, alteracoesManuais: 0 }),
    registrosCriados: changes?.created.length || 0,
    registrosAtualizados: changes?.updated.length || 0,
    registrosInalterados: changes?.unchanged.length || 0,
    pendenciasBloqueantes: blockingIssues.length,
  };
  return {
    version: validation.version,
    valid: validation.valid && database.available && !databaseIssues.length,
    publicationAvailable: validation.valid && database.available && database.publicationEnabled && !databaseIssues.length,
    publicationVersion: validation.publicationVersion,
    records: validation.records,
    summary,
    issues: blockingIssues,
    warnings,
    database: {
      available: database.available,
      schemaReady: database.schemaReady,
      publicationEnabled: database.publicationEnabled,
      reason: database.reason || null,
      code: database.code || null,
      currentChecksum: database.currentChecksum || null,
      legacyRecords: changes?.legacyRecords.length || 0,
    },
    changes,
  };
};

export const createPublicationController = ({ repository }) => ({
  preview: async (request, response, next) => {
    try {
      response.json(await buildPreview(request.body?.schedules, repository));
    } catch (error) {
      next(error);
    }
  },

  backup: async (_request, response, next) => {
    try {
      const records = await repository.readAllRecords();
      const payload = {
        backupVersion: 1,
        exportedAt: new Date().toISOString(),
        table: 'public.horarios',
        columns: ['id', 'turma', 'curso', 'horario'],
        records,
        recordsChecksum: recordsChecksum(records),
      };
      response.attachment(`iara-horarios-backup-${new Date().toISOString().slice(0, 10)}.json`);
      response.json(payload);
    } catch (error) {
      next(error);
    }
  },

  publish: async (request, response, next) => {
    try {
      if (request.body?.confirmPublication !== true) throw createPublicationError('PUBLICATION_CONFIRMATION_REQUIRED', 'Confirme explicitamente a publicação depois de revisar a prévia e o backup.', 400);
      const validation = validatePublicationSchedules(request.body?.schedules);
      if (!validation.valid) throw createPublicationError('PUBLICATION_VALIDATION_FAILED', 'A grade possui pendências bloqueantes e não pode ser publicada.', 422, { issues: validation.issues });
      if (request.body?.previewVersion !== validation.publicationVersion) throw createPublicationError('PUBLICATION_PREVIEW_STALE', 'A prévia não corresponde à versão atual da grade. Gere uma nova prévia antes de publicar.', 409);
      if (!repository.isConfigured) throw createPublicationError('PUBLICATION_DATABASE_UNAVAILABLE', 'A publicação está indisponível porque o cliente administrativo do Supabase não foi configurado.', 503);
      if (!repository.publicationEnabled) throw createPublicationError('PUBLICATION_DISABLED', 'A publicação está desabilitada. Revise a migração e defina PUBLICATION_ENABLED=true no backend quando estiver pronta.', 503);

      const before = await repository.readPublicationRecords();
      const beforeChecksum = recordsChecksum(before);
      if (!request.body?.backupChecksum) throw createPublicationError('PUBLICATION_BACKUP_REQUIRED', 'Baixe o backup dos registros atuais antes de publicar.', 400);
      if (request.body.backupChecksum !== beforeChecksum) throw createPublicationError('PUBLICATION_BACKUP_OUTDATED', 'O backup não corresponde ao estado atual do banco. Baixe um novo backup antes de publicar.', 409);
      if (request.body?.baseRecordsChecksum !== beforeChecksum) throw createPublicationError('PUBLICATION_DATABASE_CHANGED', 'Os registros mudaram desde a prévia. Gere uma nova prévia antes de publicar.', 409);
      const comparison = comparePublicationRecords(validation.records, before);
      if (comparison.duplicateClasses.length) throw createPublicationError('PUBLICATION_DUPLICATE_TURMA', 'O banco possui registros duplicados para uma ou mais turmas; a publicação foi bloqueada.', 409);

      await repository.upsert(validation.records);
      let after;
      try {
        after = await repository.readPublicationRecords();
      } catch (_error) {
        throw createPublicationError('PUBLICATION_RESULT_UNCERTAIN', 'A gravação foi enviada, mas não foi possível confirmar o estado final do banco. Não tente novamente sem consultar os registros atuais.', 503);
      }
      const verification = comparePublicationRecords(validation.records, after);
      if (verification.created.length || verification.updated.length || verification.duplicateClasses.length) {
        throw createPublicationError('PUBLICATION_VERIFICATION_FAILED', 'O estado consultado após a gravação não corresponde integralmente à grade publicada.', 502);
      }
      response.json({
        success: true,
        publishedAt: new Date().toISOString(),
        summary: {
          turmas: validation.records.length,
          registrosCriados: comparison.created.length,
          registrosAtualizados: comparison.updated.length,
          registrosInalterados: comparison.unchanged.length,
        },
        recordsChecksum: recordsChecksum(after),
      });
    } catch (error) {
      next(error);
    }
  },
});

export { buildPreview };
