import Sidebar from './components/Sidebar';

export default function ProjectVisionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#0A0A0B] text-zinc-100 antialiased w-full">
      {/* Sidebar específica do Project Vision */}
      <Sidebar />

      {/* Container Principal com espaçamento para a Sidebar */}
      <main className="flex-1 lg:pl-64 flex flex-col min-h-screen relative overflow-x-hidden w-full">
        {children}
      </main>
    </div>
  );
}
