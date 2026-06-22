import Sidebar from './components/Sidebar';

export default function ProjectVisionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex bg-[#09090b] text-zinc-100 antialiased w-full" style={{ minHeight: '100dvh' }}>
      <Sidebar />
      {/*
        Mobile: pt accounts for fixed top bar (~52px) + safe-area-top
                pb accounts for fixed bottom nav (56px) + safe-area-bottom
        Desktop: lg:pl-64 for sidebar, no extra padding needed
      */}
      <main
        className="flex-1 lg:pl-64 flex flex-col w-full overflow-x-hidden"
        style={{
          paddingTop:    'calc(max(env(safe-area-inset-top), 10px) + 46px)',
          paddingBottom: 'calc(var(--safe-bottom) + 56px)',
        }}
      >
        <style>{`
          @media (min-width: 1024px) {
            main { padding-top: 0 !important; padding-bottom: 0 !important; }
          }
        `}</style>
        {children}
      </main>
    </div>
  );
}
