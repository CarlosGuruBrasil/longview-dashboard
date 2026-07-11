import QualitySidebar from './components/Sidebar'
import NotificationBanner from '@/components/NotificationBanner'
import AppHeader from '@/components/app/AppHeader'

export const metadata = {
  title: 'Quality Vision — LongView',
}

const TITLE_MAP = {
  '/quality-vision/inteligencia': 'Inteligência',
  '/quality-vision/inspecoes': 'Inspeções',
  '/quality-vision/relatorios': 'Relatórios',
  '/quality-vision/classificacao': 'Classificação',
  '/quality-vision': 'Dashboard',
}

export default function QualityVisionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#09090b] text-zinc-100 antialiased w-full" style={{ minHeight: '100dvh' }}>
      <QualitySidebar />
      <main className="lg:pl-[220px] w-full overflow-x-hidden" style={{
        paddingTop:    'calc(max(env(safe-area-inset-top), 0px) + 52px)',
        paddingBottom: 'calc(max(env(safe-area-inset-bottom), 0px) + 64px)',
      }}>
        <style>{`@media(min-width:1024px){main{padding-top:0!important;padding-bottom:0!important}}`}</style>
        <AppHeader
          module="quality"
          titleMap={TITLE_MAP}
          fallbackTitle="Quality Vision"
          subtitle="Quality control e inspeções de obra"
          accent="violet"
        />
        {children}
      </main>
      <NotificationBanner />
    </div>
  )
}
