# 安全生产工作台 - 需求拆解文档

## 产品概述

- **产品类型**: 企业安全管理工作台（中后台应用）
- **场景类型**: <scene_type>prototype-app</scene_type>
- **目标用户**: 企业安全管理人员、安全部门员工
- **核心价值**: 汇总每日安全隐患，跟踪整改进度，提供数据统计与备忘管理的一站式工作台
- **界面语言**: 中文
- **主题偏好**: user_specified（紫色主题，主色 #b791f，淡紫 #c8a9fc，激活态 #dcc9fd）
- **导航模式**: 路径导航
- **导航布局**: Sidebar（左侧固定侧边导航栏）

---

## 页面结构总览

| 页面名称 | 文件名 | 路由 | 页面类型 | 入口来源 |
|---------|-------|------|---------|---------|
| 每日安全隐患 | `DailyHazardsPage.tsx` | `/` | 一级 | 导航（默认激活） |
| 隐患汇总 | `HazardSummaryPage.tsx` | `/summary` | 一级 | 导航 |
| 备忘录 | `MemoPage.tsx` | `/memo` | 一级 | 导航 |

> **页面类型说明**：
> - **一级页面**：出现在导航中，用户可直接访问
> - 三个页面均为一级页面，对应左侧导航的三个菜单项，均围绕安全管理核心任务

---

## 页面布局建议

- **布局模式**: 经典 Sidebar + 主内容区 左右分栏 —— 中后台工作台标准布局，左侧导航固定，右侧内容区滚动
- **视觉重心**: 内容区 —— 以表格和数据卡片为核心，操作区置顶
- **结果承载区**:
  - 每日安全隐患页：隐患表格 + 统计卡片行 + 图表区；初始态直接展示模拟数据（10-15 条隐患记录）
  - 隐患汇总页：汇总统计卡片 + 筛选区 + 汇总表格；初始态展示全量数据
  - 备忘录页：便签列表 + 新增入口；初始态展示 3-5 条示例备忘

---

## 导航配置

- **导航布局**: Sidebar（左侧固定）
- **导航项**（仅一级页面）:

| 导航文字 | 路由 | 图标 | 默认状态 |
|---------|------|------|---------|
| 每日安全隐患 | `/` | 📋 | 激活（选中） |
| 隐患汇总 | `/summary` | 📊 | 未激活 |
| 备忘录 | `/memo` | 📝 | 未激活 |

- **Sidebar 顶部**: Logo 区**安全部**（紫色背景 + 白色文字）+ 主标题「安全生产工作台」+ 副标题「Personal Workbench」
- **样式规范**:
  - 图标容器：紫色背景 #c8a9fc
  - 菜单文字：纯白色
  - 激活项：淡紫色背景 #dcc9fd + 白字高亮

---

## 数据来源声明

| 数据/操作 | 来源类型 | 实现要求 | mock 兜底 |
|---|---|---|---|
| 隐患记录数据 | demo-mock | `src/data/hazards.ts` 中定义 10-15 条模拟隐患数据，含 id/日期/位置/问题描述/责任人/验收时间/整改状态字段 | ✅ 本身就是 mock |
| 隐患整改状态变更 | local-persist | localStorage key=`__app_safety_hazards`，存储隐患列表及整改状态，页面初始化时从 localStorage 读取，无数据则加载 mock 初始数据 | mock 初始数据作为首次加载默认值 |
| 备忘录数据 | local-persist | localStorage key=`__app_safety_memos`，存储备忘事项列表，支持增删改及状态标记 | 初始 3-5 条示例备忘 |
| 日期选择器当前日期 | demo-mock | 使用 `new Date()` 获取当前日期，作为日期选择器默认值 | ✅ 系统日期 |
| 月进度统计与图表数据 | demo-mock | 基于隐患记录数据前端计算（总数/已整改数/完成率/近7天趋势），程序化统计 | ✅ 由 mock 数据派生 |

---

## 功能列表

### 页面：每日安全隐患（`/`）

