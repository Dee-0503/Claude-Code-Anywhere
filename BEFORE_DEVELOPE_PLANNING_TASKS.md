# Claude Code Anywhere — 研发前阶段任务计划

> 源文档：`PRODUCT_SPEC.md` + `DETAILED_REQUIREMENTS.md` + `CLARIFICATIONS.md`
> 创建日期：2026-02-13
> 最后更新：2026-02-14

---

## 阶段总览

| #   | 阶段                    | 交付物                                                   | 状态      |
| --- | ----------------------- | -------------------------------------------------------- | --------- |
| 1   | 功能规格 + UML 图 + PRD | spec.md + constitution.md + diagrams.md + PRD            | ✅ 已完成 |
| 2   | 原型 & UI 设计          | `UI_DESIGN.md`（线框图 + 交互说明 + 组件规范）           | ⬜ 待开始 |
| 3   | 技术设计文档            | plan.md + tasks.md（类图 + ER 图 + API 设计 + 技术选型） | ⬜ 待开始 |

### 阶段 1 交付物清单

| 文件       | 路径                                                     | 说明                                                          | 状态   |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------------- | ------ |
| 项目宪法   | `.specify/memory/constitution.md`                        | 7 条核心原则 + 技术约束 + 质量门 (v1.1.0)                     | ✅     |
| 功能规格   | `specs/001-remote-terminal/spec.md`                      | 8 用户故事 + 10 验收场景 + 20+ FR + 28+ SC + 5 Clarifications | ✅     |
| 质量检查   | `specs/001-remote-terminal/checklists/requirements.md`   | 初版检查（部分条目已过时）                                    | ✅     |
| 认证检查   | `specs/001-remote-terminal/checklists/auth-update.md`    | 29 项，24 项已通过 clarify 解决                               | ✅     |
| 一致性检查 | `specs/001-remote-terminal/checklists/consistency.md`    | 15 项，8 ✅ + 7 ⚠️（已分流到遗留跟踪）                        | ✅     |
| 遗留跟踪   | `specs/001-remote-terminal/checklists/deferred-items.md` | 3 项清理 + 4 项延至 Phase 3                                   | ✅     |
| UML 图集   | `specs/001-remote-terminal/diagrams.md`                  | 12 张 Mermaid 图 (v1.1)                                       | ✅     |
| **PRD**    | `specs/001-remote-terminal/PRD.md`                       | **人类可读产品需求文档 v1.1.0（17 章，2190+ 行）**            | **✅** |

### 阶段 1 收尾任务

| #   | 任务                                 | 工具/技能                                 | 状态                |
| --- | ------------------------------------ | ----------------------------------------- | ------------------- |
| 1   | 生成人类可读 PRD                     | `product-manager` + `writing-prds` skills | ✅ 已完成（v1.1.0） |
| 2   | 清理 constitution Sync Impact Report | 手动编辑                                  | ✅ D-001 已完成     |
| 3   | 更新旧版 requirements.md             | 手动编辑                                  | ✅ D-002 已完成     |

---

## 阶段 1：合并 PRD + UML 图

### 1.1 合并三份文档为统一 PRD

将 `PRODUCT_SPEC.md`、`DETAILED_REQUIREMENTS.md`、`CLARIFICATIONS.md` 合并为一份结构清晰的 PRD，消除重复内容，以澄清文档为最终决策。

**输出结构**：

1. 产品定位与非目标
2. 用户角色
3. 用户故事（US-01 ~ US-08，已整合澄清决策）
4. 功能需求清单（FR-01 ~ FR-20，含优先级）
5. 非功能需求（NFR）
6. 核心业务流程
7. 数据模型（WebSocket 协议、数据结构）
8. 分阶段实施计划（Phase A~H → V1/V2/V3）
9. 验收测试最小集合

### 1.2 用例图（Use Case Diagram）

> 用户故事的可视化等价物

用 Mermaid 绘制，按角色分组：

- **个人开发者（移动优先）**：远程接入、命令输入、快捷键操作、手势操作、横竖屏切换
- **多设备开发者**：多端同屏、输入协同、设备切换、离线输入重连
- **团队协作者**：Agent Team 查看、Teammate 独立交互、Lead/Teammate 切换
- **运维/管理员**：设备配对管理、Token 吊销、实例创建/销毁

### 1.3 时序图（Sequence Diagram）

用 Mermaid 绘制以下核心流程：

1. **远程接入与配对认证**
   - 新设备配对流程（输入配对码 → 获取 device_token）
   - 已配对设备重连流程（device_token 认证）
   - 管理权转移流程（管理员 → 目标已配对设备）

2. **输入仲裁流程**
   - 多端发送输入 → ACK → FIFO 排队 → 注入 PTY → 广播队列状态

3. **断线重连与输出重放**
   - 断网 → 服务端缓冲 → 重连 → offset 比较 → 重放/gap 提示
   - 离线队列确认刷入

