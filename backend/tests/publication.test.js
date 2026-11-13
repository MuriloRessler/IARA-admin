import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { courses, totalClasses } from '../src/config/courses.js';
import { comparePublicationRecords, formatPublicationText, recordsChecksum, validatePublicationSchedules } from '../src/services/publication.js';
import { createPublicationRepository } from '../src/services/publication-repository.js';

const dayKeys = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

const emptyDay = () => ({ situacao: 'sem_aulas', periodos: [], compartilhamento: null, revisao: 'revisado', avisos: [] });

const emptySchedule = (curso, turma) => ({
  curso,
  turma,
  revisao: 'revisado',
  dias: Object.fromEntries(dayKeys.map((key) => [key, emptyDay()])),
});

const completeSchedules = () => Object.fromEntries(courses.flatMap((course) => course.classes.map((turma) => {
  const schedule = emptySchedule(course.name, turma);
  if (turma === '61 1') schedule.dias.segunda = {
    situacao: 'com_aulas',
    periodos: [{ id: 'period-1', posicao: 1, inicio: '07:30', estado: 'reconhecido', disciplina: 'Matemática', professor: 'Ana', sala: 'B1', revisao: 'revisado' }],
    compartilhamento: null,
    revisao: 'revisado',
    avisos: [],
  };
  return [`${course.name}::${turma}`, schedule];
})));

test('publication validation covers all official classes and produces final text without sharing metadata', () => {
  const schedules = completeSchedules();
  const result = validatePublicationSchedules(schedules);
  assert.equal(totalClasses, 49);
  assert.equal(result.valid, true);
  assert.equal(result.records.length, 49);
  assert.match(result.records.find((record) => record.turma === '61 1').horario, /07:30 - Matemática \| Professor: Ana \| Sala: B1/);
  assert.doesNotMatch(result.records.find((record) => record.turma === '61 1').horario, /origemCompartilhamento|compartilhamentoStatus/);
});

test('publication validation rejects missing classes, invalid courses, duplicate periods and end times', () => {
  const schedules = completeSchedules();
  delete schedules['Informática::61 3'];
  schedules['Informática::61 1'].curso = 'Curso inválido';
  schedules['Informática::61 2'].dias.segunda = {
    situacao: 'com_aulas',
    periodos: [{ id: 'period-2', posicao: 1, inicio: '07:30', estado: 'reconhecido', disciplina: 'Uma', professor: '', sala: '', revisao: 'revisado' }, { id: 'period-3', posicao: 1, inicio: '07:30', estado: 'reconhecido', disciplina: 'Outra', professor: '', sala: '', fim: '08:20', revisao: 'revisado' }],
    compartilhamento: null,
    revisao: 'revisado',
    avisos: [],
  };
  const result = validatePublicationSchedules(schedules);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((item) => item.code === 'MISSING_CLASS'));
  assert.ok(result.issues.some((item) => item.code === 'UNKNOWN_OR_MISMATCHED_CLASS'));
  assert.ok(result.issues.some((item) => item.code === 'DUPLICATE_PERIOD'));
  assert.ok(result.issues.some((item) => item.code === 'END_TIME_NOT_ALLOWED'));
});

test('publication validation reports incomplete review separately from blocking data errors', () => {
  const schedules = completeSchedules();
  const schedule = schedules['Informática::61 1'];
  schedule.revisao = 'nao_revisado';
  schedule.dias.segunda.revisao = 'nao_revisado';
  schedule.dias.segunda.periodos[0].revisao = 'nao_revisado';
  const result = validatePublicationSchedules(schedules);
  assert.equal(result.valid, true);
  assert.equal(result.issues.some((item) => item.code === 'PERIOD_NOT_REVIEWED' || item.code === 'DAY_NOT_REVIEWED'), false);
  assert.equal(result.review.complete, false);
  assert.equal(result.review.turmasComRevisaoIncompleta, 1);
  assert.equal(result.review.periodosNaoRevisados, 1);
  assert.equal(result.review.diasNaoRevisados, 1);
});

test('publication comparison preserves ids and keeps legacy records outside the publication set', () => {
  const next = [{ turma: '61 1', curso: 'Informática', horario: 'new' }, { turma: '61 2', curso: 'Informática', horario: 'same' }];
  const current = [{ id: 10, turma: '61 1', curso: 'Informática', horario: 'old' }, { id: 11, turma: '61 2', curso: 'Informática', horario: 'same' }, { id: 12, turma: null, curso: 'Informática', horario: 'legacy-url' }];
  const result = comparePublicationRecords(next, current);
  assert.equal(result.updated[0].id, 10);
  assert.equal(result.unchanged[0].id, 11);
  assert.equal(result.legacyRecords.length, 1);
});

