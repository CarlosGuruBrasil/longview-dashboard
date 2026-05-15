// Configurações removidas por segurança (Agora estão no Backend)
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
let metaPlatformChartInstance = null;
let currentView = 'dashboard';

// Meta Ads Config (Agora no Backend)

Chart.defaults.color = '#A3A3A3';
Chart.defaults.font.family = "'Outfit', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(20, 20, 20, 0.9)';
Chart.defaults.plugins.tooltip.titleColor = '#fff';
Chart.defaults.animation = window.innerWidth > 1024; // Desativa animações no mobile para evitar travamentos

document.addEventListener("DOMContentLoaded", () => {
    // Verificar sessão existente
    if (sessionStorage.getItem("longview_auth") === "true") {
        showApp();
    } else {
        setupEventListeners();
    }
});

// handleLogin removida para usar setupEventListeners

function startLoadingSequence(isRefresh = false) {
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

    // Simular progresso visual enquanto espera a API
    let width = 0;
    const interval = setInterval(() => {
        if (width >= 90) {
            clearInterval(interval);
        } else {
            width += Math.random() * 5;
            bar.style.width = Math.min(width, 90) + "%";
        }
    }, 200);

    loadingText.innerText = isRefresh ? "Forçando sincronização total com APIs..." : "Conectando ao Portal de Inteligência...";

    // Chamar o backend de forma definitiva
    fetchAllData(isRefresh).then((success) => {
        // Garantir que a barra chegue a 100%
        bar.style.width = "100%";
        
        if (success === false) {
            console.log("Sessão expirada, redirecionando...");
            return;
        }

        loadingText.innerText = "Dados Sincronizados!";
        generateRealInsights();
        
        // FORÇAR a retirada do overlay após os dados chegarem
        setTimeout(() => {
            overlay.classList.add("hidden");
            app.classList.remove("hidden");
            setupEventListeners();
            console.log("Dashboard liberado com sucesso.");
        }, 800);
    }).catch(err => {
        console.error("Erro fatal no carregamento:", err);
        loadingText.innerText = "Falha na conexão. Tentando recuperar...";
        
        // Mesmo em erro, se já tivermos dados antigos, podemos tentar mostrar
        setTimeout(() => {
            overlay.classList.add("hidden");
            app.classList.remove("hidden");
        }, 3000);
    });
}

