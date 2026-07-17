import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { listPublicTeamMembers } from '@/lib/site-public';

export const metadata: Metadata = {
  title: 'Equipe | LongView Site',
  description: 'Equipe comercial visível no site público da LongView.',
};

export default async function PublicSiteTeamPage() {
  const team = await listPublicTeamMembers();

  return (
    <main className="min-h-screen bg-[#071013] text-white">
      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-10">
        <Link href="/site" className="text-sm font-semibold text-teal-300">
          Voltar para o site
        </Link>
        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Equipe do site</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Corretores e consultores visíveis ao público</h1>
          </div>
          <p className="text-sm text-zinc-400">{team.length} perfis liberados no Site Vision</p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {team.map((member) => (
            <article key={member.id} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-4">
                {member.avatarUrl ? (
                  <Image src={member.avatarUrl} alt={member.name} width={64} height={64} className="h-16 w-16 rounded-2xl object-cover" unoptimized />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 text-sm font-bold text-teal-300">
                    {member.name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-semibold text-white">{member.name}</h2>
                  <p className="mt-1 text-sm text-zinc-400">{member.position}</p>
                </div>
              </div>

              <div className="mt-5 space-y-2 text-sm text-zinc-300">
                <p>{member.company}</p>
                {member.professionalId ? <p>{member.professionalIdType}: {member.professionalId}</p> : null}
                {member.whatsapp || member.phone ? <p>{member.whatsapp || member.phone}</p> : null}
                {member.email ? <p>{member.email}</p> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
