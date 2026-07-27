import type { ChinaMarketTopicId } from "@/lib/china-market/taxonomy";
import {
  PROVINCE_TOPIC_FIELD_COVERAGE_LABELS,
  PROVINCE_TOPIC_LEGAL_STATUS_LABELS,
  PROVINCE_TOPIC_OPERATIONAL_STATUS_LABELS,
} from "@/lib/china-market/status";
import type {
  ProvinceTopicFieldCoverageStatus,
  ProvinceTopicLegalStatus,
  ProvinceTopicOperationalStatus,
} from "@/lib/types";

import type { DisplayLocale } from "./locale";

type TopicCopy = {
  shortLabel: string;
  title: string;
  description: string;
  fields: Record<string, { label: string; description: string }>;
};

const EN_TOPIC_COPY: Record<ChinaMarketTopicId, TopicCopy> = {
  "trading-rules": {
    shortLabel: "Trading rules",
    title: "Power market trading rules",
    description:
      "Record day-ahead, real-time, ancillary, and retail market rules separately. Trial operation never implies formal operation.",
    fields: {
      spot_day_ahead_rule: {
        label: "Day-ahead spot rules",
        description: "Rule name, operating stage, and scope.",
      },
      spot_real_time_rule: {
        label: "Real-time spot rules",
        description: "Real-time market rules, operating stage, and scope.",
      },
      ancillary_trading_rule: {
        label: "Ancillary service trading rules",
        description: "Ancillary market rules and linkage to the spot market.",
      },
      retail_trading_rule: {
        label: "Retail market rules",
        description: "Retail access, trading, and settlement rules.",
      },
    },
  },
  "storage-capacity-compensation": {
    shortLabel: "Capacity pay",
    title: "Storage capacity compensation (revenue)",
    description:
      "Keep compensation amount, assessment, subsidy duration, and conversion coefficients separate. Do not mix with transmission/distribution capacity tariffs.",
    fields: {
      compensation_amount: {
        label: "Compensation amount",
        description: "Preserve original pricing unit, basis, and eligible resources.",
      },
      assessment_mechanism: {
        label: "Assessment mechanism",
        description: "Availability, response, or other assessment and deduction rules.",
      },
      subsidy_duration: {
        label: "Subsidy duration",
        description: "Policy commitment period or project applicability window.",
      },
      equivalent_conversion_coefficient: {
        label: "Equivalent conversion coefficient",
        description: "Capacity conversion basis, coefficient, and calculation boundary.",
      },
    },
  },
  "ancillary-services": {
    shortLabel: "Ancillary",
    title: "Ancillary service products and amounts",
    description:
      "Product existence, storage eligibility, and published prices are three independent facts, each needing source evidence.",
    fields: {
      service_products: {
        label: "Service products",
        description: "Local formal product names such as frequency regulation, reserve, or peak shaving.",
      },
      storage_eligibility: {
        label: "Storage eligibility",
        description: "Access and technical conditions for independent or joint storage entities.",
      },
      compensation_standard: {
        label: "Compensation amount / price",
        description: "Amount, price bounds, or compensation standard with original units.",
      },
      settlement_and_assessment: {
        label: "Settlement and assessment",
        description: "Pricing basis, settlement cycle, and performance assessment requirements.",
      },
    },
  },
  "fourth-regulatory-cycle-grid-cost": {
    shortLabel: "4th cycle",
    title: "4th-cycle T&D capacity / demand tariffs (grid cost)",
    description:
      "Keep capacity tariff, demand tariff, and line-loss rate as independent fields, with voltage class and regulatory period.",
    fields: {
      grid_capacity_tariff: {
        label: "T&D capacity tariff",
        description: "Fourth-cycle grid capacity tariff and pricing unit.",
      },
      grid_demand_tariff: {
        label: "T&D demand tariff",
        description: "Fourth-cycle grid demand tariff and pricing unit.",
      },
      line_loss_rate: {
        label: "Line-loss rate",
        description: "Approved line-loss rate by voltage class or applicable scope.",
      },
      voltage_scope_and_period: {
        label: "Voltage class and applicable period",
        description: "Voltage class, effective window, and customer category.",
      },
    },
  },
  "storage-operating-costs": {
    shortLabel: "OpEx",
    title: "Storage system operating costs",
    description:
      "Record only publicly evidenced system operating fees. Do not substitute spreads or industry averages.",
    fields: {
      cost_item: {
        label: "Cost item",
        description: "Fee name as stated in the policy or rule source.",
      },
      cost_standard: {
        label: "Cost standard",
        description: "Amount, rate, and original unit.",
      },
      pricing_basis: {
        label: "Pricing basis",
        description: "Charged by capacity, energy, calls, duration, or another basis.",
      },
      applicable_scope: {
        label: "Scope and effective period",
        description: "Eligible entities, voltage class, scenarios, and validity window.",
      },
    },
  },
  "green-power-direct-connection": {
    shortLabel: "Green direct",
    title: "Green power direct-connection policy",
    description:
      "Verify policy publication, project access, approval/filing, and source-load-storage requirements separately.",
    fields: {
      policy_status: {
        label: "Policy status",
        description: "Draft, consultation, published, or effective status.",
      },
      eligible_projects: {
        label: "Eligible projects",
        description: "Project types, customer scope, and access conditions.",
      },
      approval_and_filing: {
        label: "Approval / filing requirements",
        description: "Competent authority, process, and key prerequisites.",
      },
      source_load_storage_requirements: {
        label: "Source-load-storage requirements",
        description: "Green power source, load relationship, and storage configuration boundary.",
      },
      effective_date: {
        label: "Effective date",
        description: "Effective date explicitly stated in the formal document.",
      },
    },
  },
  "retail-rules": {
    shortLabel: "Retail",
    title: "Retail rules and floating ratios",
    description:
      "Store upper bound, lower bound, benchmark, and settlement rules separately to avoid silent cross-basis comparisons.",
    fields: {
      retail_access_rule: {
        label: "Retail access rules",
        description: "Access conditions for retailers, customers, and aggregators.",
      },
      floating_upper_ratio: {
        label: "Floating ratio upper bound",
        description: "Upward float versus an explicit benchmark.",
      },
      floating_lower_ratio: {
        label: "Floating ratio lower bound",
        description: "Downward float versus an explicit benchmark.",
      },
      pricing_benchmark: {
        label: "Floating benchmark",
        description: "Coal benchmark, market average, or another rule-defined benchmark.",
      },
      settlement_rule: {
        label: "Settlement and execution rules",
        description: "Settlement cycle, deviation handling, effective date, and eligible customers.",
      },
    },
  },
};

