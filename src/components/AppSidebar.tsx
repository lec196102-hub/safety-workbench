import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  BarChart3,
  StickyNote,
  FolderOpen,
  Settings,
  LogOut,
  User,
  ChevronDown,
  X,
  Search,
  ClipboardCheck,
} from 'lucide-react';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import navConfig from '@/data/navigation.json';
import themeConfig from '@/data/theme.json';

// 图标映射表（JSON 只存图标名，这里映射到实际组件）
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ClipboardList,
  BarChart3,
  StickyNote,
  FolderOpen,
  Settings,
  ClipboardCheck,
};

const NAV_ITEMS = navConfig.navItems.map((item) => ({
  ...item,
  icon: ICON_MAP[item.icon],
}));

interface AppSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function AppSidebar({ open, onClose }: AppSidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, isAdmin, logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const isMobile = useIsMobile();
  const isSummary = pathname === '/summary';
  // 在汇总页时，搜索框以 URL 为唯一数据源，与页面内搜索框实时同步；非汇总页用本地态暂存
  const sidebarSearchValue = isSummary ? (searchParams.get('search') || '') : globalSearch;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (isSummary) {
      const params = new URLSearchParams(searchParams);
      if (v.trim()) params.set('search', v);
      else params.delete('search');
      setSearchParams(params, { replace: true });
    } else {
      setGlobalSearch(v);
    }
  };

  const handleGlobalSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const kw = (isSummary ? (searchParams.get('search') || '') : globalSearch).trim();
      if (kw) {
        if (!isSummary) {
          navigate(`/summary?search=${encodeURIComponent(kw)}`);
          setGlobalSearch('');
        }
        // 在汇总页时 URL 已随输入实时更新，无需额外跳转
        onClose?.();
      }
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('已退出登录');
    onClose?.();
    navigate('/login', { replace: true });
  };

  const handleNavClick = () => {
    if (isMobile) {
      onClose?.();
    }
  };

  const sidebarContent = (
    <>
      {/* 移动端关闭按钮 */}
      {isMobile && (
        <div className="flex justify-end px-4 pt-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 hover:text-white"
            onClick={onClose}
            aria-label="关闭菜单"
          >
            <X className="size-5" />
          </Button>
        </div>
      )}

      {/* Logo 区 */}
      <div className="flex flex-col items-center gap-2 px-6 py-6">
        <div
          className="flex size-12 items-center justify-center rounded-xl text-base font-bold text-white shadow-lg md:size-14 md:text-lg"
          style={{ backgroundColor: themeConfig.colors.primaryDark }}
        >
          {navConfig.brand.department}
        </div>
        <div className="text-center">
          <div className="text-base font-bold text-white md:text-lg">{navConfig.brand.title}</div>
          <div className="text-xs" style={{ color: themeConfig.colors.primarySubtitle }}>
            {navConfig.brand.subtitle}
          </div>
        </div>
      </div>

      {/* 分隔线 */}
      <div className="mx-6 h-px bg-white/20" />

      {/* 全局搜索 */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-white/50" />
          <Input
            placeholder="全局搜索隐患..."
            value={sidebarSearchValue}
            onChange={handleSearchChange}
            onKeyDown={handleGlobalSearch}
            className="pl-9 h-9 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/15 focus:border-white/30"
          />
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 md:space-y-2 md:px-4 md:py-6">
        {NAV_ITEMS.filter((item) => isAdmin || item.path !== '/files').map((item) => {
          const Icon = item.icon;
          const isActive = item.end
            ? pathname === item.path
            : pathname === item.path || pathname.startsWith(`${item.path}/`);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={handleNavClick}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 md:px-4 md:py-3"
              style={{
                backgroundColor: isActive ? themeConfig.colors.primaryLighter : 'transparent',
                color: '#ffffff',
              }}
            >
              <span
                className="flex size-8 items-center justify-center rounded-lg shrink-0 md:size-9"
                style={{ backgroundColor: isActive ? '#ffffff30' : themeConfig.colors.primaryLight }}
              >
                <Icon className="size-4 text-white md:size-5" />
              </span>
              <span className="text-white">{item.label}</span>
            </NavLink>
          );
        })}

        {/* 账号管理（仅管理员可见） */}
        {isAdmin && (
          <NavLink
            to="/settings"
            onClick={handleNavClick}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 md:px-4 md:py-3"
            style={{
              backgroundColor: pathname === '/settings' ? themeConfig.colors.primaryLighter : 'transparent',
              color: '#ffffff',
            }}
          >
            <span
              className="flex size-8 items-center justify-center rounded-lg shrink-0 md:size-9"
              style={{
                backgroundColor: pathname === '/settings' ? '#ffffff30' : themeConfig.colors.primaryLight,
              }}
            >
              <Settings className="size-4 text-white md:size-5" />
            </span>
            <span className="text-white">账号管理</span>
          </NavLink>
        )}
      </nav>

      {/* 底部：用户信息 + 退出 */}
      <div className="px-3 pb-4 md:px-4">
        <div className="rounded-xl bg-white/15 p-3">
          <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between px-2 text-white hover:bg-white/20 hover:text-white h-11"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/30 text-sm font-bold text-white"
                  >
                    {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-sm font-medium truncate max-w-[100px]">
                      {currentUser?.username || '未登录'}
                    </span>
                    <span className="text-xs text-white/70">
                      {isAdmin ? '管理员' : '子账号'}
                    </span>
                  </div>
                </div>
                <ChevronDown className="size-4 shrink-0 text-white/70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>
                <div className="flex items-center gap-2">
                  <User className="size-4" />
                  {currentUser?.username}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isAdmin && (
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => {
                    navigate('/settings');
                    setSettingsOpen(false);
                    onClose?.();
                  }}
                >
                  <Settings className="size-4" />
                  账号管理
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="size-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );

  // 移动端：抽屉式侧边栏
  if (isMobile) {
    return (
      <>
        {/* 遮罩层 */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
        )}
        {/* 抽屉 */}
        <aside
          className={`fixed left-0 top-0 z-50 flex h-screen w-72 flex-col transform transition-transform duration-300 ease-in-out ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ backgroundColor: themeConfig.colors.primary }}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  // 桌面端：固定侧边栏
  return (
    <aside
      className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col md:flex"
      style={{ backgroundColor: themeConfig.colors.primary }}
    >
      {sidebarContent}
    </aside>
  );
}
