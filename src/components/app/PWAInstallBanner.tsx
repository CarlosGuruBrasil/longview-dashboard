'use client';

/**
 * PWAInstallBanner
 * Mostra banner de "Adicionar à tela inicial" apenas quando:
 * - Dispositivo é mobile (iOS ou Android)
 * - App NÃO está rodando em modo standalone (já instalado)
 * - Usuário não dispensou o banner nesta sessão
 */
import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';

type Platform = 'ios' | 'android' | null;

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return null;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export default function PWAInstallBanner() {
  const [platform, setPlatform]   = useState<Platform>(null);
  const [dismissed, setDismissed] = useState(true); // começa oculto até detectar

  useEffect(() => {
    if (isStandalone()) return; // já instalado, não mostra nada
    const p = detectPlatform();
    if (!p) return; // desktop, não mostra
    const key = 'pwa-banner-dismissed-v1';
    if (sessionStorage.getItem(key) === '1') return; // dispensado nesta sessão
    setPlatform(p);
    setDismissed(false);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem('pwa-banner-dismissed-v1', '1');
    setDismissed(true);
  };

  if (dismissed || !platform) return null;

  return (
    <div
      className="fixed inset-x-0 z-[200] px-4 no-tap"
      style={{ bottom: 'calc(60px + max(var(--safe-bottom), 8px) + 8px)' }}
    >
      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#18181b]/95 p-4 shadow-2xl backdrop-blur-xl">
        {/* Ícone do app */}
        <div className="shrink-0 w-10 h-10 rounded-xl overflow-hidden border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="LongView" className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">
            Instalar LongView Manager
          </p>
          {platform === 'ios' ? (
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Toque em <span className="text-white font-medium">Compartilhar</span>{' '}
              <span className="text-base">⎙</span> e depois{' '}
              <span className="text-white font-medium">&quot;Adicionar à Tela de Início&quot;</span>{' '}
              para usar sem barra do navegador.
            </p>
          ) : (
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Instale o app para usar em tela cheia, sem barra do navegador.
            </p>
          )}
        </div>

        <button
          onClick={dismiss}
          className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-white/5 text-zinc-500 hover:text-white active:scale-90 transition-transform"
        >
          <X size={13} />
        </button>
      </div>

      {/* Seta apontando para a bottom nav */}
      <div className="flex justify-center mt-1">
        <div className="w-3 h-3 rotate-45 border-b border-r border-white/10 bg-[#18181b]/95" />
      </div>
    </div>
  );
}
