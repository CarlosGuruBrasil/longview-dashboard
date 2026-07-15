import { redirect } from 'next/navigation';
import Sidebar from './components/Sidebar';
import AppHeader from '@/components/app/AppHeader';
import { verifyPermission } from '@/lib/auth';

const TITLE_MAP = {
  '/site-vision/empreendimentos': 'Empreendimentos',
  '/site-vision/leads': 'Leads & Captação',
  '/site-vision/integracoes': 'Integrações',
  '/site-vision/acesso': 'Acesso & Operação',
  '/site-vision': 'Dashboard',
};

export default async function SiteVisionLayout({ children }: { children: React.ReactNode }) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) redirect('/select-app');

  return (
    <div className="bg-[#09090b] text-zinc-100 antialiased w-full" style={{ minHeight: '100dvh' }}>
      <Sidebar />
      <main
        className="lg:pl-[220px] w-full overflow-x-hidden"
        style={{
          paddingTop: 'calc(max(env(safe-area-inset-top), 0px) + 52px)',
          paddingBottom: 'calc(max(env(safe-area-inset-bottom), 0px) + 64px)',
        }}
      >
        <style>{`@media(min-width:1024px){main{padding-top:0!important;padding-bottom:0!important}}`}</style>
        <AppHeader
          module="site"
          titleMap={TITLE_MAP}
          fallbackTitle="Site Vision"
          subtitle="Admin do site, integrações e operação comercial publicada"
          accent="teal"
        />
        {children}
      </main>
    </div>
  );
}
