import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Users,
  Plus,
  Trash2,
  KeyRound,
  Shield,
  UserPlus,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import themeConfig from '@/data/theme.json';
import appConfig from '@/data/app-config.json';
import uiText from '@/data/ui-text.json';

export default function AccountSettingsPage() {
  const {
    currentUser,
    isAdmin,
    isLoading,
    subUsers,
    createUser,
    deleteUser,
    resetUserPassword,
    changePassword,
  } = useAuth();

  // 创建子账号
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  // 重置密码
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetUsername, setResetUsername] = useState('');
  const [resetNewPwd, setResetNewPwd] = useState('');
  const [resetNewPwdConfirm, setResetNewPwdConfirm] = useState('');

  // 删除确认
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState('');
  const [deleteUsername, setDeleteUsername] = useState('');

  // 修改密码
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwdConfirm, setNewPwdConfirm] = useState('');

  // 管理员权限守卫（必须在所有 hooks 之后）
  if (!isLoading && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleCreate = async () => {
    if (!newUsername.trim()) {
      toast.error('请输入用户名');
      return;
    }
    if (newPassword.length < appConfig.auth.minPasswordLength) {
      toast.error('密码至少 6 位');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error('两次输入的密码不一致');
      return;
    }
    const result = await createUser(newUsername.trim(), newPassword);
    if (result.success) {
      toast.success(result.message);
      setCreateOpen(false);
      setNewUsername('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } else {
      toast.error(result.message);
    }
  };

  const handleReset = async () => {
    if (resetNewPwd.length < appConfig.auth.minPasswordLength) {
      toast.error('新密码至少 6 位');
      return;
    }
    if (resetNewPwd !== resetNewPwdConfirm) {
      toast.error('两次输入的密码不一致');
      return;
    }
    const result = await resetUserPassword(resetUserId, resetNewPwd);
    if (result.success) {
      toast.success(result.message);
      setResetOpen(false);
      setResetUserId('');
      setResetUsername('');
      setResetNewPwd('');
      setResetNewPwdConfirm('');
    } else {
      toast.error(result.message);
    }
  };

  const handleDelete = async () => {
    const result = await deleteUser(deleteUserId);
    if (result.success) {
      toast.success(result.message);
      setDeleteOpen(false);
      setDeleteUserId('');
      setDeleteUsername('');
    } else {
      toast.error(result.message);
    }
  };

  const handleChangePwd = async () => {
    if (!oldPwd || !newPwd) {
      toast.error('请填写完整信息');
      return;
    }
    if (newPwd.length < appConfig.auth.minPasswordLength) {
      toast.error('新密码至少 6 位');
      return;
    }
    if (newPwd !== newPwdConfirm) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    const result = await changePassword(oldPwd, newPwd);
    if (result.success) {
      toast.success(result.message);
      setOldPwd('');
      setNewPwd('');
      setNewPwdConfirm('');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">账号管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理系统用户账号与权限设置
        </p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="size-4" />
            子账号管理
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-2">
            <KeyRound className="size-4" />
            修改密码
          </TabsTrigger>
        </TabsList>

        {/* 子账号管理 */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="size-5" style={{ color: themeConfig.colors.primary }} />
                子账号列表
              </CardTitle>
              <Button
                style={{ backgroundColor: themeConfig.colors.primary }}
                className="gap-2"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4" />
                新增子账号
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">
                        用户名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">
                        角色
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">
                        创建时间
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 管理员行 */}
                    <tr className="border-b border-border/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: themeConfig.colors.primary }}
                          >
                            A
                          </div>
                          <span className="font-medium">{currentUser?.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant="secondary"
                          className="gap-1"
                          style={{
                            backgroundColor: themeConfig.colors.adminBadgeBg,
                            color: themeConfig.colors.adminBadgeText,
                          }}
                        >
                          <Shield className="size-3" />
                          {uiText.userRoles.admin}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {currentUser?.createdAt
                          ? new Date(currentUser.createdAt).toLocaleDateString('zh-CN')
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-muted-foreground">
                        系统默认
                      </td>
                    </tr>
                    {/* 子账号列表 */}
                    {subUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-6 py-12 text-center text-sm text-muted-foreground"
                        >
                          暂无子账号，点击右上角按钮创建
                        </td>
                      </tr>
                    ) : (
                      subUsers.map((user) => (
                        <tr key={user.id} className="border-b border-border/50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium">{user.username}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className="gap-1">
                              <UserPlus className="size-3" />
                              {uiText.userRoles.user}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-xs"
                                onClick={() => {
                                  setResetUserId(user.id);
                                  setResetUsername(user.username);
                                  setResetOpen(true);
                                }}
                              >
                                <RotateCcw className="size-3.5" />
                                重置密码
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-xs text-destructive"
                                onClick={() => {
                                  setDeleteUserId(user.id);
                                  setDeleteUsername(user.username);
                                  setDeleteOpen(true);
                                }}
                              >
                                <Trash2 className="size-3.5" />
                                删除
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 修改密码 */}
        <TabsContent value="password" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound className="size-5" style={{ color: themeConfig.colors.primary }} />
                修改密码
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label>原密码</Label>
                  <Input
                    type="password"
                    value={oldPwd}
                    onChange={(e) => setOldPwd(e.target.value)}
                    placeholder="请输入原密码"
                  />
                </div>
                <div className="space-y-2">
                  <Label>新密码</Label>
                  <Input
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="请输入新密码（至少 6 位）"
                  />
                </div>
                <div className="space-y-2">
                  <Label>确认新密码</Label>
                  <Input
                    type="password"
                    value={newPwdConfirm}
                    onChange={(e) => setNewPwdConfirm(e.target.value)}
                    placeholder="请再次输入新密码"
                  />
                </div>
                <Button
                  style={{ backgroundColor: themeConfig.colors.primary }}
                  onClick={handleChangePwd}
                  className="mt-2"
                >
                  确认修改
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 新增子账号弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增子账号</DialogTitle>
            <DialogDescription>创建一个新的只读子账号</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="请输入用户名"
              />
            </div>
            <div className="space-y-2">
              <Label>初始密码</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="请输入初始密码（至少 6 位）"
              />
            </div>
            <div className="space-y-2">
              <Label>确认密码</Label>
              <Input
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                placeholder="请再次输入密码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button style={{ backgroundColor: themeConfig.colors.primary }} onClick={handleCreate}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码弹窗 */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>
              为子账号「{resetUsername}」设置新密码
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>新密码</Label>
              <Input
                type="password"
                value={resetNewPwd}
                onChange={(e) => setResetNewPwd(e.target.value)}
                placeholder="请输入新密码（至少 6 位）"
              />
            </div>
            <div className="space-y-2">
              <Label>确认新密码</Label>
              <Input
                type="password"
                value={resetNewPwdConfirm}
                onChange={(e) => setResetNewPwdConfirm(e.target.value)}
                placeholder="请再次输入新密码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              取消
            </Button>
            <Button style={{ backgroundColor: themeConfig.colors.primary }} onClick={handleReset}>
              确认重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除子账号「{deleteUsername}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteOpen(false)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
