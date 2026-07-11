import { describe, expect, it } from 'vitest'
import { inferQualityScopeIds } from '@/lib/quality-scopes'

describe('inferQualityScopeIds', () => {
  it('separa empreendimentos e corporativo', () => {
    expect(inferQualityScopeIds({ obra: 'Nautic' })).toEqual(['nautic'])
    expect(inferQualityScopeIds({ obra: 'Hub Beira-Mar' })).toEqual(['hub-beira-mar'])
    expect(inferQualityScopeIds({ obra: 'LongView', local: 'Setor Financeiro' })).toEqual(['longview'])
  })

  it('divide Segurança compartilhada sem duplicar a inspeção de origem', () => {
    expect(inferQualityScopeIds({
      obra: 'LongView',
      local: 'Obras - Nautic e Hub',
      modelo: 'Segurança - Inspeção Mensal da Qualidade',
    })).toEqual(['nautic', 'hub-beira-mar'])
  })

  it('mantém FVS compartilhada ambígua sem classificação', () => {
    expect(inferQualityScopeIds({
      obra: 'LongView',
      local: 'Obras - Nautic e Hub',
      modelo: 'Pré Concretagem - Pilares',
    })).toEqual([])
  })
})
