# Grid Ledger MVP 数据字典

本文档对应 `202607220001`—`202607220010` 迁移，包括 GL-MVP-001 正式表、地区目录，以及 GL-MVP-002 私有导入暂存、批准事务、Excel 行去重和受信任运维权限。对外读取边界由 PostgreSQL Row Level Security（RLS）强制，不仅依赖前端过滤。

## 枚举

### `region_type`

| 值 | 含义 |
| --- | --- |
| `global` | 全球根节点 |
| `continent` | 大洲；全球市场的第一层目录 |
| `country` | 国家；大洲下的代表市场 |
| `province` | 省级地区；中国 MVP 下钻层级 |

### `review_status`

| 值 | 含义 | 公开可见 |
| --- | --- | --- |
| `ai_draft` | AI/程序刚生成、尚未进入人工复核的内部状态 | 否 |
| `pending_review` | 人工录入草稿/待审核，新建记录默认值 | 否 |
| `published` | 已完成人工确认并发布 | 是 |
| `rejected` | 已驳回 | 否 |

### `normalized_status`

`draft` 、`consultation` 、`filed` 、`approved` 、`effective` 、`suspended` 、`other` 为七个互相独立的值。`filed` 不等于 `approved`，`draft` / `consultation` 不等于 `effective`。不允许使用某一状态代替另一状态。

### 导入枚举

- `import_input_type`：`url` / `pdf` / `excel`（CSV 归入 `excel`）。
- `import_job_status`：`pending` / `processing` / `review` / `completed` / `partial_failed` / `failed`。
- `import_target_type`：`signal` / `market_metric` / `unknown`。
- `import_item_review_status`：`ai_draft` / `pending_review` / `approved` / `rejected` / `import_failed`。

## `regions`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | 是 | 主键，默认随机 UUID |
| `slug` | `text` | 是 | 公开路由键，全局唯一 |
| `code` | `text` | 否 | 稳定代码；非空值全局唯一 |
| `name_zh` | `text` | 是 | 中文名 |
| `name_en` | `text` | 否 | 英文名 |
| `region_type` | `region_type` | 是 | `global` / `continent` / `country` / `province` |
| `parent_id` | `uuid` | 否 | 自关联父节点；全球节点必须为空 |
| `is_demo` | `boolean` | 是 | 是否为演示/fixture 记录 |
| `created_at` | `timestamptz` | 是 | 创建时间 |
| `updated_at` | `timestamptz` | 是 | 更新时间，由触发器自动维护 |

初始 seed 的层级为 `全球 → 六大洲 → 24 个代表国家 → 中国大陆 31 个省级行政区`。中国的父节点为亚洲，31 个省级节点的直接父节点仍为中国；其他国家暂不建立省级层级。六大洲指亚洲、欧洲、北美洲、南美洲、大洋洲、非洲，不建立南极洲市场目录。目录记录全部显式标记为 Demo/参考项，但真实 Signal 不会因其 Region 为 Demo 而继承 Demo 标记。

## `signals`

| 字段 | 类型 | 草稿可空 | 发布必填 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | 否 | 是 | 主键 |
| `region_id` | `uuid` | 是 | 是 | 所属地区 |
| `signal_type` | `text` | 否 | 否 | 信号类型，默认 `policy` |
| `title` | `text` | 是 | 是 | 标题；发布时不允许空白字符串 |
| `summary` | `text` | 是 | 是 | 摘要；发布时不允许空白字符串 |
| `category` | `text` | 是 | 否 | 业务分类 |
| `original_status` | `text` | 是 | 否 | 原文状态描述，不覆盖标准化状态 |
| `normalized_status` | `normalized_status` | 是 | 是 | 人工确认的标准化状态 |
| `event_date` | `date` | 是 | 否 | 事件日期 |
| `effective_date` | `date` | 是 | 否 | 生效日期；不能根据 filed/approved 自动推断 |
| `impact_channel` | `text` | 是 | 否 | 影响渠道 |
| `impact_direction` | `text` | 是 | 否 | 影响方向 |
| `impact_level` | `text` | 是 | 否 | 影响等级 |
| `source_url` | `text` | 是 | 是 | 原文链接；发布时不允许空白字符串 |
| `source_name` | `text` | 是 | 否 | 来源名称 |
| `reviewer_note` | `text` | 是 | 是 | 人工审核说明；发布时不允许空白字符串 |
| `review_status` | `review_status` | 否 | 是 | 审核状态，默认 `pending_review` |
| `published_at` | `timestamptz` | 是 | 是 | 发布时间 |
| `reviewer_id` | `uuid` | 是 | 是 | 审核人 UUID |
| `reviewed_at` | `timestamptz` | 是 | 是 | 人工审核时间 |
| `created_by` | `uuid` | 是 | 否 | 创建人 UUID |
| `is_demo` | `boolean` | 否 | 是 | 演示数据标记 |
| `created_at` | `timestamptz` | 否 | 是 | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 是 | 更新时间，由触发器自动维护 |

发布约束由 `signals_published_fields_required` 在数据库层执行。即使绕过应用校验，缺少 `region_id`、`title`、`summary`、`source_url`、`normalized_status`、`reviewer_note`、`reviewer_id`、`reviewed_at` 或 `published_at` 中任一项的记录也无法设为 `published`。

