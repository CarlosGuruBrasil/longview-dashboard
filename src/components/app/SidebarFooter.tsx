'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import {
  adminItem,
  appsItem,
  getAllowedModules,
  isAdminUser,
  switchIcon,
  type ModuleKey,
} from './moduleNavigation';

interface SidebarFooterProps {
  currentModule: ModuleKey;
  mobile?: boolean;
  onNavigate?: () => void;
}

function withFrom(href: string, pathname: string) {
  return `${href}?from=${encodeURIComponent(pathname)}`;
}

export default function SidebarFooter({ currentModule, mobile = false, onNavigate }: SidebarFooterProps) {
  const pathname = usePathname();
  const { currentUser } = useUser();
  const modules = getAllowedModules(currentUser, currentModule);
  const SwitchIcon = switchIcon;
  const AppsIcon = appsItem.icon;
  const AdminIcon = adminItem.icon;
  const adminHref = withFrom(adminItem.href, pathname);

  if (mobile) {
    return (
      <div className="space-y-2">
        <Link
          href="/select-app"
          onClick={onNavigate}
          className="no-tap flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-zinc-300 bg-white/[0.055] border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl hover:bg-white/[0.09] hover:text-white transition-all"
        >
          <AppsIcon size={15} className="text-zinc-600" />
          {appsItem.name}
        </Link>

        {modules.map(module => (
          <Link
            key={module.key}
            href={module.href}
            onClick={onNavigate}
            className={`no-tap flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm ${module.colorClass} ${module.bgClass} border ${module.borderClass} shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all`}
          >
            <SwitchIcon size={15} />
            {module.name}
          </Link>
        ))}

        {isAdminUser(currentUser) && (
          <Link
            href={adminHref}
            onClick={onNavigate}
            className="no-tap flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-red-400 bg-red-500/10 hover:bg-red-500/16 border border-red-400/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all"
          >
            <AdminIcon size={15} />
            {adminItem.name}
          </Link>
        )}

        <a
          href="/api/auth/logout"
          className="no-tap flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={15} />
          Sair
        </a>
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-white/[0.06] space-y-2">
      <Link
        href="/select-app"
        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-zinc-300 bg-white/[0.055] border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl hover:bg-white/[0.09] hover:text-white transition-all"
      >
        <AppsIcon size={14} className="text-zinc-600" />
        {appsItem.name}
      </Link>

      {modules.map(module => (
        <Link
          key={module.key}
          href={module.href}
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold ${module.bgClass} ${module.colorClass} border ${module.borderClass} shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all`}
        >
          <SwitchIcon size={14} />
          {module.name}
        </Link>
      ))}

      {isAdminUser(currentUser) && (
        <Link
          href={adminHref}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/16 text-red-400 border border-red-400/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all"
        >
          <AdminIcon size={14} />
          {adminItem.name}
        </Link>
      )}
    </div>
  );
}
