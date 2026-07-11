import type { DbUser } from '@/lib/db-kv';

export interface HrMetricDefinition {
  name: string;
  description: string;
  formula: string;
  requiredInputs: string[];
}

export interface HrMetricCategory {
  title: string;
  description: string;
  metrics: HrMetricDefinition[];
}

export const HR_METRIC_CATEGORIES: HrMetricCategory[] = [
  {
    title: 'Recrutamento e Seleção',
    description: 'Mede agilidade, custo e qualidade das contratações.',
    metrics: [
      {
        name: 'Tempo de Fechamento de Vaga',
        description: 'Dias entre abertura da vaga e contratação.',
        formula: 'data_contratacao - data_abertura_vaga',
        requiredInputs: ['data_abertura_vaga', 'data_contratacao'],
      },
      {
        name: 'Custo por Contratação',
        description: 'Investimento total para preencher cada vaga.',
        formula: 'custos_recrutamento / total_contratacoes',
        requiredInputs: ['custos_recrutamento', 'total_contratacoes'],
      },
      {
        name: 'Turnover no Primeiro Ano',
        description: 'Percentual de novos funcionários que saem antes de 12 meses.',
        formula: 'desligamentos_ate_12_meses / contratacoes_12_meses',
        requiredInputs: ['data_admissao', 'data_desligamento'],
      },
      {
        name: 'Funil de Recrutamento',
        description: 'Proporção entre inscritos, entrevistados e aprovados.',
        formula: 'inscritos -> entrevistados -> aprovados',
        requiredInputs: ['candidatos_inscritos', 'candidatos_entrevistados', 'candidatos_aprovados'],
      },
    ],
  },
  {
    title: 'Retenção e Rotatividade',
    description: 'Indica estabilidade das equipes e retenção dos talentos-chave.',
    metrics: [
      {
        name: 'Taxa de Turnover',
        description: 'Percentual de colaboradores que deixam a empresa em um período.',
        formula: 'desligamentos_periodo / headcount_medio_periodo',
        requiredInputs: ['desligamentos_periodo', 'headcount_medio_periodo'],
      },
      {
        name: 'Turnover Involuntário vs. Voluntário',
        description: 'Separa saídas por decisão da empresa e por pedido do colaborador.',
        formula: 'demissoes_empresa vs pedidos_demissao',
        requiredInputs: ['motivo_desligamento'],
      },
      {
        name: 'Índice de Retenção de Talentos',
        description: 'Percentual de profissionais de alto desempenho retidos.',
        formula: 'talentos_retidos / talentos_mapeados',
        requiredInputs: ['lista_talentos', 'status_talento'],
      },
    ],
  },
  {
    title: 'Clima Organizacional e Engajamento',
    description: 'Mostra a saúde da cultura e a satisfação interna.',
    metrics: [
      {
        name: 'eNPS',
        description: 'Disposição de recomendar a empresa como local de trabalho.',
        formula: '% promotores - % detratores',
        requiredInputs: ['pesquisa_enps'],
      },
      {
        name: 'Taxa de Absenteísmo',
        description: 'Percentual de ausências e atrasos sobre o tempo total de trabalho.',
        formula: 'horas_ausentes / horas_previstas',
        requiredInputs: ['horas_ausentes', 'horas_previstas'],
      },
      {
        name: 'Índice de Clima Organizacional',
        description: 'Nota geral das pesquisas internas de satisfação.',
        formula: 'media_pesquisas_clima',
        requiredInputs: ['pesquisas_clima'],
      },
    ],
  },
  {
    title: 'Desenvolvimento e Produtividade',
    description: 'Mede evolução técnica e retorno do capital humano.',
    metrics: [
      {
        name: 'Rendimento das Horas de Treinamento',
        description: 'Horas de capacitação por colaborador no ano.',
        formula: 'horas_treinamento / colaboradores_ativos',
        requiredInputs: ['horas_treinamento', 'colaboradores_ativos'],
      },
      {
        name: 'Receita por Funcionário',
        description: 'Faturamento total dividido pelo total de colaboradores ativos.',
        formula: 'receita_total / colaboradores_ativos',
        requiredInputs: ['receita_total', 'colaboradores_ativos'],
      },
      {
        name: 'ROI de Treinamento',
        description: 'Retorno financeiro ou ganho de produtividade após capacitações.',
        formula: '(ganho_pos_treinamento - custo_treinamento) / custo_treinamento',
        requiredInputs: ['ganho_pos_treinamento', 'custo_treinamento'],
      },
    ],
  },
];

export function buildHrReadiness(users: DbUser[]) {
  const activeUsers = users.filter((user) => (user.profile?.status ?? 'ativo') === 'ativo' && user.profile?.category !== 'fornecedor');
  const withActivatedAt = activeUsers.filter((user) => Boolean(user.profile?.activatedAt)).length;
  const withDepartment = activeUsers.filter((user) => Boolean(user.profile?.department)).length;

  return {
    activeHeadcount: activeUsers.length,
    dataCoverage: {
      activatedAt: withActivatedAt,
      department: withDepartment,
    },
    availableSources: [
      withActivatedAt > 0 ? 'data_admissao_parcial' : null,
      withDepartment > 0 ? 'departamento' : null,
      'status_colaborador',
    ].filter(Boolean) as string[],
  };
}
