const fetch = require('node-fetch');

async function testApi() {
    const headers = { 'email': 'macabongo@gmail.com', 'token': '47224c041e3ac2dd5c4c8a0f5eabd16e70a0ef23' };
    
    // Try pagina=2
    console.log("Testing ?pagina=2&limit=5");
    let res = await fetch("https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads?limit=5&pagina=2", { headers });
    let data = await res.json();
    console.log("pagina=2 => offset:", data.offset, "leads length:", data.leads ? data.leads.length : 0);
    if(data.leads && data.leads.length > 0) console.log("First lead id:", data.leads[0].idlead);
    
    // Try offset=5
    console.log("\nTesting ?offset=5&limit=5");
    res = await fetch("https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads?limit=5&offset=5", { headers });
    data = await res.json();
    console.log("offset=5 => offset:", data.offset, "leads length:", data.leads ? data.leads.length : 0);
    if(data.leads && data.leads.length > 0) console.log("First lead id:", data.leads[0].idlead);

    // Try offset=10
    console.log("\nTesting ?offset=10&limit=5");
    res = await fetch("https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads?limit=5&offset=10", { headers });
    data = await res.json();
    console.log("offset=10 => offset:", data.offset, "leads length:", data.leads ? data.leads.length : 0);
    if(data.leads && data.leads.length > 0) console.log("First lead id:", data.leads[0].idlead);
}
testApi();
