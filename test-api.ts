import { getInspections, MODEL_TYPES } from './src/lib/construpoint';

async function test() {
  console.log('Testing Construpoint API with getInspections...');
  try {
    const res = await getInspections({
      BeginDate: '2024-01-01',
      EndDate: '2026-12-31',
      ModelTypeId: MODEL_TYPES.FVS,
      HistoricoCompleto: false,
      CamposPersonalizados: false,
    });
    console.log(`Response type:`, typeof res);
    console.log('Response content:', res);
  } catch (err: any) {
    console.error('Error fetching data:', err.message);
  }
}

test();
