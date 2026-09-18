import {
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const businesses = pgTable("businesses", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  location: text("location").notNull(),
  monthlyBudget: integer("monthly_budget").notNull(),
  brandNotes: text("brand_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const goals = pgTable("goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  text: text("text").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const runs = pgTable("runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  goalId: uuid("goal_id")
    .notNull()
    .references(() => goals.id),
  stage: text("stage").notNull().default("pending"),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
});

export const researchReports = pgTable("research_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id),
  output: jsonb("output").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const strategies = pgTable("strategies", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id),
  output: jsonb("output").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const creatives = pgTable("creatives", {
  id: uuid("id").defaultRandom().primaryKey(),
  strategyId: uuid("strategy_id")
    .notNull()
    .references(() => strategies.id),
  output: jsonb("output").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Nullable: MockMetaAds.createCampaign(spec) — per the documented AdsPlatform interface — has no
   * strategy id to attach. The real pipeline (Phase 6) sets this when it persists the row itself. */
  strategyId: uuid("strategy_id").references(() => strategies.id),
  spec: jsonb("spec").notNull(),
  externalId: text("external_id"),
  status: text("status").notNull().default("pending_launch"),
  dailyBudget: integer("daily_budget").notNull(),
  /** Current per-creative allocation weights, mutated by AdsPlatform.setCreativeAllocation. Null = equal split. */
  creativeWeights: jsonb("creative_weights"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaignMetrics = pgTable("campaign_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  creativeId: uuid("creative_id")
    .notNull()
    .references(() => creatives.id),
  date: timestamp("date").notNull(),
  impressions: integer("impressions").notNull(),
  clicks: integer("clicks").notNull(),
  spend: numeric("spend", { precision: 10, scale: 2 }).notNull(),
  conversions: integer("conversions").notNull(),
});

export const observations = pgTable("observations", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  windowStart: timestamp("window_start").notNull(),
  windowEnd: timestamp("window_end").notNull(),
  output: jsonb("output").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recommendations = pgTable("recommendations", {
  id: uuid("id").defaultRandom().primaryKey(),
  observationId: uuid("observation_id")
    .notNull()
    .references(() => observations.id),
  output: jsonb("output").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const policyDecisions = pgTable("policy_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: text("action").notNull(),
  params: jsonb("params").notNull(),
  decision: text("decision").notNull(),
  ruleId: text("rule_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  subjectType: text("subject_type").notNull(),
  subjectId: uuid("subject_id").notNull(),
  status: text("status").notNull().default("pending"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const actions = pgTable("actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  recommendationId: uuid("recommendation_id").references(
    () => recommendations.id,
  ),
  adapter: text("adapter").notNull(),
  method: text("method").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const llmCalls = pgTable("llm_calls", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id").references(() => runs.id),
  stage: text("stage").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  costInr: numeric("cost_inr", { precision: 10, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const toolCalls = pgTable("tool_calls", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id").references(() => runs.id),
  tool: text("tool").notNull(),
  input: jsonb("input").notNull(),
  output: jsonb("output"),
  latencyMs: integer("latency_ms").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mockCompetitors = pgTable("mock_competitors", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  name: text("name").notNull(),
  area: text("area").notNull(),
  cuisine: text("cuisine").notNull(),
  priceBand: text("price_band").notNull(),
  instagramFollowers: integer("instagram_followers").notNull(),
  rating: numeric("rating", { precision: 2, scale: 1 }).notNull(),
});

export const mockReviews = pgTable("mock_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  subjectType: text("subject_type").notNull(),
  subjectId: uuid("subject_id").notNull(),
  author: text("author").notNull(),
  rating: integer("rating").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const mockSearchFixtures = pgTable("mock_search_fixtures", {
  id: uuid("id").defaultRandom().primaryKey(),
  queryPattern: text("query_pattern").notNull(),
  results: jsonb("results").notNull(),
});

export type Business = typeof businesses.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Run = typeof runs.$inferSelect;
// Suffixed with "Row" to avoid colliding with the same-named content types in lib/schemas/.
export type StrategyRow = typeof strategies.$inferSelect;
export type CreativeRow = typeof creatives.$inferSelect;
export type CampaignRow = typeof campaigns.$inferSelect;
export type CampaignMetricRow = typeof campaignMetrics.$inferSelect;
export type MockCompetitorRow = typeof mockCompetitors.$inferSelect;
export type MockReviewRow = typeof mockReviews.$inferSelect;
export type MockSearchFixtureRow = typeof mockSearchFixtures.$inferSelect;