test('publication routes preview, backup and publish with administrative authorization and no duplicate rows', async () => {
  let records = [{ id: 10, turma: '61 1', curso: 'Informática', horario: 'old' }, { id: 11, turma: null, curso: 'Informática', horario: 'legacy-url' }];
  let nextId = 12;
  const repository = {
    isConfigured: true,
    publicationEnabled: true,
    schemaName: 'public',
    tableName: 'Horarios',
    uniqueColumn: 'turma',
    async verifyPublicationSchema() { return { columnsAccessible: true, empty: records.length === 0 }; },
    async readAllRecords() { return records; },
    async readPublicationRecords() { return records.map(({ id, turma, curso, horario }) => ({ id, turma, curso, horario })); },
    async upsert(nextRecords) {
      nextRecords.forEach((next) => {
        const index = records.findIndex((record) => record.turma === next.turma);
        if (index >= 0) records[index] = { ...records[index], ...next };
        else records.push({ id: nextId++, ...next });
      });
      return records;
    },
  };
  const app = createApp({
    config: { allowedOrigins: ['http://localhost:5173'], adminUserId: 'admin-user-id', publicationEnabled: true },
    supabaseClient: { auth: { getUser: async () => ({ data: { user: { id: 'admin-user-id' } }, error: null }) } },
    publicationRepository: repository,
  });
  const schedules = completeSchedules();
  assert.equal((await request(app).post('/api/schedules/publication/preview').send({ schedules })).statusCode, 401);
  const preview = await request(app).post('/api/schedules/publication/preview').set('Authorization', 'Bearer valid-token').send({ schedules });
  assert.equal(preview.statusCode, 200);
  assert.equal(preview.body.valid, true);
  assert.equal(preview.body.summary.turmas, 49);
  assert.equal(preview.body.summary.registrosCriados, 48);
  assert.equal(preview.body.summary.registrosAtualizados, 1);
  assert.equal(preview.body.database.legacyRecords, 1);

  const backup = await request(app).get('/api/schedules/publication/backup').set('Authorization', 'Bearer valid-token');
  assert.equal(backup.statusCode, 200);
  assert.equal(backup.body.records.length, 2);
  assert.equal(backup.body.recordsChecksum, recordsChecksum(records));

  const missingConfirmation = await request(app).post('/api/schedules/publication/publish').set('Authorization', 'Bearer valid-token').send({ schedules, previewVersion: preview.body.publicationVersion, baseRecordsChecksum: preview.body.database.currentChecksum, backupChecksum: backup.body.recordsChecksum });
  assert.equal(missingConfirmation.statusCode, 400);

  const published = await request(app).post('/api/schedules/publication/publish').set('Authorization', 'Bearer valid-token').send({ schedules, previewVersion: preview.body.publicationVersion, baseRecordsChecksum: preview.body.database.currentChecksum, backupChecksum: backup.body.recordsChecksum, confirmPublication: true });
  assert.equal(published.statusCode, 200);
  assert.equal(published.body.success, true);
  assert.equal(published.body.summary.turmas, 49);
  assert.equal(records.filter((record) => record.turma === '61 1')[0].id, 10);
  assert.equal(new Set(records.filter((record) => record.turma).map((record) => record.turma)).size, 49);

  const secondPreview = await request(app).post('/api/schedules/publication/preview').set('Authorization', 'Bearer valid-token').send({ schedules });
  const secondBackup = await request(app).get('/api/schedules/publication/backup').set('Authorization', 'Bearer valid-token');
  const repeated = await request(app).post('/api/schedules/publication/publish').set('Authorization', 'Bearer valid-token').send({ schedules, previewVersion: secondPreview.body.publicationVersion, baseRecordsChecksum: secondPreview.body.database.currentChecksum, backupChecksum: secondBackup.body.recordsChecksum, confirmPublication: true });
  assert.equal(repeated.statusCode, 200);
  assert.equal(repeated.body.summary.registrosCriados, 0);
  assert.equal(repeated.body.summary.registrosAtualizados, 0);
  assert.equal(repeated.body.summary.registrosInalterados, 49);
});