4. **通知路由与已读消偿**（设备优先级模型）
   - 事件触发 → 优先设备推送 → ACK/超时升级 → 外部推送链
   - 任一设备响应 → 全设备 dismiss

5. **Agent Team 生命周期**
   - SubagentStart → 创建 PTY → 通知客户端 → 分窗格
   - SubagentStop → 移除窗格 → 重新布局

6. **授权审批闭环**
   - permission_prompt → 设备优先级路由 → 飞书文本通知 → 弹窗加急 → CC 持续等待

### 1.4 模块图（Component Diagram）

用 Mermaid 绘制系统模块及依赖关系：

**Backend 模块**：

- WebSocket 服务（认证、心跳、多客户端管理）
- PTY 管理器（创建/销毁、输入输出流）
- 实例管理器（多实例生命周期）
- 输出缓冲区（环形缓冲 + offset 追踪）
- 输入消息队列（FIFO + ACK + 去重）
- Agent Team 检测器（Hook 事件监听）
- 通知服务（设备优先级路由 + 外部推送）
- 设备管理器（配对码、Token、SQLite 存储）

**Frontend 模块**：

- xterm.js 终端渲染器
- 多设备连接管理器
- 分窗格布局管理器（Agent Team）
- 输入队列可视化
- 通知中心
- 软键盘修饰键栏（移动端）
- 离线队列管理器
- 弱网状态机 UI

### 1.5 状态图（State Diagram）

用 Mermaid 绘制关键状态机：

1. **客户端连接状态机**
   - `CONNECTED` ↔ `DEGRADED` ↔ `DISCONNECTED` → `RECONNECTED` → `CONNECTED`

2. **实例状态机**
   - `idle` → `processing` → `idle`（循环）

3. **输入消息状态机**
   - `queued` → `injected` → （完成）
   - `queued` → `cancelled`

4. **通知事件状态机**
   - `created` → `sent_to_priority` → `acked` / `escalated` → `dismissed`

---

## 阶段 2：原型 & UI 设计

### 2.1 桌面端 / Web UI 线框图

- 顶栏：设备选择器、实例选择器、连接状态指示器（绿/黄/红三态）
- 主区域：xterm.js 终端（单窗格/Agent Team 分窗格）
- 底栏：输入队列面板（排队位置、来源设备、取消操作）
- 侧边栏（可选）：设备面板、实例列表（按工作目录分组）
- 通知中心：通知列表、未读 badge、已读消偿同步
- 管理员面板：设备列表、配对码管理（→ 2.6）、Token 吊销、管理权转移

### 2.2 手机端竖屏线框图

- 顶栏：设备 > 实例 > 状态
- 终端区域：xterm.js（CSS 缩放适配）
- Agent Tab 栏：Lead / Teammate #1~N（颜色状态标识）
- 软键盘修饰键栏：[Ctrl] [Alt] [Shift] [Esc] [Tab] + 方向键
- 文本输入框

### 2.3 手机端横屏线框图

- 双窗格并排（Lead + Teammate）
- 精简修饰键栏 + 输入框

### 2.4 关键交互流程

- 首次配对流程（输入地址 → 输入配对码 → 连接成功 → 首个配对者成为管理员）
- 断线重连 UI（状态指示 → 重放进度 → 离线队列勾选确认）
- 通知交互（设备优先级路由 → ACK / 已读消偿 → 外部推送升级链）
- Agent Team 布局切换（自动分窗 → Tab 切换 → Teammate 退出重布局）
- 授权审批（终端内 CC 原生按钮加粗加亮，不渲染模态弹窗）
- 管理权转移（选择目标设备 → 确认转移 → 角色变更通知）
- 设备管理（设备列表 → Token 吊销 → 设备移除确认）

### 2.5 组件规范

- 配色方案（深色终端主题）
- 字体规范（等宽字体选择）
- 状态颜色定义（在线=绿、离线=灰、弱网=黄、处理中=蓝、错误=红）
- 连接状态指示器（图标 + 文案 + 点击查看 RTT / 手动重连）
- 通知 badge 规范（未读计数、已读消偿动画）
- 审批按钮视觉增强规范（加粗加亮样式，非独立 UI 组件）
- 动画与过渡效果（窗格切换、Tab 切换、队列更新）

### 2.6 D-003（WebUI 配对码管理独立 FR）闭环要求

- **主解决阶段**：阶段 2（原型 & UI 设计）
- **要求**：在 `UI_DESIGN.md` 中为“配对码管理”提供独立页面/模块定义，至少包含：
  - 入口位置与信息架构（管理员如何进入）
  - 核心操作流（生成配对码、查看状态、复制/分享）
  - 权限与异常态（非管理员禁止、过期/已使用提示）
  - 最小验收场景（Given/When/Then）
- **目标**：将 FR-001 中“管理员可生成配对码”的能力从一句描述提升为可实现的 UI 需求，不新增高风险技术范围。

---

## 阶段 3：技术设计文档

