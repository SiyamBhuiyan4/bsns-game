// Prisma-compatible client backed by the Telegram snapshot store (see telegram-store.ts).
// The app keeps calling prisma.<model>.<method>(...); data lives in the Telegram channel.
// Enums and Prisma.* types still come from @prisma/client (generated, never connected to a DB).

import { randomUUID } from 'crypto';
import { mutateSnapshot, readSnapshot, type Snapshot } from './telegram-store';

type Row = Record<string, any>;
type ModelName =
  | 'user' | 'groupSection' | 'groupLink' | 'csvUploadBatch' | 'assignment' | 'linkCompletion'
  | 'product' | 'dailyProductSale' | 'campaign' | 'dailyEntry' | 'dailyText' | 'lead' | 'leadNote'
  | 'sectionTarget' | 'budgetLimit' | 'scoringSettings' | 'weeklyReport' | 'weeklyReportAnswer'
  | 'monthlyReport' | 'plan' | 'planPhase' | 'planTask' | 'planMilestone' | 'auditLog' | 'agentPhrase';

type ModelDef = {
  table: string; // Pascal name used in relations
  dates: string[]; // DateTime / @db.Date fields
  defaults: Row | ((r: Row) => Row); // values applied on create (id/uuid handled separately)
  unique: string[][]; // unique constraints (single field = [field])
  hasUpdatedAt?: boolean;
  relations: Record<string, { to: ModelName; fk: string; many?: boolean }>;
};

const NOW = () => new Date();

