const API_URL = "https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads?limit=500";
const HEADERS = {
    "email": "macabongo@gmail.com",
    "token": "47224c041e3ac2dd5c4c8a0f5eabd16e70a0ef23",
    "Content-Type": "application/json"
};

let allLeads = [];
let filteredLeads = [];
let growthChartInstance = null;
let salesGrowthChartInstance = null;
let originPieChartInstance = null;
let statusPieChartInstance = null;
let salesOriginPieChartInstance = null;
let genderPieChartInstance = null;
let cityPieChartInstance = null;
let civilStatePieChartInstance = null;
let marketingPieChartInstance = null;
let metaGenderChartInstance = null;
let metaAgeChartInstance = null;
let metaRegionChartInstance = null;
let currentView = 'dashboard';

const META_ACT_ID = "act_913791682330789";
const META_TOKEN = "EAANZCfDAn7TsBRQpxdZB7VJU4lmBB0Vta9UtrWJv9gdrowZBa6XjR9KZAQPddgdk2aIyhKMo12JAMrsPk1QG9ZCaoUkb0rzqqrMk51rDV3UhvDtRYZCCohpaWxaCEHMHpZAMlJaeFbWGr3DX3m3ZBRmFFipVKZBFaz04B0OcweoTsGpmAZBiZCz3MB6ZB5bZCelCZApZB2bfQZDZD";

Chart.defaults.color = '#A3A3A3';
Chart.defaults.font.family = "'Outfit', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(20, 20, 20, 0.9)';
Chart.defaults.plugins.tooltip.titleColor = '#fff';

document.addEventListener("DOMContentLoaded", () => {
    // Verificar sessão existente
    if (sessionStorage.getItem("longview_auth") === "true") {
        showApp();
    } else {
        // Eventos de Login via Formulário (permite salvar senha no navegador)
        const loginForm = document.getElementById("login-form");
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            handleLogin();
        });
    }
});

function handleLogin() {
    const user = document.getElementById("login-user").value;
    const pass = document.getElementById("login-pass").value;
    const errorMsg = document.getElementById("login-error");

    if (user === "Longview" && pass === "Guru$2026") {
        sessionStorage.setItem("longview_auth", "true");
        startLoadingSequence();
    } else {
        errorMsg.classList.remove("hidden");
        // Efeito de shake simples no card
        const card = document.querySelector(".login-card");
        card.style.animation = "none";
        setTimeout(() => { card.style.animation = "shake 0.4s"; }, 10);
    }
}

function startLoadingSequence() {
    const overlay = document.getElementById("loading-overlay");
    const login = document.getElementById("login-screen");
    const app = document.getElementById("main-app");
    const bar = document.getElementById("progress-bar");
    const loadingText = document.getElementById("loading-text");
    const insightText = document.getElementById("insight-text");

    overlay.classList.remove("hidden");
    login.classList.add("hidden");
    
    // Insights Iniciais (Genéricos)
    const initialInsights = [
        "A LongView está processando suas métricas de desempenho...",
        "Conectando aos servidores do CV CRM para dados atualizados...",
        "Preparando análise de ROI e performance de mídia..."
    ];
    
    let insightIdx = 0;
    const insightInterval = setInterval(() => {
        if (!insightText) return;
        const currentList = window.realInsights && window.realInsights.length > 0 ? window.realInsights : initialInsights;
        insightIdx = (insightIdx + 1) % currentList.length;
        
        insightText.style.opacity = 0;
        setTimeout(() => {
            insightText.innerText = currentList[insightIdx];
            insightText.style.opacity = 1;
        }, 500);
    }, 3500);

    // Simular progresso
    let width = 0;
    const interval = setInterval(() => {
        if (width >= 90) clearInterval(interval);
        else {
            width += Math.random() * 5;
            bar.style.width = Math.min(width, 90) + "%";
        }
    }, 200);

    loadingText.innerText = "Conectando ao CV CRM...";

    fetchCRMData().then(() => {
        // Gerar Insights Reais após o primeiro fetch
        generateRealInsights();
        loadingText.innerText = `Analisando ${allLeads.length} leads e calculando métricas...`;
        return fetchMetaAdsData();
    }).then(() => {
        clearInterval(interval);
        clearInterval(insightInterval);
        bar.style.width = "100%";
        loadingText.innerText = "Sincronização Completa!";
        
        setTimeout(() => {
            overlay.classList.add("hidden");
            app.classList.remove("hidden");
            setupEventListeners();
        }, 800);
    }).catch(err => {
        console.error("Erro:", err);
        clearInterval(insightInterval);
        loadingText.innerText = "Erro na conexão.";
    });
}

function generateRealInsights() {
    if (!allLeads || allLeads.length === 0) return;

    const sales = allLeads.filter(l => isSale(l));
    const totalValue = sales.reduce((acc, l) => acc + (parseFloat(l.valor_negocio) || 0), 0);
    
    // Encontrar empreendimento campeão
    const empCount = {};
    sales.forEach(s => {
        const name = s.empreendimento ? s.empreendimento.nome : 'N/A';
        empCount[name] = (empCount[name] || 0) + 1;
    });
    const topEmp = Object.entries(empCount).sort((a,b) => b[1]-a[1])[0];

    // Encontrar melhor origem
    const originCount = {};
    allLeads.forEach(l => {
        const name = l.origem ? l.origem.nome : 'N/A';
        originCount[name] = (originCount[name] || 0) + 1;
    });
    const topOrigin = Object.entries(originCount).sort((a,b) => b[1]-a[1])[0];

    window.realInsights = [
        `Temos um total de ${allLeads.length} leads ativos na base de dados.`,
        `O ticket médio das vendas atuais está em ${formatCurrency(totalValue / (sales.length || 1))}.`,
        `O empreendimento "${topEmp ? topEmp[0] : 'N/A'}" é o campeão de vendas até o momento.`,
        `A origem "${topOrigin ? topOrigin[0] : 'N/A'}" é a sua maior fonte de novos contatos.`,
        `Já processamos ${formatCurrency(totalValue)} em volume total de vendas transacionadas.`
    ];
    
    // Forçar atualização imediata do texto de insight se possível
    const insightText = document.getElementById("insight-text");
    if (insightText) {
        insightText.style.opacity = 0;
        setTimeout(() => {
            insightText.innerText = window.realInsights[0];
            insightText.style.opacity = 1;
        }, 500);
    }
}

function showApp() {
    // Se já estiver logado, faz o fluxo de carregamento rápido
    startLoadingSequence();
}

