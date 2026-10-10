import type { Metadata, Viewport } from 'next';
import { Russo_One, Manrope } from 'next/font/google';
import './style.css';
const display = Russo_One({ weight: '400', subsets: ['latin', 'cyrillic'], variable: '--font-display' });
const body = Manrope({ weight: ['500', '700', '800'], subsets: ['latin', 'cyrillic'], variable: '--font-body' });
export const metadata: Metadata = { title: 'ХАПАЙ! — ночное ограбление музея', description: 'Мультиплеерное 3D-ограбление: взламывай витрины, прячься от дронов, выноси добычу раньше друзей.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, themeColor: '#070a14', viewportFit: 'cover' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="ru" className={`${display.variable} ${body.variable}`}><body>{children}</body></html>; }