const MODELS: Record<ModelName, ModelDef> = {
  user: {
    table: 'User', dates: ['created_at', 'updated_at'], hasUpdatedAt: true,
    defaults: { role: 'EMPLOYEE', phone: null, is_active: true, created_at: NOW },
    unique: [['email']],
    relations: {
      assignments_as_employee: { to: 'assignment', fk: 'employee_id', many: true },
      assignments_as_admin: { to: 'assignment', fk: 'assigned_by', many: true },
      link_completions: { to: 'linkCompletion', fk: 'employee_id', many: true },
      daily_entries: { to: 'dailyEntry', fk: 'employee_id', many: true },
      daily_texts: { to: 'dailyText', fk: 'employee_id', many: true },
      product_sales: { to: 'dailyProductSale', fk: 'employee_id', many: true },
      leads: { to: 'lead', fk: 'owner_id', many: true },
      lead_notes: { to: 'leadNote', fk: 'author_id', many: true },
      targets_set: { to: 'sectionTarget', fk: 'set_by', many: true },
      budgets_set: { to: 'budgetLimit', fk: 'set_by', many: true },
      campaigns: { to: 'campaign', fk: 'owner_id', many: true },
      plans: { to: 'plan', fk: 'created_by', many: true },
      assigned_tasks: { to: 'planTask', fk: 'owner_id', many: true },
      audit_logs: { to: 'auditLog', fk: 'actor_id', many: true },
      csv_batches: { to: 'csvUploadBatch', fk: 'uploaded_by', many: true },
      weekly_reports: { to: 'weeklyReport', fk: 'created_by', many: true },
      weekly_report_answers: { to: 'weeklyReportAnswer', fk: 'updated_by', many: true },
      monthly_reports: { to: 'monthlyReport', fk: 'created_by', many: true },
    },
  },
  groupSection: {
    table: 'GroupSection', dates: ['created_at', 'updated_at'], hasUpdatedAt: true,
    defaults: { description: null, is_active: true, created_at: NOW },
    unique: [['name']],
    relations: {
      group_links: { to: 'groupLink', fk: 'section_id', many: true },
      assignments: { to: 'assignment', fk: 'section_id', many: true },
      section_targets: { to: 'sectionTarget', fk: 'section_id', many: true },
      csv_batches: { to: 'csvUploadBatch', fk: 'section_id', many: true },
    },
  },
  groupLink: {
    table: 'GroupLink', dates: ['created_at'], defaults: { title: null, uploaded_batch_id: null, is_active: true, created_at: NOW },
    unique: [['section_id', 'url']],
    relations: {
      section: { to: 'groupSection', fk: 'section_id' },
      uploaded_batch: { to: 'csvUploadBatch', fk: 'uploaded_batch_id' },
      completions: { to: 'linkCompletion', fk: 'group_link_id', many: true },
    },
  },
  csvUploadBatch: {
    table: 'CsvUploadBatch', dates: ['created_at'], defaults: { created_at: NOW }, unique: [],
    relations: {
      section: { to: 'groupSection', fk: 'section_id' },
      uploader: { to: 'user', fk: 'uploaded_by' },
      links: { to: 'groupLink', fk: 'uploaded_batch_id', many: true },
    },
  },
  assignment: {
    table: 'Assignment', dates: ['created_at'], defaults: { post_limit: null, created_at: NOW }, unique: [['employee_id', 'section_id']],
    relations: {
      employee: { to: 'user', fk: 'employee_id' },
      section: { to: 'groupSection', fk: 'section_id' },
      admin: { to: 'user', fk: 'assigned_by' },
    },
  },
  linkCompletion: {
    table: 'LinkCompletion', dates: ['completed_at', 'undone_at'], defaults: { completed_at: NOW, undone_at: null }, unique: [],
    relations: {
      group_link: { to: 'groupLink', fk: 'group_link_id' },
      employee: { to: 'user', fk: 'employee_id' },
    },
  },
  product: {
    table: 'Product', dates: ['created_at', 'updated_at'], hasUpdatedAt: true, defaults: { is_active: true, created_at: NOW }, unique: [],
    relations: {
      sales: { to: 'dailyProductSale', fk: 'product_id', many: true },
      campaigns: { to: 'campaign', fk: 'product_id', many: true },
      leads: { to: 'lead', fk: 'product_id', many: true },
    },
  },
  dailyProductSale: {
    table: 'DailyProductSale', dates: ['entry_date', 'created_at', 'updated_at'], hasUpdatedAt: true, defaults: { created_at: NOW },
    unique: [['employee_id', 'entry_date', 'product_id']],
    relations: {
      employee: { to: 'user', fk: 'employee_id' },
      product: { to: 'product', fk: 'product_id' },
    },
  },
  campaign: {
    table: 'Campaign', dates: ['start_date', 'end_date', 'created_at'],
    defaults: { product_id: null, end_date: null, status: 'PLANNED', created_at: NOW }, unique: [],
    relations: {
      product: { to: 'product', fk: 'product_id' },
      owner: { to: 'user', fk: 'owner_id' },
      leads: { to: 'lead', fk: 'campaign_id', many: true },
      budgets: { to: 'budgetLimit', fk: 'campaign_id', many: true },
    },
  },
  dailyEntry: {
    table: 'DailyEntry', dates: ['entry_date', 'created_at', 'updated_at'], hasUpdatedAt: true,
    defaults: { note: null, created_at: NOW }, unique: [['employee_id', 'entry_date', 'metric_type']],
    relations: { employee: { to: 'user', fk: 'employee_id' } },
  },
  dailyText: {
    table: 'DailyText', dates: ['entry_date', 'created_at', 'updated_at'], hasUpdatedAt: true,
    defaults: { main_issue: null, next_priorities: null, created_at: NOW }, unique: [['employee_id', 'entry_date']],
    relations: { employee: { to: 'user', fk: 'employee_id' } },
  },
  lead: {
    table: 'Lead', dates: ['next_followup_date', 'created_at', 'updated_at'], hasUpdatedAt: true,
    defaults: {
      address: null, buyer_type: 'RETAIL', product_id: null, campaign_id: null, status: 'NEW',
      quality_rating: null, expected_value: null, order_amount: null, lost_reason: null,
      next_followup_date: null, created_at: NOW,
    },
    unique: [],
    relations: {
      owner: { to: 'user', fk: 'owner_id' },
      product: { to: 'product', fk: 'product_id' },
      campaign: { to: 'campaign', fk: 'campaign_id' },
      notes: { to: 'leadNote', fk: 'lead_id', many: true },
    },
  },
  leadNote: {
    table: 'LeadNote', dates: ['created_at'], defaults: { created_at: NOW }, unique: [],
    relations: {
      lead: { to: 'lead', fk: 'lead_id' },
      author: { to: 'user', fk: 'author_id' },
    },
  },
  sectionTarget: {
    table: 'SectionTarget', dates: ['period_start', 'period_end', 'created_at', 'updated_at'], hasUpdatedAt: true,
    defaults: { period_type: 'MONTHLY', period_start: null, period_end: null, employee_id: null, off_days: [], created_at: NOW }, unique: [],
    relations: {
      section: { to: 'groupSection', fk: 'section_id' },
      creator: { to: 'user', fk: 'set_by' },
      employee: { to: 'user', fk: 'employee_id' },
    },
  },
  budgetLimit: {
    table: 'BudgetLimit', dates: ['created_at', 'updated_at'], hasUpdatedAt: true,
    defaults: { scope: 'MONTHLY_TOTAL', campaign_id: null, month: null, created_at: NOW }, unique: [],
    relations: {
      campaign: { to: 'campaign', fk: 'campaign_id' },
      setter: { to: 'user', fk: 'set_by' },
    },
  },
  scoringSettings: {
    table: 'ScoringSettings', dates: ['updated_at'], hasUpdatedAt: true,
    defaults: {
      id: 'default', achievement_cap: 1.0, failing_threshold: 0.8, undo_enabled: true,
      employee_edit_window_days: 1, weekly_report_day: 'SUNDAY', weekly_report_time: '09:00',
      language_default: 'bn', digit_style: 'bn',
    },
    unique: [['id']],
    relations: {},
  },
  weeklyReport: {
    table: 'WeeklyReport', dates: ['week_start', 'week_end', 'published_at', 'created_at', 'updated_at'], hasUpdatedAt: true,
    defaults: { status: 'DRAFT', published_at: null, created_at: NOW }, unique: [['week_start']],
    relations: {
      creator: { to: 'user', fk: 'created_by' },
      answers: { to: 'weeklyReportAnswer', fk: 'weekly_report_id', many: true },
    },
  },
  weeklyReportAnswer: {
    table: 'WeeklyReportAnswer', dates: ['updated_at'], hasUpdatedAt: true, defaults: {},
    unique: [['weekly_report_id', 'question_no']],
    relations: {
      report: { to: 'weeklyReport', fk: 'weekly_report_id' },
      updater: { to: 'user', fk: 'updated_by' },
    },
  },
  monthlyReport: {
    table: 'MonthlyReport', dates: ['finalized_at', 'created_at', 'updated_at'], hasUpdatedAt: true,
    defaults: { status: 'DRAFT', summary_text: null, next_month_goal: null, next_month_budget: null, finalized_at: null, created_at: NOW },
    unique: [['month']],
    relations: { creator: { to: 'user', fk: 'created_by' } },
  },
  plan: {
    table: 'Plan', dates: ['start_date', 'created_at'], defaults: { status: 'ACTIVE', created_at: NOW }, unique: [],
    relations: {
      creator: { to: 'user', fk: 'created_by' },
      phases: { to: 'planPhase', fk: 'plan_id', many: true },
      tasks: { to: 'planTask', fk: 'plan_id', many: true },
      milestones: { to: 'planMilestone', fk: 'plan_id', many: true },
    },
  },
  planPhase: {
    table: 'PlanPhase', dates: ['created_at'], defaults: { created_at: NOW }, unique: [],
    relations: {
      plan: { to: 'plan', fk: 'plan_id' },
      tasks: { to: 'planTask', fk: 'phase_id', many: true },
      milestones: { to: 'planMilestone', fk: 'phase_id', many: true },
    },
  },
  planTask: {
    table: 'PlanTask', dates: ['due_date', 'created_at', 'updated_at'], hasUpdatedAt: true,
    defaults: { description: null, owner_id: null, due_date: null, status: 'NOT_STARTED', progress_percent: 0, outcome_note: null, created_at: NOW },
    unique: [],
    relations: {
      plan: { to: 'plan', fk: 'plan_id' },
      phase: { to: 'planPhase', fk: 'phase_id' },
      owner: { to: 'user', fk: 'owner_id' },
    },
  },
  planMilestone: {
    table: 'PlanMilestone', dates: ['reviewed_at'], defaults: { achieved_result: null, status: 'PENDING', reviewed_at: null }, unique: [],
    relations: {
      plan: { to: 'plan', fk: 'plan_id' },
      phase: { to: 'planPhase', fk: 'phase_id' },
    },
  },
  // Phrases the admin has taught the assistant (not in schema.prisma; Telegram store only).
  agentPhrase: {
    table: 'AgentPhrase', dates: ['created_at'], defaults: { created_at: NOW }, unique: [['phrase']],
    relations: {},
  },
  auditLog: {
    table: 'AuditLog', dates: ['created_at'], defaults: { actor_id: null, entity_id: null, payload: null, created_at: NOW }, unique: [],
    relations: { actor: { to: 'user', fk: 'actor_id' } },
  },
};