function setupEventListeners() {
    // Configurar eventos do Dashboard
    const refreshBtn = document.getElementById("refresh-btn");
    if (refreshBtn.getAttribute('data-events-set')) return; // Evitar duplicar
    refreshBtn.setAttribute('data-events-set', 'true');

    refreshBtn.addEventListener("click", fetchCRMData);
    document.getElementById("filter-btn").addEventListener("click", applyGlobalFilters);
    document.getElementById("clear-date-btn").addEventListener("click", () => {
        document.getElementById("start-date").value = "";
        document.getElementById("end-date").value = "";
        applyGlobalFilters();
    });
    
    document.getElementById("growth-period").addEventListener("change", renderGrowthChart);
    document.getElementById("sales-growth-period").addEventListener("change", renderSalesGrowthChart);

    // Navegação Lateral
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            navItems.forEach(n => n.classList.remove("active"));
            item.classList.add("active");
            
            const viewName = item.getAttribute("data-view");
            switchView(viewName);
        });
    });

    // Filtros de Coluna (Leads)
    document.querySelectorAll(".col-filter").forEach(input => {
        input.addEventListener("input", applyTableFilters);
    });

    // Filtros de Coluna (Vendas)
    document.querySelectorAll(".col-filter-sales").forEach(input => {
        input.addEventListener("input", applySalesTableFilters);
    });
}

// Helpers
function isSale(lead) {
    if (!lead.situacao || !lead.situacao.nome) return false;
    const s = lead.situacao.nome.toLowerCase();
    return s === "venda realizada" || s.includes("negócio ganho") || s.includes("negocio ganho") || s.includes("vendid");
}

function getOrigin(lead) {
    // Priorizando a mídia de visita conforme solicitado, depois fallback
    return lead.midia_visita || lead.midia_principal || lead.origem || "Desconhecido";
}

function getStatusColor(input) {
    let name = "";
    let apiColor = null;

    if (typeof input === 'object' && input !== null) {
        name = input.situacao && input.situacao.nome ? input.situacao.nome : "";
        apiColor = input.situacao && input.situacao.cor ? input.situacao.cor : null;
    } else {
        name = String(input);
    }

    // Se a API trouxer a cor exata do CV CRM, usamos ela (Prioridade máxima)
    if (apiColor && apiColor !== "" && apiColor !== "#" && apiColor !== "null") {
        return { bg: apiColor, text: "#FFFFFF" };
    }

    const s = name.toLowerCase();
    
    // Cores Oficiais CV CRM (conforme fotos enviadas)
    if (s === "aguardando atendimento") return { bg: "#FF0F47", text: "#FFFFFF" };
    if (s.includes("sdr")) return { bg: "#00E676", text: "#000000" };
    if (s.includes("aguardando atendimento corretor")) return { bg: "#FFEA00", text: "#000000" }; 
    if (s === "em atendimento") return { bg: "#FF8A00", text: "#FFFFFF" };
    if (s.includes("visita agendada")) return { bg: "#00B0FF", text: "#FFFFFF" };
    if (s.includes("visita realizada")) return { bg: "#00897B", text: "#FFFFFF" };
    if (s.includes("simula")) return { bg: "#FF5252", text: "#FFFFFF" };
    if (s.includes("reserva")) return { bg: "#2979FF", text: "#FFFFFF" };
    if (s === "venda realizada" || s.includes("vendid") || s.includes("ganho")) return { bg: "#FFFFFF", text: "#000000" };
    
    return { bg: "rgba(255, 255, 255, 0.1)", text: "#A3A3A3" };
}

async function fetchCRMData() {
    const loaderText = document.querySelector('#loader p');
    const loaderContainer = document.getElementById("loader");
    
    // 1. Tenta carregar do Cache primeiro para acesso instantâneo
    const cached = localStorage.getItem("cvcrm_leads_cache");
    if (cached) {
        try {
            allLeads = JSON.parse(cached);
            applyGlobalFilters();
            hideLoader(); // Mostra o painel instantaneamente
            
            // Ativa o mini-loader no canto da tela
            if (loaderText) loaderText.textContent = "Atualizando dados em segundo plano...";
            loaderContainer.classList.add("background-sync");
            loaderContainer.classList.remove("hidden");
        } catch(e) {
            console.error("Erro ao ler cache", e);
            showLoader();
        }
    } else {
        showLoader();
        if (loaderText) loaderText.textContent = "Buscando dados no CV CRM...";
    }
    
    // 2. Busca dados frescos da API
    try {
        let tempLeads = [];
        let limit = 500;
        let currentOffset = 0;
        let totalLeads = 0;
        let keepFetching = true;

        while(keepFetching) {
            const response = await fetch(`${API_URL}&offset=${currentOffset}`, { method: "GET", headers: HEADERS });
            if (!response.ok) throw new Error(`Erro na requisição: ${response.status}`);
            
            const data = await response.json();
            
            if (totalLeads === 0 && data.total) {
                totalLeads = data.total;
            }

            if (data.leads && data.leads.length > 0) {
                tempLeads = tempLeads.concat(data.leads);
                currentOffset += limit;
                
                // Só atualiza o texto se não estiver no background sync
                if (loaderText && totalLeads > 0 && !cached) {
                    loaderText.textContent = `Sincronizando banco de dados... (${tempLeads.length} de ${totalLeads} leads)`;
                }
                
                if (tempLeads.length >= totalLeads || data.leads.length < limit) {
                    keepFetching = false;
                }
            } else {
                keepFetching = false;
            }
        }
        
        // 3. Substitui os dados antigos pelos novos e salva no cache
        allLeads = tempLeads;
        try {
            localStorage.setItem("cvcrm_leads_cache", JSON.stringify(allLeads));
        } catch(e) {
            console.warn("Limite de armazenamento atingido, não foi possível fazer cache de tudo.");
        }
        
        applyGlobalFilters();
    } catch (error) {
        console.error("Erro na sincronização:", error);
        if (!cached) {
            alert("Erro ao buscar dados do CV CRM.");
        }
    } finally {
        if (loaderText) loaderText.textContent = "Buscando dados no CV CRM..."; 
        loaderContainer.classList.remove("background-sync");
        hideLoader();
    }
}

function applyGlobalFilters() {
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;
    
    filteredLeads = allLeads;
    
    if (startDate || endDate) {
        filteredLeads = allLeads.filter(lead => {
            if (!lead.data_cad) return false;
            const leadDateStr = lead.data_cad.split(' ')[0];
            const leadDate = new Date(leadDateStr);
            let isAfterStart = true, isBeforeEnd = true;
            if (startDate) isAfterStart = leadDate >= new Date(startDate);
            if (endDate) isBeforeEnd = leadDate <= new Date(endDate);
            return isAfterStart && isBeforeEnd;
        });
    }
    
    updateDashboard(filteredLeads);
    populateDropdowns(filteredLeads);
    applyTableFilters(); // Atualiza tabela de leads respeitando filtros das colunas
    applySalesTableFilters(); // Atualiza tabela de vendas

    fetchMetaAdsData(document.getElementById("start-date").value, document.getElementById("end-date").value);
}

