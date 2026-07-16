import { redirect } from 'next/navigation';
import { verifyPermission } from '@/lib/auth';
import { ProjectDetailClient } from './ProjectDetailClient';

export const metadata = {
  title: 'Configurar Empreendimento — Site Vision',
  description: 'Configure imagens, unidades e materiais para publicar no site',
};

type Params = { params: Promise<{ id: string }> };

export default async function ProjectDetailPage({ params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) redirect('/login');

  const { id } = await params;
  const projectId = parseInt(id, 10);
  if (!Number.isFinite(projectId)) redirect('/site-vision/empreendimentos');

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
      <ProjectDetailClient projectId={projectId} />
    </div>
  );
}
