import type {
  ProvinceTopicFieldCoverageStatus,
  ProvinceTopicLegalStatus,
  ProvinceTopicOperationalStatus,
} from "../types";

export const PROVINCE_TOPIC_LEGAL_STATUS_LABELS: Record<
  ProvinceTopicLegalStatus,
  string
> = {
  draft: "草案",
  consultation: "征求意见",
  published: "已发布",
  effective: "已生效",
  suspended: "已暂停",
  superseded: "已替代",
  other: "其他",
};

export const PROVINCE_TOPIC_OPERATIONAL_STATUS_LABELS: Record<
  ProvinceTopicOperationalStatus,
  string
> = {
  not_started: "尚未运行",
  simulation: "模拟运行",
  trial: "试运行 / 试结算",
  continuous: "连续运行",
  suspended: "暂停运行",
  unknown: "待核实",
};

export const PROVINCE_TOPIC_FIELD_COVERAGE_LABELS: Record<
  ProvinceTopicFieldCoverageStatus,
  string
> = {
  available: "已有已核实数据",
  not_covered: "尚未覆盖",
  not_published: "官方未公布",
  not_applicable: "不适用",
  stale: "数据已过期",
  conflicting: "来源冲突",
};