> **spec-kit 映射**: `/speckit.plan` → plan.md, `/speckit.tasks` → tasks.md, `/speckit.analyze` → 一致性验证
> **遗留项**: D-004 ~ D-007 在此阶段解决（见 `checklists/deferred-items.md`）
> **承接要求**: D-003 在本阶段仅补充接口契约与权限校验，不新增 UI 范围。

### 3.1 类图（Class Diagram）

用 Mermaid 绘制核心类及关系：

**Backend**：

- `DeviceServer`（设备级别，管理实例和客户端连接）
- `Instance`（实例级别，PTY + 状态 + 缓冲 + 队列）
- `OutputBuffer`（环形缓冲区实现）
- `ClientConnection`（客户端连接状态）
- `QueuedInput`（输入消息）
- `NotificationService`（通知路由）
- `DeviceNotificationConfig`（通知配置）
- `PairingManager`（配对码 + Token 管理）
- `AgentTeamDetector`（Hook 事件处理）

**Frontend**：

- `ConnectionManager`（WebSocket 连接管理）
- `TerminalRenderer`（xterm.js 封装）
- `PaneLayoutManager`（Agent Team 分窗格）
- `InputQueueManager`（输入队列可视化）
- `OfflineQueueManager`（离线队列缓存）
- `NetworkStateMachine`（弱网状态机）
- `SoftKeyboard`（软键盘修饰键）

### 3.2 ER 图（Entity-Relationship Diagram）

用 Mermaid 绘制数据库表关系：

- `paired_devices`（设备 ID、名称、token_hash、admin 标记）
- `pairing_codes`（配对码、有效期、已使用标记）
- `instances`（实例 ID、项目路径、状态、所属设备）
- `notification_events`（事件 ID、类型、状态、目标实例）
- `device_notification_config`（设备优先级、通知模式）

### 3.3 API 设计

详细定义 WebSocket 消息协议（已在源文档中有雏形，需完善）：

- 客户端 → 服务端消息类型完整定义
- 服务端 → 客户端消息类型完整定义
- 错误码定义
- 消息序列化格式（JSON）
- D-003 承接：补充“生成配对码”接口/消息的权限校验与错误码（例如无管理权限、配对码生成失败），与阶段 2 的 UI 流程一一对应。

### 3.4 技术选型确认

| 层             | 技术                       | 备选         |
| -------------- | -------------------------- | ------------ |
| Backend 运行时 | Node.js (ESM + TypeScript) | —            |
| PTY            | `node-pty`                 | —            |
| WebSocket      | `ws`                       | `socket.io`  |
| 数据库         | SQLite (`better-sqlite3`)  | —            |
| Frontend 框架  | React / Next.js（待定）    | Vue / Svelte |
| 终端渲染       | `xterm.js` + addons        | —            |
| 桌面应用       | Tauri v2                   | Electron     |
| iOS            | Swift + UIKit/SwiftUI      | React Native |
| Android        | Kotlin + Jetpack Compose   | React Native |
| 推送           | APNs + FCM                 | —            |
| 外部通知       | 飞书 SDK（复用现有）       | —            |

### 3.5 目录结构设计

```
claude-code-anywhere/
├── apps/
│   ├── backend/          # Node.js 后端
│   ├── web/              # Web 前端
│   ├── desktop/          # Tauri 桌面应用
│   ├── ios/              # iOS App
│   └── android/          # Android App
├── packages/
│   ├── protocol/         # 共享 WebSocket 协议类型定义
│   ├── shared/           # 共享工具函数
│   └── ui-components/    # 共享 UI 组件
└── docs/                 # 文档
```

### 3.6 部署架构

- Backend 部署方式（每台设备独立部署）
- 端口规划
- TLS 证书管理
- 日志方案

---

## 执行顺序与依赖

```
阶段 1（规格 + UML + PRD） ──→ 阶段 2（原型 & UI） ──→ 阶段 3（技术设计）
     │                                                        │
     │  spec-kit: constitution ✅                              │  spec-kit: /speckit.plan
     │  spec-kit: specify ✅                                   │  spec-kit: /speckit.tasks
     │  spec-kit: clarify ✅                                   │  spec-kit: /speckit.analyze
     │  PRD: product-manager ✅                                │
     │                                                        ▼
     │                                                   开始编码（Phase A MVP）
```

阶段 1 是后续所有工作的基础，必须先完成。
阶段 2 和阶段 3 有部分可并行（类图/ER 图不依赖 UI 设计），但建议顺序执行以保持一致性。

---

## 遗留项跟踪

详见 `specs/001-remote-terminal/checklists/deferred-items.md`

| Phase             | Open Items | Summary                                      |
| ----------------- | ---------- | -------------------------------------------- |
| Phase 1 清理      | 0          | ✅ 已完成（源检查清单文件已清理）            |
| Phase 2 原型 & UI | 1          | D-003：WebUI 配对码管理独立 FR（主闭环）     |
| Phase 3 技术设计  | 4          | server_id 格式、术语统一、客户端校验、Hub FR |
