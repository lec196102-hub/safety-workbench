import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, User, Shield, Loader2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import uiText from '@/data/ui-text.json';
import themeConfig from '@/data/theme.json';

export default function LoginPage() {
  const { login, isLoggedIn, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 已登录自动跳转
  useEffect(() => {
    if (isLoggedIn) {
      const from = (location.state as { from?: string } | null)?.from || '/';
      navigate(from, { replace: true });
    }
  }, [isLoggedIn, navigate, location.state]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      toast.error('请输入用户名和密码');
      return;
    }
    if (isLoading) {
      toast.info('系统加载中，请稍候...');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await login(trimmedUser, password);
      if (result.success) {
        toast.success(result.message);
        const from = (location.state as { from?: string } | null)?.from || '/';
        navigate(from, { replace: true });
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      toast.error(err.message || '登录失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-6"
      style={{
        background:
          `linear-gradient(135deg, ${themeConfig.colors.loginGradientStart} 0%, ${themeConfig.colors.loginGradientMid} 40%, ${themeConfig.colors.loginGradientEnd} 100%)`,
      }}
    >
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-20 -left-20 size-64 rounded-full opacity-30 blur-3xl sm:size-96 sm:-top-32 sm:-left-32"
          style={{ backgroundColor: themeConfig.colors.loginBlur1 }}
        />
        <div
          className="absolute -bottom-20 -right-20 size-64 rounded-full opacity-20 blur-3xl sm:size-[28rem] sm:-bottom-32 sm:-right-32"
          style={{ backgroundColor: themeConfig.colors.loginBlur2 }}
        />
      </div>

      <Card className="relative z-10 w-full max-w-sm overflow-hidden border-0 shadow-2xl sm:max-w-md">
        {/* 顶部紫色装饰条 */}
        <div
          className="h-2 w-full"
          style={{ backgroundColor: themeConfig.colors.primary }}
        />

        <CardContent className="p-6 sm:p-8">
          {/* Logo 区 */}
          <div className="mb-6 flex flex-col items-center sm:mb-8">
            <div
              className="mb-3 flex size-14 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-lg sm:size-16 sm:text-xl"
              style={{ backgroundColor: themeConfig.colors.primary }}
            >
              <Shield className="size-6 sm:size-8" />
            </div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">{uiText.loginPage.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {uiText.loginPage.subtitle}
            </p>
          </div>

          {/* 加载中提示 */}
          {isLoading && (
            <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-muted/50 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              系统加载中...
            </div>
          )}

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                用户名
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  className="h-11 pl-10 text-base"
                  autoComplete="username"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                密码
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="h-11 pl-10 text-base"
                  autoComplete="current-password"
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit(e);
                  }}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-11 w-full text-base"
              style={{ backgroundColor: themeConfig.colors.primary }}
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting || isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  登录中...
                </span>
              ) : (
                '登 录'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 全局 Toast 容器 */}
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
