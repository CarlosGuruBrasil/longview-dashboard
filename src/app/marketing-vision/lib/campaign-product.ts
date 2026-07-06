// Infere o produto/empreendimento a partir do nome da campanha Meta.
// As campanhas seguem convenção de nome: "Leads [Form - Hub]", "Vendas [HUB LP]",
// "Leads [Form - Nautic]", etc. — o produto está sempre no nome.
// ponytail: mapa fixo por token; mover pra tabela de de-para se a convenção mudar.
const PRODUTO_PATTERNS: [RegExp, string][] = [
  [/hub/i, 'HUB Beira Mar'],
  [/nautic/i, 'Nautic'],
  [/sun\s*club/i, 'SunClub'],
  [/infiniti/i, 'Infiniti'],
];

export function inferProdutoDaCampanha(campaignName?: string | null): string | null {
  if (!campaignName) return null;
  for (const [re, produto] of PRODUTO_PATTERNS) {
    if (re.test(campaignName)) return produto;
  }
  return null;
}
