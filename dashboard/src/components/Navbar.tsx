'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, LayoutDashboard, FlaskConical, BookOpen, Home } from 'lucide-react';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/tests', label: 'API Tests', icon: FlaskConical },
    { href: '/docs', label: 'SDK Docs', icon: BookOpen },
];

export default function Navbar() {
    const pathname = usePathname();

    return (
        <motion.nav
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="glass sticky top-4 z-50 mx-auto max-w-[1400px] px-4 py-3 flex items-center justify-between mb-8"
            style={{ borderRadius: '16px' }}
        >
            <Link href="/" className="flex items-center gap-3 group">
                <div className="p-2 rounded-lg" style={{ background: 'var(--accent-teal-dim)' }}>
                    <Shield size={20} style={{ color: 'var(--accent-teal)' }} />
                </div>
                <div>
                    <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        ZTNA Firewall
                    </span>
                    <span className="text-[10px] ml-2 font-mono" style={{ color: 'var(--text-muted)' }}>
                        PS001
                    </span>
                </div>
            </Link>

            <div className="flex items-center gap-1">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/' && pathname.startsWith(item.href));
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-link flex items-center gap-2 text-sm ${isActive ? 'active' : ''}`}
                        >
                            <Icon size={15} />
                            <span className="hidden sm:inline">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </motion.nav>
    );
}
