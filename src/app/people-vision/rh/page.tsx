import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertCircle, BarChart3, BriefcaseBusiness, HeartHandshake, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { verifyAuth } from '@/lib/auth';
import { readUsers } from '@/lib/db-kv';
import { buildHrReadiness, HR_METRIC_CATEGORIES } from '@/lib/hr-metrics';
import { canAccessHrMetrics } from '@/lib/user-access';

export default async function PeopleVisionRhPage() {
  const auth = await verifyAuth();
  if (!auth) redirect('/login');

  const users = await readUsers();
  const currentUser = users.find((user) => user.id === auth.userId);
  if (!currentUser || !canAccessHrMetrics(currentUser)) {
    redirect('/people-vision');
  }

  const readiness = buildHrReadiness(users);

  return (
    <div className="w-full space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
      <section className="rounded-2xl border border-[#1E1E22] bg-[#121214]/70 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300">
              <ShieldCheck size={12} />
              RH e Diretoria
            </div>
            <h2 className="mt-4 text-2xl font-bold text-white">Inteligência de RH</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
              Modelo-base para acompanhar eficiência operacional, retenção, clima e retorno do capital humano dentro do `People Vision`.
            </p>
          </div>

          <Link
            href="/people-vision/colaboradores"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/10"
          >
            <Users size={14} />
            Voltar para colaboradores
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-300"><Users size={18} /></div>
            <div>
              <p className="text-2xl font-bold text-white">{readiness.activeHeadcount}</p>
              <p className="text-xs text-zinc-500">Colaboradores ativos mapeados</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-500/10 p-3 text-blue-300"><BriefcaseBusiness size={18} /></div>
            <div>
              <p className="text-2xl font-bold text-white">{readiness.dataCoverage.activatedAt}</p>
              <p className="text-xs text-zinc-500">Com data de admissão preenchida</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-500/10 p-3 text-violet-300"><HeartHandshake size={18} /></div>
            <div>
              <p className="text-2xl font-bold text-white">{readiness.dataCoverage.department}</p>
              <p className="text-xs text-zinc-500">Com departamento definido</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/10 p-3 text-amber-300"><BarChart3 size={18} /></div>
            <div>
              <p className="text-2xl font-bold text-white">{readiness.availableSources.length}</p>
              <p className="text-xs text-zinc-500">Fontes mínimas já disponíveis</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle size={18} className="mt-0.5 text-amber-300" />
          <div>
            <h3 className="text-sm font-semibold text-amber-200">Fato importante</h3>
            <p className="mt-1 text-sm leading-relaxed text-amber-100/80">
              Hoje o sistema ainda não possui base real para calcular todos os KPIs de RH. A tela abaixo implementa o modelo de acompanhamento, mostra o que já existe e deixa explícito quais entradas faltam para cada indicador, sem inventar números.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {HR_METRIC_CATEGORIES.map((category) => (
          <div key={category.title} className="rounded-2xl border border-[#1E1E22] bg-[#121214]/60 p-5">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-white">{category.title}</h3>
              <p className="mt-1 text-sm text-zinc-500">{category.description}</p>
            </div>

            <div className="space-y-3">
              {category.metrics.map((metric) => (
                <div key={metric.name} className="rounded-xl border border-white/6 bg-[#17171A] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-100">{metric.name}</h4>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{metric.description}</p>
                    </div>
                    <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                      Modelo
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg border border-white/5 bg-[#121214]/70 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">Cálculo</p>
                      <p className="mt-1 text-sm text-zinc-200">{metric.formula}</p>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-[#121214]/70 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">Dados necessários</p>
                      <p className="mt-1 text-sm text-zinc-200">{metric.requiredInputs.join(' • ')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[#1E1E22] bg-[#121214]/60 p-5">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Próximas integrações recomendadas</h3>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-[#17171A] p-4 text-sm text-zinc-300">
            <p className="font-semibold text-white">1. Recrutamento</p>
            <p className="mt-1 text-zinc-500">Cadastro de vagas, candidatos, entrevistas, aprovações e custos por processo.</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#17171A] p-4 text-sm text-zinc-300">
            <p className="font-semibold text-white">2. Desligamentos e retenção</p>
            <p className="mt-1 text-zinc-500">Motivo da saída, data de desligamento, classificação voluntário/involuntário e talentos críticos.</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#17171A] p-4 text-sm text-zinc-300">
            <p className="font-semibold text-white">3. Clima e engajamento</p>
            <p className="mt-1 text-zinc-500">Pesquisas internas, eNPS, absenteísmo e notas por ciclo.</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#17171A] p-4 text-sm text-zinc-300">
            <p className="font-semibold text-white">4. Treinamento e ROI</p>
            <p className="mt-1 text-zinc-500">Horas de capacitação, custo por treinamento e ganho operacional pós-capacitação.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
