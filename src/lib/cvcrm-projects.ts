type NamedValue = {
  nome?: string | null;
};

export type CvProjectRecord = Record<string, unknown> & {
  idempreendimento?: string | number;
  nome?: string | null;
  empreendimento?: string | null;
  tipo_empreendimento?: NamedValue[];
  situacao_comercial?: NamedValue[];
  app_exibir?: string | null;
  link_disponibilidade?: string | null;
};

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function firstName(values: NamedValue[] | undefined) {
  return normalizeText(values?.[0]?.nome);
}

export function isRealEmpreendimento(project: CvProjectRecord) {
  const id = Number(project.idempreendimento ?? 0);
  const nome = normalizeText(project.nome ?? project.empreendimento);
  const tipo = firstName(project.tipo_empreendimento);
  const situacao = firstName(project.situacao_comercial);
  const appExibir = normalizeText(project.app_exibir).toUpperCase();
  const linkDisponibilidade = normalizeText(project.link_disponibilidade);

  if (!id) return false;
  if (!nome) return false;

  // Regra base documentada: registros sem tipo ou situação comercial
  // são cadastros administrativos / centros de custo.
  if (!tipo || !situacao) return false;

  // Se o próprio CRM marca como não exibível no app, também não tratamos
  // como empreendimento publicável no ecossistema do site.
  if (appExibir === 'N') return false;

  // Heurística adicional: empreendimento publicável costuma ter ao menos
  // um link comercial/disponibilidade ou estar habilitado para exibição.
  if (!linkDisponibilidade && appExibir !== 'S') return false;

  return true;
}
