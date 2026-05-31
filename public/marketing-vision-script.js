// Configurações removidas por segurança (Agora estão no Backend)
let allLeads = [];
let filteredLeads = [];
let growthChartInstance = null;
let salesGrowthChartInstance = null;
let originPieChartInstance = null;
let statusPieChartInstance = null;
let salesOriginPieChartInstance = null;
let lossReasonsChartInstance = null;
let opportunityStagesChartInstance = null;
let genderPieChartInstance = null;
let cityPieChartInstance = null;
let civilStatePieChartInstance = null;
let marketingPieChartInstance = null;
let metaGenderChartInstance = null;
let metaAgeChartInstance = null;
let metaRegionChartInstance = null;
let metaPlatformChartInstance = null;
let lossValueChartInstance = null;
let funnelConversionChartInstance = null;
let globalInventory = [];
let currentView = 'dashboard';

// Meta Ads Config (Agora no Backend)

Chart.defaults.color = '#A3A3A3';
Chart.defaults.font.family = "'Outfit', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(20, 20, 20, 0.9)';
Chart.defaults.plugins.tooltip.titleColor = '#fff';
Chart.defaults.animation = window.innerWidth > 1024; // Desativa animações no mobile para evitar travamentos

function initMarketingApp() {
    sessionStorage.setItem("longview_auth", "true"); // Forçar logado já que passou pelo middleware
    showApp();
}

if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(initMarketingApp, 100);
} else {
    document.addEventListener("DOMContentLoaded", initMarketingApp);
}

// handleLogin removida para usar setupEventListeners