// onDelete behaviour from the schema: parent model -> children that are removed or nulled with it.
const CASCADE: Partial<Record<ModelName, { child: ModelName; fk: string; action: 'cascade' | 'setNull' }[]>> = {
  user: [
    { child: 'assignment', fk: 'employee_id', action: 'cascade' },
    { child: 'linkCompletion', fk: 'employee_id', action: 'cascade' },
    { child: 'dailyEntry', fk: 'employee_id', action: 'cascade' },
    { child: 'dailyText', fk: 'employee_id', action: 'cascade' },
    { child: 'dailyProductSale', fk: 'employee_id', action: 'cascade' },
    { child: 'lead', fk: 'owner_id', action: 'cascade' },
    { child: 'planTask', fk: 'owner_id', action: 'setNull' },
    { child: 'auditLog', fk: 'actor_id', action: 'setNull' },
  ],
  groupSection: [
    { child: 'groupLink', fk: 'section_id', action: 'cascade' },
    { child: 'assignment', fk: 'section_id', action: 'cascade' },
    { child: 'sectionTarget', fk: 'section_id', action: 'cascade' },
    { child: 'csvUploadBatch', fk: 'section_id', action: 'cascade' },
  ],
  groupLink: [{ child: 'linkCompletion', fk: 'group_link_id', action: 'cascade' }],
  csvUploadBatch: [{ child: 'groupLink', fk: 'uploaded_batch_id', action: 'setNull' }],
  product: [
    { child: 'dailyProductSale', fk: 'product_id', action: 'cascade' },
    { child: 'campaign', fk: 'product_id', action: 'setNull' },
    { child: 'lead', fk: 'product_id', action: 'setNull' },
  ],
  campaign: [
    { child: 'lead', fk: 'campaign_id', action: 'setNull' },
    { child: 'budgetLimit', fk: 'campaign_id', action: 'cascade' },
  ],
  lead: [{ child: 'leadNote', fk: 'lead_id', action: 'cascade' }],
  weeklyReport: [{ child: 'weeklyReportAnswer', fk: 'weekly_report_id', action: 'cascade' }],
  plan: [
    { child: 'planPhase', fk: 'plan_id', action: 'cascade' },
    { child: 'planTask', fk: 'plan_id', action: 'cascade' },
    { child: 'planMilestone', fk: 'plan_id', action: 'cascade' },
  ],
  planPhase: [
    { child: 'planTask', fk: 'phase_id', action: 'cascade' },
    { child: 'planMilestone', fk: 'phase_id', action: 'cascade' },
  ],
};

