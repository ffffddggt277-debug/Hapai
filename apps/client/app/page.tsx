'use client';
import dynamic from 'next/dynamic';
const Game = dynamic(() => import('./Game'), { ssr: false, loading: () => <div className="boot"><b>ХАПАЙ!</b><span>Открываем музей…</span></div> });
export default function Page() { return <Game />; }
