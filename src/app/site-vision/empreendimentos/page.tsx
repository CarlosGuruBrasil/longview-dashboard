import { redirect } from 'next/navigation';
import { verifyPermission } from '@/lib/auth';
import { ProjectsCatalogClient } from './ProjectsCatalogClient';

export const metadata = {
  title: 'Empreendimentos — Site Vision',
  description: 'Gerencie quais empreendimentos aparecem no site público',
};

export default async function EmpreendimentosPage() {
  const user = await verifyPermission('viewSiteVision');
  if (!user) redirect('/login');

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Empreendimentos</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Escolha quais empreendimentos aparecem no site público e configure imagens, unidades e materiais.
          </p>
        </div>
      </section>

      <ProjectsCatalogClient />
    </div>
  );
}