const OPERATORS = new Set([
  'equals', 'not', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'contains', 'startsWith', 'endsWith',
  'mode', 'is', 'isNot', 'some', 'every', 'none', 'AND', 'OR', 'NOT', 'has', 'hasSome', 'isEmpty',
]);

// ---------- helpers ----------

function prismaError(code: string, message: string) {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

const isPlainObject = (v: unknown): v is Row =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);

/** Compare-friendly value: dates become timestamps, numeric strings stay as-is. */
function norm(v: unknown): unknown {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return Date.parse(v);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return Date.parse(v + 'T00:00:00Z');
  return v;
}

function cmp(a: unknown, b: unknown): number {
  const x = norm(a) as any;
  const y = norm(b) as any;
  if (x === y) return 0;
  if (x === null || x === undefined) return -1;
  if (y === null || y === undefined) return 1;
  return x < y ? -1 : 1;
}

function hydrate(model: ModelName, row: Row): Row {
  const out: Row = { ...row };
  for (const f of MODELS[model].dates) {
    const v = out[f];
    if (typeof v === 'string') out[f] = new Date(v);
  }
  return out;
}

function matchValue(value: unknown, cond: unknown, ctx: { ci?: boolean }): boolean {
  if (!isPlainObject(cond) || cond instanceof Date) {
    if (cond === undefined) return true;
    if (cond === null) return value === null || value === undefined;
    if (ctx.ci && typeof value === 'string' && typeof cond === 'string') return value.toLowerCase() === cond.toLowerCase();
    return cmp(value, cond) === 0;
  }
  const c = cond as Row;
  if (Object.keys(c).some((k) => !OPERATORS.has(k))) {
    // Looks like a nested object (e.g. Json value) -> compare deep
    return JSON.stringify(value) === JSON.stringify(cond);
  }
  const ci = ctx.ci || c.mode === 'insensitive';
  const v = value as any;
  const lower = (s: unknown): string => (typeof s === 'string' && ci ? s.toLowerCase() : (s as string));
  for (const [op, arg] of Object.entries(c)) {
    switch (op) {
      case 'mode': break;
      case 'equals': if (!matchValue(value, arg, { ci })) return false; break;
      case 'not': if (isPlainObject(arg) && !(arg instanceof Date)) { if (matchValue(value, arg, { ci })) return false; }
        else if (arg === null ? value === null || value === undefined : cmp(value, arg) === 0) return false; break;
      case 'in': if (!(arg as unknown[]).some((x) => cmp(value, x) === 0)) return false; break;
      case 'notIn': if ((arg as unknown[]).some((x) => cmp(value, x) === 0)) return false; break;
      case 'lt': if (v == null || cmp(value, arg) >= 0) return false; break;
      case 'lte': if (v == null || cmp(value, arg) > 0) return false; break;
      case 'gt': if (v == null || cmp(value, arg) <= 0) return false; break;
      case 'gte': if (v == null || cmp(value, arg) < 0) return false; break;
      case 'contains': if (typeof v !== 'string' || !lower(v).includes(lower(arg))) return false; break;
      case 'startsWith': if (typeof v !== 'string' || !lower(v).startsWith(lower(arg))) return false; break;
      case 'endsWith': if (typeof v !== 'string' || !lower(v).endsWith(lower(arg))) return false; break;
      case 'has': if (!Array.isArray(v) || !v.includes(arg)) return false; break;
      case 'isEmpty': if (Array.isArray(v) ? (v.length === 0) !== arg : true) return false; break;
      default: return false;
    }
  }
  return true;
}

