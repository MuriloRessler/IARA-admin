const nullableString = { type: ['string', 'null'] };

const periodSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    inicio: nullableString,
    fim: nullableString,
    disciplina: nullableString,
    professor: nullableString,
    sala: nullableString,
    pagina: { type: ['integer', 'null'] },
    incertezas: { type: 'array', items: { type: 'string' } },
  },
  required: ['inicio', 'fim', 'disciplina', 'professor', 'sala', 'pagina', 'incertezas'],
};

const daySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    situacaoDocumento: { type: 'string', enum: ['com_aulas', 'dia_em_branco', 'parcialmente_ilegivel', 'nao_reconhecido'] },
    periodos: { type: 'array', items: periodSchema },
    avisos: { type: 'array', items: { type: 'string' } },
  },
  required: ['situacaoDocumento', 'periodos', 'avisos'],
};

export const extractionFormat = {
  type: 'json_schema',
  name: 'school_schedule_extraction',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      paginasAnalisadas: { type: 'integer', minimum: 0 },
      turmas: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            turma: nullableString,
            curso: nullableString,
            segunda: daySchema,
            terca: daySchema,
            quarta: daySchema,
            quinta: daySchema,
            sexta: daySchema,
            avisos: { type: 'array', items: { type: 'string' } },
          },
          required: ['turma', 'curso', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'avisos'],
        },
      },
      observacoes: { type: 'array', items: { type: 'string' } },
    },
    required: ['paginasAnalisadas', 'turmas', 'observacoes'],
  },
};
