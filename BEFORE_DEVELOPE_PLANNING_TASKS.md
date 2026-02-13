# Claude Code Anywhere — 研发前阶段任务计划

> 源文档：`PRODUCT_SPEC.md` + `DETAILED_REQUIREMENTS.md` + `CLARIFICATIONS.md`
> 创建日期：2026-02-13

---

## 阶段总览

| # | 阶段 | 交付物 | 状态 |
|---|------|--------|------|
| 1 | 合并 PRD + UML 图 | `PRD.md`（合并文档 + 用例图 + 时序图 + 模块图 + 状态图） | ⬜ 待开始 |
| 2 | 原型 & UI 设计 | `UI_DESIGN.md`（线框图 + 交互说明 + 组件规范） | ⬜ 待开始 |
| 3 | 技术设计文档 | `TECHNICAL_DESIGN.md`（类图 + ER 图 + API 设计 + 技术选型） | ⬜ 待开始 |

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
   - localhost 免配对流程

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
   - permission_prompt → 设备优先级路由 → 飞书卡片 → 弹窗加急 → 超时默认拒绝

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

- 顶栏：设备选择器、实例选择器、连接状态
- 主区域：xterm.js 终端（单窗格/Agent Team 分窗格）
- 底栏：输入队列状态
- 侧边栏（可选）：设备面板、实例列表

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

- 首次配对流程（输入地址 → 输入配对码 → 连接成功）
- 断线重连 UI（状态指示 → 重放进度 → 离线队列确认）
- 通知交互（通知弹出 → ACK → 跳转终端 / 直接操作）
- Agent Team 布局切换（自动分窗 → Tab 切换 → 手动调整）
- 授权审批弹窗

### 2.5 组件规范

- 配色方案（深色终端主题）
- 字体规范（等宽字体选择）
- 状态颜色定义（在线=绿、离线=灰、弱网=黄、处理中=蓝、错误=红）
- 通知 badge 规范
- 动画与过渡效果

---

## 阶段 3：技术设计文档

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

### 3.4 技术选型确认

| 层 | 技术 | 备选 |
|----|------|------|
| Backend 运行时 | Node.js (ESM + TypeScript) | — |
| PTY | `node-pty` | — |
| WebSocket | `ws` | `socket.io` |
| 数据库 | SQLite (`better-sqlite3`) | — |
| Frontend 框架 | React / Next.js（待定） | Vue / Svelte |
| 终端渲染 | `xterm.js` + addons | — |
| 桌面应用 | Tauri v2 | Electron |
| iOS | Swift + UIKit/SwiftUI | React Native |
| Android | Kotlin + Jetpack Compose | React Native |
| 推送 | APNs + FCM | — |
| 外部通知 | 飞书 SDK（复用现有） | — |

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
阶段 1（PRD + UML） ──→ 阶段 2（原型 & UI） ──→ 阶段 3（技术设计）
                                                        │
                                                        ▼
                                                   开始编码（Phase A MVP）
```

阶段 1 是后续所有工作的基础，必须先完成。
阶段 2 和阶段 3 有部分可并行（类图/ER 图不依赖 UI 设计），但建议顺序执行以保持一致性。
