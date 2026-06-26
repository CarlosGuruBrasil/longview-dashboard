'use client';

import { useEffect, useMemo, useState } from 'react';
import { CloudRain, CloudSun } from 'lucide-react';

const WEATHER_LABELS: Record<number, string> = {
  0: 'Céu limpo',
  1: 'Poucas nuvens',
  2: 'Parcial',
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

export default function SelectAppHeaderStatus() {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

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

  const time = useMemo(() => {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(now);
  }, [now]);

  const isRain = weather ? RAIN_CODES.has(weather.code) : false;

  return (
    <div className={`hidden md:flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${isRain ? 'border-amber-400/30 bg-amber-500/10 text-amber-200' : 'border-white/[0.08] bg-white/[0.055] text-zinc-400'} shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl`}>
      <span className="font-mono text-zinc-200">{time}</span>
      <span className="h-4 w-px bg-white/[0.08]" />
      {isRain ? <CloudRain size={14} className="text-amber-300" /> : <CloudSun size={14} className={weather ? 'text-amber-300' : 'text-zinc-600'} />}
      <span>{weather ? `${weather.temp}°C · ${WEATHER_LABELS[weather.code] ?? 'Tempo'}` : 'Clima'}</span>
      {isRain && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase">Atenção</span>}
    </div>
  );
}