const EN_LEGAL: Record<ProvinceTopicLegalStatus, string> = {
  draft: "Draft",
  consultation: "Consultation",
  published: "Published",
  effective: "Effective",
  suspended: "Suspended",
  superseded: "Superseded",
  other: "Other",
};

const EN_OPERATIONAL: Record<ProvinceTopicOperationalStatus, string> = {
  not_started: "Not started",
  simulation: "Simulation",
  trial: "Trial / pilot settlement",
  continuous: "Continuous operation",
  suspended: "Suspended",
  unknown: "To be verified",
};

const EN_COVERAGE: Record<ProvinceTopicFieldCoverageStatus, string> = {
  available: "Verified data available",
  not_covered: "Not yet covered",
  not_published: "Not officially published",
  not_applicable: "Not applicable",
  stale: "Stale data",
  conflicting: "Conflicting sources",
};

export function chinaTopicCopy(
  topicId: ChinaMarketTopicId,
  locale: DisplayLocale,
): TopicCopy | null {
  if (locale !== "en") return null;
  return EN_TOPIC_COPY[topicId] ?? null;
}

export function legalStatusLabel(
  status: ProvinceTopicLegalStatus | null | undefined,
  locale: DisplayLocale,
): string {
  if (!status) return "—";
  if (locale === "en") return EN_LEGAL[status] ?? status;
  return PROVINCE_TOPIC_LEGAL_STATUS_LABELS[status] ?? status;
}

export function operationalStatusLabel(
  status: ProvinceTopicOperationalStatus | null | undefined,
  locale: DisplayLocale,
): string {
  if (!status) return "—";
  if (locale === "en") return EN_OPERATIONAL[status] ?? status;
  return PROVINCE_TOPIC_OPERATIONAL_STATUS_LABELS[status] ?? status;
}

export function fieldCoverageLabel(
  status: ProvinceTopicFieldCoverageStatus | null | undefined,
  locale: DisplayLocale,
): string {
  if (!status) return "—";
  if (locale === "en") return EN_COVERAGE[status] ?? status;
  return PROVINCE_TOPIC_FIELD_COVERAGE_LABELS[status] ?? status;
}