- **页面目标**: 查看和管理当日安全隐患，查看月度整改进度与趋势
- **功能点**:
  - **日期选择与筛选**: 顶部日期选择器，默认当前日期，切换日期后表格展示对应日期的隐患记录
  - **新增隐患**:
    - 触发: 顶部「新增隐患」按钮
    - 交互: 弹出 Dialog 表单（日期/位置/问题描述/责任人/验收时间）
    - 提交: 新增记录写入 localStorage 隐患列表，表格即时刷新
    - 反馈: toast.success('隐患已添加') + 关闭 Dialog
    - 数据契约: IHazard 含 id/date/location/description/responsible/acceptTime/isFixed
  - **同步到手机云端**: 点击按钮触发 toast 提示「同步成功」（演示功能，实际为 mock 操作反馈）
  - **隐患表格展示与操作**: 展示序号/日期/位置/问题描述/责任人/验收时间/是否完成整改；支持列排序（点击表头排序）；「是否完成整改」为复选框，勾选/取消勾选即时更新状态并同步到隐患汇总页
  - **月度统计卡片**: 本月隐患总数、已整改数量、整改完成率（进度条或环形图展示）
  - **近7天趋势折线图**: 展示近7天每日隐患数量变化趋势

### 页面：隐患汇总（`/summary`）

- **页面目标**: 全量隐患数据汇总查看与多维度筛选
- **功能点**:
  - **汇总统计卡片**: 总隐患数、已整改数、未整改数、整改率，基于全量数据实时计算
  - **日期范围筛选**: 支持按日期范围筛选隐患记录
  - **整改状态筛选**: 支持按「全部/已整改/未整改」筛选
  - **汇总表格**: 展示所有隐患完整信息（序号/日期/位置/问题描述/责任人/验收时间/整改状态），支持列排序
  - **整改状态联动**: 表格中整改状态与「每日安全隐患」页复选框双向联动，任一页修改状态另一页同步更新（基于共享 localStorage 数据）

### 页面：备忘录（`/memo`）

- **页面目标**: 管理安全工作相关的备忘事项
- **功能点**:
  - **新增备忘**:
    - 触发: 顶部「新增备忘」按钮或输入框
    - 交互: 输入备忘内容 + 可选标记重要
    - 提交: 写入 localStorage 备忘列表
    - 反馈: 即时展示在列表中
    - 数据契约: IMemo 含 id/content/isImportant/isCompleted/createTime
  - **删除备忘**: 每条备忘右侧删除按钮，点击确认后移除
  - **标记重要/取消重要**: 点击星标图标切换重要状态，重要备忘置顶或高亮显示
  - **标记已完成/取消完成**: 点击复选框切换完成状态，已完成备忘置灰或划线显示

---

## 数据共享配置

| 存储键名 | 数据说明 | 使用页面 |
|---------|---------|---------|
| `__app_safety_hazards` | 隐患记录列表，类型为 `IHazard[]` | 每日安全隐患页、隐患汇总页 |
| `__app_safety_memos` | 备忘事项列表，类型为 `IMemo[]` | 备忘录页 |

