import QualidadeSidebar from './components/Sidebar'
import NotificationBanner from '@/components/NotificationBanner'

export const metadata = {
  title: 'Qualidade Vision — LongView',
}

export default function QualidadeVisionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#09090b] text-zinc-100 antialiased w-full" style={{ minHeight: '100dvh' }}>
      <QualidadeSidebar />
      <main className="lg:pl-64 w-full overflow-x-hidden" style={{
        paddingTop:    'calc(max(env(safe-area-inset-top), 0px) + 52px)',
        paddingBottom: 'calc(max(env(safe-area-inset-bottom), 0px) + 64px)',
      }}>
        <style>{`@media(min-width:1024px){main{padding-top:0!important;padding-bottom:0!important}}`}</style>
        {children}
      </main>
      <NotificationBanner />
    </div>
  )
}