function populateDropdowns(leadsArray) {
    const uniqueValues = {
        origem: new Set(),
        corretor: new Set(),
        gestor: new Set(),
        imobiliaria: new Set(),
        empreendimento: new Set(),
        status: new Set()
    };
    
    leadsArray.forEach(lead => {
        uniqueValues.origem.add(getOrigin(lead));
        if(lead.corretor && lead.corretor.nome) uniqueValues.corretor.add(lead.corretor.nome);
        if(lead.gestor && lead.gestor.nome) uniqueValues.gestor.add(lead.gestor.nome);
        if(lead.imobiliaria && lead.imobiliaria.nome) uniqueValues.imobiliaria.add(lead.imobiliaria.nome);
        if(lead.empreendimento && lead.empreendimento.length > 0) uniqueValues.empreendimento.add(lead.empreendimento[0].nome);
        if(lead.situacao && lead.situacao.nome) uniqueValues.status.add(lead.situacao.nome);
    });
    
    document.querySelectorAll("select.col-filter, select.col-filter-sales").forEach(select => {
        const col = select.getAttribute("data-col");
        const currentValue = select.value;
        
        if (uniqueValues[col]) {
            const sorted = Array.from(uniqueValues[col]).sort();
            select.innerHTML = '<option value="">Todos</option>';
            sorted.forEach(val => {
                const option = document.createElement("option");
                option.value = val.toLowerCase();
                option.textContent = val;
                if (val.toLowerCase() === currentValue) option.selected = true;
                select.appendChild(option);
            });
        }
    });
}

function updateDashboard(leads) {
    let totalVendasQtd = 0;
    let totalVisitas = 0;
    let valorTotalVendas = 0;
    
    const origins = {};
    const statuses = {};

    leads.forEach(lead => {
        const statusName = (lead.situacao && lead.situacao.nome) ? lead.situacao.nome : "Desconhecido";
        const originName = getOrigin(lead);
        
        // Contadores
        origins[originName] = (origins[originName] || 0) + 1;
        statuses[statusName] = (statuses[statusName] || 0) + 1;

        // Regras KPI
        if (isSale(lead)) {
            totalVendasQtd++;
            if (lead.valor_negocio) {
                const numStr = lead.valor_negocio.replace(/\./g, '').replace(',', '.');
                const num = parseFloat(numStr);
                if (!isNaN(num)) valorTotalVendas += num;
            }
        }
        
        if (statusName.toLowerCase().includes("visita")) {
            totalVisitas++;
        }
    });

    // Atualiza HTML KPIs
    document.getElementById("kpi-leads").textContent = leads.length;
    document.getElementById("kpi-vendas-qtd").textContent = totalVendasQtd;
    document.getElementById("kpi-visitas").textContent = totalVisitas;
    document.getElementById("kpi-valor-vendas").textContent = formatCurrency(valorTotalVendas);

    // Renderizar Gráficos de Pizza
    renderOriginPieChart(origins);
    renderStatusPieChart(statuses);
    renderSalesOriginPieChart(leads);

    // Gráficos de Crescimento
    renderGrowthChart();
    renderSalesGrowthChart();

    // Resumos de Etapas
    renderLeadsSummary(leads);
    renderSalesSummary(leads.filter(l => isSale(l)));
}

function renderOriginPieChart(origins) {
    const ctx = document.getElementById('originPieChart');
    if(!ctx) return;
    
    const sorted = Object.entries(origins).sort((a, b) => b[1] - a[1]);
    const data = sorted.map(item => item[1]);
    const total = data.reduce((acc, val) => acc + val, 0);
    const labels = sorted.map((item, i) => {
        const perc = total > 0 ? ((data[i] / total) * 100).toFixed(1) : 0;
        return `${item[0]} (${perc}%)`;
    });
    
    if (originPieChartInstance) originPieChartInstance.destroy();
    
    originPieChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        plugins: [ChartDataLabels],
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#0D9488', '#F59E0B', '#10B981', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6', '#F43F5E', '#0ea5e9', '#84cc16'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 11 },
                    formatter: (value, context) => {
                        const sum = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                        const perc = (value / sum * 100).toFixed(1);
                        return perc >= 4 ? perc + '%' : '';
                    }
                },
                legend: { position: 'right', labels: { color: '#e5e5e5', boxWidth: 12, font: { size: 11 } } },
                tooltip: { callbacks: { label: function(context) { return ' ' + context.label + ': ' + context.raw + ' leads'; } } }
            }
        }
    });
}

function renderStatusPieChart(statuses) {
    const ctx = document.getElementById('statusPieChart');
    if(!ctx) return;
    
    const sorted = Object.entries(statuses).sort((a, b) => b[1] - a[1]);
    const data = sorted.map(item => item[1]);
    const total = data.reduce((acc, val) => acc + val, 0);
    
    const labels = sorted.map((item, i) => {
        const perc = total > 0 ? ((data[i] / total) * 100).toFixed(1) : 0;
        return `${item[0]} (${perc}%)`;
    });
    
    const colors = sorted.map(item => getStatusColor(item[0]).bg);
    
    if (statusPieChartInstance) statusPieChartInstance.destroy();
    
    statusPieChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        plugins: [ChartDataLabels],
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 11 },
                    formatter: (value, context) => {
                        const sum = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                        const perc = (value / sum * 100).toFixed(1);
                        return perc >= 4 ? perc + '%' : '';
                    }
                },
                legend: { position: 'right', labels: { color: '#e5e5e5', boxWidth: 12, font: { size: 11 } } },
                tooltip: { callbacks: { label: function(context) { return ' ' + context.label + ': ' + context.raw + ' leads'; } } }
            }
        }
    });
}

function renderSalesOriginPieChart(leads) {
    const ctx = document.getElementById('salesOriginPieChart');
    if(!ctx) return;
    
    const salesOnly = leads.filter(l => isSale(l));
    const origins = {};
    salesOnly.forEach(lead => {
        const originName = getOrigin(lead);
        origins[originName] = (origins[originName] || 0) + 1;
    });
    
    if (Object.keys(origins).length === 0) return;

    const sorted = Object.entries(origins).sort((a, b) => b[1] - a[1]);
    const data = sorted.map(item => item[1]);
    const total = data.reduce((acc, val) => acc + val, 0);
    
    const labels = sorted.map((item, i) => {
        const perc = total > 0 ? ((data[i] / total) * 100).toFixed(1) : 0;
        return `${item[0]} (${perc}%)`;
    });
    
    if (salesOriginPieChartInstance) salesOriginPieChartInstance.destroy();
    
    salesOriginPieChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        plugins: [ChartDataLabels],
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#10B981', '#0ea5e9', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#0D9488', '#F43F5E', '#84cc16'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 11 },
                    formatter: (value, context) => {
                        const sum = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                        const perc = (value / sum * 100).toFixed(1);
                        return perc >= 4 ? perc + '%' : '';
                    }
                },
                legend: { position: 'right', labels: { color: '#e5e5e5', boxWidth: 12, font: { size: 11 } } },
                tooltip: { callbacks: { label: function(context) { return ' ' + context.label + ': ' + context.raw + ' vendas'; } } }
            }
        }
    });
}