```ts
interface IHazard {
  /** 唯一标识 */
  id: string;
  /** 隐患日期 YYYY-MM-DD */
  date: string;
  /** 隐患位置 */
  location: string;
  /** 问题描述 */
  description: string;
  /** 责任人 */
  responsible: string;
  /** 验收时间 YYYY-MM-DD */
  acceptTime: string;
  /** 是否完成整改 */
  isFixed: boolean;
}

interface IMemo {
  /** 唯一标识 */
  id: string;
  /** 备忘内容 */
  content: string;
  /** 是否重要 */
  isImportant: boolean;
  /** 是否已完成 */
  isCompleted: boolean;
  /** 创建时间 */
  createTime: string;
}

-------

<scene_type>prototype-app</scene_type>

# UI 设计指南

## 1. 设计推导依据

- **参考意图**: Free —— 无参考图，按需求文本从零构建紫色主题安全生产工作台
- **核心情绪 / 应用类型**: 企业安全管理工具，专业、清晰、可信赖，紫色主题传递管控与秩序感
- **独特记忆点**: 左侧深紫导航 + 图标容器统一淡紫底 + 激活态淡紫高亮，形成"安全部"品牌识别的三色紫阶系统

## 2. Art Direction

- **方向名**: 紫阶安全工作台
- **Design Style**: Flat Design 扁平清晰 + Swiss Minimalist 瑞士极简 —— 数据密集的安全管理工具需要高可读、低干扰、信息层级分明
- **DNA 参数**: 圆角 subtle (rounded-md) / 阴影 subtle (shadow-sm) / 间距 standard (gap-4 / p-6) / 字体方向 中性无衬线 / 装饰手法 三色紫阶渐变导航 + 图标容器色块
- **应用类型**: Tool / Workflow —— 左侧固定导航 + 右侧内容区，数据表格与统计卡片为核心

## 3. Color System

**色彩关系**: 深紫主色 + 淡紫辅助 + 更淡紫激活态，构成三阶紫色系统；纯白背景 + 深灰文字保证可读性
**配色设计理由**: primary 承担品牌识别与主行动；accent 用于导航图标容器与 hover 态；激活态用更浅紫底突出当前项；整体紫色系呼应"安全管控"的专业与严谨
**主色推导**: 从用户指定的 #b791f（修正为有效十六进制 #b791ff，即 hsl(258 100% 78%)）出发，向深偏移得到主色深紫，向浅偏移得到 accent 与激活态，形成统一紫阶
**使用比例**: 65% 中性（白/灰） / 25% 紫色辅助（导航、图标容器、状态底） / 10% primary（CTA、品牌、关键状态）

| 角色 | CSS 变量 | Tailwind Class | HSL 值 | 设计说明 |
|---|---|---|---|---|
| bg | `--background` | `bg-background` | hsl(250 30% 98%) | 页面背景，极淡紫调白 |
| card | `--card` | `bg-card` | hsl(0 0% 100%) | 卡片、表格、表单承载面 |
| text | `--foreground` | `text-foreground` | hsl(258 25% 18%) | 标题和正文，深紫灰 |
| textMuted | `--muted-foreground` | `text-muted-foreground` | hsl(258 10% 45%) | 辅助文字、说明、元信息 |
| primary | `--primary` | `bg-primary` / `text-primary` | hsl(258 85% 68%) | 主交互、CTA、品牌主色（#b791ff 调整） |
| primaryForeground | `--primary-foreground` | `text-primary-foreground` | hsl(0 0% 100%) | primary 上的白色文字 |
| accent | `--accent` | `bg-accent` | hsl(258 90% 82%) | 导航图标容器、hover 底（#c8a9fc 对应） |
| accentForeground | `--accent-foreground` | `text-accent-foreground` | hsl(258 40% 25%) | accent 上的深紫文字图标 |
| border | `--border` | `border-border` | hsl(258 15% 90%) | 卡片、表格、输入框边界 |

**语义色提示**:
- 成功（已整改）: bg hsl(142 55% 94%) / border hsl(142 45% 78%) / text hsl(142 50% 32%) —— 低饱和绿，与紫色系柔和搭配，饱和度对齐 primary ±10%
- 警告（未整改/重要）: bg hsl(32 90% 95%) / border hsl(32 80% 80%) / text hsl(32 70% 38%) —— 琥珀色，饱和度与 primary 对齐
- 错误（高风险）: bg hsl(0 75% 96%) / border hsl(0 65% 82%) / text hsl(0 60% 40%) —— 低饱和红，避免报警感过强

## 4. 字体与节奏

- **font-display**: Noto Sans SC —— 中文安全管理场景，清晰稳重，标题与正文统一字体家族减少视觉噪音
- **font-body**: Noto Sans SC —— 数据表格与长文本需高可读性，无衬线中性字体适配企业工具
- **字号**: H1 text-2xl ~ text-3xl（页面标题）；H2 text-lg ~ text-xl（卡片标题）；body text-sm ~ text-base；muted text-xs ~ text-sm
- **圆角**: 小到中（rounded-md）—— 工具型产品保持专业克制，卡片与按钮统一 6-8px 圆角

## 5. 全局布局契约

- **Reference Layout Use**: 按需求结构推导，左侧固定侧边栏 + 右侧内容区经典工作台布局
- **Page / Section Order**: 三个页面（每日安全隐患 / 隐患汇总 / 备忘录）通过左侧导航切换，与需求 1:1 对齐
- **Standard Content Zone**: 后台 `max-w-[1400px]` + `mx-auto`，内容区 padding 适配侧边栏偏移
- **Shell / Frame Alignment**: 左侧固定侧边栏（宽 240px），右侧内容区独立滚动，内容容器与侧边栏右边缘对齐
- **Padding & Rhythm**: 内容区 `px-6 py-6`，卡片间距 `gap-4`，表格与统计卡片区域 `gap-6`，保持 4px 倍数节奏
- **Full-bleed Zones**: 无全宽区域，所有内容受 Standard Content Zone 约束
- **Local Narrowing**: 备忘录页面可收窄为 `max-w-3xl` 居中，提升便签阅读体验
- **Overflow Strategy**: 隐患表格列较多，使用 `overflow-x-auto`；筛选操作行横向排列不下时换行
- **Flexibility Boundary**: 允许移动端隐藏侧边栏为抽屉、卡片堆叠排列；不允许改变紫色主题、圆角系统和字体家族

## 6. 视觉与动效

- **装饰**: 紫阶色块图标容器 + 细微渐变导航背景
- **阴影/边界**: 轻 —— 卡片 `shadow-sm`，表格用边框分隔，避免重阴影
- **动效**: 克制 —— hover 状态 150ms 背景色过渡，复选框勾选有轻微缩放反馈，页面切换无动画

## 7. 组件原则

- 按钮：主按钮用 primary 实底白字；次按钮用 outline 紫边紫字；幽灵按钮用 accent 底 + 深紫字
- 表格：表头浅紫灰底，行分隔用 border，hover 行用 accent 极浅底
- 复选框：勾选态用 primary 紫底白勾，未勾选用灰边白底
- 统计卡片：白底 + 顶部细紫边 + 大字数据 + 小字标签，数字用 primary 色突出
- 导航菜单项：默认深紫底白字；激活态淡紫底（#dcc9fd 对应 hsl(258 90% 88%)）+ 白字 + 左侧 3px primary 竖条
- 所有交互元素必须有 `:focus-visible` 环（primary 色 2px outline）

## 8. Image Direction

- **Image Role**: 无强制图片需求，优先通过紫阶色块、图标容器和排版建立视觉记忆点
- **Image Art Direction**: 无强制图片需求
- **Image Prompt Keywords**: 无
- **Image Avoidance**: 避免通用商务握手素材、安全帽人物图库照、无意义紫色渐变背景图

## 9. Anti-patterns

- **Purple everywhere**: 主按钮、tab、icon、边框、链接、图表全用紫色；按 65-25-10 分配，primary 只给 CTA 与品牌锚点
- **Low contrast nav**: 淡紫底配浅字导致导航不可读；菜单文字必须纯白，激活态背景足够浅以保证白字对比
- **Table chaos**: 表格列过多挤压文字；宽表格用 overflow-x-auto，重要列固定宽度
- **Status color clash**: 成功/警告色饱和度过高压过主色；语义色饱和度与 primary 对齐 ±15%
- **Invisible checkbox state**: 仅靠颜色区分勾选状态；复选框需有明确勾选标记 + 颜色双编码
- **Default SaaS drift**: 回到默认蓝紫渐变和通用卡片堆叠；用三阶紫阶系统（深紫导航 / 淡紫图标容器 / 更淡紫激活态）塑造安全部品牌识别