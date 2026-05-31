'use client';

import React, { useEffect } from 'react';
import Script from 'next/script';
import { useUser } from '@/context/UserContext';
import './style.css';

function getRoleStyle(role: string): React.CSSProperties {
  switch (role) {
    case 'Desenvolvedor': return { background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' };
    case 'Diretoria':     return { background: 'rgba(239,68,68,0.1)',   color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' };
    case 'Gestor':        return { background: 'rgba(16,185,129,0.1)',  color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' };
    case 'Parceiro':      return { background: 'rgba(245,158,11,0.1)',  color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' };
    case 'Corretor':      return { background: 'rgba(59,130,246,0.1)',  color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' };
    default:              return { background: 'rgba(113,113,122,0.1)', color: '#a1a1aa', border: '1px solid rgba(113,113,122,0.3)' };
  }
}

export default function MarketingVisionPage() {
  const { currentUser } = useUser();
  const isAdmin = currentUser?.role === 'Desenvolvedor' || currentUser?.permissions?.isAdmin === true;
  
  useEffect(() => {
    // Forçar autenticação no sessionStorage para pular o login estático
    sessionStorage.setItem("longview_auth", "true");
  }, []);

  return (
    <div className="marketing-vision-wrapper w-full min-h-screen bg-[#09090b] text-[#e5e5e5] relative font-sans">
      {/* Dependências de Scripts Externos */}
      <Script src="https://unpkg.com/@phosphor-icons/web" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/chart.js" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js" strategy="afterInteractive" />
      
      {/* Script principal do Marketing Vision */}
      <Script 
        src="/marketing-vision-script.js" 
        strategy="lazyOnload"
      />

      {/* Estrutura HTML original do Marketing Vision */}
      
      {/* Tela de Login (Mantida oculta por padrão no CSS) */}
      <div id="login-screen" className="login-overlay hidden">
        <div className="login-card glass-card">
          <div className="logo-container" style={{ marginBottom: '24px' }}>
            <img src="/logolongview.png" alt="LongView" className="login-logo" style={{ maxHeight: '60px' }} />
          </div>
          <h2 style={{ marginBottom: '8px', textAlign: 'center' }}>Marketing Vision</h2>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '14px', marginBottom: '32px' }}>
            Área restrita à diretoria LongView
          </p>
        </div>
      </div>

      {/* Tela de Carregamento (Pós-Login) */}
      <div id="loading-overlay" className="loading-overlay">
        <div className="loading-content">
          <img src="/logolongview.png" alt="LongView" className="loading-logo" />
          <div className="progress-container">
            <div id="progress-bar" className="progress-bar"></div>
          </div>
          <p id="loading-text" style={{ whiteSpace: 'nowrap', marginBottom: '20px' }}>Iniciando sincronização inteligente...</p>
          <div className="loading-insight-box">
            <p id="insight-title">VOCÊ SABIA?</p>
            <p id="insight-text">A LongView utiliza inteligência de dados para otimizar cada conversão.</p>
          </div>
        </div>
      </div>

      {/* App Principal */}
      <div className="app-container hidden" id="main-app">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo-container flex flex-col items-center" style={{ paddingTop: '32px', paddingBottom: '24px', borderBottom: '1px solid rgba(28,28,30,0.5)' }}>
            <div style={{ position: 'relative', width: '176px', height: '56px' }}>
              <img src="/logolongview.png" alt="LongView" style={{ width: '176px', height: '56px', objectFit: 'contain' }} />
            </div>
            <span className="text-[9px] uppercase font-bold tracking-widest text-[#0ea5e9] mt-1">
              Marketing Vision
            </span>
          </div>

          <div className="nav-menu-wrapper">
            <nav className="nav-menu">
              <a href="#" className="nav-item active" data-view="dashboard">
                <i className="ph ph-squares-four"></i>
                <span>Dashboard</span>
              </a>
              <a href="#" className="nav-item" data-view="leads">
                <i className="ph ph-users"></i>
                <span>Leads</span>
              </a>
              <a href="#" className="nav-item" data-view="oportunidades-perdas">
                <i className="ph ph-trend-up"></i>
                <span>Oportunidades</span>
              </a>
              <a href="#" className="nav-item" data-view="empreendimentos">
                <i className="ph ph-buildings"></i>
                <span>Empreendimentos</span>
              </a>
              <a href="#" className="nav-item" data-view="vendas">
                <i className="ph ph-currency-dollar"></i>
                <span>Vendas</span>
              </a>
              <a href="#" className="nav-item" data-view="marketing">
                <i className="ph ph-megaphone"></i>
                <span>Marketing ADS</span>
              </a>
              <a href="#" className="nav-item" data-view="campanhas">
                <i className="ph ph-sliders"></i>
                <span>Campanhas</span>
              </a>
              <a href="#" className="nav-item" data-view="leads-meta">
                <i className="ph ph-clipboard-text"></i>
                <span>Leads Meta</span>
              </a>
              <a href="#" className="nav-item" data-view="publicar">
                <i className="ph ph-paper-plane-tilt"></i>
                <span>Publicar</span>
              </a>

              {isAdmin && (
                <a href="/admin/users" className="nav-item" style={{ color: '#c084fc' }}>
                  <i className="ph ph-gear"></i>
                  <span>Gerenciar Usuários</span>
                </a>
              )}
            </nav>
          </div>

          <div style={{ padding: '16px', borderTop: '1px solid #1C1C1E', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Bottom Quick Access Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <a
                href="/select-app"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#d4d4d8', textDecoration: 'none', transition: 'all 0.2s' }}
              >
                <i className="ph ph-grid-nine" style={{ fontSize: '14px' }}></i>
                <span>Painel de Aplicativos</span>
              </a>
              <a
                href="/project-vision"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', textDecoration: 'none', transition: 'all 0.2s' }}
              >
                <i className="ph ph-layout" style={{ fontSize: '14px' }}></i>
                <span>Ir para Project Vision</span>
              </a>
            </div>

            {/* User Profile Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: '8px', background: '#121214', border: '1px solid #1E1E22' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#27272a', border: '1px solid #3f3f46', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: '600', flexShrink: 0 }}>
                  {currentUser?.name?.charAt(0) || 'U'}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <span style={{ display: 'block', fontSize: '12px', color: '#fff', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{currentUser?.name || 'Carregando...'}</span>
                  <span style={{ display: 'inline-block', marginTop: '2px', fontSize: '9px', padding: '2px 6px', borderRadius: '9999px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', ...getRoleStyle(currentUser?.role || '') }}>{currentUser?.role || 'Acesso'}</span>
                </div>
              </div>
              <a
                href="/api/auth/logout"
                title="Fazer Logout"
                style={{ padding: '6px', color: '#71717a', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', textDecoration: 'none', flexShrink: 0 }}
              >
                <i className="ph ph-sign-out" style={{ fontSize: '14px' }}></i>
              </a>
            </div>
          </div>
        </aside>
        
        {/* Mobile Navigation (Bottom Bar) */}
        <nav className="mobile-nav">
          <a href="#" className="mobile-nav-item active" data-view="dashboard">
            <i className="ph ph-squares-four"></i>
            <span>Geral</span>
          </a>
          <a href="#" className="mobile-nav-item" data-view="leads">
            <i className="ph ph-users"></i>
            <span>Leads</span>
          </a>
          <a href="#" className="mobile-nav-item" data-view="oportunidades-perdas">
            <i className="ph ph-trend-up"></i>
            <span>Oportunidades</span>
          </a>
          <a href="#" className="mobile-nav-item" data-view="empreendimentos">
            <i className="ph ph-buildings"></i>
            <span>Empreend.</span>
          </a>
          <a href="#" className="mobile-nav-item" data-view="vendas">
            <i className="ph ph-currency-dollar"></i>
            <span>Vendas</span>
          </a>
          <a href="#" className="mobile-nav-item" data-view="marketing">
            <i className="ph ph-megaphone"></i>
            <span>Ads</span>
          </a>
          <a href="#" className="mobile-nav-item" data-view="campanhas">
            <i className="ph ph-sliders"></i>
            <span>Campanhas</span>
          </a>
          <a href="#" className="mobile-nav-item" data-view="leads-meta">
            <i className="ph ph-clipboard-text"></i>
            <span>Leads</span>
          </a>
          <a href="#" className="mobile-nav-item" data-view="publicar">
            <i className="ph ph-paper-plane-tilt"></i>
            <span>Publicar</span>
          </a>
        </nav>

        {/* Main Content */}
        <main className="main-content">
          <header className="top-header">
            <div className="mobile-top-bar">
              <img src="/logolongview.png" alt="Logo" className="mobile-logo" style={{ maxHeight: '45px' }} />
              <button id="open-filters-btn" className="menu-trigger">
                <i className="ph ph-funnel"></i>
              </button>
            </div>
            <div className="header-title desktop-only">
              <h1 id="page-title">Dashboard</h1>
              <p>Análise de clientes e negociações</p>
            </div>
            <div className="header-actions desktop-only">
              <div className="date-filters">
                <div className="date-input-group">
                  <label htmlFor="start-date">De:</label>
                  <input type="date" id="start-date" className="date-input" />
                </div>
                <div className="date-input-group">
                  <label htmlFor="end-date">Até:</label>
                  <input type="date" id="end-date" className="date-input" />
                </div>
                <button id="filter-btn" className="btn-secondary">Filtrar</button>
                <button id="clear-filters-btn" className="btn-secondary" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
                  <i className="ph ph-trash"></i> Limpar
                </button>
              </div>
              <button id="refresh-btn" className="btn-primary">
                <i className="ph ph-arrows-clockwise"></i>
                Atualizar
              </button>
            </div>
          </header>

          {/* Sidebar de Filtros Mobile */}
          <div id="mobile-filter-sidebar" className="mobile-sidebar-overlay hidden">
            <div className="mobile-sidebar-content">
              <div className="sidebar-header">
                <h3>Filtros e Ações</h3>
                <button id="close-filters-btn"><i className="ph ph-x"></i></button>
              </div>
              <div className="sidebar-body">
                <div className="sidebar-item">
                  <label>Data Inicial</label>
                  <input type="date" id="m-start-date" className="date-input" />
                </div>
                <div className="sidebar-item">
                  <label>Data Final</label>
                  <input type="date" id="m-end-date" className="date-input" />
                </div>

                <hr style={{ border: '0', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '20px 0' }} />

                <div id="dynamic-filters-mobile"></div>

                <button id="m-filter-btn" className="btn-primary" style={{ marginTop: '10px' }}>Aplicar Filtros</button>
                <button id="m-clear-btn" className="btn-secondary" style={{ marginTop: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent' }}>
                  Limpar Filtros
                </button>
                
                <div className="m-footer-actions">
                  <button id="m-refresh-btn" className="btn-secondary" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <i className="ph ph-arrows-clockwise"></i> Forçar Sincronização
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div id="loader" className="loader-container">
            <div className="spinner"></div>
            <p>Buscando dados no CV CRM...</p>
          </div>

          <div id="content-area" className="hidden">
            
            {/* VIEW: DASHBOARD */}
            <div id="view-dashboard" className="view-section active-view">
              {/* KPIs */}
              <div className="stats-grid">
                <div className="stat-card glass-card">
                  <div className="stat-icon blue"><i className="ph ph-users-three"></i></div>
                  <div className="stat-details">
                    <h3>Total de Leads</h3>
                    <p id="kpi-leads" className="stat-value">0</p>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <div className="stat-icon green"><i className="ph ph-currency-dollar"></i></div>
                  <div className="stat-details">
                    <h3>Total de Vendas</h3>
                    <p id="kpi-vendas-qtd" className="stat-value">0</p>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <div className="stat-icon purple"><i className="ph ph-map-pin-line"></i></div>
                  <div className="stat-details">
                    <h3>Visitas Realizadas</h3>
                    <p id="kpi-visitas" className="stat-value">0</p>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <div className="stat-icon orange"><i className="ph ph-money"></i></div>
                  <div className="stat-details">
                    <h3>Valor Total (Vendas)</h3>
                    <p id="kpi-valor-vendas" className="stat-value">R$ 0,00</p>
                  </div>
                </div>
              </div>

              {/* Gráficos de Crescimento */}
              <div className="lists-grid">
                <div className="chart-card glass-card">
                  <div className="chart-header">
                    <h3>Crescimento de Vendas</h3>
                    <select id="growth-period" className="select-input">
                      <option value="month">Mês a Mês</option>
                      <option value="year">Ano a Ano</option>
                    </select>
                  </div>
                  <div className="chart-container" style={{ position: 'relative', height: '300px', width: '100%' }}>
                    <canvas id="growthChart"></canvas>
                  </div>
                </div>
                <div className="chart-card glass-card">
                  <h3>Vendas por Origem</h3>
                  <div className="chart-container" style={{ position: 'relative', height: '300px', width: '100%', marginTop: '16px' }}>
                    <canvas id="salesOriginPieChart"></canvas>
                  </div>
                </div>
              </div>

              {/* Gráficos de Pizza */}
              <div className="lists-grid">
                <div className="chart-card glass-card">
                  <h3>Leads por Origem</h3>
                  <div className="chart-container" style={{ position: 'relative', height: '300px', width: '100%', marginTop: '16px' }}>
                    <canvas id="originPieChart"></canvas>
                  </div>
                </div>
                <div className="chart-card glass-card">
                  <h3>Leads por Status</h3>
                  <div id="status-pyramid-container" style={{ width: '100%', height: '400px', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* Pirâmide SVG injetada via JS */}
                  </div>
                </div>
              </div>
            </div>

            {/* VIEW: LEADS */}
            <div id="view-leads" className="view-section hidden">
              <div className="leads-summary-row" id="leads-summary-container"></div>

              <div className="charts-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                <div className="chart-card glass-card">
                  <h3>Gênero</h3>
                  <div className="chart-container" style={{ height: '250px' }}>
                    <canvas id="genderPieChart"></canvas>
                  </div>
                </div>
                <div className="chart-card glass-card">
                  <h3>Top 5 Cidades</h3>
                  <div className="chart-container" style={{ height: '250px' }}>
                    <canvas id="cityPieChart"></canvas>
                  </div>
                </div>
                <div className="chart-card glass-card">
                  <h3>Estado Civil</h3>
                  <div className="chart-container" style={{ height: '250px' }}>
                    <canvas id="civilStatePieChart"></canvas>
                  </div>
                </div>
              </div>

              <div className="table-card glass-card">
                <div className="table-header">
                  <h3>Gestão Completa de Leads</h3>
                  <div className="table-filters-row">
                    <div className="filter-group">
                      <span className="filter-label">Nome</span>
                      <input type="text" className="col-filter" data-col="nome" placeholder="Filtrar Nome..." />
                    </div>
                    <div className="filter-group">
                      <span className="filter-label">Data de Cadastro</span>
                      <input type="text" className="col-filter" data-col="data" placeholder="Ex: 14/05" />
                    </div>
                    <div className="filter-group">
                      <span className="filter-label">Origem (Mídia)</span>
                      <select className="col-filter" data-col="origem"><option value="">Todas</option></select>
                    </div>
                    <div className="filter-group">
                      <span className="filter-label">Corretor</span>
                      <select className="col-filter" data-col="corretor"><option value="">Todos</option></select>
                    </div>
                    <div className="filter-group">
                      <span className="filter-label">Imobiliária</span>
                      <select className="col-filter" data-col="imobiliaria"><option value="">Todas</option></select>
                    </div>
                    <div className="filter-group">
                      <span className="filter-label">Gestor</span>
                      <select className="col-filter" data-col="gestor"><option value="">Todos</option></select>
                    </div>
                    <div className="filter-group">
                      <span className="filter-label">Empreendimento</span>
                      <select className="col-filter" data-col="empreendimento"><option value="">Todos</option></select>
                    </div>
                    <div className="filter-group">
                      <span className="filter-label">Status (Etapa)</span>
                      <select className="col-filter" data-col="status"><option value="">Todos</option></select>
                    </div>
                    <div className="filter-group">
                      <span className="filter-label">Tag</span>
                      <select className="col-filter" data-col="tag"><option value="">Todas</option></select>
                    </div>
                    <div className="filter-group">
                      <span className="filter-label">Bolsão</span>
                      <select className="col-filter" data-col="bolsao">
                        <option value="">Todos</option>
                        <option value="sim">Sim</option>
                        <option value="nao">Não</option>
                      </select>
                    </div>
                    <div className="filter-group" style={{ alignItems: 'flex-end' }}>
                      <button className="btn-clear-table-filters" title="Limpar todos os filtros da tabela" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '8px', borderRadius: '8px', cursor: 'pointer', height: '38px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <i className="ph ph-trash"></i> Limpar
                      </button>
                    </div>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Cadastro</th>
                        <th>Etapa</th>
                        <th>Origem</th>
                        <th>Corretor</th>
                        <th>Imobiliária</th>
                        <th>Gestor</th>
                        <th>Empreend.</th>
                        <th>Tags</th>
                        <th>Bolsão</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody id="table-leads-body"></tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* VIEW: OPORTUNIDADES & PERDAS */}
            <div id="view-oportunidades-perdas" className="view-section hidden">
              <div className="stats-grid">
                <div className="stat-card glass-card">
                  <div className="stat-icon blue"><i className="ph ph-trend-up"></i></div>
                  <div className="stat-details">
                    <h3>Leads Quentes</h3>
                    <p id="kpi-leads-quentes" className="stat-value">0</p>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <div className="stat-icon green"><i className="ph ph-currency-dollar"></i></div>
                  <div className="stat-details">
                    <h3>VGV Potencial</h3>
                    <p id="kpi-vgv-potencial" className="stat-value">R$ 0,00</p>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <div className="stat-icon red"><i className="ph ph-x-circle"></i></div>
                  <div className="stat-details">
                    <h3>Leads Perdidos</h3>
                    <p id="kpi-leads-perdidos" className="stat-value">0</p>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <div className="stat-icon orange"><i className="ph ph-money"></i></div>
                  <div className="stat-details">
                    <h3>VGV Perdido</h3>
                    <p id="kpi-vgv-perdido" className="stat-value">R$ 0,00</p>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <div className="stat-icon purple"><i className="ph ph-chart-pie"></i></div>
                  <div className="stat-details">
                    <h3>Taxa de Descarte</h3>
                    <p id="kpi-taxa-descarte" className="stat-value">0,0%</p>
                  </div>
                </div>
              </div>

              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: '24px' }}>
                <div className="stat-card glass-card" style={{ borderLeft: '4px solid #EF4444', background: 'rgba(239, 68, 68, 0.03)' }}>
                  <div className="stat-icon red"><i className="ph ph-user-minus"></i></div>
                  <div className="stat-details">
                    <h3 style={{ color: '#F87171' }}>Leads Ativos Sem Corretor</h3>
                    <p id="kpi-leads-sem-corretor" className="stat-value" style={{ color: '#EF4444' }}>0</p>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Requer atribuição urgente no CRM</span>
                  </div>
                </div>
                <div className="stat-card glass-card" style={{ borderLeft: '4px solid #F59E0B', background: 'rgba(245, 158, 11, 0.03)' }}>
                  <div className="stat-icon orange"><i className="ph ph-clock-countdown"></i></div>
                  <div className="stat-details">
                    <h3 style={{ color: '#FBBF24' }}>Esfriando (Sem Interação há +10 dias)</h3>
                    <p id="kpi-leads-sem-interacao-tempo" className="stat-value" style={{ color: '#F59E0B' }}>0</p>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Potencial acumulado: <strong id="lbl-vgv-sem-interacao" style={{ color: '#e2e8f0' }}>R$ 0,00</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="lists-grid" style={{ marginTop: '24px' }}>
                <div className="chart-card glass-card">
                  <h3>Pipeline de Oportunidades</h3>
                  <div className="chart-container" style={{ position: 'relative', height: '300px', width: '100%', marginTop: '16px' }}>
                    <canvas id="opportunityStagesChart"></canvas>
                  </div>
                </div>
                <div className="chart-card glass-card">
                  <h3>Principais Motivos de Perda</h3>
                  <div id="loss-reasons-chart-wrapper" className="chart-container" style={{ position: 'relative', height: '300px', width: '100%', marginTop: '16px' }}>
                    <canvas id="lossReasonsChart"></canvas>
                  </div>
                </div>
              </div>

              <div className="lists-grid" style={{ marginTop: '24px' }}>
                <div className="chart-card glass-card">
                  <h3>Perda de VGV por Motivo (R$)</h3>
                  <div className="chart-container" style={{ position: 'relative', height: '300px', width: '100%', marginTop: '16px' }}>
                    <canvas id="lossValueChart"></canvas>
                  </div>
                </div>
                <div className="chart-card glass-card">
                  <h3>Eficiência de Conversão do Funil</h3>
                  <div className="chart-container" style={{ position: 'relative', height: '300px', width: '100%', marginTop: '16px' }}>
                    <canvas id="funnelConversionChart"></canvas>
                  </div>
                </div>
              </div>

              <div className="lists-grid" style={{ marginTop: '24px' }}>
                <div className="table-card glass-card" style={{ padding: '20px' }}>
                  <div className="table-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', marginBottom: '16px' }}>
                    <h3>🔥 Oportunidades Recentes</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Leads ativos mais recentes em fases avançadas.</p>
                  </div>
                  <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Etapa</th>
                          <th>Empreendimento</th>
                          <th>Valor</th>
                        </tr>
                      </thead>
                      <tbody id="table-oportunidades-recentes-body"></tbody>
                    </table>
                  </div>
                </div>

                <div className="table-card glass-card" style={{ padding: '20px' }}>
                  <div className="table-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', marginBottom: '16px' }}>
                    <h3>📉 Descartes Recentes</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Leads perdidos recentemente com motivo de cancelamento.</p>
                  </div>
                  <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Motivo</th>
                          <th>Corretor</th>
                          <th>Empreendimento</th>
                        </tr>
                      </thead>
                      <tbody id="table-descartes-recentes-body"></tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* VIEW: EMPREENDIMENTOS */}
            <div id="view-empreendimentos" className="view-section hidden">
              <div className="lists-grid" id="empreendimentos-grid" style={{ marginBottom: '24px' }}></div>

              <div className="table-card glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
                <div className="table-header" style={{ flexWrap: 'wrap', gap: '16px', marginBottom: '0' }}>
                  <div>
                    <h3>🔍 Controle de Estoque & Unidades</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Inventário completo de tipologias, metragens e disponibilidade.</p>
                  </div>
                  <div className="table-filters-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', marginTop: '12px' }}>
                    <div className="filter-group">
                      <span className="filter-label">Empreendimento</span>
                      <select id="filter-emp-stock" className="col-filter-stock" style={{ minWidth: '180px' }}></select>
                    </div>
                    <div className="filter-group">
                      <span className="filter-label">Tipologia</span>
                      <select id="filter-tipologia-stock" className="col-filter-stock" style={{ minWidth: '140px' }}>
                        <option value="">Todas Tipologias</option>
                        <option value="1 quarto">1 Quarto</option>
                        <option value="2 quartos">2 Quartos</option>
                        <option value="3 quartos">3 Quartos</option>
                        <option value="cobertura">Coberturas</option>
                      </select>
                    </div>
                    <div className="filter-group">
                      <span className="filter-label">Status</span>
                      <select id="filter-status-stock" className="col-filter-stock" style={{ minWidth: '120px' }}>
                        <option value="">Todos Status</option>
                        <option value="disponivel">Disponível</option>
                        <option value="reservado">Reservado</option>
                        <option value="vendido">Vendido</option>
                        <option value="bloqueado">Bloqueado</option>
                        <option value="em_processo">Em Processo</option>
                      </select>
                    </div>
                    <div className="filter-group" style={{ alignItems: 'flex-end' }}>
                      <button className="btn-clear-table-filters" title="Limpar todos os filtros da tabela" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '8px', borderRadius: '8px', cursor: 'pointer', height: '38px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <i className="ph ph-trash"></i> Limpar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="table-card glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
                <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '13px' }} id="table-unidades-estoque">
                    <thead>
                      <tr>
                        <th>Unidade</th>
                        <th>Empreendimento</th>
                        <th>Bloco</th>
                        <th>Tipologia</th>
                        <th>Área Privativa</th>
                        <th>Vagas</th>
                        <th>Sol</th>
                        <th>Status</th>
                        <th>Valor de Tabela</th>
                      </tr>
                    </thead>
                    <tbody id="table-unidades-estoque-body"></tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* VIEW: VENDAS */}
            <div id="view-vendas" className="view-section hidden">
              <div className="leads-summary-row" id="sales-summary-container" style={{ marginBottom: '28px' }}></div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ height: '3px', width: '28px', background: 'linear-gradient(90deg, #10B981, #0D9488)', borderRadius: '2px' }}></div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                  Rankings de Performance
                </span>
              </div>

              <div className="lists-grid" style={{ marginBottom: '36px' }}>
                <div className="list-card glass-card">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '20px', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
                    <span style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px' }}>TOP 5</span>
                    Corretores
                  </h3>
                  <div className="list-container" id="top-corretores"></div>
                </div>
                <div className="list-card glass-card">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '20px', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
                    <span style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px' }}>TOP 5</span>
                    Imobiliárias
                  </h3>
                  <div className="list-container" id="top-imobiliarias"></div>
                </div>
                <div className="list-card glass-card">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '20px', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
                    <span style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px' }}>VGV</span>
                    Por Empreendimento
                  </h3>
                  <div className="list-container" id="gv-projects"></div>
                </div>
              </div>

              <div className="table-card glass-card">
                <div className="table-header">
                  <h3>Auditoria de Vendas Realizadas</h3>
                  <div className="table-filters-row">
                    <div className="filter-group">
                      <span className="filter-label">Cliente</span>
                      <input type="text" className="col-filter-sales" data-col="cliente" placeholder="Filtrar Cliente..." />
                    </div>
                    <div className="filter-group">
                      <span className="filter-label">Empreendimento</span>
                      <select className="col-filter-sales" data-col="empreendimento"><option value="">Todos</option></select>
                    </div>
                    <div className="filter-group">
                      <span className="filter-label">Corretor</span>
                      <select className="col-filter-sales" data-col="corretor"><option value="">Todos</option></select>
                    </div>
                    <div className="filter-group">
                      <span className="filter-label">Imobiliária</span>
                      <select className="col-filter-sales" data-col="imobiliaria"><option value="">Todas</option></select>
                    </div>
                    <div className="filter-group" style={{ alignItems: 'flex-end' }}>
                      <button className="btn-clear-table-filters" title="Limpar todos os filtros da tabela" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '8px', borderRadius: '8px', cursor: 'pointer', height: '38px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <i className="ph ph-trash"></i> Limpar
                      </button>
                    </div>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Data Venda</th>
                        <th>Empreendimento</th>
                        <th>Bloco</th>
                        <th>Unidade</th>
                        <th>Tipologia</th>
                        <th>Corretor</th>
                        <th>Imobiliária</th>
                        <th>Valor Venda</th>
                      </tr>
                    </thead>
                    <tbody id="table-sales-body"></tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* VIEW: MARKETING ADS */}
            <div id="view-marketing" className="view-section hidden">
              <div className="stats-grid meta-stats-grid">
                <div className="stat-card glass-card">
                  <i className="ph ph-currency-circle-dollar" style={{ color: '#F43F5E', fontSize: '32px' }}></i>
                  <div>
                    <h3 id="meta-spend">R$ 0,00</h3>
                    <p>Investimento Meta Ads</p>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <i className="ph ph-users" style={{ color: '#0ea5e9', fontSize: '32px' }}></i>
                  <div>
                    <h3 id="meta-impressions">0</h3>
                    <p>Impressões</p>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <i className="ph ph-cursor-click" style={{ color: '#8B5CF6', fontSize: '32px' }}></i>
                  <div>
                    <h3 id="meta-clicks">0</h3>
                    <p>Cliques no Link</p>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <i className="ph ph-user-plus" style={{ color: '#0ea5e9', fontSize: '32px' }}></i>
                  <div>
                    <h3 id="meta-leads-top">0</h3>
                    <p>Leads Gerados (Meta)</p>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <i className="ph ph-target" style={{ color: '#10B981', fontSize: '32px' }}></i>
                  <div>
                    <h3 id="meta-cpl">R$ 0,00</h3>
                    <p>Custo por Lead (CRM)</p>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <i className="ph ph-eye" style={{ color: '#F59E0B', fontSize: '32px' }}></i>
                  <div>
                    <h3 id="meta-reach">0</h3>
                    <p>Alcance Único</p>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <i className="ph ph-repeat" style={{ color: '#8B5CF6', fontSize: '32px' }}></i>
                  <div>
                    <h3 id="meta-frequency">0x</h3>
                    <p>Frequência Média</p>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <i className="ph ph-person" style={{ color: '#EC4899', fontSize: '32px' }}></i>
                  <div>
                    <h3 id="meta-cpp">R$ 0,00</h3>
                    <p>Custo por Pessoa Alcançada</p>
                  </div>
                </div>
              </div>

              <div className="lists-grid" style={{ marginTop: '24px' }}>
                <div className="list-card glass-card">
                  <h3>Métricas de Desempenho Meta</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Custo por Clique (CPC)</span>
                      <strong id="meta-cpc" style={{ color: '#fff' }}>R$ 0,00</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Custo por Mil Impressões (CPM)</span>
                      <strong id="meta-cpm" style={{ color: '#fff' }}>R$ 0,00</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>CTR (Taxa de Clique)</span>
                      <strong id="meta-ctr" style={{ color: '#fff' }}>0%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Leads no Formulário do FB</span>
                      <strong id="meta-leads-api" style={{ color: '#10B981' }}>0</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>CPL Direto Meta (cost_per_lead)</span>
                      <strong id="meta-cpl-direct" style={{ color: '#F59E0B' }}>—</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Gasto Médio Diário</span>
                      <strong id="meta-avg-daily-spend" style={{ color: '#fff' }}>R$ 0,00</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Período Ativo</span>
                      <strong id="meta-active-days" style={{ color: '#94a3b8' }}>—</strong>
                    </div>
                  </div>
                </div>
                <div className="chart-card glass-card">
                  <h3>Origem de Leads: Meta Ads vs Resto</h3>
                  <div className="chart-container" style={{ position: 'relative', height: '250px', width: '100%' }}>
                    <canvas id="marketingPieChart"></canvas>
                  </div>
                </div>
              </div>

              <div className="lists-grid" style={{ marginTop: '24px' }}>
                <div className="chart-card glass-card">
                  <h3>Público por Gênero (Cliques)</h3>
                  <div className="chart-container" style={{ position: 'relative', height: '250px', width: '100%' }}>
                    <canvas id="metaGenderChart"></canvas>
                  </div>
                </div>
                <div className="chart-card glass-card">
                  <h3>Público por Idade (Cliques)</h3>
                  <div className="chart-container" style={{ position: 'relative', height: '250px', width: '100%' }}>
                    <canvas id="metaAgeChart"></canvas>
                  </div>
                </div>
                <div className="chart-card glass-card">
                  <h3>Público por Estado (Cliques)</h3>
                  <div className="chart-container" style={{ position: 'relative', height: '250px', width: '100%' }}>
                    <canvas id="metaRegionChart"></canvas>
                  </div>
                </div>
                <div className="chart-card glass-card">
                  <h3>Plataforma: FB vs Instagram</h3>
                  <div className="chart-container" style={{ position: 'relative', height: '250px', width: '100%' }}>
                    <canvas id="metaPlatformChart"></canvas>
                  </div>
                </div>
                <div className="chart-card glass-card">
                  <h3>Device: Mobile vs Desktop</h3>
                  <div className="chart-container" style={{ position: 'relative', height: '250px', width: '100%' }}>
                    <canvas id="metaDeviceChart"></canvas>
                  </div>
                </div>
              </div>

              {/* Gráfico de Evolução Diária */}
              <div className="table-card glass-card" style={{ marginTop: '24px' }}>
                <h3 style={{ marginBottom: '16px' }}>Evolução Diária — Investimento & Cliques</h3>
                <div style={{ position: 'relative', height: '280px', width: '100%' }}>
                  <canvas id="metaDailyChart"></canvas>
                </div>
              </div>

              {/* Tabela de Adsets */}
              <div className="table-card glass-card" style={{ marginTop: '24px' }}>
                <div className="table-header">
                  <h3>Desempenho por Conjunto de Anúncios (Adsets)</h3>
                </div>
                <div className="table-container">
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Campanha</th>
                          <th>Conjunto (Adset)</th>
                          <th>Investimento</th>
                          <th>Alcance</th>
                          <th>Impressões</th>
                          <th>Cliques</th>
                          <th>CTR</th>
                          <th>CPC</th>
                          <th>CPM</th>
                          <th>Leads (Meta)</th>
                          <th>CPL (Meta)</th>
                        </tr>
                      </thead>
                      <tbody id="table-adsets-body"></tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="table-card glass-card" style={{ marginTop: '24px' }}>
                <div className="table-header">
                  <h3>Desempenho por Campanha (Integração Meta + CV CRM)</h3>
                  <div className="table-filters-row">
                    <div className="filter-group">
                      <span className="filter-label">Filtrar Campanha</span>
                      <input type="text" className="col-filter" data-col="campanha" placeholder="Buscar campanha..." />
                    </div>
                    <div className="filter-group" style={{ alignItems: 'flex-end' }}>
                      <button className="btn-clear-table-filters" title="Limpar todos os filtros da tabela" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '8px', borderRadius: '8px', cursor: 'pointer', height: '38px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <i className="ph ph-trash"></i> Limpar
                      </button>
                    </div>
                  </div>
                </div>
                <div className="table-container">
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th className="sortable" data-sort="campanha">CAMPANHA</th>
                          <th>OBJETIVO</th>
                          <th>INÍCIO</th>
                          <th>TÉRMINO</th>
                          <th>DURAÇÃO</th>
                          <th>INVEST.</th>
                          <th>ALCANCE</th>
                          <th>FREQ.</th>
                          <th>CTR</th>
                          <th>CPC</th>
                          <th>IMP / CLIQUES</th>
                          <th>LEADS META</th>
                          <th>CPL META</th>
                          <th>LEADS CRM</th>
                          <th>FUNIL (CRM)</th>
                        </tr>
                      </thead>
                      <tbody id="table-campaigns-body"></tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* VIEW: CAMPANHAS — Controle de campanhas e adsets */}
            <div id="view-campanhas" className="view-section hidden">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Controle de Campanhas</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Pause, ative ou ajuste orçamentos diretamente pelo dashboard</p>
                </div>
                <button id="btn-refresh-campanhas" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.3)', color: '#0ea5e9', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  <i className="ph ph-arrows-clockwise"></i> Atualizar
                </button>
              </div>

              {/* Status indicator */}
              <div id="campanhas-status" style={{ display: 'none', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}></div>

              {/* Campanhas */}
              <div className="table-card glass-card" style={{ marginBottom: '24px' }}>
                <div className="table-header">
                  <h3>Campanhas <span id="campanhas-count" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '400' }}></span></h3>
                  <input type="text" id="filter-campanhas" placeholder="Buscar campanha..." style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '13px', width: '200px' }} />
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>CAMPANHA</th>
                        <th>STATUS</th>
                        <th>OBJETIVO</th>
                        <th>ORÇAMENTO DIÁRIO</th>
                        <th>ORÇAMENTO TOTAL</th>
                        <th>INÍCIO</th>
                        <th>AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody id="table-campanhas-control-body"></tbody>
                  </table>
                </div>
              </div>

              {/* Adsets */}
              <div className="table-card glass-card">
                <div className="table-header">
                  <h3>Conjuntos de Anúncios (Adsets) <span id="adsets-count" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '400' }}></span></h3>
                  <input type="text" id="filter-adsets-control" placeholder="Buscar conjunto..." style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '13px', width: '200px' }} />
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>CAMPANHA</th>
                        <th>CONJUNTO</th>
                        <th>STATUS</th>
                        <th>ORÇAMENTO DIÁRIO</th>
                        <th>INÍCIO</th>
                        <th>FIM</th>
                        <th>AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody id="table-adsets-control-body"></tbody>
                  </table>
                </div>
              </div>

              {/* Modal de edição de orçamento */}
              <div id="budget-modal" style={{ display: 'none', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '28px', width: '360px', maxWidth: '90vw' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Editar Orçamento</h3>
                  <p id="budget-modal-name" style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 20px' }}></p>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Orçamento Diário (R$)</label>
                    <input id="budget-input" type="number" step="0.01" min="1" placeholder="Ex: 150.00" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button id="budget-cancel-btn" style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
                    <button id="budget-save-btn" style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.4)', color: '#0ea5e9', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Salvar</button>
                  </div>
                </div>
              </div>
            </div>

            {/* VIEW: LEADS META — Leads dos formulários Meta */}
            <div id="view-leads-meta" className="view-section hidden">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Leads Meta (Formulários)</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Leads coletados diretamente pelos formulários do Facebook e Instagram</p>
                </div>
                <button id="btn-refresh-leads-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  <i className="ph ph-arrows-clockwise"></i> Atualizar
                </button>
              </div>

              {/* Formulários disponíveis */}
              <div className="lists-grid" style={{ marginBottom: '24px' }}>
                <div className="list-card glass-card">
                  <h3>Formulários Ativos</h3>
                  <div id="leads-meta-forms-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Carregando formulários...</p>
                  </div>
                </div>
                <div className="stat-card glass-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <i className="ph ph-clipboard-text" style={{ fontSize: '32px', color: '#10b981' }}></i>
                    <div>
                      <h3 id="leads-meta-total" style={{ margin: 0, fontSize: '28px' }}>—</h3>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Total de Leads nos Formulários</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Formulários ativos</p>
                      <strong id="leads-meta-forms-count" style={{ fontSize: '18px' }}>—</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Formulário selecionado</p>
                      <strong id="leads-meta-selected-form" style={{ fontSize: '13px', color: '#10b981' }}>Todos</strong>
                    </div>
                  </div>
                  {/* Stats de cruzamento CRM */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', marginTop: '4px' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Cruzados c/ CRM</p>
                      <strong id="leads-meta-crm-matched" style={{ fontSize: '18px', color: '#10b981' }}>—</strong>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Taxa de match</p>
                      <strong id="leads-meta-crm-rate" style={{ fontSize: '18px', color: '#f59e0b' }}>—</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total leads CRM</p>
                      <strong id="leads-meta-crm-total" style={{ fontSize: '18px' }}>—</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabela de leads */}
              <div className="table-card glass-card">
                <div className="table-header">
                  <h3>Leads do Formulário <span id="leads-meta-table-count" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '400' }}></span></h3>
                  <input type="text" id="filter-leads-meta" placeholder="Buscar nome, e-mail, telefone..." style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '13px', width: '240px' }} />
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>DATA</th>
                        <th>NOME</th>
                        <th>E-MAIL</th>
                        <th>TELEFONE</th>
                        <th>CAMPANHA</th>
                        <th>CONJUNTO</th>
                        <th>FORMULÁRIO</th>
                        <th>OUTROS CAMPOS</th>
                        <th style={{ color: '#10b981' }}>MATCH CRM</th>
                      </tr>
                    </thead>
                    <tbody id="table-leads-meta-body"></tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* VIEW: PUBLICAR — Publicação de posts FB/Instagram */}
            <div id="view-publicar" className="view-section hidden">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Publicar nas Redes Sociais</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Longview Empreendimentos — Facebook & Instagram</p>
                </div>
              </div>

              <div className="lists-grid" style={{ alignItems: 'flex-start' }}>
                {/* Formulário de publicação */}
                <div className="list-card glass-card" style={{ gridColumn: '1 / -1' }}>
                  <h3 style={{ marginBottom: '20px' }}>Novo Post</h3>

                  {/* Plataformas */}
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Publicar em</p>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                        <input type="checkbox" id="pub-facebook" defaultChecked style={{ accentColor: '#0ea5e9' }} />
                        <i className="ph ph-facebook-logo" style={{ color: '#1877F2', fontSize: '18px' }}></i>
                        <span>Facebook</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                        <input type="checkbox" id="pub-instagram" style={{ accentColor: '#E1306C' }} />
                        <i className="ph ph-instagram-logo" style={{ color: '#E1306C', fontSize: '18px' }}></i>
                        <span>Instagram</span>
                      </label>
                    </div>
                    <p id="pub-instagram-note" style={{ margin: '6px 0 0', fontSize: '11px', color: '#F59E0B' }}>
                      ⚠ Instagram requer imagem. Posts de texto puro não são suportados.
                    </p>
                  </div>

                  {/* Texto */}
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Texto do post *</p>
                    <textarea id="pub-message" rows={5} placeholder="Escreva o texto do seu post aqui..." style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '14px', lineHeight: '1.6', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                    <p id="pub-char-count" style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'right' }}>0 caracteres</p>
                  </div>

                  {/* URL da imagem */}
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>URL da Imagem (opcional para Facebook, obrigatório para Instagram)</p>
                    <input type="url" id="pub-image-url" placeholder="https://sua-imagem.com/foto.jpg" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }} />
                    <div id="pub-image-preview" style={{ display: 'none', marginTop: '12px' }}>
                      <img id="pub-image-preview-img" src="" alt="Preview" style={{ maxWidth: '320px', maxHeight: '200px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
                    </div>
                  </div>

                  {/* Preview */}
                  <div id="pub-preview-box" style={{ display: 'none', marginBottom: '20px', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>Preview</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: '700' }}>L</div>
                      <div>
                        <strong style={{ fontSize: '13px' }}>Longview Empreendimentos</strong>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>Agora</p>
                      </div>
                    </div>
                    <p id="pub-preview-text" style={{ margin: '0 0 10px', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}></p>
                    <img id="pub-preview-image" src="" alt="" style={{ display: 'none', width: '100%', maxHeight: '280px', borderRadius: '8px', objectFit: 'cover' }} />
                  </div>

                  {/* Status de envio */}
                  <div id="pub-status" style={{ display: 'none', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}></div>

                  {/* Botões */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button id="btn-preview-post" style={{ padding: '10px 20px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="ph ph-eye"></i> Pré-visualizar
                    </button>
                    <button id="btn-publish-post" style={{ padding: '10px 24px', borderRadius: '8px', background: 'linear-gradient(135deg, rgba(14,165,233,0.2), rgba(99,102,241,0.2))', border: '1px solid rgba(14,165,233,0.4)', color: '#0ea5e9', cursor: 'pointer', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="ph ph-paper-plane-tilt"></i> Publicar Agora
                    </button>
                  </div>
                </div>
              </div>

              {/* Posts recentes */}
              <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <button id="btn-posts-facebook" className="posts-platform-btn active" style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(24,119,242,0.15)', border: '1px solid rgba(24,119,242,0.4)', color: '#1877F2', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ph ph-facebook-logo"></i> Posts Facebook
                  </button>
                  <button id="btn-posts-instagram" className="posts-platform-btn" style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ph ph-instagram-logo"></i> Posts Instagram
                  </button>
                </div>
                <div id="posts-recentes-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Carregando posts recentes...</p>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
