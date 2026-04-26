# Deferred Items Tracker: Claude Code Anywhere 随行终端

**Purpose**: 跟踪规范审查中发现但延迟处理的遗留项，确保后续阶段不遗漏
**Created**: 2026-02-14
**Source**: 原 auth-update.md (29项) + consistency.md (15项) 中未闭合的项目（源文件已在 2026-02-25 清理，遗留项已整合至此）

---

## Status Summary

| Category          | Count     | Target Phase              |
| ----------------- | --------- | ------------------------- |
| ~~Phase 1 清理~~  | ~~3~~ → 0 | ✅ 已完成（源文件已清理） |
| Phase 2 原型 & UI | 1         | Phase 2 (`UI_DESIGN.md`)  |
| Phase 3 技术设计  | 4         | Phase 3 (`/speckit.plan`) |
| **Total Open**    | **5**     | —                         |

---

## Phase 1 清理项（规范文档维护）— ✅ 已全部完成

> 源检查清单文件（requirements.md、auth-update.md、consistency.md）已在 2026-02-25 清理移除，遗留项已整合至此文档。

### ~~D-001 | 清理 Constitution Sync Impact Report~~ ✅ Done (2026-02-14)

- **Severity**: LOW
- **Action**: Follow-up TODOs 已更新为 ✅ 完成状态

### ~~D-002 | 更新旧版 requirements.md 过时引用~~ ✅ Done (2026-02-14)

- **Severity**: LOW
- **Action**: 已完成；源文件 requirements.md 已在后续清理中移除

### D-003 | WebUI 配对码管理缺少独立 FR

- **Source**: 原 auth-update.md CHK005
- **Severity**: LOW
- **Location**: `specs/001-remote-terminal/spec.md` §FR-001
- **Issue**: FR-001 提到管理员可在 WebUI 生成配对码，但无独立 FR 定义 WebUI 管理界面
- **Action**: 在阶段 2 `UI_DESIGN.md` 中为配对码管理提供独立页面/模块定义（见 `BEFORE_DEVELOPE_PLANNING_TASKS.md` §2.6）

---

## Phase 3 技术设计项（`/speckit.plan` 阶段解决）

> 这些项涉及技术实现细节，应在技术设计阶段明确。

### D-004 | server_id/instance_id 默认值格式定义

- **Source**: 原 auth-update.md CHK007
- **Severity**: MEDIUM
- **Location**: `specs/001-remote-terminal/spec.md` §FR-003a
- **Issue**: V1 阶段 server_id/instance_id 为"固定值"，具体格式未定义（如 `"default"` / `"local"` / UUID）
- **Action**: 在 plan.md 的 data-model 章节定义具体默认值格式

### D-005 | Backend → Server 术语统一

- **Source**: 原 auth-update.md CHK016 + consistency.md C01
- **Severity**: MEDIUM
- **Location**: `specs/001-remote-terminal/diagrams.md` L129,495 participant 标签
- **Issue**: diagrams 使用 "Backend" 而 constitution/spec 统一使用 "Server"
- **Action**: 在 plan.md 建立术语表；同步更新 diagrams.md 中的 participant 标签

### D-006 | V1 客户端 server_id/instance_id 字段校验行为

- **Source**: 原 auth-update.md CHK026
- **Severity**: LOW
- **Location**: `specs/001-remote-terminal/spec.md` §FR-003a
- **Issue**: V1 阶段客户端收到 server_id/instance_id 时是否需要校验（忽略 / 透传 / 断言为默认值）
- **Action**: 在 plan.md 的 contracts 章节明确客户端行为

### D-007 | V3 Hub 是否需要独立 FR

- **Source**: 原 auth-update.md CHK029
- **Severity**: LOW
- **Location**: `specs/001-remote-terminal/spec.md`
- **Issue**: V3 Hub 架构在 constitution/Edge Cases 中描述，但无独立的功能需求编号
- **Action**: 评估是否在 plan.md 中为 V3 Hub 预定义 FR（或保留为 V3 独立 spec）

---

## Already Resolved（已通过 clarify 会议解决的项）

以下项在 2026-02-13 clarify 会议中已获得用户决策并集成到 spec.md，仅作记录：

| Original ID | Issue                      | Resolution                                             |
| ----------- | -------------------------- | ------------------------------------------------------ |
| CHK001      | 管理权转移触发条件         | 单向即时，管理员直接指定（spec US-01.9, Edge Cases）   |
| CHK002      | 管理员 token 丢失恢复      | CLI `claude-anywhere admin reset`（spec Edge Cases）   |
| CHK003      | Server 重启管理员持久化    | SQLite 持久化，配对码失效（spec Edge Cases）           |
| CHK004      | 首次配对码生成时机         | 仅首次启动或 admin reset 后（spec Edge Cases）         |
| CHK006      | V3 Hub 管理员层级          | 统一管理员（spec Clarifications, Edge Cases）          |
| CHK008      | 管理权转移操作流程         | 一步单向操作，无目标确认（spec Clarifications Q1）     |
| CHK009      | 并发转移冲突处理           | 原子操作（spec Edge Cases）                            |
| CHK010      | 转移后原管理员会话         | 保留连接，失去管理权限（spec Edge Cases）              |
| CHK011      | 同时配对竞态               | 先到先得 + 一次性配对码（spec Clarifications Q4）      |
| CHK017      | 管理权转移验收场景         | US-01 场景 9-10 已补充                                 |
| CHK018      | 管理权转移独立 US          | 合并在 US-01 场景 9-10                                 |
| CHK019      | 管理权转移 SC 指标         | SC-008a 已补充（2秒完成）                              |
| CHK020      | 管理员离线非管操作         | 非管操作不依赖管理员在线（隐式解决）                   |
| CHK021      | 管理员设备永久丢失         | CLI reset + SSH/物理访问（spec Edge Cases）            |
| CHK022      | 多配对码同时有效           | 一次性配对码，每台设备独立生成（spec Edge Cases）      |
| CHK023      | 非管理员管理操作错误       | US-01 场景 10 定义拒绝行为                             |
| CHK024      | 配对码有效期内 Server 重启 | 重启后配对码失效（spec Edge Cases）                    |
| CHK025      | 管理权转移网络中断回滚     | 原子操作，中断则不生效（spec Edge Cases）              |
| C04         | 管理权转移缺验收场景       | US-01 场景 9-10 + Edge Cases                           |
| C05         | 管理权转移无 SC            | SC-008a 已补充                                         |
| C06         | 管理员设备丢失无恢复路径   | CLI reset 恢复机制已定义                               |
| C07         | 管理权转移是否需确认       | 单向即时，无需目标确认                                 |
| CHK012      | Constitution 对齐验证      | Constitution §IV 与 spec FR-001 权限列表一致（C08 ✅） |