`signals_published_source_is_http` 只允许已发布记录使用 HTTP(S) 原文链接。`signals_bind_reviewer` 触发器会在认证管理员发布或更新已发布记录时，用当前 `auth.uid()` 和数据库时间覆盖客户端提交的 `reviewer_id` / `reviewed_at`；客户端不能伪造审核身份。受信任的本地 seed/service role 可保留明确的 Demo 审核 UUID。

`reviewer_id` 和 `created_by` 故意不对 `auth.users` 建立外键：生产操作存储 Auth 用户 UUID；seed 则使用明确标注的固定 DEMO UUID，且不会创建伪造的账号。

## `market_metrics`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | 是 | 主键 |
| `region_id` | `uuid` | 是 | 所属地区 |
| `metric_key` | `text` | 是 | 稳定机器键 |
| `label` | `text` | 是 | 界面显示名 |
| `value` | `numeric` | 否 | 指标数值；缺失时必须保留 `NULL`，禁止转为 `0` |
| `unit` | `text` | 否 | 单位 |
| `period_label` | `text` | 否 | 期间/预测窗口标签 |
| `as_of_date` | `date` | 否 | 数据时点 |
| `source_url` | `text` | 否 | 来源链接 |
| `source_name` | `text` | 否 | 来源名 |
| `notes` | `text` | 否 | 口径、覆盖或数据不足说明 |
| `is_demo` | `boolean` | 是 | 演示数据标记 |
| `is_published` | `boolean` | 是 | 是否允许公开读取 |
| `created_at` | `timestamptz` | 是 | 创建时间 |
| `updated_at` | `timestamptz` | 是 | 更新时间，由触发器自动维护 |

seed 中的市场指标仅为工程夹具：`is_demo = true`、`value = NULL`，标题和备注都显式标记 `DEMO`。它们不表示真实市场数据。

## `import_jobs`

私有导入任务。保存输入类型、URL/文件名、私有 Storage 路径、MIME/大小、原文件与内容 SHA-256、提取文本、工作表预览/映射等 `input_metadata`、任务计数、失败阶段、用户错误、私有技术错误、重试标记以及创建人/时间。URL 使用 normalized/canonical/content hash 基础去重；PDF/XLSX/CSV 使用原文件 hash 去重。Excel/CSV 另有生成列 `workbook_source_key`，只对原文件名做大小写与首尾空白归一，用于保守界定“同源工作簿”。

## `import_items`

私有候选记录。每项保存任务外键、目标类型、URL/PDF 页码/Excel 工作表与原始行、原始行 hash、原始数据、提取文本、结构化结果、管理员可编辑副本、证据、置信度、warnings、模型/响应/提示版本、审核状态和正式记录的类型安全外键。

Excel 的 `raw_row_hash` 使用键排序后的 JSON 计算 SHA-256，保留字符串空白，并严格区分 `NULL` 与数值 `0`。处理同源更新版时，仅在目标类型、sheet、原始行位置与原始行 JSON 都相同，且历史项仍为 `ai_draft`、`pending_review` 或 `approved` 时跳过；`rejected` 和 `import_failed` 不会永久屏蔽重新导入。历史 Job/Item ID、跳过行和提示写入 `input_metadata.excel_row_deduplication`。数据库还以 JSONB 相等做碰撞安全及旧 hash 兼容检查，不建立跨工作簿的全局唯一约束。

`ai_result` 保留首次结构化结果（URL/PDF 为 AI 严格输出，Excel 为已确认映射后的确定性结果），管理员修改写入 `draft_data`。批准必须调用 `approve_import_item(...)`：数据库事务校验管理员、地区、必填字段、状态枚举、数值/单位以及 PDF/Excel 证据位置，然后创建 `pending_review` Signal 或 `is_published = false` Metric，并回写 `approved_record_id`。重复批准幂等，不能自动发布。

## 私有 Storage

bucket `grid-ledger-imports` 为 private。对象路径为 `{auth.uid()}/{import_job_id}/{随机文件名}`；只有管理员可插入和签名读取，匿名用户没有对象策略。应用签名链接有效期短，并以下载方式提供原文件。

## RLS 与权限

- `anon` 和普通 `authenticated` 只能读取地区、`review_status = 'published'` 且已有 `published_at` 的 Signal，以及 `is_published = true` 的市场指标。
- 草稿、待审、驳回 Signal 不可通过 anon/普通登录身份读取。
- `import_jobs`、`import_items` 和 `grid-ledger-imports` 对匿名及普通登录用户均不可读写；只有管理员可访问。
- 管理员读写权限只认 JWT `app_metadata.role = 'admin'`；不读取用户可自行修改的 `user_metadata`。
- `anon` 对 Signal 仅有公开列权限，不可直接读取 `reviewer_id` 或 `created_by`；Next Viewer API 同样使用显式 DTO 白名单。
- seed 不创建 Auth 用户或存储明文密码。管理员账号应在部署时由受信任的服务端流程创建，并将角色写入 `app_metadata`。