test('publication requires risk acceptance only for incomplete review and keeps structural errors blocking', async () => {
  let records = [];
  let nextId = 1;
  const repository = {
    isConfigured: true,
    publicationEnabled: true,
    schemaName: 'public',
    tableName: 'Horarios',
    uniqueColumn: 'turma',
    async verifyPublicationSchema() { return { columnsAccessible: true, empty: records.length === 0 }; },
    async readAllRecords() { return records; },
    async readPublicationRecords() { return records.map(({ id, turma, curso, horario }) => ({ id, turma, curso, horario })); },
    async upsert(nextRecords) {
      nextRecords.forEach((next) => records.push({ id: nextId++, ...next }));
      return records;
    },
  };
  const app = createApp({
    config: { allowedOrigins: ['http://localhost:5173'], adminUserId: 'admin-user-id', publicationEnabled: true },
    supabaseClient: { auth: { getUser: async () => ({ data: { user: { id: 'admin-user-id' } }, error: null }) } },
    publicationRepository: repository,
  });
  const schedules = completeSchedules();
  schedules['Informática::61 1'].revisao = 'nao_revisado';
  schedules['Informática::61 1'].dias.segunda.revisao = 'nao_revisado';
  schedules['Informática::61 1'].dias.segunda.periodos[0].revisao = 'nao_revisado';
  const preview = await request(app).post('/api/schedules/publication/preview').set('Authorization', 'Bearer valid-token').send({ schedules });
  assert.equal(preview.statusCode, 200);
  assert.equal(preview.body.valid, true);
  assert.equal(preview.body.summary.periodosNaoRevisados, 1);
  const backup = await request(app).get('/api/schedules/publication/backup').set('Authorization', 'Bearer valid-token');
  const payload = { schedules, previewVersion: preview.body.publicationVersion, baseRecordsChecksum: preview.body.database.currentChecksum, backupChecksum: backup.body.recordsChecksum, confirmPublication: true };
  const withoutAcceptance = await request(app).post('/api/schedules/publication/publish').set('Authorization', 'Bearer valid-token').send(payload);
  assert.equal(withoutAcceptance.statusCode, 400);
  assert.equal(withoutAcceptance.body.error.code, 'PUBLICATION_UNREVIEWED_RISK_REQUIRED');
  const withAcceptance = await request(app).post('/api/schedules/publication/publish').set('Authorization', 'Bearer valid-token').send({ ...payload, acceptUnreviewedRisk: true });
  assert.equal(withAcceptance.statusCode, 200);

  const structurallyInvalid = completeSchedules();
  structurallyInvalid['Informática::61 1'].dias.segunda.periodos[0].fim = '08:20';
  const blocked = await request(app).post('/api/schedules/publication/publish').set('Authorization', 'Bearer valid-token').send({ ...payload, schedules: structurallyInvalid, acceptUnreviewedRisk: true });
  assert.equal(blocked.statusCode, 422);
  assert.equal(blocked.body.error.code, 'PUBLICATION_VALIDATION_FAILED');
});

test('schema validation is independent from the publication feature flag', async () => {
  const repository = {
    isConfigured: true,
    publicationEnabled: false,
    schemaName: 'public',
    tableName: 'Horarios',
    uniqueColumn: 'turma',
    async verifyPublicationSchema() { return { columnsAccessible: true, empty: true }; },
    async readPublicationRecords() { return []; },
    async readAllRecords() { return []; },
  };
  const app = createApp({
    config: { allowedOrigins: ['http://localhost:5173'], adminUserId: 'admin-user-id', publicationEnabled: false },
    supabaseClient: { auth: { getUser: async () => ({ data: { user: { id: 'admin-user-id' } }, error: null }) } },
    publicationRepository: repository,
  });
  const schedules = completeSchedules();
  const preview = await request(app).post('/api/schedules/publication/preview').set('Authorization', 'Bearer valid-token').send({ schedules });
  assert.equal(preview.statusCode, 200);
  assert.equal(preview.body.valid, true);
  assert.equal(preview.body.publicationAvailable, false);
  assert.equal(preview.body.database.available, true);
  assert.equal(preview.body.database.configuration, 'disabled');
  assert.equal(preview.body.issues.some((item) => item.code === 'PUBLICATION_DISABLED'), false);
  assert.ok(preview.body.warnings.some((item) => item.code === 'PUBLICATION_DISABLED'));

  const blocked = await request(app).post('/api/schedules/publication/publish').set('Authorization', 'Bearer valid-token').send({ schedules, previewVersion: preview.body.publicationVersion, confirmPublication: true });
  assert.equal(blocked.statusCode, 503);
  assert.equal(blocked.body.error.code, 'PUBLICATION_DISABLED');
});