function renderGrowthChart() {
    const periodType = document.getElementById("growth-period").value; // 'month' ou 'year'
    const ctx = document.getElementById('growthChart').getContext('2d');
    
    const salesOnly = filteredLeads.filter(l => isSale(l));
    if (growthChartInstance) growthChartInstance.destroy();

    if (periodType === 'month') {
        const yearsData = {};
        salesOnly.forEach(lead => {
            if (!lead.data_cad) return;
            // The split ensures we get YYYY-MM-DD reliably if it's the standard format
            const dateStr = lead.data_cad.split(' ')[0]; 
            const parts = dateStr.split('-');
            if(parts.length < 3) return;
            
            const y = parts[0];
            const m = parseInt(parts[1], 10) - 1; // 0-11
            
            if (!yearsData[y]) yearsData[y] = Array(12).fill(0);
            yearsData[y][m]++;
        });
        
        const monthsLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const datasets = [];
        const colors = ['#0D9488', '#F59E0B', '#6366F1', '#EC4899', '#10B981', '#F43F5E'];
        
        let colorIndex = 0;
        Object.keys(yearsData).sort().forEach(year => {
            datasets.push({
                label: `Vendas ${year}`,
                data: yearsData[year],
                borderColor: colors[colorIndex % colors.length],
                backgroundColor: 'transparent',
                borderWidth: 3,
                tension: 0.4
            });
            colorIndex++;
        });
        
        growthChartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: monthsLabels, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, labels: { color: '#e5e5e5' } }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    } else {
        // Ano a Ano (Soma Total por Ano)
        const groupedSales = groupLeadsByDate(salesOnly, 'year');
        const labels = Object.keys(groupedSales).sort();
        const salesData = labels.map(label => groupedSales[label] || 0);

        growthChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Vendas Totais',
                        data: salesData,
                        backgroundColor: '#10B981',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

function renderSalesGrowthChart() {
    const periodType = document.getElementById("sales-growth-period").value;
    const ctx = document.getElementById('salesGrowthChart').getContext('2d');
    
    const salesOnly = filteredLeads.filter(l => isSale(l));

    if (salesGrowthChartInstance) salesGrowthChartInstance.destroy();

    if (periodType === 'month') {
        const yearsData = {};
        salesOnly.forEach(lead => {
            if (!lead.data_cad) return;
            const dateStr = lead.data_cad.split(' ')[0]; 
            const parts = dateStr.split('-');
            if(parts.length < 3) return;
            
            const y = parts[0];
            const m = parseInt(parts[1], 10) - 1; // 0-11
            
            if (!yearsData[y]) yearsData[y] = Array(12).fill(0);
            yearsData[y][m]++;
        });
        
        const monthsLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const datasets = [];
        const colors = ['#0D9488', '#F59E0B', '#6366F1', '#EC4899', '#10B981', '#F43F5E'];
        
        let colorIndex = 0;
        Object.keys(yearsData).sort().forEach(year => {
            datasets.push({
                label: `Vendas ${year}`,
                data: yearsData[year],
                borderColor: colors[colorIndex % colors.length],
                backgroundColor: 'transparent',
                borderWidth: 3,
                tension: 0.4
            });
            colorIndex++;
        });
        
        salesGrowthChartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: monthsLabels, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, labels: { color: '#e5e5e5' } }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    } else {
        const groupedSales = groupLeadsByDate(salesOnly, 'year');
        const labels = Object.keys(groupedSales).sort();
        const salesData = labels.map(label => groupedSales[label] || 0);

        salesGrowthChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Qtd. de Vendas',
                    data: salesData,
                    backgroundColor: '#10B981',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

function groupLeadsByDate(leadsArray, periodType) {
    const counts = {};
    leadsArray.forEach(lead => {
        if (!lead.data_cad) return;
        const dateObj = new Date(lead.data_cad.split(' ')[0]);
        let key = "";
        if (periodType === 'month') {
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const y = dateObj.getFullYear();
            key = `${m}/${y}`;
        } else {
            key = `${dateObj.getFullYear()}`;
        }
        counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
}

// Lógica de Tabela Avançada (Filtros por Coluna)
function applyTableFilters() {
    const filters = {};
    document.querySelectorAll(".col-filter").forEach(input => {
        if(input.value.trim() !== "") {
            filters[input.getAttribute("data-col")] = input.value.toLowerCase().trim();
        }
    });

    const finalLeads = filteredLeads.filter(lead => {
        const name = (lead.nome || "").toLowerCase();
        
        let dataCadFormatted = "";
        if (lead.data_cad) {
            const parts = lead.data_cad.split(' ')[0].split('-');
            if (parts.length === 3) dataCadFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        
        const origem = getOrigin(lead).toLowerCase();
        const corretor = (lead.corretor && lead.corretor.nome ? lead.corretor.nome : "").toLowerCase();
        const gestor = (lead.gestor && lead.gestor.nome ? lead.gestor.nome : "").toLowerCase();
        const imobiliaria = (lead.imobiliaria && lead.imobiliaria.nome ? lead.imobiliaria.nome : "").toLowerCase();
        const emp = (lead.empreendimento && lead.empreendimento.length > 0 ? lead.empreendimento[0].nome : "").toLowerCase();
        const status = (lead.situacao && lead.situacao.nome ? lead.situacao.nome : "").toLowerCase();

        if (filters["nome"] && !name.includes(filters["nome"])) return false;
        if (filters["data"] && !dataCadFormatted.includes(filters["data"])) return false;
        if (filters["origem"] && origem !== filters["origem"]) return false;
        if (filters["corretor"] && corretor !== filters["corretor"]) return false;
        if (filters["gestor"] && gestor !== filters["gestor"]) return false;
        if (filters["imobiliaria"] && imobiliaria !== filters["imobiliaria"]) return false;
        if (filters["empreendimento"] && emp !== filters["empreendimento"]) return false;
        if (filters["status"] && status !== filters["status"]) return false;

        return true;
    });

    renderTable(finalLeads, "table-leads-body");
    renderLeadsSummary(finalLeads);
    renderDemographicCharts(finalLeads);
}

function renderDemographicCharts(leadsArray) {
    const genders = {};
    const cities = {};
    const civilStates = {};
    
    leadsArray.forEach(lead => {
        // Gênero
        let g = "Não Informado";
        if (lead.cliente && lead.cliente.sexo) g = lead.cliente.sexo;
        else if (lead.sexo) g = lead.sexo;
        
        if (g.toLowerCase() === 'm' || g.toLowerCase() === 'masculino') g = "Masculino";
        else if (g.toLowerCase() === 'f' || g.toLowerCase() === 'feminino') g = "Feminino";
        
        genders[g] = (genders[g] || 0) + 1;
        
        // Cidade
        let c = "Não Informada";
        if (lead.cliente && lead.cliente.cidade) c = lead.cliente.cidade;
        else if (lead.cidade) c = lead.cidade;
        cities[c] = (cities[c] || 0) + 1;
        
        // Estado Civil
        let s = "Não Informado";
        if (lead.cliente && lead.cliente.estado_civil) s = lead.cliente.estado_civil;
        else if (lead.estado_civil) s = lead.estado_civil;
        civilStates[s] = (civilStates[s] || 0) + 1;
    });

    renderGenericPieChart('genderPieChart', genders, genderPieChartInstance, (inst) => genderPieChartInstance = inst);
    renderGenericPieChart('cityPieChart', getTopN(cities, 5), cityPieChartInstance, (inst) => cityPieChartInstance = inst);
    renderGenericPieChart('civilStatePieChart', civilStates, civilStatePieChartInstance, (inst) => civilStatePieChartInstance = inst);
}

function getTopN(obj, n) {
    const sorted = Object.entries(obj).sort((a,b) => b[1] - a[1]);
    const top = sorted.slice(0, n);
    const others = sorted.slice(n).reduce((acc, val) => acc + val[1], 0);
    const res = {};
    top.forEach(([k, v]) => res[k] = v);
    if (others > 0) res["Outras"] = others;
    return res;
}

function renderGenericPieChart(canvasId, dataObj, chartInstance, setInstanceCallback) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    const sorted = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return;
    
    const data = sorted.map(item => item[1]);
    const total = data.reduce((acc, val) => acc + val, 0);
    
    const labels = sorted.map((item, i) => {
        const perc = total > 0 ? ((data[i] / total) * 100).toFixed(1) : 0;
        return `${item[0]} (${perc}%)`;
    });
    
    if (chartInstance) chartInstance.destroy();
    
    const newInst = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        plugins: [ChartDataLabels],
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#0ea5e9', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#6366F1', '#0D9488', '#F43F5E'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 10 },
                    formatter: (value, context) => {
                        const sum = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                        const perc = (value / sum * 100).toFixed(1);
                        return perc >= 5 ? perc + '%' : '';
                    }
                },
                legend: { position: 'right', labels: { color: '#e5e5e5', boxWidth: 10, font: { size: 10 } } },
                tooltip: { callbacks: { label: function(context) { return ' ' + context.label + ': ' + context.raw + ' leads'; } } }
            }
        }
    });
    setInstanceCallback(newInst);
}

