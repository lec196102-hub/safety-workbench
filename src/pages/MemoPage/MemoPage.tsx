import { useState } from 'react';
import { Plus, Star, Trash2, Check, CheckCircle2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useMemos } from '@/hooks/use-memos';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import themeConfig from '@/data/theme.json';

export default function MemoPage() {
  const { memos, addMemo, deleteMemo, toggleImportant, toggleCompleted } =
    useMemos();
  const { isAdmin } = useAuth();
  const [newContent, setNewContent] = useState('');
  const [newImportant, setNewImportant] = useState(false);

  const handleAdd = async () => {
    if (!newContent.trim()) {
      toast.error('请输入备忘内容');
      return;
    }
    try {
      await addMemo(newContent.trim(), newImportant);
      setNewContent('');
      setNewImportant(false);
      toast.success('备忘已添加');
    } catch (err: any) {
      toast.error(err.message || '添加失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMemo(id);
      toast.success('已删除');
    } catch (err: any) {
      toast.error(err.message || '删除失败');
    }
  };

  // 按重要性 + 创建时间排序（重要置顶，完成置底）
  const sortedMemos = [...memos].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
    return b.createTime.localeCompare(a.createTime);
  });

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">备忘录</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          记录安全工作中的待办事项和重要提醒
        </p>
      </div>

      {/* 新增备忘（仅管理员） */}
      {isAdmin && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                placeholder="输入备忘内容，按回车添加..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                }}
                className="flex-1"
              />
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={newImportant}
                    onCheckedChange={(checked) =>
                      setNewImportant(checked === true)
                    }
                  />
                  <span className="text-muted-foreground">标记重要</span>
                </label>
                <Button
                  className="gap-2"
                  onClick={handleAdd}
                  style={{ backgroundColor: themeConfig.colors.primary }}
                >
                  <Plus className="size-4" />
                  添加
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 备忘列表 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedMemos.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-muted-foreground">
              {isAdmin ? '暂无备忘记录，添加一条吧' : '暂无备忘记录'}
            </CardContent>
          </Card>
        ) : (
          sortedMemos.map((memo) => (
            <Card
              key={memo.id}
              className={`relative transition-all hover:shadow-md ${
                memo.isCompleted ? 'opacity-60' : ''
              } ${
                memo.isImportant
                  ? 'border-l-4'
                  : ''
              }`}
              style={
                memo.isImportant
                  ? { borderLeftColor: themeConfig.colors.importantBorder, borderLeftWidth: '4px' }
                  : undefined
              }
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {isAdmin ? (
                    <Checkbox
                      checked={memo.isCompleted}
                      onCheckedChange={() => toggleCompleted(memo.id)}
                      className="mt-0.5 shrink-0"
                    />
                  ) : (
                    <div className="mt-0.5 shrink-0">
                      {memo.isCompleted ? (
                        <CheckCircle2 className="size-4 text-success" />
                      ) : (
                        <div className="size-4 rounded-sm border border-border" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm leading-relaxed ${
                        memo.isCompleted
                          ? 'text-muted-foreground line-through'
                          : 'text-foreground'
                      }`}
                    >
                      {memo.content}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {memo.createTime}
                      </span>
                      {isAdmin ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleImportant(memo.id)}
                            className="rounded-md p-1.5 transition-colors hover:bg-muted"
                            title={memo.isImportant ? '取消重要' : '标记重要'}
                          >
                            <Star
                              className="size-4"
                              fill={memo.isImportant ? themeConfig.colors.starActive : 'none'}
                              color={memo.isImportant ? themeConfig.colors.starActive : themeConfig.colors.starInactive}
                            />
                          </button>
                          <button
                            onClick={() => handleDelete(memo.id)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title="删除"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Eye className="size-3" />
                          只读
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 统计 */}
      <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-success" />
          <span>
            已完成 {memos.filter((m) => m.isCompleted).length} 项
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Star className="size-4" fill={themeConfig.colors.starActive} color={themeConfig.colors.starActive} />
          <span>
            重要 {memos.filter((m) => m.isImportant && !m.isCompleted).length} 项
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Check className="size-4" />
          <span>
            共 {memos.length} 条备忘
          </span>
        </div>
      </div>
    </div>
  );
}
