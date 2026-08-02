import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppSidebar from './AppSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import themeConfig from '@/data/theme.json';
import navConfig from '@/data/navigation.json';

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col min-w-0">
        {/* 移动端顶部栏 */}
        {isMobile && (
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/50 bg-background/90 px-4 backdrop-blur-md">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              aria-label="打开菜单"
              className="shrink-0"
            >
              <Menu className="size-5" />
            </Button>
            <div
              className="flex size-8 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: themeConfig.colors.primary }}
            >
              {navConfig.brand.department.charAt(0)}
            </div>
            <span className="font-semibold text-foreground">{navConfig.brand.title}</span>
          </header>
        )}

        <main
          className={`flex-1 min-w-0 overflow-x-hidden ${
            isMobile ? 'p-4' : 'ml-64 p-6 lg:p-8'
          }`}
        >
          <Outlet />
        </main>
      </div>

      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
