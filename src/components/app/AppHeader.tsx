'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CloudRain, CloudSun, LogOut, UserCircle } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { type ModuleKey } from './moduleNavigation';

type Accent = 'blue' | 'orange' | 'sky' | 'emerald' | 'teal' | 'violet';

interface AppHeaderProps {
  module: ModuleKey;
  titleMap?: Record<string, string>;
  fallbackTitle?: string;
  subtitle?: string;
  accent?: Accent;
  centerContent?: React.ReactNode;
  actions?: React.ReactNode;
}

const ACCENT_CLASSES: Record<Accent, string> = {
  blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  teal: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
  violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
};

const WEATHER_LABELS: Record<number, string> = {
  0: 'Céu limpo',
  1: 'Poucas nuvens',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Neblina',
  48: 'Neblina',
  51: 'Garoa',
  53: 'Garoa',
  55: 'Garoa',
  61: 'Chuva',
  63: 'Chuva',
  65: 'Chuva forte',
  80: 'Pancadas',
  81: 'Pancadas',
  82: 'Temporal',
  95: 'Trovoadas',
};

const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82, 95]);

function resolveTitle(pathname: string, titleMap?: Record<string, string>, fallbackTitle?: string) {
  if (!titleMap) return fallbackTitle ?? 'Dashboard';
  for (const [href, title] of Object.entries(titleMap)) {
    if (pathname === href || (href !== '/' && pathname.startsWith(href))) return title;
  }
  return fallbackTitle ?? 'Dashboard';
}

function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(now);
  }, [now]);
}

function useWeather() {
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      try {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=-27.5949&longitude=-48.5482&current=temperature_2m,weather_code&timezone=America%2FSao_Paulo';
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.current) {
          setWeather({
            temp: Math.round(Number(data.current.temperature_2m)),
            code: Number(data.current.weather_code),
          });
        }
      } catch {
        if (!cancelled) setWeather(null);
      }
    }

    loadWeather();
    const id = window.setInterval(loadWeather, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return weather;
}

interface PresenceEntry { userId: string; name: string; role: string; avatarUrl?: string; lastSeen: string; }

function useHeartbeat() {
  useEffect(() => {
    const ping = () => fetch('/api/user/heartbeat', { method: 'POST' }).catch(() => {});
    ping();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') ping();
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
}

function usePresence() {
  const [online, setOnline] = useState<PresenceEntry[]>([]);
  useEffect(() => {
    const load = () => fetch('/api/user/presence').then(r => r.json()).then(d => setOnline(d.online ?? [])).catch(() => {});
    load();
    const id = window.setInterval(load, 30_000);
    return () => window.clearInterval(id);
  }, []);
  return online;
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

export default function AppHeader({
  module,
  titleMap,
  fallbackTitle,
  subtitle,
  accent = 'orange',
  centerContent,
  actions,
}: AppHeaderProps) {
  const pathname = usePathname();
  const { currentUser } = useUser();
  const time = useClock();
  const weather = useWeather();
  const title = resolveTitle(pathname, titleMap, fallbackTitle);
  const accentClass = ACCENT_CLASSES[accent];
  const isRain = weather ? RAIN_CODES.has(weather.code) : false;

  useHeartbeat();
  const online = usePresence();
  const [showPresence, setShowPresence] = useState(false);
  const presenceRef = useRef<HTMLDivElement>(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (presenceRef.current && !presenceRef.current.contains(e.target as Node)) {
        setShowPresence(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!isRain || !weather) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const key = `weather-alert-${new Date().toISOString().slice(0, 10)}`;
    if (window.sessionStorage.getItem(key) === '1') return;
    window.sessionStorage.setItem(key, '1');
    new Notification('Atenção ao clima', {
      body: `${WEATHER_LABELS[weather.code] ?? 'Chuva'} em Florianópolis agora. Vale revisar deslocamentos e atividades externas.`,
    });
  }, [isRain, weather]);

  return (
    <header data-module={module} className="hidden lg:flex shrink-0 items-center gap-4 px-6 py-3 border-b border-white/[0.06] bg-[#0d0d0f]/88 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="min-w-0">
        <h1 className="text-base font-semibold text-zinc-100 truncate">{title}</h1>
        <Link
          href="/people-vision/colaboradores/me"
          className="mt-0.5 inline-flex max-w-[260px] items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
          title="Abrir configurações do usuário"
        >
          <UserCircle size={13} className={accentClass.split(' ')[0]} />
          <span className="truncate">{currentUser?.name ?? 'Usuário'}</span>
        </Link>
        {subtitle && <p className="text-xs text-zinc-500 truncate">{subtitle}</p>}
      </div>

      {centerContent && (
        <div className="flex flex-1 items-center justify-center">
          {centerContent}
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        {actions}

        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${isRain ? 'border-amber-400/30 bg-amber-500/10 text-amber-200' : 'border-white/[0.08] bg-white/[0.045] text-zinc-400'} shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl`}>
          <span className="font-mono text-zinc-200" suppressHydrationWarning>{time}</span>
          <span className="h-4 w-px bg-white/[0.08]" />
          {isRain ? <CloudRain size={14} className="text-amber-300" /> : <CloudSun size={14} className={weather ? 'text-amber-300' : 'text-zinc-600'} />}
          <span className="whitespace-nowrap">
            {weather ? `${weather.temp}°C · ${WEATHER_LABELS[weather.code] ?? 'Tempo'}` : 'Clima'}
          </span>
          {isRain && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-200">Atenção</span>}
        </div>

        {/* Indicador de presença */}
        <div ref={presenceRef} className="relative">
          <button
            onClick={() => setShowPresence(v => !v)}
            className="flex items-center gap-2 h-9 px-3 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            title="Usuários ativos agora"
          >
            <span className="relative flex h-2 w-2">
              {online.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${online.length > 0 ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
            </span>
            <span className="text-xs text-zinc-400">{online.length} ativo{online.length !== 1 ? 's' : ''}</span>
          </button>

          {showPresence && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-[#1E1E22] bg-[#121214] shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1C1C1E]">
                <p className="text-xs font-semibold text-zinc-300">Ativos agora</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">Últimos 5 minutos</p>
              </div>
              {online.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-6">Nenhum usuário ativo</p>
              ) : (
                <div className="p-2 space-y-1">
                  {online.map(u => (
                    <div key={u.userId} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.04]">
                      {u.avatarUrl ? (
                        <Image src={u.avatarUrl} alt={u.name} width={28} height={28} className="rounded-full object-cover border border-[#1E1E22] shrink-0" unoptimized />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-emerald-800/30 border border-emerald-700/20 flex items-center justify-center text-[10px] font-bold text-emerald-300 shrink-0">
                          {getInitials(u.name)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-100 font-medium truncate">{u.name}</p>
                        <p className="text-[10px] text-zinc-500 truncate">{u.role}</p>
                      </div>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <a
          href="/api/auth/logout"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-500 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          title="Sair"
        >
          <LogOut size={15} />
        </a>
      </div>
    </header>
  );
}
