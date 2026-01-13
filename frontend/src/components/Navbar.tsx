'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, LogOut, LayoutDashboard, Settings, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-black/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-blue-600 flex items-center justify-center">
              <Image 
                src="/logo.png" 
                alt="Susalabs Logo" 
                width={32} 
                height={32}
                className="object-cover"
              />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              Susalabs <span className="text-blue-600">Security</span>
            </span>
          </Link>
          <div className="flex items-center space-x-6">
            <Link href="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white flex items-center space-x-1 transition-colors">
              <LayoutDashboard size={18} />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <Link href="/setup" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white flex items-center space-x-1 transition-colors">
              <Settings size={18} />
              <span className="hidden sm:inline">Settings</span>
            </Link>
            
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
              aria-label="Toggle Theme"
            >
              {mounted && theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button 
              onClick={handleLogout}
              className="bg-red-600/10 text-red-600 dark:bg-red-900/20 dark:text-red-500 px-4 py-2 rounded-lg flex items-center space-x-1 hover:bg-red-600 hover:text-white dark:hover:bg-opacity-30 transition-all border border-red-600/20"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
