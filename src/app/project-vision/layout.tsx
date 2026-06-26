import Sidebar from './components/Sidebar';
import NotificationBanner from '@/components/NotificationBanner';
import AppHeader from '@/components/app/AppHeader';

const TITLE_MAP = {
  '/project-vision/projects': 'Empreendimentos',
  '/project-vision/tasks': 'Tarefas',
  '/project-vision/kanban': 'Kanban',
  '/project-vision/timeline': 'Timeline',
  '/project-vision/responsibles': 'Responsáveis',
  '/project-vision/documents': 'Documentos',
  '/project-vision/reports': 'Relatórios',
  '/project-vision/settings': 'Configurações',
  '/project-vision': 'Dashboard',
};

export default function ProjectVisionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#09090b] text-zinc-100 antialiased w-full" style={{ minHeight: '100dvh' }}>
      <Sidebar />
      {/*
        Mobile:  top header ~52px + safe-area-top | bottom nav 60px + safe-area-bottom
        Desktop: lg:pl-64 for sidebar, no extra padding
      */}
      <main className="lg:pl-[220px] w-full overflow-x-hidden" style={{
        paddingTop:    'calc(max(env(safe-area-inset-top), 0px) + 52px)',
        paddingBottom: 'calc(max(env(safe-area-inset-bottom), 0px) + 64px)',
      }}>
        {/* Override on desktop */}
        <style>{`@media(min-width:1024px){main{padding-top:0!important;padding-bottom:0!important}}`}</style>
        <AppHeader
          module="project"
          titleMap={TITLE_MAP}
          fallbackTitle="Project Vision"
          subtitle="Gestão de projetos, tarefas e cronogramas"
          accent="blue"
        />
        {children}
      </main>

      {/* Banner de permissão FCM (mobile, só aparece se não concedido) */}
      <NotificationBanner />
    </div>
  );
}