function generateRealInsights() {
    if (!allLeads || allLeads.length === 0) return;

    const sales = allLeads.filter(l => isSale(l));
    const totalValue = sales.reduce((acc, l) => {
        let val = 0;
        if (l.valor_negocio) {
            // Remove pontos de milhar e troca vírgula por ponto
            const cleanVal = l.valor_negocio.toString().replace(/\./g, '').replace(',', '.');
            val = parseFloat(cleanVal) || 0;
        }
        return acc + val;
    }, 0);
    
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
        const name = getOrigin(l);
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
    // --- LOGIN ---
    const loginBtn = document.getElementById("btn-login");
    if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const user = document.getElementById("login-user").value;
            const pass = document.getElementById("login-pass").value;
            
            loginBtn.innerText = "Verificando...";
            loginBtn.disabled = true;

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: user, password: pass })
                });

                if (res.ok) {
                    sessionStorage.setItem("longview_auth", "true");
                    startLoadingSequence();
                } else {
                    alert("Usuário ou senha incorretos.");
                    loginBtn.innerText = "Entrar no Painel";
                    loginBtn.disabled = false;
                }
            } catch (err) {
                console.error("Erro no login:", err);
                alert("Erro ao conectar com o servidor.");
                loginBtn.innerText = "Entrar no Painel";
                loginBtn.disabled = false;
            }
        });
    }

    // Configurar eventos do Dashboard
    const refreshBtn = document.getElementById("refresh-btn");
    if (refreshBtn && !refreshBtn.getAttribute('data-events-set')) {
        refreshBtn.setAttribute('data-events-set', 'true');
        refreshBtn.addEventListener("click", () => startLoadingSequence(true));
    }

    const filterBtn = document.getElementById("filter-btn");
    if (filterBtn) filterBtn.addEventListener("click", applyGlobalFilters);

    // Navegação Lateral (Desktop)
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            switchView(item.getAttribute("data-view"));
        });
    });

    // Navegação Inferior (Mobile)
    document.querySelectorAll(".mobile-nav-item").forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            switchView(item.getAttribute("data-view"));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    // --- Menu Mobile ---
    const openFiltersBtn = document.getElementById("open-filters-btn");
    const closeFiltersBtn = document.getElementById("close-filters-btn");
    const mobileSidebar = document.getElementById("mobile-filter-sidebar");

    if (openFiltersBtn) {
        openFiltersBtn.addEventListener("click", () => mobileSidebar.classList.remove("hidden"));
    }
    if (closeFiltersBtn) {
        closeFiltersBtn.addEventListener("click", () => mobileSidebar.classList.add("hidden"));
    }

    // Filtros Mobile
    const mFilterBtn = document.getElementById("m-filter-btn");
    if (mFilterBtn) {
        mFilterBtn.addEventListener("click", () => {
            const start = document.getElementById("m-start-date").value;
            const end = document.getElementById("m-end-date").value;
            if (start) document.getElementById("start-date").value = start;
            if (end) document.getElementById("end-date").value = end;
            applyGlobalFilters();
            mobileSidebar.classList.add("hidden");
        });
    }

    const mClearBtn = document.getElementById("m-clear-btn");
    if (mClearBtn) {
        mClearBtn.addEventListener("click", () => {
            document.getElementById("m-start-date").value = "";
            document.getElementById("m-end-date").value = "";
            document.getElementById("start-date").value = "";
            document.getElementById("end-date").value = "";
            applyGlobalFilters();
            mobileSidebar.classList.add("hidden");
        });
    }

    const mRefreshBtn = document.getElementById("m-refresh-btn");
    if (mRefreshBtn) {
        mRefreshBtn.addEventListener("click", () => {
            startLoadingSequence(true);
            mobileSidebar.classList.add("hidden");
        });
    }

    const clearBtn = document.getElementById("clear-filters-btn");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            document.getElementById("start-date").value = "";
            document.getElementById("end-date").value = "";
            if (document.getElementById("m-start-date")) document.getElementById("m-start-date").value = "";
            if (document.getElementById("m-end-date")) document.getElementById("m-end-date").value = "";
            
            // Limpar também filtros de coluna das tabelas
            document.querySelectorAll(".col-filter, .col-filter-sales").forEach(input => {
                input.value = "";
            });
            
            applyGlobalFilters();
        });
    }

    // Botões de Limpar Filtros das Tabelas (Individuais)
    document.querySelectorAll(".btn-clear-table-filters").forEach(btn => {
        btn.addEventListener("click", () => {
            const container = btn.closest(".table-filters-row");
            if (container) {
                container.querySelectorAll(".col-filter, .col-filter-sales").forEach(input => {
                    input.value = "";
                });
                // Re-filtrar a tabela específica ou todas
                filterLeadsTable();
                filterSalesTable();
                if (typeof filterAdsTable === 'function') filterAdsTable();
            }
        });
    });

    // Filtros de ADS ---
    const adsSearch = document.getElementById("ads-search-campaign");
    const adsProduct = document.getElementById("ads-filter-product");

    if (adsSearch) adsSearch.addEventListener("input", filterAdsTable);
    if (adsProduct) adsProduct.addEventListener("change", filterAdsTable);
}

// Iniciar eventos imediatamente
setupEventListeners();

// Helpers
function isSale(lead) {
    if (!lead.situacao || !lead.situacao.nome) return false;
    const s = lead.situacao.nome.toLowerCase();
    return s === "venda realizada" || s.includes("negócio ganho") || s.includes("negocio ganho") || s.includes("vendid");
}

