import RHSidebar from './components/Sidebar';
import NotificationBanner from '@/components/NotificationBanner';
import AppHeader from '@/components/app/AppHeader';

const TITLE_MAP = {
  '/rh-vision/colaboradores': 'Colaboradores',
  '/rh-vision/cadastro': 'Cadastro',
  '/rh-vision/notificacoes': 'Notificações',
  '/rh-vision': 'Dashboard',
};

export default function RHVisionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#09090b] text-zinc-100 antialiased w-full" style={{ minHeight: '100dvh' }}>
      <RHSidebar />
      <main className="lg:pl-[220px] w-full overflow-x-hidden" style={{
        paddingTop:    'calc(max(env(safe-area-inset-top), 0px) + 52px)',
        paddingBottom: 'calc(max(env(safe-area-inset-bottom), 0px) + 64px)',
      }}>
        <style>{`@media(min-width:1024px){main{padding-top:0!important;padding-bottom:0!important}}`}</style>
        <AppHeader
          module="people"
          titleMap={TITLE_MAP}
          fallbackTitle="People Vision"
          subtitle="Gestão de pessoas, perfis e acessos"
          accent="emerald"
        />
        {children}
      </main>
      <NotificationBanner />
    </div>
  );
}
