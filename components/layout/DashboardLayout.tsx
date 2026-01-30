'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { Menu, Bell, User, LogOut, Building2 } from 'lucide-react';
import { authUtils } from '@/lib/auth';
import type { User as UserType, Workspace } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    // Check authentication
    const currentUser = authUtils.getUser();
    const currentWorkspace = authUtils.getWorkspace();

    if (!currentUser) {
      router.push('/login');
      return;
    }

    setUser(currentUser);
    setWorkspace(currentWorkspace);
  }, [router]);

  const handleLogout = () => {
    authUtils.clearUser();
    router.push('/login');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-neutral-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-neutral-200 flex-shrink-0 z-30">
          <div className="flex items-center justify-between px-4 py-3">
            {/* Left: Menu Button + Page Title */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <Menu className="w-5 h-5 text-neutral-700" />
              </button>
              <div className="hidden md:block">
                <h2 className="text-lg font-semibold text-neutral-800">
                  {pathname === '/dashboard' && 'Dashboard'}
                  {pathname === '/configurations' && 'Configurations'}
                  {pathname === '/campaigns' && 'Campaigns'}
                  {pathname === '/messages' && 'Messages'}
                  {pathname === '/analytics' && 'Analytics'}
                  {pathname === '/templates' && 'Templates'}
                </h2>
                {workspace && (
                  <div className="flex items-center gap-1 text-xs text-neutral-500">
                    <Building2 className="w-3 h-3" />
                    <span>{workspace.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Notifications + User */}
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <button className="relative p-2 hover:bg-neutral-100 rounded-lg transition-colors">
                <Bell className="w-5 h-5 text-neutral-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-neutral-800">
                      {user.name}
                    </p>
                    <p className="text-xs text-neutral-500">{user.email}</p>
                  </div>
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {showUserMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowUserMenu(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute right-0 mt-2 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 overflow-hidden"
                      >
                        <div className="p-3 border-b border-neutral-200">
                          <p className="text-sm font-medium text-neutral-800">
                            {user.name}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {user.email}
                          </p>
                        </div>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Logout</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