function getOrigin(lead) {
    // Priorizando a mídia de visita conforme solicitado, depois fallback
    if (lead.midia_visita) return String(lead.midia_visita);
    if (lead.midia_principal) return String(lead.midia_principal);
    if (lead.origem) {
        return typeof lead.origem === 'object' && lead.origem.nome ? String(lead.origem.nome) : String(lead.origem);
    }
    return "Desconhecido";
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

async function fetchAllData(force = false) {
    const loadingText = document.getElementById("loading-text");
    
    try {
        if (loadingText) loadingText.textContent = "Buscando dados no servidor...";
        
        const url = force ? '/api/data?refresh=true' : '/api/data';
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 401) {
                sessionStorage.removeItem("longview_auth");
                window.location.reload(); 
                return false;
            }
            throw new Error('Falha na sincronização');
        }
        
        const data = await response.json();
        
        // 1. Leads do CRM (Garantir leitura flexível do Cache ou API)
        if (data.leads && data.leads.leads) {
            allLeads = data.leads.leads;
        } else if (Array.isArray(data.leads)) {
            allLeads = data.leads;
        } else {
            allLeads = [];
        }
        
        // 2. Dados do Meta
        if (data.meta) {
            window.lastMetaDemographics = data.meta.demographics || [];
            window.lastMetaRegions = data.meta.regions || [];
            window.lastMetaCampaigns = data.meta.campaigns || [];
            window.lastMetaGlobal = data.meta.global;
            
            renderMetaDemographics(window.lastMetaDemographics, window.lastMetaRegions);
            renderMetaPlatforms(data.meta.platforms || []);
            renderCampaignsTable(window.lastMetaCampaigns);
            updateMetaDashboard(window.lastMetaGlobal);
        }

        applyGlobalFilters();

        // REMOVER o spinner interno e mostrar o conteúdo
        const innerLoader = document.getElementById("loader");
        const contentArea = document.getElementById("content-area");
        if (innerLoader) innerLoader.classList.add("hidden");
        if (contentArea) contentArea.classList.remove("hidden");

        return true; // Sucesso final
    } catch (error) {
        console.error("Erro na sincronização:", error);
        alert("Erro ao sincronizar dados. Tente novamente mais tarde.");
        return false;
    }
}

function applyGlobalFilters() {
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;
    
    console.log(`Aplicando filtros: de ${startDate || 'sempre'} até ${endDate || 'hoje'}`);

    if (!startDate && !endDate) {
        filteredLeads = allLeads;
    } else {
        filteredLeads = allLeads.filter(lead => {
            const leadDateStr = (lead.data_cadastramento || lead.data_cad || "").split(' ')[0];
            if (!leadDateStr) return false;
            
            if (startDate && leadDateStr < startDate) return false;
            if (endDate && leadDateStr > endDate) return false;
            return true;
        });
    }
    
    console.log(`Filtro finalizado: ${filteredLeads.length} leads encontrados.`);

    // Atualizar tudo
    updateDashboard(filteredLeads);
    populateDropdowns(filteredLeads);
    applyTableFilters(); // Atualiza tabela de leads respeitando filtros das colunas
    applySalesTableFilters(); // Atualiza tabela de vendas
    
    // Atualizar Meta Ads buscando os dados reais filtrados no servidor
    fetchFilteredMetaData(startDate, endDate);
}

