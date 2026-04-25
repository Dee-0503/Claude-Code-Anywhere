<!-- Sync Impact Report
  Version change: 1.0.0 → 1.1.0
  Modified principles: IV (安全认证)
  Added sections:
    - 管理员角色基于首次配对（替代 localhost 检测）
    - 管理权转移机制
    - 协议前瞻性要求（server_id/instance_id）
  Removed sections:
    - localhost 自动配对为 admin
  Templates requiring updates:
    ✅ plan-template.md — Constitution Check gates align with principles
    ✅ spec-template.md — User story structure compatible
    ✅ tasks-template.md — Phase structure compatible
  Follow-up:
    ✅ spec.md: US-01 场景7/9/10、FR-001、FR-003a、FR-013、Edge Cases 已同步更新 (2026-02-13)
    ✅ diagrams.md: 用例图 UC05、时序图流程 A/C 已同步更新 (2026-02-13)
-->

# Claude Code Anywhere 随行终端 Constitution

## Core Principles

### I. 远程终端本质（Terminal-First）

Claude Code Anywhere 是远程终端，不是聊天机器人，不是消息桥接。

- 所有用户交互 MUST 通过 PTY stdin/stdout 透传，不做额外抽象层
- 终端渲染 MUST 使用 xterm.js 统一引擎，ANSI 颜色、TUI 元素、代码块原样呈现
- Claude Code 的所有功能（/命令、Plan 模式、Shift+Tab 切换）MUST 可通过远程终端正常使用
- 不得为特定 Claude Code 功能创建定制 UI 旁路（如独立的 Plan 审核面板）

### II. 跨端显示一致性（Uniform Rendering）

所有客户端看到的终端输出 MUST 完全一致，无信息丢失。

- PTY MUST 固定列数（默认 120 列），不跟随任何客户端动态调整
- 各客户端 MUST 通过 CSS `transform: scale()` 缩放适配屏幕宽度
- xterm.js 的 cols 配置 MUST 与 PTY cols 保持一致
- 从 WebSocket 协议中移除 `resize` 消息类型——PTY 尺寸在实例创建时固定

### III. 连接可靠性（Reliable Connection）

用户在弱网、断网、App 切后台等场景下 MUST 不丢失任何信息。

- 每实例 MUST 维护 1MB 环形输出缓冲区，记录全局写入 offset（单调递增）
- 重连时 MUST 基于客户端 lastOffset 重放缺失输出；offset 已被覆盖时 MUST 发送 `output_gap` 提示
- 每条输入 MUST 有唯一 ID + ACK 确认，3 秒无 ACK 自动重试，服务端按 ID 去重
- 客户端 MUST 实现三态状态机：CONNECTED ↔ DEGRADED ↔ DISCONNECTED
- DEGRADED 模式下输出 MUST 降频为批量推送（每 2 秒合并）

### IV. 安全认证（Secure Pairing）

设备认证 MUST 基于配对码机制，不使用固定密码或明文 token。管理员角色 MUST 基于首次配对确立，不依赖 localhost 检测。

- Server 首次启动时 MUST 在终端打印首次配对码（6 位数字，有效期 10 分钟）
- 首个完成配对的客户端 MUST 自动成为管理员（admin），无论连接来源是本地还是远程
- 配对成功后 MUST 签发 device_token（32 字节 hex），服务端只存 bcrypt hash
- 管理员 MUST 可生成新配对码、吊销其他设备 token、将管理权转移给其他已配对设备
- 每个 Server 同一时间 MUST 只有一个管理员
- 生产环境 WebSocket MUST 使用 WSS（TLS 加密）
- WebSocket 消息协议 MUST 包含 server_id 和 instance_id 字段（V1 为固定值），为 V3 Hub 架构预留扩展性

### V. 输入公平性（Fair Input Arbitration）

多端输入 MUST 通过 FIFO 队列公平仲裁，不设主控权机制。