test('publication formatter resolves a whole-day shared reference without emitting technical source metadata', () => {
  const source = emptySchedule('Informática', '61 1');
  source.dias.segunda = { situacao: 'com_aulas', periodos: [{ posicao: 1, inicio: '07:30', estado: 'reconhecido', disciplina: 'Programação', professor: 'Bia', sala: '', revisao: 'revisado' }], compartilhamento: null, revisao: 'revisado', avisos: [] };
  const target = emptySchedule('Informática', '61 2');
  target.dias.segunda = { situacao: 'compartilhado', periodos: [], compartilhamento: { curso: 'Informática', turma: '61 1' }, revisao: 'revisado', avisos: [] };
  const text = formatPublicationText(target, { 'Informática::61 1': source, 'Informática::61 2': target });
  assert.match(text, /07:30 - Programação/);
  assert.doesNotMatch(text, /AULAS COMPARTILHADAS DE/);
});

test('publication repository reports a schema without turma and uses turma as the upsert conflict key', async () => {
  const missingColumn = createPublicationRepository({ client: { from: () => ({ select: () => ({ limit: async () => ({ data: null, error: { code: '42703', message: 'column turma does not exist' } }) }) }) }, config: { publicationEnabled: true }, logger: { error() {} } });
  await assert.rejects(() => missingColumn.verifyPublicationSchema(), (error) => error.code === 'PUBLICATION_COLUMN_MISSING');

  let upsertOptions;
  const client = {
    from: () => ({
      select: () => ({ limit: async () => ({ data: [], error: null }), then: (resolve) => resolve({ data: [], error: null }) }),
      upsert: (_records, options) => {
        upsertOptions = options;
        return { select: async () => ({ data: [], error: null }) };
      },
    }),
  };
  const repository = createPublicationRepository({ client, config: { publicationEnabled: true } });
  await repository.upsert([{ turma: '61 1', curso: 'Informática', horario: 'texto' }]);
  assert.deepEqual(upsertOptions, { onConflict: 'turma', ignoreDuplicates: false });
});

test('publication repository uses public and the configured exact table name', async () => {
  let schemaName;
  let selectedTable;
  const client = {
    schema(schema) {
      schemaName = schema;
      return { from(table) { selectedTable = table; return { select: () => ({ limit: async () => ({ data: [], error: null }) }) }; } };
    },
  };
  const repository = createPublicationRepository({ client, config: { publicationEnabled: true, supabaseHorariosTable: 'Horarios' } });
  const result = await repository.verifyPublicationSchema();
  assert.deepEqual(result, { columnsAccessible: true, empty: true });
  assert.equal(schemaName, 'public');
  assert.equal(selectedTable, 'Horarios');
});

test('publication repository classifies table name mismatches and missing unique constraints', async () => {
  const mismatch = createPublicationRepository({
    client: { from: () => ({ select: () => ({ limit: async () => ({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.horarios' in the schema cache", hint: "Perhaps you meant the table 'public.Horarios'" } }) }) }) },
    config: { publicationEnabled: true, supabaseHorariosTable: 'horarios' },
    logger: { error() {} },
  });
  await assert.rejects(() => mismatch.verifyPublicationSchema(), (error) => error.code === 'PUBLICATION_TABLE_NAME_MISMATCH');

  const uniqueMissing = createPublicationRepository({
    client: { from: () => ({ upsert: () => ({ select: async () => ({ data: null, error: { code: '42P10', message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification' } }) }) }) },
    config: { publicationEnabled: true },
    logger: { error() {} },
  });
  await assert.rejects(() => uniqueMissing.upsert([{ turma: '61 1', curso: 'Informática', horario: 'texto' }]), (error) => error.code === 'PUBLICATION_UNIQUE_CONSTRAINT_MISSING');
});

test('publication repository separates cache, permission, credentials and network failures', async () => {
  const cases = [
    [{ code: 'PGRST205', message: 'Could not find the table in the schema cache' }, 'PUBLICATION_SCHEMA_CACHE_STALE'],
    [{ code: '42501', message: 'permission denied for table Horarios' }, 'PUBLICATION_PERMISSION_DENIED'],
    [{ status: 401, message: 'Invalid API key' }, 'PUBLICATION_CREDENTIALS_INVALID'],
    [{ name: 'TypeError', message: 'fetch failed' }, 'PUBLICATION_CONNECTION_FAILED'],
  ];
  for (const [supabaseError, expectedCode] of cases) {
    const logs = [];
    const repository = createPublicationRepository({
      client: { from: () => ({ select: () => ({ limit: async () => ({ data: null, error: supabaseError }) }) }) },
      config: { publicationEnabled: true },
      logger: { error: (...args) => logs.push(args) },
    });
    await assert.rejects(() => repository.verifyPublicationSchema(), (error) => error.code === expectedCode);
    assert.equal(logs[0][0], '[Supabase] Falha na operação de publicação');
    assert.equal(logs[0][1].operation, 'verify-publication-schema');
    assert.equal(Object.hasOwn(logs[0][1], 'authorization'), false);
  }
});