async function fetchFilteredMetaData(start, end) {
    // Se não tiver datas, volta ao original (Tudo)
    if (!start && !end) {
        if (window.lastMetaGlobal) {
            renderMetaDemographics(window.lastMetaDemographics, window.lastMetaRegions);
            renderCampaignsTable(window.lastMetaCampaigns);
            updateMetaDashboard(window.lastMetaGlobal);
        }
        return;
    }

    try {
        const btn = document.getElementById("filter-btn");
        if(btn) btn.innerText = "Filtrando...";

        const response = await fetch(`/api/data?type=meta&start=${start || ''}&end=${end || ''}`);
        if (!response.ok) throw new Error('Falha na busca de ads');
        
        const data = await response.json();
        
        if (data.meta) {
            renderMetaDemographics(data.meta.demographics || [], data.meta.regions || []);
            renderCampaignsTable(data.meta.campaigns || []);
            updateMetaDashboard(data.meta.global);
        }
        
        if(btn) btn.innerText = "Filtrar";
    } catch (err) {
        console.error("Erro ao buscar filtros do Meta:", err);
        const btn = document.getElementById("filter-btn");
        if(btn) btn.innerText = "Filtrar";
    }
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
    if (!leads) return;

    // Pequeno atraso para garantir que o navegador processou a memória antes de desenhar gráficos pesados
    setTimeout(() => {
        try {
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
            const elLeads = document.getElementById("kpi-leads");
            const elVendas = document.getElementById("kpi-vendas-qtd");
            const elVisitas = document.getElementById("kpi-visitas");
            const elValor = document.getElementById("kpi-valor-vendas");

            if(elLeads) elLeads.textContent = leads.length;
            if(elVendas) elVendas.textContent = totalVendasQtd;
            if(elVisitas) elVisitas.textContent = totalVisitas;
            if(elValor) elValor.textContent = formatCurrency(valorTotalVendas);

            // Renderizar Gráficos de Pizza com proteção individual
            try { renderOriginPieChart(origins); } catch(e) { console.error("Erro Origem:", e); }
            try { renderStatusPieChart(statuses); } catch(e) { console.error("Erro Status:", e); }
            try { renderSalesOriginPieChart(leads); } catch(e) { console.error("Erro Vendas Origem:", e); }

            // Gráficos de Crescimento
            try { renderGrowthChart(); } catch(e) { console.error("Erro Growth:", e); }
            try { renderSalesGrowthChart(); } catch(e) { console.error("Erro Sales Growth:", e); }

            // Resumos de Etapas
            try { renderLeadsSummary(leads); } catch(e) { console.error("Erro Leads Summary:", e); }
            try { renderSalesSummary(leads.filter(l => isSale(l))); } catch(e) { console.error("Erro Sales Summary:", e); }
            
        } catch (globalError) {
            console.error("Erro global no Dashboard:", globalError);
        }
    }, 50);
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
    const container = document.getElementById('status-pyramid-container');
    if(!container) return;
    
    // Ordenar por volume
    const sorted = Object.entries(statuses).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
        container.innerHTML = "<p style='color:#94a3b8;'>Sem dados</p>";
        return;
    }

    const totalLeads = sorted.reduce((acc, curr) => acc + curr[1], 0);
    const n = sorted.length;
    
    // Configurações do Desenho
    const svgW = 400;
    const svgH = 380;
    const pyramidTopW = 300; // Largura do topo da pirâmide
    const pyramidBotW = 20;  // Largura da base (ponta)
    const centerX = 160;     // Deslocado para a esquerda para dar espaço aos textos na direita
    const sectionH = svgH / n;
    
    let svgHtml = `<svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%; height:100%; overflow: visible;">`;
    
    // Filtro de Sombra Suave
    svgHtml += `<defs><filter id="pyramidShadow"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/></filter></defs>`;

    sorted.forEach((item, i) => {
        const name = item[0];
        const val = item[1];
        const perc = totalLeads > 0 ? ((val / totalLeads) * 100).toFixed(1) : 0;
        const colorData = getStatusColor(name);
        const bgColor = colorData.bg;
        const textColor = colorData.text; // Usar a cor de contraste definida (preto para branco, etc)
        
        // Cálculo das coordenadas do trapézio para formar o triângulo perfeito
        const yTop = i * sectionH;
        const yBot = (i + 1) * sectionH;
        
        // Interpolação linear da largura
        const wTop = pyramidTopW - (i * (pyramidTopW - pyramidBotW) / n);
        const wBot = pyramidTopW - ((i + 1) * (pyramidTopW - pyramidBotW) / n);
        
        const x1 = centerX - wTop/2;
        const x2 = centerX + wTop/2;
        const x3 = centerX + wBot/2;
        const x4 = centerX - wBot/2;
        
        const points = `${x1},${yTop} ${x2},${yTop} ${x3},${yBot} ${x4},${yBot}`;
        
        svgHtml += `
            <g class="pyramid-slice" style="cursor:pointer;">
                <polygon points="${points}" fill="${bgColor}" filter="url(#pyramidShadow)">
                    <title>${name}: ${val} leads</title>
                </polygon>
                
                <!-- Porcentagem Interna (com cor de contraste inteligente) -->
                <text x="${centerX}" y="${yTop + sectionH/2 + 5}" text-anchor="middle" fill="${textColor}" style="font-size: 13px; font-weight: 800; pointer-events:none;">${perc}%</text>
                
                <!-- Linha Guia -->
                <line x1="${x2 + 5}" y1="${yTop + sectionH/2}" x2="${x2 + 25}" y2="${yTop + sectionH/2}" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
                
                <!-- Rótulo Externo (Nome e Valor) - Sem truncar -->
                <text x="${x2 + 30}" y="${yTop + sectionH/2 + 4}" fill="#e2e8f0" style="font-size: 11px; font-weight: 600;">
                    ${name} <tspan fill="#94a3b8" font-weight="400">(${val})</tspan>
                </text>
            </g>
        `;
    });

    svgHtml += `</svg>`;
    container.innerHTML = svgHtml;
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

    const totalVGV = salesArray.reduce((acc, lead) => {
        let val = 0;
        if (lead.valor_negocio) {
            const cleanVal = lead.valor_negocio.toString().replace(/\./g, '').replace(',', '.');
            val = parseFloat(cleanVal) || 0;
        }
        return acc + val;
    }, 0);

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
                <td data-label="Cliente"><strong>${name}</strong></td>
                <td data-label="Data">${dataCad}</td>
                <td data-label="Status"><span class="status-badge" style="background-color: ${colors.bg}; color: ${colors.text}; border: 1px solid rgba(255,255,255,0.1);">${statusName}</span></td>
                <td data-label="Origem">${source}</td>
                <td data-label="Corretor">${corretor}</td>
                <td data-label="Imobiliária">${imobiliaria}</td>
                <td data-label="Gestor">${gestor}</td>
                <td data-label="Empreendimento">${emp}</td>
                <td data-label="Unidade"><strong>${unidade}</strong></td>
                <td data-label="Tipologia"><span style="color:var(--text-secondary);font-size:13px;">${tipologia}</span></td>
                <td data-label="Valor"><strong style="color: #10B981;">${valFormatted}</strong></td>
            `;
        } else {
            tr.innerHTML = `
                <td data-label="Cliente"><strong>${name}</strong></td>
                <td data-label="Data">${dataCad}</td>
                <td data-label="Status"><span class="status-badge" style="background-color: ${colors.bg}; color: ${colors.text}; border: 1px solid rgba(255,255,255,0.1);">${statusName}</span></td>
                <td data-label="Origem">${source}</td>
                <td data-label="Corretor">${corretor}</td>
                <td data-label="Imobiliária">${imobiliaria}</td>
                <td data-label="Gestor">${gestor}</td>
                <td data-label="Empreendimento">${emp}</td>
                <td data-label="Valor">${valFormatted}</td>
            `;
        }
        
        tbody.appendChild(tr);
    });
}

// ==========================================
// META ADS INTEGRATION
// ==========================================
// Função fetchMetaAdsData removida (integrada no fetchAllData)

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
            <td data-label="Campanha"><strong>${name}</strong></td>
            <td data-label="Período" style="font-size: 12px; color: var(--text-secondary);">${periodStr}</td>
            <td data-label="Duração" style="font-size: 12px;">${durationStr}</td>
            <td data-label="Gasto"><strong style="color: #F43F5E;">${formatCurrency(spend)}</strong></td>
            <td data-label="Imp/Cliques">${impressions.toLocaleString('pt-BR')} / ${clicks.toLocaleString('pt-BR')}</td>
            <td data-label="Meta Leads">${metaLeads}</td>
            <td data-label="CPL"><strong>${cplStr}</strong></td>
            <td data-label="CRM Leads"><strong style="color: #0ea5e9; font-size: 1.1em;">${crmLeadsCount}</strong></td>
            <td data-label="Status Funil" style="max-width: 320px; line-height: 1.6;">${badgesHtml}</td>
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
    if (!insights) return;

    const spend = parseFloat(insights.spend || 0);
    const impressions = parseInt(insights.impressions || 0);
    const clicks = parseInt(insights.clicks || 0);

    // Contar Leads do Facebook/Instagram que chegaram no CRM (A métrica mais real)
    let crmFbLeads = 0;
    // Usa 'filteredLeads' se houver algum filtro ativo, caso contrário 'allLeads'
    const startVal = document.getElementById("start-date") ? document.getElementById("start-date").value : "";
    const endVal = document.getElementById("end-date") ? document.getElementById("end-date").value : "";
    const leadsBase = (startVal || endVal) ? filteredLeads : allLeads;
    
    leadsBase.forEach(l => {
        const o = getOrigin(l).toLowerCase();
        if (o.includes("facebook") || o.includes("instagram") || o.includes("fb") || o.includes("ig") || o.includes("meta") || o.includes("social")) {
            crmFbLeads++;
        }
    });

    // Detecção ULTRA Robusta de Leads (Meta API)
    let metaLeadsFromApi = 0;
    if (insights.actions) {
        const leadActions = insights.actions.filter(a => 
            a.action_type === 'lead' || 
            a.action_type === 'offsite_conversion.fb_pixel_lead' ||
            a.action_type.includes('leadgen') ||
            a.action_type.includes('onsite_conversion.lead') ||
            a.action_type.includes('lead_grouped')
        );
        metaLeadsFromApi = leadActions.reduce((acc, a) => acc + parseInt(a.value || 0), 0);
    }

    // Usamos o maior valor entre o CRM e a API para garantir que nunca fique zerado injustamente
    const displayLeads = Math.max(crmFbLeads, metaLeadsFromApi);

    document.getElementById("meta-spend").innerText = formatCurrency(spend);
    document.getElementById("meta-impressions").innerText = impressions.toLocaleString('pt-BR');
    document.getElementById("meta-clicks").innerText = clicks.toLocaleString('pt-BR');
    document.getElementById("meta-leads-api").innerText = displayLeads.toLocaleString('pt-BR');
    document.getElementById("meta-leads-top").innerText = displayLeads.toLocaleString('pt-BR');

    const totalLeadsCrm = crmFbLeads;
    const cplCRM = totalLeadsCrm > 0 ? spend / totalLeadsCrm : 0;
    document.getElementById("meta-cpl").innerText = formatCurrency(cplCRM);

    document.getElementById("meta-cpc").innerText = formatCurrency(parseFloat(insights.cpc || 0));
    document.getElementById("meta-cpm").innerText = formatCurrency(parseFloat(insights.cpm || 0));
    document.getElementById("meta-ctr").innerText = (parseFloat(insights.ctr || 0)).toFixed(2) + "%";

    // Chart Pie: Meta vs Resto
    const ctx = document.getElementById("marketingPieChart");
    if (ctx) {
        const nonFbLeads = leadsBase.length - crmFbLeads;
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

function filterAdsTable() {
    const searchTerm = document.getElementById("ads-search-campaign").value.toLowerCase();
    // No momento usamos apenas o busca por termo, o filtro por produto pode ser expandido depois
    
    const rows = document.querySelectorAll("#table-campaigns-body tr");
    rows.forEach(row => {
        const campaignName = row.cells[0].textContent.toLowerCase();
        if (campaignName.includes(searchTerm)) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
}

function switchView(viewName) {
    currentView = viewName;
    
    // Atualizar classes ativa (Desktop)
    document.querySelectorAll(".nav-item").forEach(n => {
        n.classList.remove("active");
        if (n.getAttribute("data-view") === viewName) n.classList.add("active");
    });

    // Atualizar classes ativa (Mobile)
    document.querySelectorAll(".mobile-nav-item").forEach(n => {
        n.classList.remove("active");
        if (n.getAttribute("data-view") === viewName) n.classList.add("active");
    });

    document.querySelectorAll(".view-section").forEach(sec => {
        sec.classList.remove("active-view");
        sec.classList.add("hidden");
    });
    
    const target = document.getElementById(`view-${viewName}`);
    if(target) {
        target.classList.remove("hidden");
        target.classList.add("active-view");
    }

    const titleMap = {
        "dashboard": "Dashboard Geral",
        "leads": "Gestão de Leads",
        "vendas": "Relatório de Vendas",
        "marketing": "Marketing ADS"
    };
    document.getElementById("page-title").textContent = titleMap[viewName] || "Dashboard";
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

function renderMetaPlatforms(platformData) {
    console.log("Meta Platform Data:", platformData); // Log para conferência
    
    const platforms = { "facebook": 0, "instagram": 0, "others": 0 };
    let hasData = false;
    
    platformData.forEach(d => {
        const p = d.publisher_platform ? d.publisher_platform.toLowerCase() : "others";
        const val = parseInt(d.clicks || d.impressions || 0);
        if (val > 0) {
            hasData = true;
            if (p.includes("facebook")) platforms.facebook += val;
            else if (p.includes("instagram")) platforms.instagram += val;
            else platforms.others += val;
        }
    });

    const chartCard = document.getElementById("metaPlatformChart") ? document.getElementById("metaPlatformChart").closest('.chart-card') : null;
    
    if (!hasData) {
        if (chartCard) chartCard.classList.add("hidden");
        return;
    } else {
        if (chartCard) chartCard.classList.remove("hidden");
    }

    const ctx = document.getElementById("metaPlatformChart");
    if (ctx) {
        if (metaPlatformChartInstance) metaPlatformChartInstance.destroy();
        metaPlatformChartInstance = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            plugins: [ChartDataLabels],
            data: {
                labels: ['Facebook', 'Instagram', 'Outros'],
                datasets: [{
                    data: [platforms.facebook, platforms.instagram, platforms.others],
                    backgroundColor: ['#1877F2', '#E1306C', '#64748b'],
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
                        font: { weight: 'bold' },
                        formatter: (val, ctx) => {
                            const sum = ctx.chart.data.datasets[0].data.reduce((a,b) => a+b, 0);
                            return sum > 0 ? ((val/sum)*100).toFixed(1) + "%" : "";
                        }
                    }
                }
            }
        });
    }
}