function startLoadingSequence(isRefresh = false) {
    const overlay = document.getElementById("loading-overlay");
    const login = document.getElementById("login-screen");
    const app = document.getElementById("main-app");
    const bar = document.getElementById("progress-bar");
    const loadingText = document.getElementById("loading-text");
    const insightText = document.getElementById("insight-text");
    const startTime = Date.now();

    overlay.classList.remove("hidden");
    login.classList.add("hidden");

    const initialInsights = [
        "A LongView está processando suas métricas de desempenho...",
        "Orgulhosamente criado por Carlos Guru",
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

    // Tempo de exibição: 15s para atualização da API, 1.5s para cache local
    const isCache = !isRefresh && !!localStorage.getItem('mv_data_cache');
    const DISPLAY_DURATION = isCache ? 1500 : 15000;

    let width = 0;
    const stepTime = 100;
    const totalSteps = DISPLAY_DURATION / stepTime;
    const increment = 100 / totalSteps;

    const interval = setInterval(() => {
        if (width >= 99) {
            clearInterval(interval);
        } else {
            width += increment;
            bar.style.width = Math.min(width, 99) + "%";
        }
    }, stepTime);

    if (isRefresh) {
        loadingText.innerText = "Forçando sincronização total com APIs...";
    } else if (isCache) {
        const ts = localStorage.getItem('mv_data_cache_ts');
        const tsStr = ts ? new Date(ts).toLocaleString('pt-BR') : '';
        loadingText.innerText = tsStr ? `Carregando cache local (${tsStr})...` : "Carregando dados do cache local...";
    } else {
        loadingText.innerText = "Conectando ao Portal de Inteligência...";
    }

    fetchAllData(isRefresh).then(() => {
        clearInterval(insightInterval);
        const remainingTime = Math.max(0, DISPLAY_DURATION - (Date.now() - startTime));

        setTimeout(() => {
            clearInterval(interval);
            bar.style.width = "100%";
            loadingText.innerText = "Dashboard Pronto!";
            setTimeout(() => {
                overlay.classList.add("hidden");
                app.classList.remove("hidden");
                setupEventListeners();
            }, 400);
        }, remainingTime);
    }).catch(err => {
        console.error("Erro fatal no carregamento:", err);
        clearInterval(insightInterval);
        clearInterval(interval);
        loadingText.innerText = "Falha na conexão. Tentando recuperar...";
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

    // Filtros de Coluna (Leads e Campanhas)
    document.querySelectorAll(".col-filter").forEach(input => {
        const handler = () => {
            if (input.getAttribute("data-col") === "campanha") {
                applyCampaignTableFilters();
            } else {
                applyTableFilters();
            }
        };
        input.addEventListener("input", handler);
        input.addEventListener("change", handler);
    });

    // Filtros de Coluna (Vendas)
    document.querySelectorAll(".col-filter-sales").forEach(input => {
        input.addEventListener("input", applySalesTableFilters);
        input.addEventListener("change", applySalesTableFilters);
    });

    // Navegação Lateral (Desktop)
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", (e) => {
            const view = item.getAttribute("data-view");
            if (view) {
                e.preventDefault();
                switchView(view);
            }
        });
    });

    // Navegação Inferior (Mobile)
    document.querySelectorAll(".mobile-nav-item").forEach(item => {
        item.addEventListener("click", (e) => {
            const view = item.getAttribute("data-view");
            if (view) {
                e.preventDefault();
                switchView(view);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
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
            
            // Limpar também filtros de coluna das tabelas no mobile
            document.querySelectorAll(".col-filter, .col-filter-sales, .col-filter-stock").forEach(input => {
                input.value = "";
            });
            
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
            document.querySelectorAll(".col-filter, .col-filter-sales, .col-filter-stock").forEach(input => {
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
                container.querySelectorAll(".col-filter, .col-filter-sales, .col-filter-stock").forEach(input => {
                    input.value = "";
                });
                
                // Identificar qual tabela re-filtrar com base nos inputs presentes no container
                const hasSalesFilters = container.querySelector(".col-filter-sales") !== null;
                const hasCampaignFilters = container.querySelector('[data-col="campanha"]') !== null;
                const hasStockFilters = container.querySelector(".col-filter-stock") !== null;
                
                if (hasSalesFilters) {
                    applySalesTableFilters();
                } else if (hasCampaignFilters) {
                    applyCampaignTableFilters();
                } else if (hasStockFilters) {
                    populateStockFilters();
                    renderEmpreendimentosTable();
                } else {
                    applyTableFilters();
                }
                
                if (typeof filterAdsTable === 'function') {
                    filterAdsTable();
                }
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

    // Cores Oficiais CV CRM
    if (s.includes("aguardando atendimento corretor")) return { bg: "#FFEA00", text: "#000000" };
    if (s === "aguardando atendimento")               return { bg: "#FF0F47", text: "#FFFFFF" };
    if (s.includes("sdr"))                            return { bg: "#00E676", text: "#000000" };
    if (s === "em atendimento")                       return { bg: "#FF8A00", text: "#FFFFFF" };
    if (s.includes("visita agendada"))                return { bg: "#00B0FF", text: "#FFFFFF" };
    if (s.includes("visita realizada"))               return { bg: "#00897B", text: "#FFFFFF" };
    if (s.includes("simula"))                         return { bg: "#FF5252", text: "#FFFFFF" };
    if (s.includes("reserva"))                        return { bg: "#2979FF", text: "#FFFFFF" };
    if (s === "venda realizada" || s.includes("vendid") || s.includes("ganho")) return { bg: "#FFFFFF", text: "#000000" };
    if (s.includes("perdid") || s === "perdido")      return { bg: "#6B7280", text: "#FFFFFF" };
    if (s.includes("lançamento") || s.includes("lancamento")) return { bg: "#8B5CF6", text: "#FFFFFF" };
    if (s.includes("qualificad"))                     return { bg: "#F59E0B", text: "#000000" };
    if (s.includes("proposta"))                       return { bg: "#EC4899", text: "#FFFFFF" };
    if (s.includes("negociacao") || s.includes("negociação")) return { bg: "#F97316", text: "#FFFFFF" };

    return { bg: "#4B5563", text: "#E5E7EB" };
}

const MV_CACHE_KEY = 'mv_data_cache';
const MV_CACHE_TS_KEY = 'mv_data_cache_ts';

function applyDataToApp(data) {
    window.lastMetaData = data;

    if (data.leads && data.leads.leads) {
        allLeads = data.leads.leads;
    } else if (Array.isArray(data.leads)) {
        allLeads = data.leads;
    } else {
        allLeads = [];
    }

    if (data.meta) {
        window.lastMetaDemographics  = data.meta.demographics  || [];
        window.lastMetaRegions       = data.meta.regions       || [];
        window.lastMetaCampaigns     = data.meta.campaigns     || [];
        window.lastMetaPlatforms     = data.meta.platforms     || [];
        window.lastMetaDevices       = data.meta.devices       || [];
        window.lastMetaAdsets        = data.meta.adsets        || [];
        window.lastMetaDaily         = data.meta.daily         || [];
        window.lastMetaGlobal        = data.meta.global;

        renderMetaDemographics(window.lastMetaDemographics, window.lastMetaRegions);
        renderMetaPlatforms(data.meta.platforms || []);
        renderMetaDevices(data.meta.devices || []);
        renderMetaDaily(data.meta.daily || []);
        renderCampaignsTable(window.lastMetaCampaigns);
        renderAdsetsTable(window.lastMetaAdsets);
        updateMetaDashboard(window.lastMetaGlobal);
    }

    applyGlobalFilters();
    generateRealInsights();

    const innerLoader = document.getElementById("loader");
    const contentArea = document.getElementById("content-area");
    if (innerLoader) innerLoader.classList.add("hidden");
    if (contentArea) contentArea.classList.remove("hidden");
}

async function fetchAllData(force = false) {
    const loadingText = document.getElementById("loading-text");

    // Usar cache local se não for atualização forçada
    if (!force) {
        try {
            const cached = localStorage.getItem(MV_CACHE_KEY);
            if (cached) {
                if (loadingText) loadingText.textContent = "Carregando dados do cache local...";
                applyDataToApp(JSON.parse(cached));
                return true;
            }
        } catch (e) {
            console.warn("Cache corrompido, buscando da API...", e);
            localStorage.removeItem(MV_CACHE_KEY);
            localStorage.removeItem(MV_CACHE_TS_KEY);
        }
    }

    try {
        if (loadingText) loadingText.textContent = "Sincronizando com o servidor...";

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

        // Salvar no cache local para próximas visitas
        try {
            localStorage.setItem(MV_CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(MV_CACHE_TS_KEY, new Date().toISOString());
        } catch (e) {
            console.warn("Não foi possível salvar cache:", e);
        }

        applyDataToApp(data);
        return true;

    } catch (error) {
        console.error("Erro na sincronização:", error);

        // Fallback: tentar usar cache mesmo em erro
        try {
            const cached = localStorage.getItem(MV_CACHE_KEY);
            if (cached) {
                if (loadingText) loadingText.textContent = "Servidor indisponível — usando cache local...";
                applyDataToApp(JSON.parse(cached));
                return true;
            }
        } catch (e) { /* sem cache disponível */ }

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
    updateOportunidadesPerdas(filteredLeads);
    updateEmpreendimentos(filteredLeads);
    populateDropdowns(filteredLeads);
    applyTableFilters(); // Atualiza tabela de leads respeitando filtros das colunas
    applyCampaignTableFilters(); // Atualiza tabela de campanhas
    applySalesTableFilters(); // Atualiza tabela de vendas
    
    // Atualizar Meta Ads buscando os dados reais filtrados no servidor
    fetchFilteredMetaData(startDate, endDate);
}

async function fetchFilteredMetaData(start, end) {
    // Se não tiver datas, volta ao original (Tudo)
    if (!start && !end) {
        if (window.lastMetaGlobal) {
            renderMetaDemographics(window.lastMetaDemographics, window.lastMetaRegions);
            renderMetaPlatforms(window.lastMetaPlatforms || []);
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
        window.lastMetaData = data; // CRITICAL: Atualizar dados globais ao filtrar
        
        if (data.meta) {
            window.lastMetaDemographics = data.meta.demographics || [];
            window.lastMetaRegions      = data.meta.regions      || [];
            window.lastMetaCampaigns    = data.meta.campaigns    || [];
            window.lastMetaPlatforms    = data.meta.platforms    || [];
            window.lastMetaDevices      = data.meta.devices      || [];
            window.lastMetaAdsets       = data.meta.adsets       || [];
            window.lastMetaDaily        = data.meta.daily        || [];
            window.lastMetaGlobal       = data.meta.global;

            renderMetaDemographics(data.meta.demographics || [], data.meta.regions || []);
            renderMetaPlatforms(data.meta.platforms || []);
            renderMetaDevices(data.meta.devices || []);
            renderMetaDaily(data.meta.daily || []);
            renderCampaignsTable(data.meta.campaigns || []);
            renderAdsetsTable(data.meta.adsets || []);
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
        status: new Set(),
        tag: new Set()
    };
    
    leadsArray.forEach(lead => {
        uniqueValues.origem.add(getOrigin(lead));
        if(lead.corretor && lead.corretor.nome) uniqueValues.corretor.add(lead.corretor.nome);
        if(lead.gestor && lead.gestor.nome) uniqueValues.gestor.add(lead.gestor.nome);
        if(lead.imobiliaria && lead.imobiliaria.nome) uniqueValues.imobiliaria.add(lead.imobiliaria.nome);
        if(lead.empreendimento && lead.empreendimento.length > 0) uniqueValues.empreendimento.add(lead.empreendimento[0].nome);
        if(lead.situacao && lead.situacao.nome) uniqueValues.status.add(lead.situacao.nome);
        if(lead.tags) {
            if(Array.isArray(lead.tags)) {
                lead.tags.forEach(t => {
                    const name = typeof t === 'string' ? t : (t && t.nome ? t.nome : "");
                    if(name.trim()) uniqueValues.tag.add(name.trim());
                });
            } else if(typeof lead.tags === 'string' && lead.tags.trim()) {
                uniqueValues.tag.add(lead.tags.trim());
            }
        }
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

// --- SISTEMA DE VISUALIZAÇÃO MOBILE (PIRÂMIDES) ---
function isMobile() { return window.innerWidth < 768; }

function renderMobilePyramidSVG(canvasId, dataObj, _unit = "leads") {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const parent = canvas.parentElement;
    
    // Garantir que temos um container para o SVG
    let svgContainer = parent.querySelector('.mobile-pyramid-wrapper');
    if (!svgContainer) {
        svgContainer = document.createElement('div');
        svgContainer.className = 'mobile-pyramid-wrapper';
        parent.appendChild(svgContainer);
    }

    const sorted = Object.entries(dataObj).sort((a, b) => b[1] - a[1]).slice(0, 7);
    if (sorted.length === 0) {
        svgContainer.innerHTML = "<p style='color:#94a3b8; font-size:12px; padding:20px;'>Sem dados para exibir</p>";
        return;
    }

    const total = sorted.reduce((acc, curr) => acc + curr[1], 0);
    const n = sorted.length;
    const svgW = 400;
    const svgH = Math.max(280, n * 50);
    const topW = 280;
    const botW = 20;
    const centerX = 150;
    const sectionH = svgH / n;
    const palette = ['#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#0ea5e9', '#6366F1'];

    let html = `<svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%; height:auto; overflow:visible;">`;
    html += `<defs><filter id="pShadow"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.3"/></filter></defs>`;

    sorted.forEach((item, i) => {
        const [name, val] = item;
        const perc = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
        const yT = i * sectionH;
        const yB = (i + 1) * sectionH;
        const wT = topW - (i * (topW - botW) / n);
        const wB = topW - ((i + 1) * (topW - botW) / n);
        const pts = `${centerX - wT/2},${yT} ${centerX + wT/2},${yT} ${centerX + wB/2},${yB} ${centerX - wB/2},${yB}`;
        
        html += `
            <g>
                <polygon points="${pts}" fill="${palette[i % palette.length]}" filter="url(#pShadow)" opacity="${1 - (i*0.05)}"/>
                <text x="${centerX}" y="${yT + sectionH/2 + 5}" text-anchor="middle" fill="#fff" style="font-size:12px; font-weight:800;">${perc}%</text>
                <text x="${centerX + wT/2 + 10}" y="${yT + sectionH/2 + 4}" fill="#e2e8f0" style="font-size:11px; font-weight:600;">
                    ${name.length > 18 ? name.substring(0,16)+'..' : name} <tspan fill="#94a3b8" font-weight="400">(${val})</tspan>
                </text>
            </g>`;
    });
    html += `</svg>`;

    canvas.style.display = 'none';
    svgContainer.style.display = 'block';
    svgContainer.innerHTML = html;
}

function renderOriginPieChart(origins) {
    if (isMobile()) {
        renderMobilePyramidSVG('originPieChart', origins);
        return;
    }
    const ctx = document.getElementById('originPieChart');
    if(!ctx) return;
    ctx.style.display = 'block';
    const wrapper = ctx.parentElement.querySelector('.mobile-pyramid-wrapper');
    if(wrapper) wrapper.style.display = 'none';
    
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
    // No mobile ou desktop, este gráfico JÁ É pirâmide por design
    const containerId = 'status-pyramid-container';
    const container = document.getElementById(containerId);
    if(!container) return;
    
    // Reaproveitar o motor de pirâmide para consistência
    const sorted = Object.entries(statuses).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
        container.innerHTML = "<p style='color:#94a3b8;'>Sem dados</p>";
        return;
    }
    
    // No status, usamos cores específicas do CRM
    const totalLeads = sorted.reduce((acc, curr) => acc + curr[1], 0);
    const n = sorted.length;
    const svgW = 400;
    const svgH = 380;
    const topW = 300;
    const botW = 20;
    const centerX = 160;
    const sectionH = svgH / n;
    
    let svgHtml = `<svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%; height:100%; overflow: visible;">`;
    svgHtml += `<defs><filter id="pyramidShadow"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/></filter></defs>`;

    sorted.forEach((item, i) => {
        const name = item[0];
        const val = item[1];
        const perc = totalLeads > 0 ? ((val / totalLeads) * 100).toFixed(1) : 0;
        const colorData = getStatusColor(name);
        const yT = i * sectionH;
        const yB = (i + 1) * sectionH;
        const wT = topW - (i * (topW - botW) / n);
        const wB = topW - ((i + 1) * (topW - botW) / n);
        const pts = `${centerX - wT/2},${yT} ${centerX + wT/2},${yT} ${centerX + wB/2},${yB} ${centerX - wB/2},${yB}`;
        
        svgHtml += `
            <g class="pyramid-slice" style="cursor:pointer;">
                <polygon points="${pts}" fill="${colorData.bg}" filter="url(#pyramidShadow)"/>
                <text x="${centerX}" y="${yT + sectionH/2 + 5}" text-anchor="middle" fill="${colorData.text}" style="font-size: 13px; font-weight: 800;">${perc}%</text>
                <text x="${centerX + wT/2 + 15}" y="${yT + sectionH/2 + 4}" fill="#e2e8f0" style="font-size: 11px; font-weight: 600;">
                    ${name} <tspan fill="#94a3b8" font-weight="400">(${val})</tspan>
                </text>
            </g>`;
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
        
        if (filters["tag"]) {
            let leadTags = [];
            if (Array.isArray(lead.tags)) {
                leadTags = lead.tags.map(t => {
                    const tName = typeof t === 'string' ? t : (t && t.nome ? t.nome : "");
                    return tName.toLowerCase().trim();
                });
            } else if (typeof lead.tags === 'string') {
                leadTags = [lead.tags.toLowerCase().trim()];
            }
            if (!leadTags.includes(filters["tag"])) return false;
        }

        if (filters["bolsao"]) {
            const isBolsao = isLeadBolsao(lead);
            if (filters["bolsao"] === "sim" && !isBolsao) return false;
            if (filters["bolsao"] === "nao" && isBolsao) return false;
        }

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
    if (isMobile()) {
        renderMobilePyramidSVG(canvasId, dataObj);
        return;
    }
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    ctx.style.display = 'block';
    const wrapper = ctx.parentElement.querySelector('.mobile-pyramid-wrapper');
    if(wrapper) wrapper.style.display = 'none';
    
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
        let s = lead.situacao && lead.situacao.nome ? lead.situacao.nome : "Desconhecido";
        if (lead.qtde_reservas_associadas && lead.qtde_reservas_associadas > 0 && !isLoss(lead) && !isSale(lead)) {
            s = "Com Reserva";
        }
        statuses[s] = (statuses[s] || 0) + 1;
    });

    const priorityStatuses = ["Visita Agendada", "Com Reserva"];

    const makeBox = (name, count, colors) => {
        const hex = colors.bg.startsWith('#') ? colors.bg : colors.bg;
        const isLight = colors.text === "#000000";
        const countColor = isLight ? colors.bg : '#ffffff';
        return `<div class="summary-box" style="border-bottom-color:${hex}; background:${hex}18;">
            <span class="title" style="color:${hex}">${name}</span>
            <span class="count" style="color:${countColor}">${count}</span>
        </div>`;
    };

    let html = `<div class="summary-box total-box"><span class="title">Total de Leads</span><span class="count">${leadsArray.length}</span></div>`;

    // Etapas prioritárias sempre em primeiro
    priorityStatuses.forEach(name => {
        html += makeBox(name, statuses[name] || 0, getStatusColor(name));
    });

    // Todas as demais etapas (sem limite), ordenadas por quantidade
    const exclude = new Set(["Aguardando Atendimento Corretor", "Em Atendimento SDR", "Desconhecido", ...priorityStatuses]);
    Object.entries(statuses)
        .filter(([name]) => !exclude.has(name) && statuses[name] > 0)
        .sort((a, b) => b[1] - a[1])
        .forEach(([name, count]) => {
            const sampleLead = leadsArray.find(l => (l.situacao?.nome || "Desconhecido") === name);
            const colors = sampleLead ? getStatusColor(sampleLead) : getStatusColor(name);
            html += makeBox(name, count, colors);
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
        
        const unitInfoForRank = getSaleUnitInfo(lead);
        let tName = unitInfoForRank.tipologiaLabel || "Não Informada";
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
    
    const medals = ["🥇", "🥈", "🥉"];
    const positionColors = ["#fbbf24", "#94a3b8", "#cd7c2f", "rgba(255,255,255,0.5)", "rgba(255,255,255,0.4)"];

    list.forEach(([name, data], idx) => {
        const item = document.createElement("div");
        item.className = "list-item";
        const medal = medals[idx] || "";
        const posColor = positionColors[idx] || positionColors[4];
        const posLabel = medal
            ? `<span style="font-size:18px; line-height:1; margin-right:4px;">${medal}</span>`
            : `<span style="font-size:12px; font-weight:700; color:${posColor}; min-width:22px; display:inline-block;">${idx + 1}º</span>`;

        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; min-width:0; flex:1;">
                ${posLabel}
                <div style="display: flex; flex-direction: column; gap: 1px; min-width:0;">
                    <span style="font-weight: 600; font-size: 13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:170px;" title="${name}">${name}</span>
                    <span style="font-size: 11px; color: var(--text-secondary);">${data.count} venda${data.count !== 1 ? "s" : ""}</span>
                </div>
            </div>
            <span style="color: #10B981; font-weight: 700; font-size:13px; white-space:nowrap; flex-shrink:0;">${formatCurrency(data.sum)}</span>
        `;
        container.appendChild(item);
    });
}

function isLeadBolsao(lead) {
    if (!lead) return false;
    
    // 1. Verificar nas tags
    if (lead.tags) {
        let tagsList = [];
        if (Array.isArray(lead.tags)) {
            tagsList = lead.tags;
        } else if (typeof lead.tags === 'string') {
            tagsList = [lead.tags];
        }
        for (let tag of tagsList) {
            let tagName = "";
            if (typeof tag === 'string') tagName = tag;
            else if (tag && typeof tag === 'object' && tag.nome) tagName = tag.nome;
            
            tagName = tagName.toLowerCase();
            if (tagName.includes("bolsão") || tagName.includes("bolsao")) {
                return true;
            }
        }
    }
    
    // 2. Verificar nas interações
    if (lead.interacao && Array.isArray(lead.interacao)) {
        for (let inter of lead.interacao) {
            const desc = (inter.descricao || "").toLowerCase();
            if (desc.includes("bolsão") || desc.includes("bolsao")) {
                return true;
            }
        }
    }
    
    // 3. Verificar na situação/status
    const statusName = (lead.situacao && lead.situacao.nome ? lead.situacao.nome : "").toLowerCase();
    if (statusName.includes("bolsão") || statusName.includes("bolsao")) {
        return true;
    }
    
    return false;
}

function getLeadCRMUrl(lead) {
    if (!lead) return "#";
    if (lead.link_interesses) return lead.link_interesses;
    if (lead.link_interacoes) return lead.link_interacoes;
    const id = lead.id_lead || lead.id || lead.idlead;
    if (id) {
        return `https://longviewempreendimentos.cvcrm.com.br/gestor/comercial/leads/${id}/detalhes`;
    }
    return "#";
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
        let tipologiaLabel = "-";
        if (lead.empreendimento && lead.empreendimento.length > 0) {
            emp = lead.empreendimento[0].nome || "-";
        }
        // Cruzar com inventário para unidade e tipologia reais
        if (tbodyId === "table-sales-body") {
            const unitInfo = getSaleUnitInfo(lead);
            unidade = unitInfo.unidade;
            tipologiaLabel = unitInfo.tipologiaLabel;
        } else {
            if (lead.empreendimento && lead.empreendimento.length > 0) {
                if (lead.empreendimento[0].unidade) unidade = lead.empreendimento[0].unidade;
                if (lead.empreendimento[0].tipologia) tipologiaLabel = lead.empreendimento[0].tipologia;
            } else {
                if (lead.unidade) unidade = lead.unidade;
                if (lead.tipologia) tipologiaLabel = lead.tipologia;
            }
        }
        
        const source = getOrigin(lead);
        const corretor = (lead.corretor && lead.corretor.nome) ? lead.corretor.nome : "-";
        const imobiliaria = (lead.imobiliaria && lead.imobiliaria.nome) ? lead.imobiliaria.nome : "-";
        const gestor = (lead.gestor && lead.gestor.nome) ? lead.gestor.nome : "-";
        
        let valStr = lead.valor_negocio || "0,00";
        const valFormatted = `R$ ${valStr}`;
        
        const statusName = lead.situacao && lead.situacao.nome ? lead.situacao.nome : "Novo";
        const colors = getStatusColor(lead);
        
        const leadLink = getLeadCRMUrl(lead);
        const corretorStr = (lead.corretor && lead.corretor.nome) ? lead.corretor.nome : "Sem corretor";
        const clientCellContent = leadLink !== "#"
            ? `<a href="${leadLink}" target="_blank" style="color: #60A5FA; text-decoration: none; border-bottom: 1px dashed rgba(96, 165, 250, 0.4); font-weight: 600;">${name}</a><div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px;">Corretor: ${corretorStr}</div>`
            : `<strong>${name}</strong><div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px;">Corretor: ${corretorStr}</div>`;
        
        if (tbodyId === "table-sales-body") {
            // Badge colorido por tipologia
            const tipColors = {
                "1 Quarto":   { bg: "rgba(14,165,233,0.15)",   color: "#38bdf8" },
                "2 Quartos":  { bg: "rgba(16,185,129,0.15)",   color: "#34d399" },
                "3 Quartos":  { bg: "rgba(139,92,246,0.15)",   color: "#a78bfa" },
                "Cobertura":  { bg: "rgba(245,158,11,0.15)",   color: "#fbbf24" },
                "Loja":       { bg: "rgba(236,72,153,0.15)",   color: "#f472b6" },
                "Não Informada": { bg: "rgba(148,163,184,0.1)", color: "#94a3b8" }
            };
            const tColor = tipColors[tipologiaLabel] || tipColors["Não Informada"];
            const tipBadge = `<span style="background:${tColor.bg}; color:${tColor.color}; border:1px solid ${tColor.color}30; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; white-space:nowrap;">${tipologiaLabel}</span>`;
            tr.innerHTML = `
                <td data-label="Cliente">${clientCellContent}</td>
                <td data-label="Data">${dataCad}</td>
                <td data-label="Status"><span class="status-badge" style="background-color: ${colors.bg}; color: ${colors.text}; border: 1px solid rgba(255,255,255,0.1);">${statusName}</span></td>
                <td data-label="Origem">${source}</td>
                <td data-label="Corretor">${corretor}</td>
                <td data-label="Imobiliária">${imobiliaria}</td>
                <td data-label="Gestor">${gestor}</td>
                <td data-label="Empreendimento">${emp}</td>
                <td data-label="Unidade"><strong style="color:#e2e8f0; letter-spacing:0.5px;">${unidade}</strong></td>
                <td data-label="Tipologia">${tipBadge}</td>
                <td data-label="Valor"><strong style="color: #10B981; font-size:14px;">${valFormatted}</strong></td>
            `;
        } else {
            let tagsHtml = `<span style="color: var(--text-secondary); font-size: 13px;">-</span>`;
            if (lead.tags) {
                let tagsList = [];
                if (Array.isArray(lead.tags)) {
                    tagsList = lead.tags;
                } else if (typeof lead.tags === 'string') {
                    tagsList = [lead.tags];
                }
                
                const validTags = tagsList
                    .map(t => typeof t === 'string' ? t.trim() : (t && t.nome ? t.nome.trim() : ""))
                    .filter(t => t !== "");
                
                if (validTags.length > 0) {
                    tagsHtml = validTags.map(tName => {
                        return `<span class="tag-badge" style="background: rgba(14, 165, 233, 0.12); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.25); padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px; display: inline-block; white-space: nowrap; margin-bottom: 2px;">${tName}</span>`;
                    }).join("");
                }
            }

            const bolsao = isLeadBolsao(lead);
            const bolsaoHtml = bolsao 
                ? `<span class="bolsao-badge" style="background: rgba(167, 139, 250, 0.12); color: #c084fc; border: 1px solid rgba(167, 139, 250, 0.25); padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; display: inline-block;">Sim</span>`
                : `<span style="color: var(--text-secondary); font-size: 13px;">Não</span>`;

            tr.innerHTML = `
                <td data-label="Cliente">${clientCellContent}</td>
                <td data-label="Data">${dataCad}</td>
                <td data-label="Status"><span class="status-badge" style="background-color: ${colors.bg}; color: ${colors.text}; border: 1px solid rgba(255,255,255,0.1);">${statusName}</span></td>
                <td data-label="Origem">${source}</td>
                <td data-label="Corretor">${corretor}</td>
                <td data-label="Imobiliária">${imobiliaria}</td>
                <td data-label="Gestor">${gestor}</td>
                <td data-label="Empreendimento">${emp}</td>
                <td data-label="Tags">${tagsHtml}</td>
                <td data-label="Bolsão">${bolsaoHtml}</td>
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
    
    // Pegar detalhes extras (datas reais) vindos do backend
    const detailsMapById = {};
    const detailsMapByName = {};
    const details = window.lastMetaData && window.lastMetaData.meta ? window.lastMetaData.meta.campaignDetails : [];
    
    if (details && details.length > 0) {
        details.forEach(d => {
            if (d.id) detailsMapById[d.id.toString()] = d;
            if (d.name) detailsMapByName[d.name.toLowerCase().trim()] = d;
        });
    }

    const translateObjective = (obj, name = "") => {
        const n = name.toUpperCase();
        
        // Fallback por Nome (Muito comum se a API omitir o campo objective)
        if (n.includes("RECONHECIMENTO")) return "Reconhecimento";
        if (n.includes("ENG ") || n.includes("ENGAJAMENTO")) return "Engajamento";
        if (n.includes("TRAFEGO") || n.includes("TRAFFIC")) return "Tráfego";
        if (n.includes("CADASTRO") || n.includes("LEAD")) return "Cadastros (Leads)";

        const map = {
            'OUTREACH': 'Reconhecimento',
            'OUTCOMES': 'Conversão/Leads',
            'TRAFFIC': 'Tráfego',
            'ENGAGEMENT': 'Engajamento',
            'LEAD_GENERATION': 'Cadastros (Leads)',
            'APP_PROMOTION': 'App',
            'SALES': 'Vendas',
            'CONVERSIONS': 'Conversões',
            'AWARENESS': 'Reconhecimento'
        };
        
        if (map[obj]) return map[obj];
        if (obj && obj !== "UNKNOWN") return obj;

        return "Marketing";
    };

    // Função auxiliar para tentar extrair data do nome (ex: 09/09/2024)
    const extractDateFromName = (name) => {
        const regex = /(\d{2})\/(\d{2})\/(\d{4})/;
        const match = name.match(regex);
        if (match) {
            const [_, day, month, year] = match;
            return new Date(`${year}-${month}-${day}T12:00:00`); // Meio dia para evitar timezone jump
        }
        return null;
    };

    // Ordenar pelas mais recentes baseando-se na data de CRIAÇÃO REAL
    const sortedCampaigns = [...campaigns].sort((a, b) => {
        const idA = a.campaign_id ? a.campaign_id.toString() : "";
        const idB = b.campaign_id ? b.campaign_id.toString() : "";
        const nameA = a.campaign_name || "";
        const nameB = b.campaign_name || "";

        const detA = detailsMapById[idA] || detailsMapByName[nameA.toLowerCase().trim()];
        const detB = detailsMapById[idB] || detailsMapByName[nameB.toLowerCase().trim()];

        const dateA = detA ? new Date(detA.created_time || detA.start_time) : (extractDateFromName(nameA) || new Date(a.date_start));
        const dateB = detB ? new Date(detB.created_time || detB.start_time) : (extractDateFromName(nameB) || new Date(b.date_start));
        
        return dateB - dateA;
    });

    const filterInput = document.querySelector('.col-filter[data-col="campanha"]');
    const filterText = filterInput ? filterInput.value.toLowerCase().trim() : "";

    const filtered = sortedCampaigns.filter(c => 
        (c.campaign_name || "").toLowerCase().includes(filterText)
    );

    filtered.forEach(camp => {
        const name        = camp.campaign_name || "Desconhecido";
        const spend       = parseFloat(camp.spend || 0);
        const impressions = parseInt(camp.impressions || 0);
        const clicks      = parseInt(camp.clicks || 0);
        const reach       = parseInt(camp.reach || 0);
        const frequency   = parseFloat(camp.frequency || 0);
        const cpc         = parseFloat(camp.cpc || 0);
        const cpm         = parseFloat(camp.cpm || 0);
        const ctr         = parseFloat(camp.ctr || 0);
        
        // Metadados
        const id = camp.campaign_id ? camp.campaign_id.toString() : "";
        const det = detailsMapById[id] || detailsMapByName[name.toLowerCase().trim()];
        
        let objStr = translateObjective(det ? det.objective : "", name);
        let start = det ? new Date(det.created_time || det.start_time) : (extractDateFromName(name) || new Date(camp.date_start));
        let stop = det && det.stop_time ? new Date(det.stop_time) : null;
        
        const startStr = start.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'2-digit'});
        const stopStr = stop ? stop.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'2-digit'}) : "Ativa";
        
        const endCalc = stop || new Date();
        const diffTime = Math.abs(endCalc - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const durationStr = `${diffDays} dias`;

        let metaLeads = 0;
        if (camp.actions) {
            const leadAction = camp.actions.find(a => a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead');
            if (leadAction) metaLeads = parseInt(leadAction.value);
        }

        const crmLeadsMatched = findCRMLeadsForCampaign(name);
        const crmLeadsCount = crmLeadsMatched.length;
        
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
        
        // CPL direto da Meta por campanha
        let campCplMeta = 0;
        if (camp.cost_per_action_type) {
            const cpa = camp.cost_per_action_type.find(a =>
                a.action_type === 'lead' || a.action_type.includes('leadgen')
            );
            if (cpa) campCplMeta = parseFloat(cpa.value || 0);
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td data-label="Campanha"><strong>${name}</strong></td>
            <td data-label="Objetivo"><span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1);">${objStr}</span></td>
            <td data-label="Início" style="font-size: 12px; color: #10B981; font-weight: 600;">${startStr}</td>
            <td data-label="Término" style="font-size: 12px; color: var(--text-secondary);">${stopStr}</td>
            <td data-label="Duração" style="font-size: 12px;">${durationStr}</td>
            <td data-label="Investimento"><strong style="color: #F43F5E;">${formatCurrency(spend)}</strong></td>
            <td data-label="Alcance" style="font-size: 12px;">${reach > 0 ? reach.toLocaleString('pt-BR') : '—'}</td>
            <td data-label="Freq." style="font-size: 12px;">${frequency > 0 ? frequency.toFixed(2) + 'x' : '—'}</td>
            <td data-label="CTR">${ctr > 0 ? ctr.toFixed(2) + '%' : '—'}</td>
            <td data-label="CPC">${cpc > 0 ? formatCurrency(cpc) : '—'}</td>
            <td data-label="Imp/Cliques">${impressions.toLocaleString('pt-BR')} / ${clicks.toLocaleString('pt-BR')}</td>
            <td data-label="Leads (Meta)">${metaLeads > 0 ? metaLeads : '—'}</td>
            <td data-label="CPL Meta">${campCplMeta > 0 ? formatCurrency(campCplMeta) : cplStr}</td>
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

    // Métricas calculadas pela Meta (v21.0) — mais precisas que calcular manualmente
    document.getElementById("meta-cpc").innerText   = formatCurrency(parseFloat(insights.cpc || 0));
    document.getElementById("meta-cpm").innerText   = formatCurrency(parseFloat(insights.cpm || 0));
    document.getElementById("meta-ctr").innerText   = (parseFloat(insights.ctr || 0)).toFixed(2) + "%";

    // Novos KPIs: Reach, Frequency, CPP
    const reach     = parseInt(insights.reach || 0);
    const frequency = parseFloat(insights.frequency || 0);
    const cpp       = parseFloat(insights.cpp || 0);

    const elReach = document.getElementById("meta-reach");
    if (elReach) elReach.innerText = reach.toLocaleString('pt-BR');

    const elFreq = document.getElementById("meta-frequency");
    if (elFreq) elFreq.innerText = frequency.toFixed(2) + "x";

    const elCpp = document.getElementById("meta-cpp");
    if (elCpp) elCpp.innerText = formatCurrency(cpp);

    // CPL direto da Meta (cost_per_action_type) — mais preciso que calcular pelo CRM
    let metaCplDirect = 0;
    if (insights.cost_per_action_type) {
        const leadCpa = insights.cost_per_action_type.find(a =>
            a.action_type === 'lead' ||
            a.action_type === 'offsite_conversion.fb_pixel_lead' ||
            a.action_type.includes('leadgen')
        );
        if (leadCpa) metaCplDirect = parseFloat(leadCpa.value || 0);
    }
    const elCplMeta = document.getElementById("meta-cpl-direct");
    if (elCplMeta) elCplMeta.innerText = metaCplDirect > 0 ? formatCurrency(metaCplDirect) : "—";

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
        "oportunidades-perdas": "Oportunidades & Perdas",
        "empreendimentos": "Gestão de Empreendimentos",
        "vendas": "Relatório de Vendas",
        "marketing": "Marketing ADS"
    };
    document.getElementById("page-title").textContent = titleMap[viewName] || "Dashboard";
    
    if (viewName === "empreendimentos") {
        updateEmpreendimentos(filteredLeads);
    } else if (viewName === "vendas") {
        // Re-renderizar a tela de vendas para garantir cruzamento atualizado com o inventário
        const salesLeads = filteredLeads.filter(l => isSale(l));
        applySalesTableFilters();
        renderTop5(salesLeads);
        renderSalesSummary(salesLeads);
    }
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

function formatCompactCurrency(value) {
    if (value === undefined || value === null || isNaN(value)) return "R$ 0,00";
    if (value >= 1000000) {
        const val = value / 1000000;
        return "R$ " + val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + " M";
    } else if (value >= 1000) {
        const val = value / 1000;
        return "R$ " + val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + " mil";
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
}


// ─── RENDER: Device breakdown (Mobile vs Desktop) ─────────────────────────────
function renderMetaDevices(deviceData) {
    const devices = {};
    deviceData.forEach(d => {
        const platform = d.device_platform || 'other';
        const key = platform.charAt(0).toUpperCase() + platform.slice(1);
        devices[key] = (devices[key] || 0) + parseInt(d.clicks || 0);
    });

    const ctx = document.getElementById("metaDeviceChart");
    if (!ctx) return;

    const labels = Object.keys(devices);
    const values = Object.values(devices);
    const colors = { 'Mobile': '#0ea5e9', 'Desktop': '#8B5CF6', 'Other': '#64748b' };

    if (window.metaDeviceChartInstance) window.metaDeviceChartInstance.destroy();
    window.metaDeviceChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        plugins: [ChartDataLabels],
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: labels.map(l => colors[l] || '#64748b'),
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
                        const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                        return sum > 0 ? ((val / sum) * 100).toFixed(1) + "%" : "";
                    }
                }
            }
        }
    });
}

// ─── RENDER: Daily time series (gráfico de evolução) ─────────────────────────
function renderMetaDaily(dailyData) {
    if (!dailyData || dailyData.length === 0) return;

    const sorted = [...dailyData].sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
    const labels    = sorted.map(d => new Date(d.date_start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    const spendData = sorted.map(d => parseFloat(d.spend || 0));
    const clickData = sorted.map(d => parseInt(d.clicks || 0));
    const reachData = sorted.map(d => parseInt(d.reach || 0));

    // Spend acumulado
    const cumulativeSpend = [];
    spendData.reduce((acc, val, i) => { cumulativeSpend[i] = acc + val; return cumulativeSpend[i]; }, 0);

    const ctx = document.getElementById("metaDailyChart");
    if (!ctx) return;

    if (window.metaDailyChartInstance) window.metaDailyChartInstance.destroy();
    window.metaDailyChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Investimento Diário (R$)',
                    data: spendData,
                    borderColor: '#F43F5E',
                    backgroundColor: 'rgba(244, 63, 94, 0.1)',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'ySpend',
                    pointRadius: sorted.length > 30 ? 0 : 3,
                },
                {
                    label: 'Cliques Diários',
                    data: clickData,
                    borderColor: '#0ea5e9',
                    backgroundColor: 'rgba(14, 165, 233, 0.08)',
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'yClicks',
                    pointRadius: sorted.length > 30 ? 0 : 3,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    ticks: { color: '#94a3b8', maxRotation: 45, autoSkip: true, maxTicksLimit: 15 },
                    grid: { color: 'rgba(255,255,255,0.04)' }
                },
                ySpend: {
                    type: 'linear',
                    position: 'left',
                    ticks: { color: '#F43F5E', callback: v => 'R$' + v.toLocaleString('pt-BR') },
                    grid: { color: 'rgba(255,255,255,0.04)' }
                },
                yClicks: {
                    type: 'linear',
                    position: 'right',
                    ticks: { color: '#0ea5e9' },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { labels: { color: '#e2e8f0' } },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            if (ctx.dataset.label.includes('Investimento')) {
                                return ' ' + ctx.dataset.label + ': ' + formatCurrency(ctx.raw);
                            }
                            return ' ' + ctx.dataset.label + ': ' + ctx.raw.toLocaleString('pt-BR');
                        }
                    }
                },
                datalabels: { display: false }
            }
        }
    });

    // Atualizar métricas de resumo do período
    const totalSpend    = spendData.reduce((a, b) => a + b, 0);
    const totalClicks   = clickData.reduce((a, b) => a + b, 0);
    const avgDailySpend = spendData.length > 0 ? totalSpend / spendData.length : 0;
    const elAvgSpend    = document.getElementById("meta-avg-daily-spend");
    if (elAvgSpend) elAvgSpend.innerText = formatCurrency(avgDailySpend);
    const elDays = document.getElementById("meta-active-days");
    if (elDays) elDays.innerText = spendData.filter(s => s > 0).length + " dias ativos";
}

// ─── RENDER: Adsets table ────────────────────────────────────────────────────
function renderAdsetsTable(adsets) {
    const tbody = document.getElementById("table-adsets-body");
    if (!tbody || !adsets || adsets.length === 0) return;
    tbody.innerHTML = "";

    const sorted = [...adsets].sort((a, b) => parseFloat(b.spend || 0) - parseFloat(a.spend || 0));

    sorted.forEach(adset => {
        const spend       = parseFloat(adset.spend || 0);
        const impressions = parseInt(adset.impressions || 0);
        const clicks      = parseInt(adset.clicks || 0);
        const reach       = parseInt(adset.reach || 0);
        const cpc         = parseFloat(adset.cpc || 0);
        const cpm         = parseFloat(adset.cpm || 0);
        const ctr         = parseFloat(adset.ctr || 0);

        let metaLeads = 0;
        if (adset.actions) {
            const leadAction = adset.actions.find(a =>
                a.action_type === 'lead' ||
                a.action_type === 'offsite_conversion.fb_pixel_lead' ||
                a.action_type.includes('leadgen')
            );
            if (leadAction) metaLeads = parseInt(leadAction.value || 0);
        }

        let cplDirect = 0;
        if (adset.cost_per_action_type) {
            const cpa = adset.cost_per_action_type.find(a =>
                a.action_type === 'lead' || a.action_type.includes('leadgen')
            );
            if (cpa) cplDirect = parseFloat(cpa.value || 0);
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td data-label="Campanha" style="font-size:11px;color:var(--text-secondary);">${adset.campaign_name || '—'}</td>
            <td data-label="Adset"><strong>${adset.adset_name || '—'}</strong></td>
            <td data-label="Investimento"><strong style="color:#F43F5E;">${formatCurrency(spend)}</strong></td>
            <td data-label="Alcance">${reach.toLocaleString('pt-BR')}</td>
            <td data-label="Impressões">${impressions.toLocaleString('pt-BR')}</td>
            <td data-label="Cliques">${clicks.toLocaleString('pt-BR')}</td>
            <td data-label="CTR">${ctr.toFixed(2)}%</td>
            <td data-label="CPC">${formatCurrency(cpc)}</td>
            <td data-label="CPM">${formatCurrency(cpm)}</td>
            <td data-label="Leads (Meta)">${metaLeads > 0 ? metaLeads : '—'}</td>
            <td data-label="CPL (Meta)">${cplDirect > 0 ? formatCurrency(cplDirect) : '—'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function applyCampaignTableFilters() {
    if (window.lastMetaCampaigns) {
        renderCampaignsTable(window.lastMetaCampaigns);
    }
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

function isLoss(lead) {
    if (lead.motivo_cancelamento && lead.motivo_cancelamento.nome) return true;
    if (!lead.situacao || !lead.situacao.nome) return false;
    const s = lead.situacao.nome.toLowerCase();
    return s.includes("perdido") || s.includes("descartado") || s.includes("inativo") || s.includes("cancelado") || s.includes("lixeira") || s.includes("desist") || s.includes("reprovado");
}

function isOpportunity(lead) {
    if (isSale(lead) || isLoss(lead)) return false;
    if ((lead.qtde_simulacoes_associadas && lead.qtde_simulacoes_associadas > 0) || 
        (lead.qtde_reservas_associadas && lead.qtde_reservas_associadas > 0)) {
        return true;
    }
    if (!lead.situacao || !lead.situacao.nome) return false;
    const s = lead.situacao.nome.toLowerCase();
    return s.includes("visita") || 
           s.includes("simula") || 
           s.includes("reserva") || 
           s.includes("proposta") || 
           s.includes("negocia") || 
           s.includes("apresenta") || 
           s.includes("crédito") || 
           s.includes("credito");
}

function getLeadValueNumber(lead) {
    if (!lead.valor_negocio) return 0;
    const numStr = lead.valor_negocio.toString().replace(/\./g, '').replace(',', '.');
    const num = parseFloat(numStr);
    return isNaN(num) ? 0 : num;
}

function updateOportunidadesPerdas(leads) {
    if (!leads) return;

    setTimeout(() => {
        try {
            const leadsQuentes = leads.filter(l => isOpportunity(l));
            const leadsPerdidos = leads.filter(l => isLoss(l));

            // KPIs Padrão
            const totalLeadsQuentes = leadsQuentes.length;
            const totalLeadsPerdidos = leadsPerdidos.length;

            const vgvPotencial = leadsQuentes.reduce((acc, l) => acc + getLeadValueNumber(l), 0);
            const vgvPerdido = leadsPerdidos.reduce((acc, l) => acc + getLeadValueNumber(l), 0);

            const taxaDescarte = leads.length > 0 ? (totalLeadsPerdidos / leads.length) * 100 : 0;

            // Renderizar KPIs no HTML
            const elLeadsQuentes = document.getElementById("kpi-leads-quentes");
            const elVgvPotencial = document.getElementById("kpi-vgv-potencial");
            const elLeadsPerdidos = document.getElementById("kpi-leads-perdidos");
            const elVgvPerdido = document.getElementById("kpi-vgv-perdido");
            const elTaxaDescarte = document.getElementById("kpi-taxa-descarte");

            if (elLeadsQuentes) elLeadsQuentes.textContent = totalLeadsQuentes;
            if (elVgvPotencial) elVgvPotencial.textContent = formatCurrency(vgvPotencial);
            if (elLeadsPerdidos) elLeadsPerdidos.textContent = totalLeadsPerdidos;
            if (elVgvPerdido) elVgvPerdido.textContent = formatCurrency(vgvPerdido);
            if (elTaxaDescarte) elTaxaDescarte.textContent = taxaDescarte.toFixed(1) + "%";

            // KPIs de Eficiência de Vendas
            const leadsSemCorretor = leads.filter(l => !isSale(l) && !isLoss(l) && (!l.corretor || !l.corretor.nome || l.corretor.nome === "-" || l.corretor.nome.trim() === ""));
            const totalSemCorretor = leadsSemCorretor.length;

            const hoje = new Date("2026-05-21T12:00:00");
            const leadsEsfriando = leads.filter(l => {
                if (isSale(l) || isLoss(l)) return false;
                let lastDateStr = l.ultima_data_conversao || l.data_cad || "";
                if (l.interacao && l.interacao.length > 0) {
                    lastDateStr = l.interacao[0].data_cad || lastDateStr;
                }
                if (!lastDateStr) return false;
                const d = new Date(lastDateStr.replace(' ', 'T'));
                if (isNaN(d.getTime())) return false;
                const diffTime = Math.abs(hoje - d);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays > 10;
            });
            const totalEsfriando = leadsEsfriando.length;
            const vgvEsfriando = leadsEsfriando.reduce((acc, l) => acc + getLeadValueNumber(l), 0);

            const elSemCorretor = document.getElementById("kpi-leads-sem-corretor");
            const elEsfriando = document.getElementById("kpi-leads-sem-interacao-tempo");
            const elLblVgvEsfriando = document.getElementById("lbl-vgv-sem-interacao");

            if (elSemCorretor) elSemCorretor.textContent = totalSemCorretor;
            if (elEsfriando) elEsfriando.textContent = totalEsfriando;
            if (elLblVgvEsfriando) elLblVgvEsfriando.textContent = formatCurrency(vgvEsfriando);

            // 1. Gráfico de Pipeline de Oportunidades
            const stages = {};
            leadsQuentes.forEach(l => {
                const stageName = l.situacao && l.situacao.nome ? l.situacao.nome : "Desconhecido";
                stages[stageName] = (stages[stageName] || 0) + 1;
            });
            renderOpportunityStagesChart(stages);

            // 2. Gráfico de Motivos de Perda
            const lossReasons = {};
            leadsPerdidos.forEach(l => {
                const reasonName = l.motivo_cancelamento && l.motivo_cancelamento.nome ? l.motivo_cancelamento.nome : "Motivo não informado";
                lossReasons[reasonName] = (lossReasons[reasonName] || 0) + 1;
            });
            renderLossReasonsChart(lossReasons);

            // 3. Gráfico de Perda de VGV por Motivo (R$)
            const lossReasonsValue = {};
            leadsPerdidos.forEach(l => {
                const reasonName = l.motivo_cancelamento && l.motivo_cancelamento.nome ? l.motivo_cancelamento.nome : "Motivo não informado";
                const val = getLeadValueNumber(l);
                lossReasonsValue[reasonName] = (lossReasonsValue[reasonName] || 0) + val;
            });
            renderLossValueChart(lossReasonsValue);

            // 4. Gráfico de Eficiência de Conversão do Funil
            const triagemCount = leads.filter(l => !isLoss(l)).length;
            const atendimentoCount = leads.filter(l => !isLoss(l) && !l.situacao?.nome?.toLowerCase().includes("aguardando atendimento") && !l.situacao?.nome?.toLowerCase().includes("sdr")).length;
            const visitaCount = leads.filter(l => !isLoss(l) && (l.situacao?.nome?.toLowerCase().includes("visita") || l.situacao?.nome?.toLowerCase().includes("simula") || l.situacao?.nome?.toLowerCase().includes("reserva") || isSale(l))).length;
            const propostaCount = leads.filter(l => !isLoss(l) && (l.situacao?.nome?.toLowerCase().includes("simula") || l.situacao?.nome?.toLowerCase().includes("reserva") || isSale(l))).length;
            const reservaCount = leads.filter(l => !isLoss(l) && (l.situacao?.nome?.toLowerCase().includes("reserva") || (l.qtde_reservas_associadas && l.qtde_reservas_associadas > 0) || isSale(l))).length;
            const vendaCount = leads.filter(l => isSale(l)).length;

            const triagemToAtendimento = triagemCount > 0 ? (atendimentoCount / triagemCount) * 100 : 0;
            const atendimentoToVisita = atendimentoCount > 0 ? (visitaCount / atendimentoCount) * 100 : 0;
            const visitaToProposta = visitaCount > 0 ? (propostaCount / visitaCount) * 100 : 0;
            const propostaToReserva = propostaCount > 0 ? (reservaCount / propostaCount) * 100 : 0;
            const reservaToVenda = reservaCount > 0 ? (vendaCount / reservaCount) * 100 : 0;

            const conversionRates = {
                triagemToAtendimento: Math.min(100, triagemToAtendimento),
                atendimentoToVisita: Math.min(100, atendimentoToVisita),
                visitaToProposta: Math.min(100, visitaToProposta),
                propostaToReserva: Math.min(100, propostaToReserva),
                reservaToVenda: Math.min(100, reservaToVenda)
            };
            renderFunnelConversionChart(conversionRates);

            // 5. Tabelas Detalhadas
            renderOportunidadesRecentesTable(leadsQuentes);
            renderDescartesRecentesTable(leadsPerdidos);

        } catch (e) {
            console.error("Erro ao processar oportunidades e perdas:", e);
        }
    }, 50);
}

function renderOpportunityStagesChart(stages) {
    if (isMobile()) {
        renderMobilePyramidSVG('opportunityStagesChart', stages, 'leads');
        return;
    }
    const ctx = document.getElementById('opportunityStagesChart');
    if (!ctx) return;
    ctx.style.display = 'block';
    const wrapper = ctx.parentElement.querySelector('.mobile-pyramid-wrapper');
    if (wrapper) wrapper.style.display = 'none';

    const sorted = Object.entries(stages).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(item => item[0]);
    const data = sorted.map(item => item[1]);

    if (opportunityStagesChartInstance) opportunityStagesChartInstance.destroy();

    opportunityStagesChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: '#0EA5E9',
                borderRadius: 6,
                barThickness: 20
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#A3A3A3' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#e2e8f0', font: { size: 11 } }
                }
            },
            plugins: {
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 11 },
                    anchor: 'end',
                    align: 'start',
                    offset: 4,
                    formatter: (val) => val
                },
                legend: { display: false }
            }
        }
    });
}

function renderLossReasonsChart(reasons) {
    if (isMobile()) {
        renderMobilePyramidSVG('lossReasonsChart', reasons, 'leads');
        return;
    }
    const ctx = document.getElementById('lossReasonsChart');
    if (!ctx) return;
    ctx.style.display = 'block';
    const wrapper = ctx.parentElement.querySelector('.mobile-pyramid-wrapper');
    if (wrapper) wrapper.style.display = 'none';

    const sorted = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
    const data = sorted.map(item => item[1]);
    const total = data.reduce((acc, val) => acc + val, 0);
    const labels = sorted.map((item, i) => {
        const perc = total > 0 ? ((data[i] / total) * 100).toFixed(1) : 0;
        return `${item[0]} (${perc}%)`;
    });

    if (lossReasonsChartInstance) lossReasonsChartInstance.destroy();

    lossReasonsChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        plugins: [ChartDataLabels],
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#F43F5E', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#EC4899', '#6366F1', '#0ea5e9', '#14B8A6', '#84cc16'],
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
                        return perc >= 5 ? perc + '%' : '';
                    }
                },
                legend: { position: 'right', labels: { color: '#e5e5e5', boxWidth: 12, font: { size: 11 } } },
                tooltip: { callbacks: { label: function(context) { return ' ' + context.label + ': ' + context.raw + ' leads'; } } }
            }
        }
    });
}

function renderOportunidadesRecentesTable(leadsArray) {
    const tbody = document.getElementById("table-oportunidades-recentes-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    const sorted = [...leadsArray].sort((a, b) => {
        const dateA = a.data_cadastramento || a.data_cad || "";
        const dateB = b.data_cadastramento || b.data_cad || "";
        return dateB.localeCompare(dateA);
    }).slice(0, 20);

    if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 20px;">Nenhuma oportunidade recente encontrada.</td></tr>`;
        return;
    }

    sorted.forEach(lead => {
        const tr = document.createElement("tr");

        const name = lead.nome || "Sem nome";
        const leadLink = getLeadCRMUrl(lead);
        const corretorStr = (lead.corretor && lead.corretor.nome) ? lead.corretor.nome : "Sem corretor";
        const nameLink = leadLink !== "#" 
            ? `<a href="${leadLink}" target="_blank" style="color: #60A5FA; text-decoration: none; border-bottom: 1px dashed rgba(96, 165, 250, 0.4); font-weight: 600;">${name}</a><div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px;">Corretor: ${corretorStr}</div>` 
            : `<strong>${name}</strong><div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px;">Corretor: ${corretorStr}</div>`;

        const stage = lead.situacao && lead.situacao.nome ? lead.situacao.nome : "Desconhecido";
        const colors = getStatusColor(lead);
        const stageBadge = `<span class="status-badge" style="background-color: ${colors.bg}; color: ${colors.text}; border: 1px solid rgba(255,255,255,0.1);">${stage}</span>`;

        const emp = lead.empreendimento && lead.empreendimento.length > 0 ? lead.empreendimento[0].nome : "-";
        
        const valNum = getLeadValueNumber(lead);
        const valFormatted = valNum > 0 ? `<strong style="color: #10B981;">${formatCurrency(valNum)}</strong>` : `<span style="color: var(--text-secondary);">-</span>`;

        tr.innerHTML = `
            <td data-label="Cliente">${nameLink}</td>
            <td data-label="Etapa">${stageBadge}</td>
            <td data-label="Empreendimento">${emp}</td>
            <td data-label="Valor">${valFormatted}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderDescartesRecentesTable(leadsArray) {
    const tbody = document.getElementById("table-descartes-recentes-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    const sorted = [...leadsArray].sort((a, b) => {
        const dateA = a.data_cadastramento || a.data_cad || "";
        const dateB = b.data_cadastramento || b.data_cad || "";
        return dateB.localeCompare(dateA);
    }).slice(0, 20);

    if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 20px;">Nenhum descarte recente encontrado.</td></tr>`;
        return;
    }

    sorted.forEach(lead => {
        const tr = document.createElement("tr");

        const name = lead.nome || "Sem nome";
        const leadLink = getLeadCRMUrl(lead);
        const corretorStr = (lead.corretor && lead.corretor.nome) ? lead.corretor.nome : "Sem corretor";
        const nameLink = leadLink !== "#" 
            ? `<a href="${leadLink}" target="_blank" style="color: #60A5FA; text-decoration: none; border-bottom: 1px dashed rgba(96, 165, 250, 0.4); font-weight: 600;">${name}</a><div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px;">Corretor: ${corretorStr}</div>` 
            : `<strong>${name}</strong><div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px;">Corretor: ${corretorStr}</div>`;

        const reason = lead.motivo_cancelamento && lead.motivo_cancelamento.nome ? lead.motivo_cancelamento.nome : "Motivo não informado";
        const corretor = lead.corretor && lead.corretor.nome ? lead.corretor.nome : "-";
        const emp = lead.empreendimento && lead.empreendimento.length > 0 ? lead.empreendimento[0].nome : "-";

        tr.innerHTML = `
            <td data-label="Cliente">${nameLink}</td>
            <td data-label="Motivo" style="color: #FB923C;">${reason}</td>
            <td data-label="Corretor">${corretor}</td>
            <td data-label="Empreendimento">${emp}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderLossValueChart(reasonsValue) {
    const ctx = document.getElementById('lossValueChart');
    if (!ctx) return;

    const sorted = Object.entries(reasonsValue).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const labels = sorted.map(item => item[0]);
    const data = sorted.map(item => item[1]);

    if (lossValueChartInstance) lossValueChartInstance.destroy();

    lossValueChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: '#F43F5E',
                borderRadius: 6,
                barThickness: 16
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#A3A3A3',
                        font: { size: 10 },
                        callback: function(value) {
                            if (value >= 1e6) return 'R$ ' + (value/1e6).toFixed(1) + 'M';
                            if (value >= 1e3) return 'R$ ' + (value/1e3).toFixed(0) + 'k';
                            return 'R$ ' + value;
                        }
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#e2e8f0', font: { size: 10 } }
                }
            },
            plugins: {
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 9 },
                    anchor: 'end',
                    align: 'start',
                    offset: 4,
                    formatter: (val) => {
                        if (val >= 1e6) return 'R$ ' + (val/1e6).toFixed(1) + 'M';
                        if (val >= 1e3) return 'R$ ' + (val/1e3).toFixed(0) + 'k';
                        return 'R$ ' + val;
                    }
                },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ' Perda: ' + formatCurrency(context.raw);
                        }
                    }
                }
            }
        }
    });
}

function renderFunnelConversionChart(conversionRates) {
    const ctx = document.getElementById('funnelConversionChart');
    if (!ctx) return;

    const labels = [
        "Triagem ➔ Atend.",
        "Atend. ➔ Visita",
        "Visita ➔ Prop./Sim.",
        "Proposta ➔ Reser.",
        "Reserva ➔ Venda"
    ];
    const data = [
        conversionRates.triagemToAtendimento,
        conversionRates.atendimentoToVisita,
        conversionRates.visitaToProposta,
        conversionRates.propostaToReserva,
        conversionRates.reservaToVenda
    ];

    if (funnelConversionChartInstance) funnelConversionChartInstance.destroy();

    funnelConversionChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: '#10B981',
                borderRadius: 6,
                barThickness: 24
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#e2e8f0', font: { size: 9 } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#A3A3A3',
                        font: { size: 10 },
                        callback: (val) => val + '%'
                    },
                    max: 100
                }
            },
            plugins: {
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 10 },
                    anchor: 'end',
                    align: 'top',
                    offset: 2,
                    formatter: (val) => val.toFixed(1) + "%"
                },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ' Conversão: ' + context.raw.toFixed(1) + '%';
                        }
                    }
                }
            }
        }
    });
}

function getLeadProjectName(lead) {
    const estoque = (window.lastMetaData && window.lastMetaData.estoque) ? window.lastMetaData.estoque : null;
    const activeProjects = [];
    if (estoque) {
        Object.keys(estoque).forEach(idStr => {
            if (estoque[idStr] && estoque[idStr].nome) {
                activeProjects.push({
                    id: idStr,
                    nome: estoque[idStr].nome
                });
            }
        });
    } else {
        // Fallback se o estoque não tiver carregado ainda
        activeProjects.push({ id: "3", nome: "HUB Beira Mar" });
        activeProjects.push({ id: "4", nome: "Nautic" });
    }

    // 1. Verificar lead.empreendimento (contém nome e id)
    if (lead.empreendimento && lead.empreendimento.length > 0) {
        const leadEmp = lead.empreendimento[0];
        const leadEmpId = leadEmp.id ? String(leadEmp.id) : null;
        const leadEmpNome = leadEmp.nome ? leadEmp.nome.toLowerCase() : "";

        if (leadEmpId) {
            const found = activeProjects.find(p => p.id === leadEmpId);
            if (found) return found.nome;
        }
        for (let proj of activeProjects) {
            const pName = proj.nome.toLowerCase();
            if (leadEmpNome.includes(pName) || pName.includes(leadEmpNome)) {
                return proj.nome;
            }
            if (pName === "hub beira mar" && (leadEmpNome.includes("hub") || leadEmpNome.includes("beira mar"))) {
                return proj.nome;
            }
        }
    }

    // 2. Verificar lead.empreendimentosId
    if (lead.empreendimentosId) {
        const id = String(lead.empreendimentosId);
        const found = activeProjects.find(p => p.id === id);
        if (found) return found.nome;
    }

    // 3. Verificar tags do lead
    if (lead.tags && Array.isArray(lead.tags)) {
        for (let tag of lead.tags) {
            const t = tag.toLowerCase();
            for (let proj of activeProjects) {
                const pName = proj.nome.toLowerCase();
                if (t.includes(pName) || pName.includes(t)) {
                    return proj.nome;
                }
                if (pName === "hub beira mar" && (t.includes("hub") || t.includes("beira mar"))) {
                    return proj.nome;
                }
            }
        }
    }

    // 4. Verificar o nome do lead
    const nameStr = (lead.nome || "").toLowerCase();
    for (let proj of activeProjects) {
        const pName = proj.nome.toLowerCase();
        if (nameStr.includes(pName)) {
            return proj.nome;
        }
        if (pName === "hub beira mar" && (nameStr.includes("hub") || nameStr.includes("beira mar"))) {
            return proj.nome;
        }
    }

    return null;
}

// ============================================================
// NORMALIZAÇÃO DE TIPOLOGIAS
// ============================================================
function normalizeTipologia(tipStr, area, _projectName) {
    const t = (tipStr || "").toLowerCase().trim();
    const a = parseFloat(area) || 0;

    // Mapeamento direto de strings conhecidas da API
    if (t.includes("loja")) return "loja";
    if (t.includes("cobertura") || t.includes("penthouse")) return "cobertura";
    if (t === "studio" || t.includes("stúdio") || t === "1 dorm" || t === "1 dormitório") return "1 quarto";
    if (t.includes("2 dorm") || t.includes("2 dormitório") || t.includes("2 quartos")) return "2 quartos";
    if (t.includes("3 dorm") || t.includes("3 dormitório") || t.includes("3 quartos")) return "3 quartos";
    if (t.includes("1 suíte") || t.includes("1 suite")) return "1 quarto";
    if (t.includes("2 suíte") || t.includes("2 suite")) return "2 quartos";
    if (t.includes("3 suíte") || t.includes("3 suite")) return "3 quartos";

    // Inferência por área (para Nautic e outros com tipologia nula/"Geral")
    if (!t || t === "geral" || t === "-") {
        if (a > 0 && a < 75) return "1 quarto";
        if (a >= 75 && a < 110) return "2 quartos";
        if (a >= 110 && a < 160) return "3 quartos";
        if (a >= 160) return "cobertura";
    }

    // Retornar original em lowercase se não mapeado
    return t || "sem tipologia";
}

// ============================================================
// CRUZAMENTO DE LEADS DE VENDA COM INVENTÁRIO
// ============================================================
const displayTipologyLabels = {
    "1 quarto": "1 Quarto",
    "2 quartos": "2 Quartos",
    "3 quartos": "3 Quartos",
    "cobertura": "Cobertura",
    "loja": "Loja",
    "sem tipologia": "Não Informada"
};

function getSaleUnitInfo(lead) {
    if (!globalInventory || globalInventory.length === 0) {
        return { unidade: "-", tipologia: "-", tipologiaLabel: "-" };
    }

    const leadId = lead.idlead || lead.id_lead || lead.id;

    // 1. Buscar pela unidade associada diretamente pelo ID do lead
    if (leadId) {
        const matched = globalInventory.find(u => u.leadId && String(u.leadId) === String(leadId));
        if (matched) {
            const tipLbl = displayTipologyLabels[matched.tipologia] || (matched.tipologia
                ? matched.tipologia.charAt(0).toUpperCase() + matched.tipologia.slice(1)
                : "-");
            return { unidade: matched.unidade || "-", tipologia: matched.tipologia || "-", tipologiaLabel: tipLbl };
        }
    }

    // 2. Fallback: ler direto do objeto do lead (campos legados)
    const empArr = lead.empreendimento || [];
    const empObj = empArr.length > 0 ? empArr[0] : {};
    const rawTip = empObj.tipologia || lead.tipologia || "";
    const normTip = normalizeTipologia(rawTip, 0, empObj.nome || "");
    const tipLbl = displayTipologyLabels[normTip] || rawTip || "-";
    return {
        unidade: empObj.unidade || lead.unidade || "-",
        tipologia: normTip || "-",
        tipologiaLabel: tipLbl
    };
}

function generateBaseInventory() {
    const inventory = [];

    // Tentar ler os dados reais do CVCRM se existirem
    const estoque = (window.lastMetaData && window.lastMetaData.estoque) ? window.lastMetaData.estoque : null;
    let hasRealData = false;

    if (estoque) {
        const ids = Object.keys(estoque);
        ids.forEach(idStr => {
            const dataProj = estoque[idStr];
            if (dataProj && dataProj.etapas) {
                hasRealData = true;
                const projectName = dataProj.nome || (idStr === "3" ? "HUB Beira Mar" : (idStr === "4" ? "Nautic" : `Projeto ${idStr}`));
                
                dataProj.etapas.forEach(etapa => {
                    const blocos = etapa.blocos || [];
                    blocos.forEach(bloco => {
                        const unidades = bloco.unidades || [];
                        unidades.forEach(unidade => {
                            const uNome = unidade.nome || "";

                            // Ignorar registros de garagem/hobby box técnicos extras do HUB Beira Mar (ID 3)
                            if (idStr === "3" && ["VG 01", "HB 03", "VG 23 HB 19"].includes(uNome)) {
                                return;
                            }

                            // Determinar o status
                            const sit = unidade.situacao || {};
                            const mapa = sit.situacao_mapa_disponibilidade;
                            let status = "disponivel";

                            if (mapa === 3) {
                                status = "vendido";
                            } else if (mapa === 2) {
                                status = "reservado";
                            } else if (mapa === 4) {
                                status = "bloqueado";
                            } else if (mapa === 5) {
                                status = "em_processo";
                            } else {
                                status = "disponivel";
                            }

                            // Tratar vagas
                            let vagasCount = 0;
                            if (unidade.vagas_garagem) {
                                const match = String(unidade.vagas_garagem).match(/\d+/);
                                if (match) {
                                    vagasCount = parseInt(match[0], 10);
                                }
                            }

                            inventory.push({
                                unidade: unidade.nome || String(unidade.idunidade),
                                empreendimento: projectName,
                                bloco: bloco.nome || "Torre Única",
                                tipologia: normalizeTipologia(unidade.tipologia || unidade.tipo, unidade.area_privativa, projectName),
                                area: parseFloat(unidade.area_privativa) || 0,
                                vagas: vagasCount,
                                sol: unidade.posicao || "N/I",
                                valorTabela: parseFloat(unidade.valor) || 0,
                                status: status,
                                idunidade: unidade.idunidade,
                                leadId: null,
                                leadNome: null,
                                lead: null,
                                situacao_para_venda: sit.situacao_para_venda,
                                situacao_mapa_disponibilidade: mapa
                            });
                        });
                    });
                });
            }
        });
    }

    if (hasRealData) {
        console.log(`Inventário dinâmico carregado do CVCRM com ${inventory.length} unidades.`);
        return inventory;
    }

    // ==========================================
    // FALLBACK: Lógica de simulação mock original
    // ==========================================
    console.log("Servindo inventário mock de fallback...");

    // HUB Beira Mar mock
    for (let floor = 1; floor <= 15; floor++) {
        for (let unitNum = 1; unitNum <= 8; unitNum++) {
            const number = floor * 100 + unitNum;
            let tipologia = "";
            let area = 0;
            let vagas = 0;
            let sol = "";
            let valor = 0;

            if (floor === 15 && unitNum <= 4) {
                tipologia = "cobertura";
                area = 250;
                vagas = 4;
                sol = "Manhã";
                valor = 5900000;
            } else if (unitNum === 1 || unitNum === 2) {
                tipologia = "3 quartos";
                area = 120;
                vagas = 2;
                sol = "Manhã";
                valor = 2800000;
            } else if (unitNum >= 3 && unitNum <= 6) {
                tipologia = "2 quartos";
                area = 85;
                vagas = 2;
                sol = unitNum <= 4 ? "Manhã" : "Tarde";
                valor = 1650000;
            } else {
                tipologia = "1 quarto";
                area = 45;
                vagas = 1;
                sol = "Tarde";
                valor = 850000;
            }

            inventory.push({
                unidade: `${number}`,
                empreendimento: "HUB Beira Mar",
                bloco: "Torre Única",
                tipologia: tipologia,
                area: area,
                vagas: vagas,
                sol: sol,
                valorTabela: valor,
                status: "disponivel",
                leadId: null,
                leadNome: null,
                lead: null
            });
        }
    }

    // Nautic mock
    for (let floor = 1; floor <= 10; floor++) {
        for (let unitNum = 1; unitNum <= 8; unitNum++) {
            const number = floor * 100 + unitNum;
            let tipologia = "";
            let area = 0;
            let vagas = 0;
            let sol = "";
            let valor = 0;

            if (floor === 10 && unitNum <= 4) {
                tipologia = "cobertura";
                area = 210;
                vagas = 4;
                sol = "Manhã";
                valor = 4800000;
            } else if (unitNum === 1 || unitNum === 2) {
                tipologia = "3 quartos";
                area = 112;
                vagas = 2;
                sol = "Manhã";
                valor = 2400000;
            } else if (unitNum >= 3 && unitNum <= 6) {
                tipologia = "2 quartos";
                area = 78;
                vagas = 2;
                sol = "Tarde";
                valor = 1450000;
            } else {
                tipologia = "1 quarto";
                area = 40;
                vagas = 1;
                sol = "Tarde";
                valor = 750000;
            }

            const idx = (floor - 1) * 8 + (unitNum - 1);
            const blockNum = Math.floor(idx / 16) + 1;
            inventory.push({
                unidade: `${number}`,
                empreendimento: "Nautic",
                bloco: `Torre ${blockNum}`,
                tipologia: tipologia,
                area: area,
                vagas: vagas,
                sol: sol,
                valorTabela: valor,
                status: "disponivel",
                leadId: null,
                leadNome: null,
                lead: null
            });
        }
    }

    return inventory;
}

function findMatchingUnit(lead, units, targetStatus) {
    let searchText = (lead.nome || "").toLowerCase();
    
    if (lead.campos_adicionais && Array.isArray(lead.campos_adicionais)) {
        lead.campos_adicionais.forEach(field => {
            searchText += " " + String(field.valor || "").toLowerCase();
        });
    }
    
    if (lead.interacao && Array.isArray(lead.interacao)) {
        lead.interacao.forEach(inter => {
            searchText += " " + String(inter.descricao || "").toLowerCase();
        });
    }

    for (let u of units) {
        if (u.status === targetStatus && !u.leadId) {
            const unitClean = u.unidade.toLowerCase().replace(/[^a-z0-9]/g, "");
            const unitNumberOnly = u.unidade.replace(/\D/g, "");
            
            const hasUnitClean = unitClean.length > 0 && searchText.includes(unitClean);
            const hasUnitNumber = unitNumberOnly.length > 0 && (
                searchText.includes("ap " + unitNumberOnly) ||
                searchText.includes("apto " + unitNumberOnly) ||
                searchText.includes("apartamento " + unitNumberOnly) ||
                searchText.includes("unidade " + unitNumberOnly) ||
                searchText.includes("sala " + unitNumberOnly) ||
                searchText.includes("loja " + unitNumberOnly) ||
                searchText.includes("lj " + unitNumberOnly) ||
                searchText.includes("nº " + unitNumberOnly) ||
                searchText.includes("no " + unitNumberOnly) ||
                searchText.includes("num " + unitNumberOnly)
            );

            let blockMatch = true;
            if (u.bloco && u.bloco !== "Torre Única") {
                const blockClean = u.bloco.toLowerCase().replace(/[^a-z0-9]/g, "");
                const blockNumOnly = u.bloco.replace(/\D/g, "");
                
                const hasBlockClean = searchText.includes(blockClean);
                const hasBlockNum = blockNumOnly.length > 0 && (
                    searchText.includes("torre " + blockNumOnly) ||
                    searchText.includes("bloco " + blockNumOnly) ||
                    searchText.includes("t" + blockNumOnly) ||
                    searchText.includes("b" + blockNumOnly)
                );
                
                blockMatch = hasBlockClean || hasBlockNum;
            }

            if (hasUnitClean || hasUnitNumber) {
                if (blockMatch) {
                    return u;
                }
            }
        }
    }
    return null;
}

function allocateLeadsToInventory(projectName, salesLeads, resLeads) {
    const projectUnits = globalInventory.filter(u => u.empreendimento === projectName);

    // VENDAS - Casamento Inteligente
    const salesUnassociated = [];
    salesLeads.forEach(lead => {
        const matchedUnit = findMatchingUnit(lead, projectUnits, "vendido");
        if (matchedUnit) {
            matchedUnit.leadId = lead.idlead || lead.id_lead || lead.id;
            matchedUnit.leadNome = lead.nome;
            matchedUnit.lead = lead;
            const leadVal = getLeadValueNumber(lead);
            if (leadVal > 0) {
                matchedUnit.valorTabela = leadVal;
            }
        } else {
            salesUnassociated.push(lead);
        }
    });

    // VENDAS - Alocação Sequencial
    let saleUnassignedIdx = 0;
    for (let u of projectUnits) {
        if (u.status === "vendido" && !u.leadId) {
            if (saleUnassignedIdx < salesUnassociated.length) {
                const lead = salesUnassociated[saleUnassignedIdx];
                u.leadId = lead.idlead || lead.id_lead || lead.id;
                u.leadNome = lead.nome;
                u.lead = lead;
                const leadVal = getLeadValueNumber(lead);
                if (leadVal > 0) {
                    u.valorTabela = leadVal;
                }
                saleUnassignedIdx++;
            } else {
                u.leadNome = "Adquirente (CVCRM)";
            }
        }
    }

    // RESERVAS - Casamento Inteligente
    const resUnassociated = [];
    resLeads.forEach(lead => {
        const matchedUnit = findMatchingUnit(lead, projectUnits, "reservado");
        if (matchedUnit) {
            matchedUnit.leadId = lead.idlead || lead.id_lead || lead.id;
            matchedUnit.leadNome = lead.nome;
            matchedUnit.lead = lead;
            const leadVal = getLeadValueNumber(lead);
            if (leadVal > 0) {
                matchedUnit.valorTabela = leadVal;
            }
        } else {
            resUnassociated.push(lead);
        }
    });

    // RESERVAS - Alocação Sequencial
    let resUnassignedIdx = 0;
    for (let u of projectUnits) {
        if (u.status === "reservado" && !u.leadId) {
            if (resUnassignedIdx < resUnassociated.length) {
                const lead = resUnassociated[resUnassignedIdx];
                u.leadId = lead.idlead || lead.id_lead || lead.id;
                u.leadNome = lead.nome;
                u.lead = lead;
                const leadVal = getLeadValueNumber(lead);
                if (leadVal > 0) {
                    u.valorTabela = leadVal;
                }
                resUnassignedIdx++;
            } else {
                u.leadNome = "Reserva Ativa (CVCRM)";
            }
        }
    }
}

function getProjectColor(projectName, index) {
    const name = projectName.toLowerCase();
    if (name.includes("hub") || name.includes("beira mar")) return "#14b8a6"; // Teal
    if (name.includes("nautic")) return "#0ea5e9"; // Light Blue
    
    const palette = ["#8b5cf6", "#f59e0b", "#ec4899", "#6366f1", "#10b981", "#a855f7", "#f43f5e"];
    return palette[index % palette.length];
}

function populateStockFilters() {
    const fEmp = document.getElementById("filter-emp-stock");
    const fTip = document.getElementById("filter-tipologia-stock");
    const fStat = document.getElementById("filter-status-stock");
    
    if (!fEmp || !fTip || !fStat) return;
    
    let selEmp = fEmp.value;
    let selTip = fTip.value;
    let selStat = fStat.value;
    
    // 1. Obter opções de Empreendimentos válidas com base nos outros filtros
    const unitsForEmp = globalInventory.filter(u => {
        if (selTip && u.tipologia !== selTip) return false;
        if (selStat && u.status !== selStat) return false;
        return true;
    });
    const uniqueProjects = [...new Set(unitsForEmp.map(u => u.empreendimento))].sort();
    
    // Auto-reset se a seleção atual de Empreendimento se tornou inválida
    if (selEmp && !uniqueProjects.includes(selEmp)) {
        selEmp = "";
        fEmp.value = "";
    }
    
    // 2. Obter opções de Tipologias válidas com base nos outros filtros
    const unitsForTip = globalInventory.filter(u => {
        if (selEmp && u.empreendimento !== selEmp) return false;
        if (selStat && u.status !== selStat) return false;
        return true;
    });
    const uniqueTipologies = [...new Set(unitsForTip.map(u => u.tipologia))].sort();
    
    // Auto-reset se a seleção atual de Tipologia se tornou inválida
    if (selTip && !uniqueTipologies.includes(selTip)) {
        selTip = "";
        fTip.value = "";
    }
    
    // 3. Obter opções de Status válidas com base nos outros filtros
    const unitsForStat = globalInventory.filter(u => {
        if (selEmp && u.empreendimento !== selEmp) return false;
        if (selTip && u.tipologia !== selTip) return false;
        return true;
    });
    const uniqueStatuses = [...new Set(unitsForStat.map(u => u.status))].sort();
    
    // Auto-reset se a seleção atual de Status se tornou inválida
    if (selStat && !uniqueStatuses.includes(selStat)) {
        selStat = "";
        fStat.value = "";
    }
    
    // --- Renderizar Seletor de Empreendimento ---
    fEmp.innerHTML = '<option value="">Todos Empreendimentos</option>';
    uniqueProjects.forEach(proj => {
        const option = document.createElement("option");
        option.value = proj;
        option.textContent = proj;
        if (proj === selEmp) option.selected = true;
        fEmp.appendChild(option);
    });
    
    // --- Renderizar Seletor de Tipologia ---
    fTip.innerHTML = '<option value="">Todas Tipologias</option>';
    uniqueTipologies.forEach(tip => {
        if (!tip) return;
        const option = document.createElement("option");
        option.value = tip;
        option.textContent = displayTipologyLabels[tip] || (tip.charAt(0).toUpperCase() + tip.slice(1));
        if (tip === selTip) option.selected = true;
        fTip.appendChild(option);
    });
    
    // --- Renderizar Seletor de Status ---
    fStat.innerHTML = '<option value="">Todos Status</option>';
    const statusLabels = {
        "disponivel": "Disponível",
        "reservado": "Reservado",
        "vendido": "Vendido",
        "bloqueado": "Bloqueado",
        "em_processo": "Em Processo"
    };
    
    uniqueStatuses.forEach(stat => {
        const option = document.createElement("option");
        option.value = stat;
        option.textContent = statusLabels[stat] || (stat.charAt(0).toUpperCase() + stat.slice(1));
        if (stat === selStat) option.selected = true;
        fStat.appendChild(option);
    });
}

function renderDynamicProjectCards() {
    const container = document.getElementById("empreendimentos-grid");
    if (!container) return;

    container.innerHTML = "";

    // Obter todos os projetos únicos presentes no inventário global
    const uniqueProjects = [...new Set(globalInventory.map(u => u.empreendimento))].sort();

    if (uniqueProjects.length === 0) {
        container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; grid-column: 1 / -1; padding: 40px;">Nenhum empreendimento ativo encontrado.</p>`;
        return;
    }

    uniqueProjects.forEach((projectName, index) => {
        const projectUnits = globalInventory.filter(u => u.empreendimento === projectName);
        const totalUnits = projectUnits.length;

        let soldCount = 0;
        let reservedCount = 0;
        let availableCount = 0;
        let blockedCount = 0;
        let processingCount = 0;

        projectUnits.forEach(u => {
            // Regra especial para o HUB Beira Mar para bater com o comportamento do CVCRM
            if (projectName === "HUB Beira Mar" && u.situacao_para_venda === 2) {
                reservedCount++;
            }

            if (u.status === "vendido") {
                soldCount++;
            } else if (u.status === "reservado") {
                if (projectName !== "HUB Beira Mar") {
                    reservedCount++;
                }
            } else if (u.status === "disponivel") {
                availableCount++;
            } else if (u.status === "bloqueado") {
                blockedCount++;
            } else if (u.status === "em_processo") {
                processingCount++;
            }
        });

        const soldUnits = projectUnits.filter(u => u.status === "vendido");

        // VGV comercializado: soma dos valores das unidades vendidas
        const vgvComercializado = soldUnits.reduce((acc, u) => acc + u.valorTabela, 0);

        // Ticket médio
        const ticketMedio = soldCount > 0 ? vgvComercializado / soldCount : (totalUnits > 0 ? projectUnits.reduce((acc, u) => acc + u.valorTabela, 0) / totalUnits : 0);

        // Percentual Vendido (por quantidade de unidades)
        const percentVendido = totalUnits > 0 ? (soldCount / totalUnits) * 100 : 0;

        // Configuração visual
        const idSuffix = projectName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
        
        const descriptions = {
            "HUB Beira Mar": "Empreendimento de alto padrão com vista definitiva para o mar, rooftop exclusivo e automação integrada.",
            "Nautic": "Design contemporâneo inspirado em iates de luxo, com acesso facilitado para embarcações e spa completo."
        };
        const tags = {
            "HUB Beira Mar": "Premium",
            "Nautic": "Exclusivo"
        };
        
        const desc = descriptions[projectName] || "Projeto residencial de alta performance desenvolvido pela LongView, com foco em sofisticação e qualidade de vida.";
        const tag = tags[projectName] || "Lançamento";
        const color = getProjectColor(projectName, index);

        const totalBarUnits = soldCount + reservedCount + availableCount + blockedCount + processingCount;

        const pSold = totalBarUnits > 0 ? (soldCount / totalBarUnits) * 100 : 0;
        const pReserved = totalBarUnits > 0 ? (reservedCount / totalBarUnits) * 100 : 0;
        const pAvailable = totalBarUnits > 0 ? (availableCount / totalBarUnits) * 100 : 0;
        const pBlocked = totalBarUnits > 0 ? (blockedCount / totalBarUnits) * 100 : 0;
        const pProcessing = totalBarUnits > 0 ? (processingCount / totalBarUnits) * 100 : 0;

        const card = document.createElement("div");
        card.className = "chart-card glass-card project-card";
        card.id = `project-${idSuffix}`;
        
        // Tentar obter o endereço dos detalhes do projeto se disponível no estoque
        let locationStr = "Florianópolis - SC";
        const estoque = (window.lastMetaData && window.lastMetaData.estoque) ? window.lastMetaData.estoque : null;
        if (estoque) {
            const matchedKey = Object.keys(estoque).find(key => estoque[key] && estoque[key].nome === projectName);
            if (matchedKey && estoque[matchedKey]) {
                const pData = estoque[matchedKey];
                if (pData.bairro && pData.cidade && pData.estado) {
                    locationStr = `${pData.bairro}, ${pData.cidade} - ${pData.estado.substring(0, 2).toUpperCase()}`;
                } else if (pData.endereco_emp) {
                    locationStr = `${pData.endereco_emp}, ${pData.cidade || "Florianópolis"} - ${(pData.estado || "SC").substring(0, 2).toUpperCase()}`;
                }
            }
        }
        
        if (projectName === "HUB Beira Mar") {
            locationStr = "Av. Beira Mar Norte, Florianópolis - SC";
        } else if (projectName === "Nautic") {
            locationStr = "Região da Marina, Florianópolis - SC";
        }

        card.innerHTML = `
            <div class="project-header">
                <div class="project-title-area">
                    <span class="project-tag" style="background: ${color}1a; color: ${color};">${tag}</span>
                    <h2>${projectName}</h2>
                    <p class="project-loc"><i class="ph ph-map-pin"></i> ${locationStr}</p>
                </div>
                <div class="project-progress-circle">
                    <svg viewBox="0 0 36 36" class="circular-chart">
                        <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path class="circle animate-dash" style="stroke: ${color};" stroke-dasharray="${percentVendido.toFixed(1)}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <text x="18" y="20.35" class="percentage">${percentVendido.toFixed(0)}%</text>
                    </svg>
                </div>
            </div>
            <p class="project-desc">${desc}</p>
            
            <div class="project-stats">
                <div class="p-stat">
                    <span class="p-stat-label">VGV Comercializado</span>
                    <span class="p-stat-val" title="${formatCurrency(vgvComercializado)}">${formatCompactCurrency(vgvComercializado)}</span>
                </div>
                <div class="p-stat">
                    <span class="p-stat-label">Ticket Médio</span>
                    <span class="p-stat-val" title="${formatCurrency(ticketMedio)}">${formatCompactCurrency(ticketMedio)}</span>
                </div>
                <!-- NOVO KPI de Unidades Totais -->
                <div class="p-stat">
                    <span class="p-stat-label">Unidades Totais</span>
                    <span class="p-stat-val" style="color: #60A5FA;">${totalUnits}</span>
                </div>
            </div>

            <div class="project-units-bar">
                <div class="unit-bar-segment sold" style="width: ${pSold}%;" title="Vendido"></div>
                <div class="unit-bar-segment reserved" style="width: ${pReserved}%;" title="Reservado"></div>
                <div class="unit-bar-segment available" style="width: ${pAvailable}%;" title="Disponível"></div>
                <div class="unit-bar-segment blocked" style="width: ${pBlocked}%;" title="Bloqueado"></div>
                <div class="unit-bar-segment processing" style="width: ${pProcessing}%;" title="Em Processo"></div>
            </div>

            <div class="project-legend">
                <span class="legend-item"><span class="bullet sold"></span>Vendido: <strong>${soldCount}</strong></span>
                <span class="legend-item"><span class="bullet reserved"></span>Reservado: <strong>${reservedCount}</strong></span>
                <span class="legend-item"><span class="bullet available"></span>Disponível: <strong>${availableCount}</strong></span>
                <span class="legend-item"><span class="bullet blocked"></span>Bloqueado: <strong>${blockedCount}</strong></span>
                <span class="legend-item"><span class="bullet processing"></span>Em Processo: <strong>${processingCount}</strong></span>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function renderEmpreendimentosTable() {
    const tbody = document.getElementById("table-unidades-estoque-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    const filterEmp = document.getElementById("filter-emp-stock").value;
    const filterTipologia = document.getElementById("filter-tipologia-stock").value;
    const filterStatus = document.getElementById("filter-status-stock").value;

    const filtered = globalInventory.filter(u => {
        if (filterEmp && u.empreendimento !== filterEmp) return false;
        if (filterTipologia && u.tipologia !== filterTipologia) return false;
        if (filterStatus && u.status !== filterStatus) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 20px;">Nenhuma unidade encontrada para os filtros selecionados.</td></tr>`;
        return;
    }

    filtered.forEach(u => {
        const tr = document.createElement("tr");

        let statusBadge = "";
        if (u.status === "vendido") {
            statusBadge = `<span class="status-badge" style="background-color: rgba(239, 68, 68, 0.15); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.3);">Vendido</span>`;
        } else if (u.status === "reservado") {
            statusBadge = `<span class="status-badge" style="background-color: rgba(245, 158, 11, 0.15); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.3);">Reservado</span>`;
        } else if (u.status === "bloqueado") {
            statusBadge = `<span class="status-badge" style="background-color: rgba(107, 114, 128, 0.15); color: #9CA3AF; border: 1px solid rgba(107, 114, 128, 0.3);">Bloqueado</span>`;
        } else if (u.status === "em_processo") {
            statusBadge = `<span class="status-badge" style="background-color: rgba(59, 130, 246, 0.15); color: #93C5FD; border: 1px solid rgba(59, 130, 246, 0.3);">Em Processo</span>`;
        } else {
            statusBadge = `<span class="status-badge" style="background-color: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3);">Disponível</span>`;
        }

        let clientInfo = "";
        if (u.lead) {
            const leadLink = getLeadCRMUrl(u.lead);
            const corretorStr = (u.lead.corretor && u.lead.corretor.nome) ? u.lead.corretor.nome : "Sem corretor";
            const leadLinkHtml = leadLink !== "#"
                ? `<a href="${leadLink}" target="_blank" style="color: #60A5FA; text-decoration: none; border-bottom: 1px dashed rgba(96, 165, 250, 0.4); font-weight: 600;">${u.leadNome}</a>`
                : `<strong>${u.leadNome}</strong>`;
            
            clientInfo = `<br><small style="color: var(--text-secondary); font-size: 10px; display: block; margin-top: 4px;">Cliente: ${leadLinkHtml}</small><small style="color: var(--text-secondary); font-size: 9px; display: block;">Corretor: ${corretorStr}</small>`;
        } else if (u.leadNome) {
            clientInfo = `<br><small style="color: var(--text-secondary); font-size: 10px; display: block; margin-top: 4px;">Cliente: <strong>${u.leadNome}</strong></small><small style="color: var(--text-secondary); font-size: 9px; display: block;">Corretor: Sem corretor</small>`;
        }

        const tipologiaLabel = u.tipologia.charAt(0).toUpperCase() + u.tipologia.slice(1);

        const unitLabel = (u.unidade.toUpperCase().includes("APTO") || u.unidade.toUpperCase().includes("APT") || u.unidade.toUpperCase().includes("LJ") || u.unidade.toUpperCase().includes("LOJA") || u.unidade.toUpperCase().includes("SALA") || u.unidade.toUpperCase().includes("VAGA"))
            ? u.unidade
            : `Apto ${u.unidade}`;

        tr.innerHTML = `
            <td data-label="Unidade"><strong>${unitLabel}</strong></td>
            <td data-label="Empreendimento">${u.empreendimento}</td>
            <td data-label="Bloco">${u.bloco || "Torre Única"}</td>
            <td data-label="Tipologia">${tipologiaLabel}</td>
            <td data-label="Área Privativa">${u.area}m²</td>
            <td data-label="Vagas">${u.vagas} ${u.vagas > 1 ? 'vagas' : 'vaga'}</td>
            <td data-label="Sol">${u.sol}</td>
            <td data-label="Status">${statusBadge}${clientInfo}</td>
            <td data-label="Valor de Tabela"><strong style="color: #60A5FA;">${formatCurrency(u.valorTabela)}</strong></td>
        `;

        tbody.appendChild(tr);
    });
}

function handleStockFilterChange() {
    populateStockFilters();
    renderEmpreendimentosTable();
}

function setupStockFilters() {
    const fEmp = document.getElementById("filter-emp-stock");
    const fTip = document.getElementById("filter-tipologia-stock");
    const fStat = document.getElementById("filter-status-stock");

    if (fEmp && !fEmp.getAttribute("data-listener")) {
        fEmp.setAttribute("data-listener", "true");
        fEmp.addEventListener("change", handleStockFilterChange);
    }
    if (fTip && !fTip.getAttribute("data-listener")) {
        fTip.setAttribute("data-listener", "true");
        fTip.addEventListener("change", handleStockFilterChange);
    }
    if (fStat && !fStat.getAttribute("data-listener")) {
        fStat.setAttribute("data-listener", "true");
        fStat.addEventListener("change", handleStockFilterChange);
    }
}

function toggleAccordion(id) {
    const content = document.getElementById(id);
    if (!content) return;

    const parent = content.parentElement;
    const caret = parent.querySelector(".caret-icon");

    // Fechar outros accordions
    document.querySelectorAll(".accordion-content").forEach(c => {
        if (c.id !== id && c.classList.contains("active")) {
            c.classList.remove("active");
            c.parentElement.querySelector(".caret-icon").classList.remove("rotate");
        }
    });

    content.classList.toggle("active");
    if (caret) {
        caret.classList.toggle("rotate");
    }
}

function updateEmpreendimentos(leads) {
    if (!leads) return;

    // 1. Gerar inventário base limpo
    globalInventory = generateBaseInventory();

    // 2. Filtrar leads por empreendimento e agrupar por Vendas e Reservas de forma dinâmica
    const projectSales = {};
    const projectReservations = {};

    const activeProjects = [...new Set(globalInventory.map(u => u.empreendimento))];
    activeProjects.forEach(proj => {
        projectSales[proj] = [];
        projectReservations[proj] = [];
    });

    leads.forEach(lead => {
        const proj = getLeadProjectName(lead);
        if (!proj || !activeProjects.includes(proj)) return;

        if (isSale(lead)) {
            projectSales[proj].push(lead);
        } else if (lead.qtde_reservas_associadas && lead.qtde_reservas_associadas > 0 && !isLoss(lead)) {
            projectReservations[proj].push(lead);
        }
    });

    // 3. Alocar dinamicamente vendas e reservas no inventário
    activeProjects.forEach(proj => {
        allocateLeadsToInventory(proj, projectSales[proj], projectReservations[proj]);
    });

    // 4. Calcular consolidados para renderização de KPIs e Cards
    renderDynamicProjectCards();

    // 5. Popular os filtros de estoque dinamicamente
    populateStockFilters();

    // 6. Renderizar a tabela filtrada
    renderEmpreendimentosTable();

    // Configurar os event listeners dos filtros de estoque
    setupStockFilters();
}