function renderLeadsSummary(leadsArray) {
    const container = document.getElementById("leads-summary-container");
    if (!container) return;

    const statuses = {};
    leadsArray.forEach(lead => {
        const s = lead.situacao && lead.situacao.nome ? lead.situacao.nome : "Desconhecido";
        statuses[s] = (statuses[s] || 0) + 1;
    });

    const priorityStatuses = ["Visita Agendada", "Com Reserva"];
    
    let html = `<div class="summary-box total-box"><span class="title">Total de Leads</span><span class="count">${leadsArray.length}</span></div>`;

    priorityStatuses.forEach(name => {
        const count = statuses[name] || 0;
        const colors = getStatusColor(name);
        html += `<div class="summary-box" style="border-bottom: 3px solid ${colors.bg}"><span class="title" style="color: ${colors.bg}">${name}</span><span class="count">${count}</span></div>`;
    });

    const exclude = ["Aguardando Atendimento Corretor", "Em Atendimento SDR", ...priorityStatuses];
    Object.entries(statuses).filter(([name]) => !exclude.includes(name)).sort((a,b) => b[1]-a[1]).slice(0, 5).forEach(([name, count]) => {
        const colors = getStatusColor(name);
        html += `<div class="summary-box" style="border-bottom: 3px solid ${colors.bg}"><span class="title" style="color: ${colors.bg}">${name}</span><span class="count">${count}</span></div>`;
    });

    container.innerHTML = html;
}

function renderSalesSummary(salesArray) {
    const container = document.getElementById("sales-summary-container");
    if (!container) return;

    const totalVGV = salesArray.reduce((acc, lead) => acc + (parseFloat(lead.valor_negocio) || 0), 0);

    container.innerHTML = `
        <div class="summary-box total-box">
            <span class="title">Qtd. de Vendas</span>
            <span class="count">${salesArray.length}</span>
        </div>
        <div class="summary-box" style="border-bottom: 3px solid #10B981; flex: 1.5; min-width: 250px;">
            <span class="title" style="color: #10B981">VGV Total (Filtrado)</span>
            <span class="count">${formatCurrency(totalVGV)}</span>
        </div>
    `;
}