- 所有设备的输入平等入队，不区分优先级
- Claude 实例空闲时 MUST 自动 dequeue 下一条输入注入 PTY stdin
- 队列变更 MUST 广播给所有已连接客户端（queue_update 消息）
- 队列中的消息 MUST 可在任一设备上取消
- 每条输入 MUST 标记来源设备名称
- Ctrl+C 中断 MUST 不经过队列，任何设备可立即发送

### VI. 设备优先级通知（Priority Notification）

通知路由 MUST 遵循设备优先级模型，已读消偿，避免重复打扰。

- 多设备在线时 MUST 优先通知电脑端（用户可配置优先级排序）
- 优先设备响应（ACK）后 MUST 广播 `notification_dismiss` 给其他设备
- ACK 定义：用户产生交互行为（窗口焦点 + 未读通知、点击推送、终端输入、审批按钮操作）
- 外部推送（APNs/FCM → 飞书文本+深链 → 弹窗加急）MUST 仅在所有客户端离线时触发
- 权限审批事件 MUST 走完整升级链（含弹窗加急），CC 侧保持持续等待不自动拒绝
- 非审批事件（任务完成、等待输入）MUST NOT 升级到弹窗加急
- 客户端 MUST 对终端中 CC 原生渲染的审批按钮进行加粗加亮视觉增强，MUST NOT 额外渲染模态对话框或浮动 UI
- 飞书通知 MUST 仅发送文本消息+客户端深链，MUST NOT 使用交互式审批卡片

### VII. 渐进式交付（Incremental Delivery）

产品 MUST 按 Phase 分阶段实施，每个版本可独立交付价值。

- V1（MVP）= Phase A + B：单设备单实例可靠远程终端
- V2 = Phase C + D + E：多实例 + 多客户端 + 通知体系
- V3 = Phase F + G + H：多设备管理 + 原生客户端
- 每个 Phase MUST 有明确的验收标准和可独立演示的功能
- 后续 Phase 的功能 MUST NOT 阻塞前序 Phase 的交付
- 架构设计 MUST 支持 Phase 间的增量扩展，不需要推倒重来

## Technical Constraints

- **运行时**：Node.js + TypeScript（ESM，`module: "NodeNext"`，`.js` 扩展名）
- **PTY 管理**：`node-pty` 创建/销毁 Claude Code 实例进程
- **终端渲染**：xterm.js + SearchAddon（前端统一渲染引擎）
- **通信协议**：WebSocket（`ws` 库），JSON 序列化
- **数据存储**：SQLite（`better-sqlite3`）存储设备信息、配对码（MVP）
- **外部通知**：飞书 SDK（`@larksuiteoapi/node-sdk`）、APNs、FCM
- **桌面应用**：Tauri v2（V3 阶段）
- **移动端**：Swift (iOS) + Kotlin (Android)（V3 阶段）
- **文档语言**：中文（所有面向用户的 UI 和文档）

## Quality Gates

- 核心模块（消息队列、环形缓冲区、输入仲裁、配对认证）单元测试覆盖 MUST ≥ 80%
- 每个 User Story MUST 有独立的验收测试（Given/When/Then）
- WebSocket 协议变更 MUST 同步更新 `packages/protocol/` 类型定义
- 每个 Phase 完成后 MUST 通过集成测试验证与前序 Phase 的兼容性
- 安全相关代码（token 生成、bcrypt、TLS）MUST 不使用自行实现的加密算法

## Governance

- 本宪法优先于所有其他开发实践和文档
- 修订 MUST 记录变更内容、版本号、日期，并更新依赖模板
- 版本号遵循语义化版本：MAJOR（原则删除/重定义）、MINOR（新增原则/章节）、PATCH（措辞澄清）
- 所有 PR/Review MUST 验证是否符合宪法原则
- 复杂度 MUST 有正当理由——简单方案优先（YAGNI）

**Version**: 1.1.0 | **Ratified**: 2026-02-13 | **Last Amended**: 2026-02-13

### Amendment Log

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.1.0 | 2026-02-13 | 原则 IV：去掉 localhost 自动 admin，改为首次配对即 admin + 管理权转移；新增协议前瞻性要求（server_id/instance_id） |
| 1.0.0 | 2026-02-13 | 初始版本 |