/** Flatten compound unique keys like { employee_id_entry_date: {employee_id, entry_date} } into plain fields. */
function flattenWhere(model: ModelName, where: Row | undefined): Row {
  if (!where) return {};
  const fields = new Set([...Object.keys(MODELS[model].relations), ...MODELS[model].dates, 'id']);
  const out: Row = {};
  for (const [k, v] of Object.entries(where)) {
    if (isPlainObject(v) && !fields.has(k) && !OPERATORS.has(k) && !Object.keys(v).some((x) => OPERATORS.has(x))) {
      Object.assign(out, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function matchRow(model: ModelName, snap: Snapshot, row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  const w = flattenWhere(model, where);
  const def = MODELS[model];
  for (const [k, cond] of Object.entries(w)) {
    if (cond === undefined) continue;
    if (k === 'AND') {
      const list = Array.isArray(cond) ? cond : [cond];
      if (!list.every((c) => matchRow(model, snap, row, c))) return false;
      continue;
    }
    if (k === 'OR') {
      if (!(cond as Row[]).some((c) => matchRow(model, snap, row, c))) return false;
      continue;
    }
    if (k === 'NOT') {
      const list = Array.isArray(cond) ? cond : [cond];
      if (list.some((c) => matchRow(model, snap, row, c))) return false;
      continue;
    }
    const rel = def.relations[k];
    if (rel) {
      if (!relationMatch(snap, row, k, rel, cond as Row)) return false;
      continue;
    }
    if (!matchValue(row[k], cond, {})) return false;
  }
  return true;
}

function relationMatch(snap: Snapshot, row: Row, _name: string, rel: { to: ModelName; fk: string; many?: boolean }, cond: Row): boolean {
  const target = snap.tables[MODELS[rel.to].table] ?? [];
  if (rel.many) {
    const children = target.filter((t) => t[rel.fk] === row.id);
    if (cond?.some !== undefined) return children.some((t) => matchRow(rel.to, snap, t, cond.some));
    if (cond?.every !== undefined) return children.every((t) => matchRow(rel.to, snap, t, cond.every));
    if (cond?.none !== undefined) return !children.some((t) => matchRow(rel.to, snap, t, cond.none));
    return children.some((t) => matchRow(rel.to, snap, t, cond));
  }
  // to-one: the foreign key points at target.id
  const parent = target.find((t) => t.id === row[rel.fk]);
  if (cond?.is !== undefined) return cond.is === null ? !parent : !!parent && matchRow(rel.to, snap, parent, cond.is);
  if (cond?.isNot !== undefined) return cond.isNot === null ? !!parent : !parent || !matchRow(rel.to, snap, parent, cond.isNot);
  if (!parent) return false;
  return matchRow(rel.to, snap, parent, cond);
}

function orderRows(model: ModelName, snap: Snapshot, rows: Row[], orderBy: any): Row[] {
  if (!orderBy) return rows;
  const specs = (Array.isArray(orderBy) ? orderBy : [orderBy]).flatMap((o: Row) => Object.entries(o));
  return [...rows].sort((a, b) => {
    for (const [field, dir] of specs) {
      const d = dir === 'desc' ? -1 : 1;
      const av = isPlainObject(dir) ? a[field] : a[field];
      const c = cmp(av, b[field]);
      if (c !== 0) return c * d;
    }
    return 0;
  });
}

/** Apply select / include / _count to a stored row, returning a fresh object. */
function project(model: ModelName, snap: Snapshot, row: Row, select?: Row, include?: Row): Row {
  const def = MODELS[model];
  let out: Row;
  if (select) {
    out = {};
    for (const [k, v] of Object.entries(select)) {
      if (!v) continue;
      if (def.relations[k]) {
        out[k] = relatedRows(model, snap, row, k, isPlainObject(v) ? v : {});
      } else if (k === '_count') {
        out._count = countRelations(snap, model, row, v as Row);
      } else {
        out[k] = row[k];
      }
    }
    return out;
  }
  out = { ...row };
  if (include) {
    for (const [k, v] of Object.entries(include)) {
      if (!v) continue;
      if (def.relations[k]) out[k] = relatedRows(model, snap, row, k, isPlainObject(v) ? v : {});
      if (k === '_count') out._count = countRelations(snap, model, row, v as Row);
    }
  }
  return out;
}

function countRelations(snap: Snapshot, model: ModelName, row: Row, spec: Row): Row {
  const def = MODELS[model];
  const sel = isPlainObject(spec) && spec.select ? spec.select : spec;
  const out: Row = {};
  for (const [k, v] of Object.entries(sel ?? {})) {
    if (!v) continue;
    const rel = def.relations[k];
    if (!rel) continue;
    const target = snap.tables[MODELS[rel.to].table] ?? [];
    out[k] = target.filter((t) => t[rel.fk] === row.id).length;
  }
  return out;
}

function relatedRows(model: ModelName, snap: Snapshot, row: Row, name: string, args: Row): any {
  const rel = MODELS[model].relations[name];
  const target = snap.tables[MODELS[rel.to].table] ?? [];
  if (rel.many) {
    let rows = target.filter((t) => t[rel.fk] === row.id && matchRow(rel.to, snap, t, args.where));
    rows = orderRows(rel.to, snap, rows, args.orderBy);
    if (args.skip) rows = rows.slice(args.skip);
    if (args.take !== undefined) rows = rows.slice(0, args.take);
    return rows.map((r) => project(rel.to, snap, hydrate(rel.to, r), args.select, args.include));
  }
  const parent = target.find((t) => t.id === row[rel.fk]);
  if (!parent) return null;
  return project(rel.to, snap, hydrate(rel.to, parent), args.select, args.include);
}

function applyDefaults(model: ModelName, data: Row): Row {
  const def = MODELS[model];
  const defaults = typeof def.defaults === 'function' ? def.defaults(data) : def.defaults;
  const out: Row = { ...data };
  for (const [k, v] of Object.entries(defaults)) {
    if (out[k] === undefined) out[k] = typeof v === 'function' ? (v as () => unknown)() : v;
  }
  if (out.id === undefined) out.id = model === 'scoringSettings' ? 'default' : randomUUID();
  if (def.hasUpdatedAt && out.updated_at === undefined) out.updated_at = NOW();
  // Prisma relation inputs: { employee: { connect: { id } } } and FK scalars
  for (const [k, v] of Object.entries(data)) {
    const rel = def.relations[k];
    if (rel && isPlainObject(v) && !rel.many) {
      const c = (v as Row).connect ?? v;
      if (c && c.id !== undefined) out[rel.fk] = c.id;
      if (v.disconnect) out[rel.fk] = null;
      delete out[k];
    }
  }
  // Scalar inputs wrapped in { set } (Prisma style)
  for (const [k, v] of Object.entries(out)) {
    if (isPlainObject(v) && 'set' in v && Object.keys(v).length === 1) out[k] = (v as Row).set;
  }
  return out;
}

function checkUnique(model: ModelName, rows: Row[], row: Row, selfId?: string) {
  for (const fields of MODELS[model].unique) {
    const clash = rows.find((r) => r.id !== selfId && fields.every((f) => cmp(r[f], row[f]) === 0));
    if (clash) throw prismaError('P2002', `Unique constraint failed on the fields: (${fields.join(',')})`);
  }
}

function applyUpdate(model: ModelName, row: Row, data: Row): Row {
  const def = MODELS[model];
  const out: Row = { ...row };
  for (const [k, raw] of Object.entries(data)) {
    if (raw === undefined) continue;
    const rel = def.relations[k];
    if (rel && isPlainObject(raw) && !rel.many) {
      if ((raw as Row).disconnect) out[rel.fk] = null;
      else if ((raw as Row).connect) out[rel.fk] = (raw as Row).connect.id;
      continue;
    }
    let v: any = raw;
    if (isPlainObject(v) && Object.keys(v).length === 1) {
      if ('set' in v) v = v.set;
      else if ('increment' in v) v = Number(row[k] ?? 0) + Number(v.increment);
      else if ('decrement' in v) v = Number(row[k] ?? 0) - Number(v.decrement);
      else if ('multiply' in v) v = Number(row[k] ?? 0) * Number(v.multiply);
    }
    out[k] = v;
  }
  if (def.hasUpdatedAt) out.updated_at = NOW();
  return out;
}

function rowsOf(snap: Snapshot, model: ModelName): Row[] {
  const t = MODELS[model].table;
  if (!snap.tables[t]) snap.tables[t] = [];
  return snap.tables[t];
}

function selectRows(model: ModelName, snap: Snapshot, args: Row = {}): Row[] {
  let rows = rowsOf(snap, model).filter((r) => matchRow(model, snap, r, args.where));
  rows = orderRows(model, snap, rows, args.orderBy);
  if (args.cursor) {
    const idx = rows.findIndex((r) => Object.entries(args.cursor).every(([k, v]) => cmp(r[k], v) === 0));
    if (idx >= 0) rows = rows.slice(idx);
  }
  if (args.skip) rows = rows.slice(args.skip);
  if (args.take !== undefined) rows = args.take >= 0 ? rows.slice(0, args.take) : rows.slice(args.take);
  return rows;
}

function shape(model: ModelName, snap: Snapshot, row: Row, args: Row = {}): Row {
  return project(model, snap, hydrate(model, row), args.select, args.include);
}

function groupAgg(rows: Row[], spec: Row | undefined): Row {
  const out: Row = {};
  if (!spec) return out;
  for (const [op, fields] of Object.entries(spec)) {
    if (!fields) continue;
    if (op === '_count') {
      out._count = fields === true ? rows.length : Object.fromEntries(Object.keys(fields as Row).filter((f) => (fields as Row)[f]).map((f) => [f, rows.filter((r) => r[f] != null).length]));
      continue;
    }
    if (!fields || typeof fields !== 'object') continue;
    out[op] = {};
    for (const f of Object.keys(fields as Row)) {
      if (!(fields as Row)[f]) continue;
      const nums = rows.map((r) => r[f]).filter((x) => x != null).map((x) => Number(x));
      const val =
        op === '_sum' ? nums.reduce((a, b) => a + b, 0) :
        op === '_avg' ? (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null) :
        op === '_min' ? (nums.length ? Math.min(...nums) : null) :
        op === '_max' ? (nums.length ? Math.max(...nums) : null) : null;
      out[op][f] = val;
    }
  }
  return out;
}

// ---------- model delegate ----------

type Ctx = { snap: Snapshot } | null;

function delegate(model: ModelName, ctx: Ctx = null) {
  // Outside a transaction: reads use the cached snapshot, writes persist immediately.
  // Inside $transaction: everything runs on one snapshot that is saved only if the callback succeeds.
  const read = async <T>(fn: (snap: Snapshot) => T): Promise<T> => fn(ctx ? ctx.snap : await readSnapshot(5_000));
  const write = <T>(fn: (snap: Snapshot) => T | Promise<T>): Promise<T> =>
    ctx ? Promise.resolve(fn(ctx.snap)) : mutateSnapshot(fn);

  const findUniqueRow = (snap: Snapshot, where: Row) => {
    const flat = flattenWhere(model, where);
    return rowsOf(snap, model).find((r) => matchRow(model, snap, r, flat));
  };

  return {
    findMany: (args: Row = {}) => read((snap) => selectRows(model, snap, args).map((r) => shape(model, snap, r, args))),
    findFirst: (args: Row = {}) => read((snap) => {
      const r = selectRows(model, snap, { ...args, take: 1 })[0];
      return r ? shape(model, snap, r, args) : null;
    }),
    findFirstOrThrow: (args: Row = {}) => read((snap) => {
      const r = selectRows(model, snap, { ...args, take: 1 })[0];
      if (!r) throw prismaError('P2025', 'Record not found');
      return shape(model, snap, r, args);
    }),
    findUnique: (args: Row) => read((snap) => {
      const r = findUniqueRow(snap, args.where);
      return r ? shape(model, snap, r, args) : null;
    }),
    findUniqueOrThrow: (args: Row) => read((snap) => {
      const r = findUniqueRow(snap, args.where);
      if (!r) throw prismaError('P2025', 'Record not found');
      return shape(model, snap, r, args);
    }),
    count: (args: Row = {}) => read((snap) => selectRows(model, snap, { where: args.where }).length),
    aggregate: (args: Row = {}) => read((snap) => {
      const rows = selectRows(model, snap, { where: args.where });
      return groupAgg(rows, { _sum: args._sum, _avg: args._avg, _min: args._min, _max: args._max, _count: args._count });
    }),
    groupBy: (args: Row) => read((snap) => {
      const rows = selectRows(model, snap, { where: args.where });
      const by: string[] = args.by;
      const groups = new Map<string, Row[]>();
      for (const r of rows) {
        const key = JSON.stringify(by.map((b) => r[b]));
        groups.set(key, [...(groups.get(key) ?? []), r]);
      }
      let out = [...groups.entries()].map(([key, g]) => {
        const keyVals = JSON.parse(key);
        const row: Row = Object.fromEntries(by.map((b, i) => [b, keyVals[i]]));
        return { ...row, ...groupAgg(g, { _sum: args._sum, _avg: args._avg, _min: args._min, _max: args._max, _count: args._count }) };
      });
      out = orderRows(model, snap, out, args.orderBy);
      return out;
    }),
    create: (args: Row) => write((snap) => {
      const rows = rowsOf(snap, model);
      const row = applyDefaults(model, args.data);
      checkUnique(model, rows, row);
      rows.push(row);
      return shape(model, snap, row, args);
    }),
    createMany: (args: Row) => write((snap) => {
      const rows = rowsOf(snap, model);
      const list = Array.isArray(args.data) ? args.data : [args.data];
      let count = 0;
      for (const d of list) {
        const row = applyDefaults(model, d);
        try {
          checkUnique(model, rows, row);
        } catch (e) {
          if (args.skipDuplicates) continue;
          throw e;
        }
        rows.push(row);
        count++;
      }
      return { count };
    }),
    update: (args: Row) => write((snap) => {
      const rows = rowsOf(snap, model);
      const idx = rows.findIndex((r) => matchRow(model, snap, r, flattenWhere(model, args.where)));
      if (idx < 0) throw prismaError('P2025', 'Record to update not found.');
      const updated = applyUpdate(model, rows[idx], args.data);
      checkUnique(model, rows, updated, rows[idx].id);
      rows[idx] = updated;
      return shape(model, snap, updated, args);
    }),
    updateMany: (args: Row) => write((snap) => {
      const rows = rowsOf(snap, model);
      let count = 0;
      for (let i = 0; i < rows.length; i++) {
        if (!matchRow(model, snap, rows[i], args.where)) continue;
        rows[i] = applyUpdate(model, rows[i], args.data);
        count++;
      }
      return { count };
    }),
    upsert: (args: Row) => write((snap) => {
      const rows = rowsOf(snap, model);
      const idx = rows.findIndex((r) => matchRow(model, snap, r, flattenWhere(model, args.where)));
      if (idx >= 0) {
        rows[idx] = applyUpdate(model, rows[idx], args.update);
        return shape(model, snap, rows[idx], args);
      }
      const row = applyDefaults(model, args.create);
      checkUnique(model, rows, row);
      rows.push(row);
      return shape(model, snap, row, args);
    }),
    delete: (args: Row) => write((snap) => {
      const rows = rowsOf(snap, model);
      const idx = rows.findIndex((r) => matchRow(model, snap, r, flattenWhere(model, args.where)));
      if (idx < 0) throw prismaError('P2025', 'Record to delete does not exist.');
      const [removed] = rows.splice(idx, 1);
      cascadeDelete(snap, model, [removed.id]);
      return shape(model, snap, removed, args);
    }),
    deleteMany: (args: Row = {}) => write((snap) => {
      const rows = rowsOf(snap, model);
      const ids = rows.filter((r) => matchRow(model, snap, r, args.where)).map((r) => r.id);
      snap.tables[MODELS[model].table] = rows.filter((r) => !ids.includes(r.id));
      cascadeDelete(snap, model, ids);
      return { count: ids.length };
    }),
  };
}

function cascadeDelete(snap: Snapshot, parent: ModelName, ids: string[]) {
  if (!ids.length) return;
  for (const { child, fk, action } of CASCADE[parent] ?? []) {
    const table = MODELS[child].table;
    const rows = rowsOf(snap, child);
    if (action === 'setNull') {
      for (const r of rows) if (ids.includes(r[fk])) r[fk] = null;
    } else {
      const removedIds = rows.filter((r) => ids.includes(r[fk])).map((r) => r.id);
      snap.tables[table] = rows.filter((r) => !ids.includes(r[fk]));
      cascadeDelete(snap, child, removedIds);
    }
  }
}

// ---------- client ----------

function buildClient(ctx: Ctx): PrismaShim {
  const client: Record<string, any> = {};
  for (const m of Object.keys(MODELS) as ModelName[]) client[m] = delegate(m, ctx);
  return client as PrismaShim;
}

// Loosely typed delegate surface: rows are plain records; Prisma's generated per-model types are not reproduced.
type Args = Record<string, any>;
interface Delegate {
  findMany(args?: Args): Promise<any[]>;
  findFirst(args?: Args): Promise<any>;
  findFirstOrThrow(args?: Args): Promise<any>;
  findUnique(args: Args): Promise<any>;
  findUniqueOrThrow(args: Args): Promise<any>;
  count(args?: Args): Promise<number>;
  aggregate(args?: Args): Promise<any>;
  groupBy(args: Args): Promise<any[]>;
  create(args: Args): Promise<any>;
  createMany(args: Args): Promise<{ count: number }>;
  update(args: Args): Promise<any>;
  updateMany(args: Args): Promise<{ count: number }>;
  upsert(args: Args): Promise<any>;
  delete(args: Args): Promise<any>;
  deleteMany(args?: Args): Promise<{ count: number }>;
}

type PrismaShim = Record<ModelName, Delegate> & {
  $transaction: {
    <T>(fn: (tx: PrismaShim) => Promise<T>, options?: { maxWait?: number; timeout?: number }): Promise<T>;
    (ops: Promise<unknown>[]): Promise<unknown[]>;
  };
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
};

const shim = buildClient(null);

shim.$transaction = (async (arg: any) => {
  if (Array.isArray(arg)) {
    const out = [];
    for (const p of arg) out.push(await p);
    return out;
  }
  // Interactive transaction: all tx.* calls operate on one snapshot, saved only on success.
  return mutateSnapshot(async (snap) => {
    const tx = buildClient({ snap });
    return arg(tx);
  });
}) as PrismaShim['$transaction'];
shim.$connect = async () => undefined;
shim.$disconnect = async () => undefined;

export const prisma = shim;
export default prisma;
