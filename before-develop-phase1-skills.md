# 阶段 1 技能需求清单

> 阶段 1 任务：合并 PRD + 用例图 + 时序图 + 模块图 + 状态图（全部 Mermaid）

---

## 技能分类

### A. 流程管理类

| 技能 | 用途 | 状态 |
|------|------|------|
| `superpowers:brainstorming` | 合并 PRD 前梳理结构、确定信息取舍 | ✅ 已安装 |
| `superpowers:writing-plans` | 制定阶段 1 的详细执行计划 | ✅ 已安装 |
| `superpowers:executing-plans` | 按计划逐步执行 | ✅ 已安装 |
| `superpowers:dispatching-parallel-agents` | 多张图可并行生成 | ✅ 已安装 |
| `superpowers:subagent-driven-development` | 用子 agent 并行写不同章节/图 | ✅ 已安装 |
| `superpowers:verification-before-completion` | 完成后校验一致性 | ✅ 已安装 |
| `superpowers:requesting-code-review` | 输出后请求审查 | ✅ 已安装 |

### B. 内容生成类

| 技能 | 用途 | 状态 |
|------|------|------|
| Mermaid 图表绘制 | 用例图、时序图、模块图、状态图、ER 图 | ❌ 未安装 |
| PRD / 产品文档写作 | 合并三份文档、结构化、消除冲突 | ❌ 未安装 |
| UML 建模规范 | 确保图表符合 UML 标准命名和关系 | ❌ 未安装 |

### C. UI/设计类（阶段 2 用，阶段 1 暂不需要）

| 技能 | 用途 | 状态 |
|------|------|------|
| `ui-ux-pro-max` | 原型设计、组件规范、配色方案 | ✅ 已安装（阶段 2 使用） |

---

## 关键缺口分析

### ❌ 1. Mermaid 图表绘制技能

**阶段 1 强依赖**，需覆盖：

- `graph TD` — 用例图（actor → use case 关系）
- `sequenceDiagram` — 6 个核心时序图
- `C4Component` 或 `graph` — 模块/组件图
- `stateDiagram-v2` — 4 个状态机
- `erDiagram` — 阶段 3 ER 图（可提前安装）
- `classDiagram` — 阶段 3 类图（可提前安装）

期望技能能力：
- 了解 Mermaid 最新语法（subgraph、note、alt/opt/loop 等）
- 能根据产品文档自动选择合适的图表类型
- 输出可直接在 GitHub/Markdown 预览中渲染的代码

### ❌ 2. PRD / 产品文档写作技能

**阶段 1 强依赖**，需覆盖：

- 多份文档合并去重（识别重复/冲突内容）
- 产品规格文档结构化（用户故事、功能需求、NFR）
- 澄清决策的内联整合（不单独列出，融入对应章节）
- 中文技术文档写作规范

### ❌ 3. UML 建模规范技能

**阶段 1 弱依赖**（有则更规范，无则用 Mermaid 常识兜底）：

- UML 2.0 标准关系类型（association、dependency、composition、aggregation）
- 用例图标准：actor 命名、include/extend 关系
- 时序图标准：同步/异步消息、生命线、activation bar

---

## 建议安装优先级

| 优先级 | 技能 | 理由 |
|--------|------|------|
| P0 必装 | Mermaid 图表绘制 | 阶段 1 的 4 类图全依赖它 |
| P0 必装 | PRD / 产品文档写作 | 合并文档是阶段 1 主要工作 |
| P1 可选 | UML 建模规范 | 能提升图表专业度，但不阻塞 |

---

## 备注

- 如果没有现成的 Mermaid/PRD 技能可安装，我也能基于模型内置知识完成，只是没有 skill 约束可能输出风格不够一致
- 阶段 2 的 `ui-ux-pro-max` 已就绪，无需额外安装
- 阶段 3 的技术设计类技能（架构设计、API 设计）后续再评估