function applySalesTableFilters() {
    const salesLeads = filteredLeads.filter(l => isSale(l));

    const filters = {};
    document.querySelectorAll(".col-filter-sales").forEach(input => {
        if(input.value.trim() !== "") {
            filters[input.getAttribute("data-col")] = input.value.toLowerCase().trim();
        }
    });

    const finalSales = salesLeads.filter(lead => {
        const name = (lead.nome || "").toLowerCase();
        
        let dataCadFormatted = "";
        if (lead.data_cad) {
            const parts = lead.data_cad.split(' ')[0].split('-');
            if (parts.length === 3) dataCadFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        
        const origem = getOrigin(lead).toLowerCase();
        const corretor = (lead.corretor && lead.corretor.nome ? lead.corretor.nome : "").toLowerCase();
        const gestor = (lead.gestor && lead.gestor.nome ? lead.gestor.nome : "").toLowerCase();
        const imobiliaria = (lead.imobiliaria && lead.imobiliaria.nome ? lead.imobiliaria.nome : "").toLowerCase();
        const emp = (lead.empreendimento && lead.empreendimento.length > 0 ? lead.empreendimento[0].nome : "").toLowerCase();

        if (filters["nome"] && !name.includes(filters["nome"])) return false;
        if (filters["data"] && !dataCadFormatted.includes(filters["data"])) return false;
        if (filters["origem"] && origem !== filters["origem"]) return false;
        if (filters["corretor"] && corretor !== filters["corretor"]) return false;
        if (filters["gestor"] && gestor !== filters["gestor"]) return false;
        if (filters["imobiliaria"] && imobiliaria !== filters["imobiliaria"]) return false;
        if (filters["empreendimento"] && emp !== filters["empreendimento"]) return false;

        return true;
    });

    renderTable(finalSales, "table-sales-body");
    renderTop5(finalSales);
    renderSalesSummary(finalSales);
}

function renderTop5(salesLeads) {
    const corretores = {};
    const imobiliarias = {};
    const empreendimentos = {};
    const gestores = {};
    const tipologias = {};
    
    salesLeads.forEach(lead => {
        const cName = lead.corretor && lead.corretor.nome ? lead.corretor.nome : "Sem Corretor";
        const iName = lead.imobiliaria && lead.imobiliaria.nome ? lead.imobiliaria.nome : "Sem Imobiliária";
        const eName = lead.empreendimento && lead.empreendimento.length > 0 ? lead.empreendimento[0].nome : "Sem Empreendimento";
        const gName = lead.gestor && lead.gestor.nome ? lead.gestor.nome : "Sem Gestor";
        
        let tName = "-";
        if (lead.empreendimento && lead.empreendimento.length > 0 && lead.empreendimento[0].tipologia) {
            tName = lead.empreendimento[0].tipologia;
        } else if (lead.tipologia) {
            tName = lead.tipologia;
        }
        if (tName === "-" || !tName) tName = "Não Informada";
        
        let val = 0;
        if (lead.valor_negocio) {
            val = parseFloat(lead.valor_negocio.replace(/\./g, '').replace(',', '.'));
            if (isNaN(val)) val = 0;
        }
        
        if (!corretores[cName]) corretores[cName] = { sum: 0, count: 0 };
        if (!imobiliarias[iName]) imobiliarias[iName] = { sum: 0, count: 0 };
        if (!empreendimentos[eName]) empreendimentos[eName] = { sum: 0, count: 0 };
        if (!gestores[gName]) gestores[gName] = { sum: 0, count: 0 };
        if (!tipologias[tName]) tipologias[tName] = { sum: 0, count: 0 };

        corretores[cName].sum += val; corretores[cName].count++;
        imobiliarias[iName].sum += val; imobiliarias[iName].count++;
        empreendimentos[eName].sum += val; empreendimentos[eName].count++;
        gestores[gName].sum += val; gestores[gName].count++;
        tipologias[tName].sum += val; tipologias[tName].count++;
    });

    const topCorretores = Object.entries(corretores).sort((a,b) => b[1].sum - a[1].sum).slice(0,5);
    const topImobiliarias = Object.entries(imobiliarias).sort((a,b) => b[1].sum - a[1].sum).slice(0,5);
    const topEmpreendimentos = Object.entries(empreendimentos).sort((a,b) => b[1].sum - a[1].sum).slice(0,5);
    const topGestores = Object.entries(gestores).sort((a,b) => b[1].sum - a[1].sum).slice(0,5);
    const topTipologias = Object.entries(tipologias).sort((a,b) => b[1].sum - a[1].sum).slice(0,5);

    renderRanking("top-corretores", topCorretores);
    renderRanking("top-imobiliarias", topImobiliarias);
    renderRanking("top-empreendimentos", topEmpreendimentos);
    renderRanking("top-gestores", topGestores);
    renderRanking("top-tipologias", topTipologias);
}

function renderRanking(containerId, list) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    
    list.forEach(([name, data], idx) => {
        const item = document.createElement("div");
        item.className = "list-item";
        item.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-weight: 600; font-size: 14px;">${idx + 1}º ${name}</span>
                <span style="font-size: 11px; color: var(--text-secondary); opacity: 0.8;">${data.count} vendas</span>
            </div>
            <span class="value" style="color: #10B981; font-weight: 700;">${formatCurrency(data.sum)}</span>
        `;
        container.appendChild(item);
    });
}

function renderTable(leadsArray, tbodyId, limit = null) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    tbody.innerHTML = "";
    
    const arrayToRender = limit ? leadsArray.slice(0, limit) : leadsArray;
    
    arrayToRender.forEach(lead => {
        const tr = document.createElement("tr");
        
        const name = lead.nome || "Sem nome";
        
        let dataCad = "-";
        if (lead.data_cad) {
            const parts = lead.data_cad.split(' ')[0].split('-');
            if (parts.length === 3) dataCad = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        let emp = "-";
        let unidade = "-";
        let tipologia = "-";
        if (lead.empreendimento && lead.empreendimento.length > 0) {
            emp = lead.empreendimento[0].nome;
            if (lead.empreendimento[0].unidade) unidade = lead.empreendimento[0].unidade;
            if (lead.empreendimento[0].tipologia) tipologia = lead.empreendimento[0].tipologia;
        } else {
            if (lead.unidade) unidade = lead.unidade;
            if (lead.tipologia) tipologia = lead.tipologia;
        }
        
        const source = getOrigin(lead);
        const corretor = (lead.corretor && lead.corretor.nome) ? lead.corretor.nome : "-";
        const imobiliaria = (lead.imobiliaria && lead.imobiliaria.nome) ? lead.imobiliaria.nome : "-";
        const gestor = (lead.gestor && lead.gestor.nome) ? lead.gestor.nome : "-";
        
        let valStr = lead.valor_negocio || "0,00";
        const valFormatted = `R$ ${valStr}`;
        
        const statusName = lead.situacao && lead.situacao.nome ? lead.situacao.nome : "Novo";
        const colors = getStatusColor(lead);
        
        if (tbodyId === "table-sales-body") {
            tr.innerHTML = `
                <td><strong>${name}</strong></td>
                <td>${dataCad}</td>
                <td><span class="status-badge" style="background-color: ${colors.bg}; color: ${colors.text}; border: 1px solid rgba(255,255,255,0.1);">${statusName}</span></td>
                <td>${source}</td>
                <td>${corretor}</td>
                <td>${imobiliaria}</td>
                <td>${gestor}</td>
                <td>${emp}</td>
                <td><strong>${unidade}</strong></td>
                <td><span style="color:var(--text-secondary);font-size:13px;">${tipologia}</span></td>
                <td><strong style="color: #10B981;">${valFormatted}</strong></td>
            `;
        } else {
            tr.innerHTML = `
                <td><strong>${name}</strong></td>
                <td>${dataCad}</td>
                <td><span class="status-badge" style="background-color: ${colors.bg}; color: ${colors.text}; border: 1px solid rgba(255,255,255,0.1);">${statusName}</span></td>
                <td>${source}</td>
                <td>${corretor}</td>
                <td>${imobiliaria}</td>
                <td>${gestor}</td>
                <td>${emp}</td>
                <td>${valFormatted}</td>
            `;
        }
        
        tbody.appendChild(tr);
    });
}

// ==========================================
// META ADS INTEGRATION
// ==========================================
async function fetchMetaAdsData(startDateStr, endDateStr) {
    try {
        let datePart = "";
        if (startDateStr || endDateStr) {
            let since = startDateStr || '2010-01-01';
            let until = endDateStr || new Date().toISOString().split('T')[0];
            const timeRangeObj = { since: since, until: until };
            datePart = `time_range=${encodeURIComponent(JSON.stringify(timeRangeObj))}`;
        } else {
            datePart = "date_preset=maximum";
        }

        const urlGlobal = `https://graph.facebook.com/v19.0/${META_ACT_ID}/insights?fields=spend,impressions,clicks,cpc,cpm,ctr,actions&${datePart}&access_token=${META_TOKEN}`;
        const urlCampaigns = `https://graph.facebook.com/v19.0/${META_ACT_ID}/insights?level=campaign&fields=campaign_name,spend,impressions,clicks,cpc,cpm,ctr,actions,date_start,date_stop&${datePart}&access_token=${META_TOKEN}`;
        const urlDemo = `https://graph.facebook.com/v19.0/${META_ACT_ID}/insights?fields=clicks,impressions&breakdowns=gender,age&${datePart}&access_token=${META_TOKEN}`;
        const urlRegion = `https://graph.facebook.com/v19.0/${META_ACT_ID}/insights?fields=clicks,impressions&breakdowns=region&${datePart}&access_token=${META_TOKEN}`;

        const [resGlobal, resCampaigns, resDemo, resRegion] = await Promise.all([
            fetch(urlGlobal),
            fetch(urlCampaigns),
            fetch(urlDemo),
            fetch(urlRegion)
        ]);
        
        const dataGlobal = await resGlobal.json();
        const dataCampaigns = await resCampaigns.json();
        const dataDemo = await resDemo.json();
        const dataRegion = await resRegion.json();

        // Render Demographics
        renderMetaDemographics(dataDemo.data || [], dataRegion.data || []);

        // Calcular total de leads a partir das campanhas (mais confiável para períodos longos/maximum)
        let totalLeadsFromCampaigns = 0;
        if (dataCampaigns.data) {
            dataCampaigns.data.forEach(camp => {
                if (camp.actions) {
                    const l = camp.actions.find(a => a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead');
                    if (l) totalLeadsFromCampaigns += parseInt(l.value);
                }
            });
        }

        if (dataGlobal.data && dataGlobal.data.length > 0) {
            const insights = dataGlobal.data[0];
            
            // Garantir que o objeto de ações existe
            if (!insights.actions) insights.actions = [];
            
            // Se o global não trouxe a ação 'lead', ou se a soma das campanhas for maior (mais precisa)
            const globalLeadAction = insights.actions.find(a => a.action_type === 'lead');
            if (!globalLeadAction || totalLeadsFromCampaigns > parseInt(globalLeadAction.value)) {
                if (globalLeadAction) {
                    globalLeadAction.value = totalLeadsFromCampaigns.toString();
                } else {
                    insights.actions.push({ action_type: 'lead', value: totalLeadsFromCampaigns.toString() });
                }
            }

            updateMetaDashboard(insights);
        } else {
            updateMetaDashboard(null);
        }

        if (dataCampaigns.data) {
            renderCampaignsTable(dataCampaigns.data);
        } else {
            renderCampaignsTable([]);
        }
    } catch (e) {
        console.error("Meta Ads Error:", e);
    }
}

function findCRMLeadsForCampaign(campaignName) {
    const cmpNormal = campaignName.toLowerCase();
    return filteredLeads.filter(lead => {
        const origem = (lead.origem || "").toLowerCase();
        const midia_p = (lead.midia_principal || "").toLowerCase();
        const midia_s = (lead.midia_secundaria || "").toLowerCase();
        const campanha = (lead.campanha || "").toLowerCase();
        const utm_campaign = (lead.utm_campaign || "").toLowerCase();
        
        return origem.includes(cmpNormal) || 
               midia_p.includes(cmpNormal) || 
               midia_s.includes(cmpNormal) || 
               campanha.includes(cmpNormal) || 
               utm_campaign.includes(cmpNormal);
    });
}

function renderCampaignsTable(campaigns) {
    const tbody = document.getElementById("table-campaigns-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    // Ordenar pelas mais recentes (date_stop desc, date_start desc)
    const sortedCampaigns = campaigns.sort((a, b) => {
        const dateB = new Date(b.date_stop);
        const dateA = new Date(a.date_stop);
        if (dateB - dateA !== 0) return dateB - dateA;
        return new Date(b.date_start) - new Date(a.date_start);
    });

    sortedCampaigns.forEach(camp => {
        const name = camp.campaign_name || "Desconhecido";
        const spend = parseFloat(camp.spend || 0);
        const impressions = parseInt(camp.impressions || 0);
        const clicks = parseInt(camp.clicks || 0);
        
        // Datas e Duração
        let periodStr = "-";
        let durationStr = "-";
        if (camp.date_start && camp.date_stop) {
            const start = new Date(camp.date_start);
            const stop = new Date(camp.date_stop);
            periodStr = `${start.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})} à ${stop.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}`;
            
            const diffTime = Math.abs(stop - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            durationStr = `${diffDays} dias`;
        }

        let metaLeads = 0;
        if (camp.actions) {
            const leadAction = camp.actions.find(a => a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead');
            if (leadAction) metaLeads = parseInt(leadAction.value);
        }

        const crmLeadsMatched = findCRMLeadsForCampaign(name);
        const crmLeadsCount = crmLeadsMatched.length;
        
        // Agrupar leads do CRM pelo Status do Funil
        const statusCounts = {};
        crmLeadsMatched.forEach(l => {
            const statusName = l.situacao && l.situacao.nome ? l.situacao.nome : "Novo";
            statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
        });

        let badgesHtml = "";
        Object.entries(statusCounts).sort((a,b) => b[1] - a[1]).forEach(([sName, sCount]) => {
            const colors = getStatusColor(sName);
            badgesHtml += `<span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: ${colors.bg}; color: ${colors.text}; white-space: nowrap; border: 1px solid rgba(255,255,255,0.1); margin-right: 4px; margin-bottom: 4px; display: inline-block;">${sName}: ${sCount}</span>`;
        });
        if (crmLeadsCount === 0) {
            badgesHtml = `<span style="color:var(--text-secondary); font-size:12px;">Nenhum cruzamento encontrado</span>`;
        }

        const totalLeadsForCPL = crmLeadsCount > 0 ? crmLeadsCount : (metaLeads > 0 ? metaLeads : 0);
        let cplStr = "R$ 0,00";
        if (spend > 0 && totalLeadsForCPL > 0) {
            cplStr = formatCurrency(spend / totalLeadsForCPL);
        }
        
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${name}</strong></td>
            <td style="font-size: 12px; color: var(--text-secondary);">${periodStr}</td>
            <td style="font-size: 12px;">${durationStr}</td>
            <td><strong style="color: #F43F5E;">${formatCurrency(spend)}</strong></td>
            <td>${impressions.toLocaleString('pt-BR')} / ${clicks.toLocaleString('pt-BR')}</td>
            <td>${metaLeads}</td>
            <td><strong>${cplStr}</strong></td>
            <td><strong style="color: #0ea5e9; font-size: 1.1em;">${crmLeadsCount}</strong></td>
            <td style="max-width: 320px; line-height: 1.6;">${badgesHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderMetaDemographics(demoData, regionData) {
    // 1. GÊNERO
    const genders = { "male": 0, "female": 0, "unknown": 0 };
    demoData.forEach(d => {
        if(d.gender) genders[d.gender] += parseInt(d.clicks || 0);
    });
    
    const genderCtx = document.getElementById("metaGenderChart");
    if (genderCtx) {
        if (metaGenderChartInstance) metaGenderChartInstance.destroy();
        metaGenderChartInstance = new Chart(genderCtx.getContext('2d'), {
            type: 'doughnut',
            plugins: [ChartDataLabels],
            data: {
                labels: ['Homens', 'Mulheres', 'Outros'],
                datasets: [{
                    data: [genders.male, genders.female, genders.unknown],
                    backgroundColor: ['#3b82f6', '#f43f5e', '#64748b'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#e2e8f0' } },
                    datalabels: {
                        color: '#fff',
                        formatter: (val, ctx) => {
                            const sum = ctx.chart.data.datasets[0].data.reduce((a,b) => a+b, 0);
                            return sum > 0 ? ((val/sum)*100).toFixed(1) + "%" : "";
                        }
                    }
                }
            }
        });
    }

    // 2. IDADE
    const ages = {};
    demoData.forEach(d => {
        if(d.age) ages[d.age] = (ages[d.age] || 0) + parseInt(d.clicks || 0);
    });
    const ageLabels = Object.keys(ages).sort();
    const ageValues = ageLabels.map(l => ages[l]);

    const ageCtx = document.getElementById("metaAgeChart");
    if (ageCtx) {
        if (metaAgeChartInstance) metaAgeChartInstance.destroy();
        metaAgeChartInstance = new Chart(ageCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ageLabels,
                datasets: [{
                    label: 'Cliques',
                    data: ageValues,
                    backgroundColor: '#0ea5e9',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // 3. ESTADOS
    const regions = {};
    regionData.forEach(d => {
        if(d.region) regions[d.region] = (regions[d.region] || 0) + parseInt(d.clicks || 0);
    });
    const topRegions = Object.entries(regions).sort((a,b) => b[1] - a[1]).slice(0, 5);
    const regionLabels = topRegions.map(r => r[0]);
    const regionValues = topRegions.map(r => r[1]);

    const regionCtx = document.getElementById("metaRegionChart");
    if (regionCtx) {
        if (metaRegionChartInstance) metaRegionChartInstance.destroy();
        metaRegionChartInstance = new Chart(regionCtx.getContext('2d'), {
            type: 'bar',
            indexAxis: 'y',
            data: {
                labels: regionLabels,
                datasets: [{
                    label: 'Cliques',
                    data: regionValues,
                    backgroundColor: '#10b981',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}

function updateMetaDashboard(insights) {
    if (!insights) {
        document.getElementById("meta-spend").innerText = "R$ 0,00";
        document.getElementById("meta-impressions").innerText = "0";
        document.getElementById("meta-clicks").innerText = "0";
        document.getElementById("meta-cpc").innerText = "R$ 0,00";
        document.getElementById("meta-cpm").innerText = "R$ 0,00";
        document.getElementById("meta-ctr").innerText = "0%";
        document.getElementById("meta-leads-api").innerText = "0";
        document.getElementById("meta-leads-top").innerText = "0";
        document.getElementById("meta-cpl").innerText = "R$ 0,00";
        return;
    }

    const spend = parseFloat(insights.spend || 0);
    const impressions = parseInt(insights.impressions || 0);
    const clicks = parseInt(insights.clicks || 0);
    const cpc = parseFloat(insights.cpc || 0);
    const cpm = parseFloat(insights.cpm || 0);
    const ctr = parseFloat(insights.ctr || 0);

    let metaLeads = 0;
    if (insights.actions) {
        const leadAction = insights.actions.find(a => a.action_type === 'lead');
        if (leadAction) metaLeads = parseInt(leadAction.value);
    }

    document.getElementById("meta-spend").innerText = formatCurrency(spend);
    document.getElementById("meta-impressions").innerText = impressions.toLocaleString('pt-BR');
    document.getElementById("meta-clicks").innerText = clicks.toLocaleString('pt-BR');
    document.getElementById("meta-cpc").innerText = formatCurrency(cpc);
    document.getElementById("meta-cpm").innerText = formatCurrency(cpm);
    document.getElementById("meta-ctr").innerText = ctr.toFixed(2) + "%";
    document.getElementById("meta-leads-api").innerText = metaLeads.toLocaleString('pt-BR');
    document.getElementById("meta-leads-top").innerText = metaLeads.toLocaleString('pt-BR');

    // Calculate CRM Leads from FB/IG
    let crmFbLeads = 0;
    filteredLeads.forEach(l => {
        const o = getOrigin(l).toLowerCase();
        if (o.includes("facebook") || o.includes("instagram") || o.includes("fb") || o.includes("ig") || o.includes("meta")) {
            crmFbLeads++;
        }
    });

    const totalLeadsCrm = crmFbLeads > 0 ? crmFbLeads : (metaLeads > 0 ? metaLeads : 0);
    
    if (totalLeadsCrm > 0 && spend > 0) {
        document.getElementById("meta-cpl").innerText = formatCurrency(spend / totalLeadsCrm);
    } else {
        document.getElementById("meta-cpl").innerText = "R$ 0,00";
    }

    // Chart
    const ctx = document.getElementById("marketingPieChart");
    if (ctx) {
        const nonFbLeads = filteredLeads.length - crmFbLeads;
        if (marketingPieChartInstance) marketingPieChartInstance.destroy();
        marketingPieChartInstance = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            plugins: [ChartDataLabels],
            data: {
                labels: [`Meta Ads (${crmFbLeads})`, `Outros (${nonFbLeads})`],
                datasets: [{
                    data: [crmFbLeads, nonFbLeads],
                    backgroundColor: ['#0ea5e9', '#6366F1'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold', size: 12 },
                        formatter: (val, ctx) => {
                            const sum = ctx.chart.data.datasets[0].data.reduce((a,b) => a+b, 0);
                            return sum > 0 ? ((val/sum)*100).toFixed(1) + "%" : "";
                        }
                    },
                    legend: { position: 'bottom', labels: { color: '#e5e5e5' } }
                }
            }
        });
    }
}

function switchView(viewName) {
    document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active-view", "hidden"));
    document.querySelectorAll(".view-section").forEach(sec => sec.classList.add("hidden"));
    
    const target = document.getElementById(`view-${viewName}`);
    if(target) {
        target.classList.remove("hidden");
        target.classList.add("active-view");
    }

    const titleMap = {
        "dashboard": "Dashboard Geral",
        "leads": "Gestão de Leads",
        "vendas": "Relatório de Vendas"
    };
    document.getElementById("page-title").textContent = titleMap[viewName];
}

function showLoader() {
    document.getElementById("loader").classList.remove("hidden");
    document.getElementById("content-area").classList.add("hidden");
}

function hideLoader() {
    document.getElementById("loader").classList.add("hidden");
    document.getElementById("content-area").classList.remove("hidden");
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
}
