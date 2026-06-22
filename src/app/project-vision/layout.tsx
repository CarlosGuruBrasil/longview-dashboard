import Sidebar from './components/Sidebar';

export default function ProjectVisionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#09090b] text-zinc-100 antialiased w-full" style={{ minHeight: '100dvh' }}>
      <Sidebar />
      {/*
        Mobile:  top header ~52px + safe-area-top | bottom nav 60px + safe-area-bottom
        Desktop: lg:pl-64 for sidebar, no extra padding
      */}
      <main className="lg:pl-64 w-full overflow-x-hidden" style={{
        paddingTop:    'calc(max(env(safe-area-inset-top), 0px) + 52px)',
        paddingBottom: 'calc(max(env(safe-area-inset-bottom), 0px) + 64px)',
      }}>
        {/* Override on desktop */}
        <style>{`@media(min-width:1024px){main{padding-top:0!important;padding-bottom:0!important}}`}</style>
        {children}
      </main>
    </div>
  );
}
