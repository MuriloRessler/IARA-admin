const nullableString = { type: ['string', 'null'] };

const positionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    posicao: { type: ['integer', 'null'] },
    estado: { type: 'string', enum: ['reconhecido', 'vazio_documento', 'nao_reconhecido', 'parcial'] },
    inicio: nullableString,
    fim: nullableString,
    disciplina: nullableString,
    professor: nullableString,
    sala: nullableString,
    pagina: { type: ['integer', 'null'] },
    incertezas: { type: 'array', items: { type: 'string' } },
  },
  required: ['posicao', 'estado', 'inicio', 'fim', 'disciplina', 'professor', 'sala', 'pagina', 'incertezas'],
};

const daySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    situacaoDocumento: { type: 'string', enum: ['com_aulas', 'dia_em_branco', 'parcialmente_ilegivel', 'nao_reconhecido'] },
    posicoes: { type: 'array', items: positionSchema },
    avisos: { type: 'array', items: { type: 'string' } },
  },
  required: ['situacaoDocumento', 'posicoes', 'avisos'],
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
            turmaAssociacao: {
              type: 'object',
              additionalProperties: false,
              properties: {
                regiao: nullableString,
                confianca: { type: 'string', enum: ['confiavel', 'duvidosa', 'nao_identificada'] },
              },
              required: ['regiao', 'confianca'],
            },
            segunda: daySchema,
            terca: daySchema,
            quarta: daySchema,
            quinta: daySchema,
            sexta: daySchema,
            avisos: { type: 'array', items: { type: 'string' } },
          },
          required: ['turma', 'curso', 'turmaAssociacao', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'avisos'],
        },
      },
      observacoes: { type: 'array', items: { type: 'string' } },
    },
    required: ['paginasAnalisadas', 'turmas', 'observacoes'],
  },
};
