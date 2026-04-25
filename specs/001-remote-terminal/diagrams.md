# Claude Code Anywhere 随行终端 — UML 图集

> 基于 `specs/001-remote-terminal/spec.md` 绘制
> 参考源文档：PRODUCT_SPEC.md, DETAILED_REQUIREMENTS.md, CLARIFICATIONS.md
> 创建日期：2026-02-13
>
> 图表类型：用例图 ×1, 时序图 ×6, 模块图 ×1, 状态图 ×4（共 12 张）

---

## 目录

1. [用例图 — 角色与功能映射](#1-用例图--角色与功能映射)
2. [时序图 — 配对认证](#2-时序图--配对认证)
3. [时序图 — 输入仲裁](#3-时序图--输入仲裁)
4. [时序图 — 断线重连与输出重放](#4-时序图--断线重连与输出重放)
5. [时序图 — 设备优先级通知路由](#5-时序图--设备优先级通知路由)
6. [时序图 — Agent Team 生命周期](#6-时序图--agent-team-生命周期)
7. [时序图 — 授权审批闭环](#7-时序图--授权审批闭环)
8. [模块图 — 系统架构](#8-模块图--系统架构)
9. [状态图 — 客户端连接状态机](#9-状态图--客户端连接状态机)
10. [状态图 — 实例状态机](#10-状态图--实例状态机)
11. [状态图 — 输入消息状态机](#11-状态图--输入消息状态机)
12. [状态图 — 通知事件状态机](#12-状态图--通知事件状态机)

---

## 1. 用例图 — 角色与功能映射

> 4 种用户角色与系统用例的对应关系。按功能域分组。

```mermaid
flowchart LR
    A1(("个人开发者\n（移动优先）"))
    A2(("多设备\n开发者"))
    A3(("团队\n协作者"))
    A4(("运维/\n管理员"))

    subgraph UC_Access["远程接入与会话"]
        UC01["远程连接终端"]
        UC02["完整终端渲染"]
        UC03["断线恢复与重放"]
        UC04["配对码认证"]
        UC05["管理权转移"]
    end

    subgraph UC_Collab["多端协同"]
        UC06["多端同屏查看"]
        UC07["FIFO 输入排队"]
        UC08["队列查看与取消"]
        UC09["离线队列缓存"]
        UC10["Ctrl+C 即时中断"]
    end

    subgraph UC_Instance["实例管理"]
        UC11["列出活跃实例"]
        UC12["切换实例"]
        UC13["远程创建实例"]
    end

    subgraph UC_Notify["通知与授权"]
        UC14["设备优先级通知"]
        UC15["已读消偿"]
        UC16["权限审批（终端内按钮加粗加亮）"]
        UC17["飞书文本通知（深链）"]
        UC18["外部推送（APNs/FCM + 飞书深链 + 弹窗加急）"]
    end

    subgraph UC_Team["Agent Team"]
        UC19["自动检测 Teammate"]
        UC20["分窗格/Tab 布局"]
        UC21["Teammate 独立输入"]
    end

    subgraph UC_Device["设备管理"]
        UC22["设备配对"]
        UC23["Token 吊销"]
        UC24["生成新配对码"]
    end

    subgraph UC_Mobile["移动端增强"]
        UC25["软键盘修饰键栏"]
        UC26["手势操作"]
        UC27["横竖屏自适应"]
    end

    %% 个人开发者
    A1 --> UC01
    A1 --> UC02
    A1 --> UC03
    A1 --> UC04
    A1 --> UC25
    A1 --> UC26
    A1 --> UC27

    %% 多设备开发者
    A2 --> UC06
    A2 --> UC07
    A2 --> UC09
    A2 --> UC11
    A2 --> UC12
    A2 --> UC13
    A2 --> UC14
    A2 --> UC16

    %% 团队协作者
    A3 --> UC19
    A3 --> UC20
    A3 --> UC21

    %% 运维/管理员
    A4 --> UC22
    A4 --> UC23
    A4 --> UC24
    A4 --> UC05
    A4 --> UC13
```

---

## 2. 时序图 — 配对认证

> 三种认证流程：首次配对（首个配对者成为管理员）、已配对设备重连、管理权转移。
> 参考：CLARIFICATIONS #6（认证 Token 机制）+ Constitution v1.1.0 原则 IV。

```mermaid
sequenceDiagram
    participant C as 客户端
    participant B as Backend
    participant DB as SQLite

    rect rgb(230, 245, 255)
    Note over C,DB: 流程 A — 首次配对（Server 首次启动，首个配对者成为管理员）
    C->>B: WebSocket 连接
    C->>B: pair { code: "839271", deviceName: "iPhone" }
    B->>DB: 查询配对码（10 分钟有效期）
    alt 配对码有效且未使用
        B->>B: 生成 device_token（32 字节 hex）
        B->>DB: 检查是否已有管理员
        alt 首个配对（无管理员）
            B->>DB: 存储 bcrypt(device_token) + 设备信息（is_admin = 1）
            B-->>C: paired { deviceToken, deviceId, role: "admin" }
            Note over C: 成为管理员，可生成配对码/吊销设备/转移管理权
        else 已有管理员
            B->>DB: 存储 bcrypt(device_token) + 设备信息（is_admin = 0）
            B-->>C: paired { deviceToken, deviceId, role: "member" }
            Note over C: 普通已配对设备
        end
        B->>DB: 标记配对码已使用
    else 配对码无效或已过期
        B-->>C: auth_failed { reason: "配对码已过期" }
    end
    end

    rect rgb(240, 255, 240)
    Note over C,DB: 流程 B — 已配对设备重连
    C->>B: WebSocket 连接
    C->>B: auth { token: "abc...", deviceName: "iPhone" }
    B->>DB: 查询设备，bcrypt 比对 token
    alt token 有效
        B-->>C: auth_ok { clientId: "client-123" }
        B-->>C: instance_list { instances: [...] }
    else token 被吊销或过期
        B-->>C: auth_failed { reason: "设备已被取消配对" }
        Note over C: 清除本地 token → 跳转配对界面
    end
    end

    rect rgb(255, 248, 230)
    Note over C,DB: 流程 C — 管理权转移
    C->>B: admin_transfer { targetDeviceId: "device-456" }
    B->>DB: 验证请求者是否为当前管理员
    alt 请求者是管理员
        B->>DB: 设置 target device is_admin = 1
        B->>DB: 设置 current device is_admin = 0
        B-->>C: admin_transfer_ok { newAdmin: "device-456" }
        Note over C: 降级为普通已配对设备
        B-->>B: 通知 target device（若在线）: role_changed { role: "admin" }
    else 请求者非管理员
        B-->>C: admin_transfer_failed { reason: "无管理权限" }
    end
    end
```

---

## 3. 时序图 — 输入仲裁

> 多端输入 FIFO 队列、ACK 确认、去重、取消、Ctrl+C 即时中断。
> 参考：CLARIFICATIONS #4（砍掉主控权，所有输入进 FIFO 队列）。

```mermaid
sequenceDiagram
    participant PA as 客户端 A（Phone）
    participant PB as 客户端 B（Desktop）
    participant B as Backend
    participant PTY as PTY stdin

    Note over PA,PTY: 实例状态: idle，队列为空

    PA->>B: input { id: "msg-001", text: "修复bug" }
    B-->>PA: input_ack { id: "msg-001", status: "queued" }
    B->>B: 实例 idle → 立即 dequeue
    B->>PTY: 注入 "修复bug\n"
    B->>B: 实例 → processing
    B-->>PA: input_ack { id: "msg-001", status: "injected" }
    B-->>PA: queue_update { queue: [] }
    B-->>PB: queue_update { queue: [] }

    Note over PA,PTY: Claude 处理中…其他输入入队等待

    PB->>B: input { id: "msg-002", text: "加测试" }
    B-->>PB: input_ack { id: "msg-002", status: "queued" }
    B-->>PA: queue_update { queue: [msg-002/Desktop] }
    B-->>PB: queue_update { queue: [msg-002/Desktop] }

    PA->>B: input { id: "msg-003", text: "优化性能" }
    B-->>PA: input_ack { id: "msg-003", status: "queued" }
    B-->>PA: queue_update { queue: [msg-002, msg-003] }
    B-->>PB: queue_update { queue: [msg-002, msg-003] }

    Note over PA,PTY: ACK 重试与去重
    PA->>B: input { id: "msg-003", text: "优化性能" }
    Note over B: 检测到重复 id → 不重复入队
    B-->>PA: input_ack { id: "msg-003", status: "duplicate" }

    Note over PA,PTY: 用户在 Phone 取消 msg-003
    PA->>B: input_cancel { inputId: "msg-003" }
    B-->>PA: queue_update { queue: [msg-002] }
    B-->>PB: queue_update { queue: [msg-002] }

    PTY-->>B: Claude 输出完成（检测到 idle prompt）
    B->>B: 实例 → idle → dequeue msg-002
    B->>PTY: 注入 "加测试\n"
    B->>B: 实例 → processing
    B-->>PA: state_change { state: "processing" }
    B-->>PB: state_change { state: "processing" }
    B-->>PA: queue_update { queue: [] }
    B-->>PB: queue_update { queue: [] }

    Note over PA,PTY: Ctrl+C — 不经过队列，立即送达
    PA->>B: input { id: "ctrl-c", text: "\x03" }
    B->>PTY: 立即注入 SIGINT（绕过队列）
    Note over B: 队列中的后续消息仍保留
```

---

## 4. 时序图 — 断线重连与输出重放

> 断网 → 服务端缓冲 → 重连 → offset 重放 → 离线队列确认发送。
> 参考：CLARIFICATIONS #5（离线队列重连确认策略）、#8（缓冲区溢出处理）。

```mermaid
sequenceDiagram
    participant C as 客户端
    participant B as Backend
    participant BUF as 环形缓冲区（1MB）
    participant PTY as PTY

    Note over C,PTY: 正常连接中（lastOffset = 5000）

    C->>B: heartbeat
    B-->>C: heartbeat_ack

    Note over C,PTY: ⚡ 网络中断

    PTY-->>B: Claude 持续输出（大量数据）
    B->>BUF: 写入输出 offset 5001 → 12000
    Note over B: 记录客户端 lastOffset = 5000

    C->>C: 用户继续输入（离线）
    C->>C: 存入离线队列 [msg-A, msg-B]
    C->>C: 界面提示"已离线"

    Note over C,PTY: 网络恢复，客户端重连

    C->>B: WebSocket 重连
    C->>B: auth { token: "..." }
    B-->>C: auth_ok { clientId: "..." }

    C->>B: reconnect { offsets: { "inst-1": 5000 } }
    B->>BUF: 检查 offset 5000 是否在缓冲区内

    alt offset 在缓冲区范围内
        B-->>C: output_replay { data: "...", fromOffset: 5001, toOffset: 12000 }
        Note over C: 终端无缝衔接
    else offset 已被覆盖（缓冲区溢出）
        B-->>C: output_gap { lostFrom: 5000, lostTo: 8000 }
        B-->>C: output_replay { data: "...", fromOffset: 8001, toOffset: 12000 }
        Note over C: 显示"部分历史输出已丢失"提示
    end

    Note over C,PTY: 离线队列确认发送
    C->>C: 展示离线队列（勾选框，默认全选）
    Note over C: [✓] msg-A: "重构代码"<br/>[✓] msg-B: "运行测试"
    C->>C: 用户确认（可取消不需要的）
    C->>B: input { id: "msg-A", text: "重构代码" }
    B-->>C: input_ack { id: "msg-A", status: "queued" }
    C->>B: input { id: "msg-B", text: "运行测试" }
    B-->>C: input_ack { id: "msg-B", status: "queued" }
```

---

## 5. 时序图 — 设备优先级通知路由

> 设备优先级模型：优先通知电脑端 → 已读消偿 → 外部推送升级链。
> 参考：CLARIFICATIONS #12（通知机制重设计）、#1（通知层级口径统一）。

```mermaid
sequenceDiagram
    participant CC as Claude Code
    participant B as Backend
    participant D1 as 优先设备（Desktop）
    participant D2 as 次要设备（Phone）
    participant EXT as 外部推送

    CC-->>B: Hook 事件（需通知）

    rect rgb(230, 245, 255)
    Note over B,D2: 阶段 1 — 设备优先级路由
    B->>B: 检查已连接客户端

    alt 优先设备在线
        B->>D1: notification { event, detail }
        Note over B: 等待 ACK（30 秒）

        alt 用户在 Desktop 交互（窗口焦点/输入/点击）
            D1->>B: notification_ack { eventId }
            B->>D2: notification_dismiss { eventId }
            Note over D2: 通知标记已读，取消提醒
        else 30 秒未 ACK
            B->>D2: notification { event, detail }
            Note over B: 通知下一优先级设备
            D2->>B: notification_ack { eventId }
            B->>D1: notification_dismiss { eventId }
        end

    else 所有客户端离线
        Note over B,EXT: 进入外部推送升级链
    end
    end

    rect rgb(255, 248, 230)
    Note over B,EXT: 阶段 2 — 外部推送升级链（所有客户端离线时）
    B->>B: 等待 2 分钟（用户可能马上回来）

    B->>EXT: APNs/FCM 推送到手机
    Note over B: 等待 3 分钟

    alt 用户点击推送
        D2->>B: 重连 + notification_ack
        Note over B: 结束
    else 3 分钟无响应
        B->>EXT: 飞书文本通知（含深链）
        Note over B: 等待响应

        alt 用户点击深链跳转客户端
            EXT-->>B: 用户打开客户端完成审批
            Note over B: 结束
        else 持续无响应（权限审批事件）
            B->>EXT: 弹窗加急（最高优先级通知）
            Note over B: CC 继续等待,不自动拒绝
        end
    end
    end
```

---

## 6. 时序图 — Agent Team 生命周期

> 通过 Hook 事件（SubagentStart/SubagentStop）检测 Teammate 创建与退出。
> 参考：CLARIFICATIONS #10（Agent Team 检测机制）。

```mermaid
sequenceDiagram
    participant CC as Claude Code（Lead）
    participant B as Backend
    participant C1 as 桌面客户端
    participant C2 as 手机客户端

    Note over CC,C2: Claude Code 启动 Agent Team 模式

    rect rgb(230, 245, 255)
    Note over CC,C2: Teammate 创建
    CC-->>B: Hook: SubagentStart { agent_id: "tm-1", agent_type: "Explore" }
    B->>B: 为 Teammate 创建独立 PTY 连接
    B->>B: 注册为 Lead 实例的子实例
    B-->>C1: team_update { action: "teammate_added", agentId: "tm-1", agentType: "Explore" }
    B-->>C2: team_update { action: "teammate_added", agentId: "tm-1", agentType: "Explore" }
    Note over C1: 桌面端：创建并排分窗格
    Note over C2: 手机端：添加 Tab 标签

    CC-->>B: Hook: SubagentStart { agent_id: "tm-2", agent_type: "general-purpose" }
    B->>B: 为 Teammate #2 创建独立 PTY
    B-->>C1: team_update { action: "teammate_added", agentId: "tm-2" }
    B-->>C2: team_update { action: "teammate_added", agentId: "tm-2" }
    Note over C1: 重新布局（3 窗格）
    Note over C2: 添加第 3 个 Tab
    end

    rect rgb(240, 255, 240)
    Note over CC,C2: Teammate 状态变化
    CC-->>B: Hook: TeammateIdle { agent_id: "tm-1" }
    B-->>C1: state_change { instanceId: "tm-1", state: "idle" }
    B-->>C2: state_change { instanceId: "tm-1", state: "idle" }
    Note over C2: Tab 颜色变为"空闲"标识
    end

    rect rgb(255, 240, 240)
    Note over CC,C2: Teammate 退出
    CC-->>B: Hook: SubagentStop { agent_id: "tm-1" }
    B->>B: 清理 Teammate PTY 资源
    B-->>C1: team_update { action: "teammate_removed", agentId: "tm-1" }
    B-->>C2: team_update { action: "teammate_removed", agentId: "tm-1" }
    Note over C1: 移除窗格，重新布局（2 窗格）
    Note over C2: 移除 Tab，切换到 Lead
    end
```

---

## 7. 时序图 — 授权审批闭环

> 权限审批事件的升级路径：设备优先级 → 推送 → 飞书文本通知（深链） → 弹窗加急。CC 侧保持持续等待,不设超时自动拒绝。
> 参考：CLARIFICATIONS #12.4（各事件类型的升级规则）。

```mermaid
sequenceDiagram
    participant CC as Claude Code
    participant B as Backend
    participant D as 优先设备
    participant PUSH as APNs/FCM
    participant FS as 飞书
    participant URG as 弹窗加急

    CC-->>B: Hook: permission_prompt { tool: "Bash", command: "rm -rf /tmp/old" }
    B->>B: 事件分类: 权限审批 → CC 持续等待

    rect rgb(230, 245, 255)
    Note over B,D: 阶段 1: 设备优先级路由
    B->>D: notification { event: "auth_required", detail: "Bash: rm -rf /tmp/old" }
    Note over B: 等待 ACK（30 秒）

    alt 用户在设备上操作
        D->>B: notification_ack
        alt 用户批准
            D->>B: auth_response { approved: true }
            B->>CC: 注入审批结果 → 继续执行
            B-->>D: state_change { state: "processing" }
        else 用户拒绝
            D->>B: auth_response { approved: false }
            B->>CC: 注入拒绝结果
        end
    else 30 秒未 ACK + 所有设备离线
        Note over B,URG: 进入外部推送链
    end
    end

    rect rgb(255, 248, 230)
    Note over B,URG: 阶段 2: 外部推送升级链
    B->>B: 等待 2 分钟
    B->>PUSH: 推送通知 "Claude 需要权限审批"
    Note over B: 等待 3 分钟

    alt 用户点击推送
        D->>B: 重连 + 审批操作
    else 无响应
        B->>FS: 飞书文本通知（含审批摘要 + 客户端深链）
        Note over B: 等待响应

        alt 用户点击深链跳转客户端
            D->>B: 重连 + 审批操作
            B->>CC: 注入审批结果
            B-->>D: 同步审批状态
        else 持续无响应
            B->>URG: 弹窗加急（最高优先级通知）
            Note over B: CC 持续等待,不自动拒绝
            alt 用户最终响应
                D->>B: 重连 + 审批操作
                B->>CC: 注入审批结果
            else 继续无响应
                Note over B: CC 继续等待
            end
        end
    end
    end
```

---

## 8. 模块图 — 系统架构

> Backend 8 模块 + Frontend 8 模块 + 外部依赖。各模块间的数据流与依赖关系。

```mermaid
flowchart TB
    subgraph Client["客户端（Frontend）"]
        direction TB
        FE01["xterm.js\n终端渲染器"]
        FE02["多设备\n连接管理器"]
        FE03["分窗格/Tab\n布局管理器"]
        FE04["输入队列\n可视化"]
        FE05["通知中心"]
        FE06["软键盘\n修饰键栏"]
        FE07["离线队列\n管理器"]
        FE08["弱网状态机\nUI"]
    end

    subgraph Backend["Backend（每台设备部署一个）"]
        direction TB
        BE01["WebSocket\n服务"]
        BE02["PTY\n管理器"]
        BE03["实例\n管理器"]
        BE04["输出\n缓冲区"]
        BE05["输入\n消息队列"]
        BE06["Agent Team\n检测器"]
        BE07["通知\n服务"]
        BE08["设备\n管理器"]
    end

    subgraph External["外部服务"]
        EX01["Claude Code\n进程"]
        EX02["SQLite\n数据库"]
        EX03["APNs / FCM"]
        EX04["飞书 SDK"]
    end

    %% Frontend 内部依赖
    FE02 --> FE01
    FE02 --> FE08
    FE03 --> FE01
    FE04 --> FE01
    FE07 --> FE04
    FE06 --> FE01

    %% Frontend → Backend（WebSocket）
    FE02 <==>|WebSocket| BE01

    %% Backend 内部依赖
    BE01 --> BE08
    BE01 --> BE03
    BE01 --> BE05
    BE01 --> BE04
    BE03 --> BE02
    BE03 --> BE04
    BE03 --> BE05
    BE06 --> BE03
    BE07 --> BE01

    %% Backend → External
    BE02 --> EX01
    BE08 --> EX02
    BE07 --> EX03
    BE07 --> EX04
    BE06 -->|Hook 事件| EX01
```

### 模块职责说明

| 层 | 模块 | 核心职责 |
|---|---|---|
| Backend | WebSocket 服务 | 连接管理、认证握手、心跳检测、多客户端广播 |
| Backend | PTY 管理器 | node-pty 创建/销毁、stdin/stdout 流转发 |
| Backend | 实例管理器 | 多实例生命周期（创建/销毁/列出/切换） |
| Backend | 输出缓冲区 | 环形缓冲 1MB/实例、全局写入 offset 追踪 |
| Backend | 输入消息队列 | FIFO 队列、ACK 确认、消息去重、队列广播 |
| Backend | Agent Team 检测器 | Hook 事件监听（SubagentStart/Stop/TeammateIdle） |
| Backend | 通知服务 | 设备优先级路由、已读消偿、外部推送升级链 |
| Backend | 设备管理器 | 配对码管理、device_token 生命周期、SQLite 存储 |
| Frontend | xterm.js 终端渲染器 | ANSI/TUI 渲染、SearchAddon 搜索、固定 120 列 |
| Frontend | 多设备连接管理器 | 多 WebSocket 并行连接、设备面板 |
| Frontend | 分窗格/Tab 布局管理器 | Agent Team 桌面分窗格、手机 Tab 切换 |
| Frontend | 输入队列可视化 | 队列状态展示、来源设备标识、取消操作 |
| Frontend | 通知中心 | 通知展示、ACK 触发、已读消偿同步 |
| Frontend | 软键盘修饰键栏 | 修饰键 toggle/lock、组合键发送（移动端） |
| Frontend | 离线队列管理器 | 断网输入缓存、重连勾选确认发送 |
| Frontend | 弱网状态机 UI | 连接状态指示器、降频模式切换 |

---

## 9. 状态图 — 客户端连接状态机

> 三态状态机 + 过渡态 RECONNECTING。
> 参考：PRODUCT_SPEC 弱网处理、CLARIFICATIONS #12.5（各平台后台能力）。

```mermaid
stateDiagram-v2
    [*] --> DISCONNECTED: 初始状态

    DISCONNECTED --> CONNECTING: 发起连接
    CONNECTING --> CONNECTED: 认证成功
    CONNECTING --> DISCONNECTED: 认证失败/超时

    CONNECTED --> DEGRADED: 心跳超时（>15s 未收到 ack）
    CONNECTED --> DISCONNECTED: WebSocket 关闭/错误

    DEGRADED --> CONNECTED: 心跳恢复正常
    DEGRADED --> DISCONNECTED: 连接完全断开

    DISCONNECTED --> RECONNECTING: 自动重连（指数退避）
    RECONNECTING --> CONNECTED: 重连成功 + offset 重放
    RECONNECTING --> DISCONNECTED: 重连失败（达到最大退避 30s 仍失败）

    state CONNECTED {
        [*] --> 实时流
        实时流: 输出实时流式推送
        实时流: 输入立即发送 + ACK
        实时流: 心跳 15s 周期
    }

    state DEGRADED {
        [*] --> 批量推送
        批量推送: 输出每 2 秒合并推送
        批量推送: 输入带 ACK + 自动重试
        批量推送: UI 提示"网络不稳定"
    }

    state DISCONNECTED {
        [*] --> 离线模式
        离线模式: 输入存入离线队列
        离线模式: UI 提示"已离线"
        离线模式: 关键事件走推送通知
    }

    state RECONNECTING {
        [*] --> 退避重连
        退避重连: 1s → 2s → 4s → 8s → 16s → 30s
    }
```

---

## 10. 状态图 — 实例状态机

> Claude Code 实例的运行状态。每个实例独立维护。

```mermaid
stateDiagram-v2
    [*] --> CREATING: 用户请求创建实例

    CREATING --> IDLE: PTY 创建成功 + Claude Code 启动
    CREATING --> ERROR: 创建失败（目录不存在等）

    IDLE --> PROCESSING: 输入注入 PTY stdin
    PROCESSING --> IDLE: Claude 输出完成（检测到 idle prompt）
    PROCESSING --> PROCESSING: Claude 持续输出中

    IDLE --> IDLE: 队列中有输入 → dequeue → 注入 → PROCESSING

    IDLE --> TERMINATED: 用户退出（/exit 或 Ctrl+D）
    PROCESSING --> TERMINATED: Claude 进程异常退出
    ERROR --> TERMINATED: 清理资源

    TERMINATED --> [*]

    state IDLE {
        [*] --> 等待输入
        等待输入: 队列非空时自动 dequeue
        等待输入: 接受新输入入队
    }

    state PROCESSING {
        [*] --> 执行中
        执行中: 输出写入环形缓冲区
        执行中: 输出广播所有客户端
        执行中: 新输入入队等待
    }
```

---

## 11. 状态图 — 输入消息状态机

> 每条用户输入从创建到完成的生命周期。

```mermaid
stateDiagram-v2
    [*] --> PENDING: 客户端创建输入

    PENDING --> SENT: 通过 WebSocket 发送
    PENDING --> OFFLINE_QUEUED: 客户端离线

    SENT --> QUEUED: 收到 ACK（status: queued）
    SENT --> SENT: 3 秒无 ACK → 自动重试
    SENT --> FAILED: 重试多次仍失败

    OFFLINE_QUEUED --> PENDING_CONFIRM: 重连成功
    PENDING_CONFIRM --> SENT: 用户确认发送（勾选）
    PENDING_CONFIRM --> DISCARDED: 用户取消勾选

    QUEUED --> INJECTED: 实例 idle → dequeue → 注入 PTY
    QUEUED --> CANCELLED: 用户在任一设备取消
    QUEUED --> DUPLICATE: 服务端检测到重复 ID

    INJECTED --> [*]: 执行完成

    CANCELLED --> [*]
    DISCARDED --> [*]
    FAILED --> [*]
    DUPLICATE --> [*]
```

---

## 12. 状态图 — 通知事件状态机

> 通知事件从创建到最终处置的完整状态流转。
> 参考：CLARIFICATIONS #12.4（各事件类型的升级规则）。

```mermaid
stateDiagram-v2
    [*] --> CREATED: Backend 检测到需通知事件

    CREATED --> ROUTING: 开始设备优先级路由

    state ROUTING {
        [*] --> SENT_PRIORITY: 发送到优先设备
        SENT_PRIORITY --> SENT_NEXT: 30s 未 ACK → 通知下一设备
        SENT_NEXT --> SENT_NEXT: 继续下一设备
        SENT_NEXT --> ALL_OFFLINE: 所有设备已轮询/均离线
    }

    ROUTING --> ACKED: 任一设备 ACK

    ALL_OFFLINE --> WAIT_RECONNECT: 等待 2 分钟
    WAIT_RECONNECT --> ACKED: 客户端重连并 ACK

    WAIT_RECONNECT --> PUSH_SENT: APNs/FCM 推送
    PUSH_SENT --> ACKED: 用户点击推送
    PUSH_SENT --> FEISHU_SENT: 3 分钟无响应 → 飞书消息

    FEISHU_SENT --> ACKED: 用户点击深链跳转客户端审批

    FEISHU_SENT --> URGENT_SENT: 持续无响应 → 弹窗加急（仅权限审批）

    URGENT_SENT --> ACKED: 用户最终响应

    URGENT_SENT --> WAITING: 持续无响应（CC 继续等待）

    ACKED --> DISMISSED: 广播 notification_dismiss
    WAITING --> ACKED: 用户最终响应

    DISMISSED --> [*]
```

### 各事件类型的升级范围

| 事件类型 | 设备路由 | 推送 | 飞书（文本+深链） | 弹窗加急 | 超时策略 |
|---|:---:|:---:|:---:|:---:|---|
| 权限审批 | ✅ | ✅ | ✅ | ✅ | 持续等待（CC 原生行为） |
| Plan 等待审核 | ✅ | ✅ | ✅ | ✅ | 持续等待 |
| 执行出错 | ✅ | ✅ | ✅ | - | 仅通知 |
| 任务完成 | ✅ | ✅ | - | - | 仅通知 |
| 等待输入 | ✅ | ✅ | - | - | 仅通知 |
| 对话框选择 | ✅ | ✅ | ✅ | ✅ | 持续等待 |

---

## 版本记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v1.2 | 2026-02-24 | 恢复弹窗加急升级步骤：时序图 5/7、状态图 12、事件类型表新增弹窗加急列；UC18 补充弹窗加急；修正 CC 持续等待（去掉超时默认拒绝） |
| v1.1 | 2026-02-13 | 认证流程重构：去掉 localhost 免配对，改为首次配对即管理员 + 管理权转移流程；用例图 UC05 更新 |
| v1.0 | 2026-02-13 | 初始版本，12 张 Mermaid 图（1 用例 + 6 时序 + 1 模块 + 4 状态） |
