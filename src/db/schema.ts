import { pgTable, serial, text, integer, boolean, timestamp, date, jsonb, uniqueIndex, index, primaryKey, doublePrecision } from 'drizzle-orm/pg-core';

const id = () => serial('id').primaryKey();
const ts = (n: string) => timestamp(n, { withTimezone: true });
const created = () => ts('created_at').defaultNow().notNull();

// ---------- Branding and editable content ----------
export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull().default(''),
});

// Overrides for any interface label. key = 'nav.sessions', lang = 'ar' | 'en'
export const siteLabels = pgTable('site_labels', {
  key: text('key').notNull(), lang: text('lang').notNull(), value: text('value').notNull(),
}, t => [primaryKey({ columns: [t.key, t.lang] })]);

// ---------- Roles and staff ----------
export const roles = pgTable('roles', {
  id: id(), key: text('key').notNull().unique(), nameAr: text('name_ar').notNull(), nameEn: text('name_en').notNull(),
  system: boolean('system').notNull().default(false),
});
export const rolePermissions = pgTable('role_permissions', {
  roleId: integer('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permission: text('permission').notNull(),
}, t => [primaryKey({ columns: [t.roleId, t.permission] })]);

export const serviceCategories = pgTable('service_categories', {
  id: id(), key: text('key').notNull().unique(), nameAr: text('name_ar').notNull(), nameEn: text('name_en').notNull(),
  image: text('image'), sort: integer('sort').notNull().default(0), active: boolean('active').notNull().default(true),
});

export const staff = pgTable('staff', {
  id: id(), nameAr: text('name_ar').notNull(), nameEn: text('name_en').notNull(),
  email: text('email').notNull().unique(), phone: text('phone').notNull().default(''),
  passwordHash: text('password_hash').notNull(), mustChangePassword: boolean('must_change_password').notNull().default(true),
  roleId: integer('role_id').notNull().references(() => roles.id),
  photo: text('photo'), active: boolean('active').notNull().default(true),
  workingHours: jsonb('working_hours').$type<Record<string, { from: string; to: string } | null>>().notNull().default({}),
  failedAttempts: integer('failed_attempts').notNull().default(0), lockedUntil: ts('locked_until'),
  createdAt: created(),
});
// Which service categories a staff member can perform; `covers` = may support when the main specialist is busy
export const staffCategories = pgTable('staff_categories', {
  staffId: integer('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').notNull().references(() => serviceCategories.id, { onDelete: 'cascade' }),
  priority: integer('priority').notNull().default(1), // 1 = first choice, 2 = support
}, t => [primaryKey({ columns: [t.staffId, t.categoryId] })]);
export const staffTimeOff = pgTable('staff_time_off', {
  id: id(), staffId: integer('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  startsAt: ts('starts_at').notNull(), endsAt: ts('ends_at').notNull(), reason: text('reason').notNull().default(''),
});

// ---------- Customers ----------
export const customers = pgTable('customers', {
  id: id(), name: text('name').notNull(), whatsapp: text('whatsapp').notNull(), email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(), firstSessionDate: date('first_session_date'),
  language: text('language').notNull().default('ar'), status: text('status').notNull().default('pending'), // pending | active | blocked
  verifiedAt: ts('verified_at'),
  reminderEnabled: boolean('reminder_enabled').notNull().default(false), reminderDay: integer('reminder_day').notNull().default(30),
  reminderChannel: text('reminder_channel').notNull().default('whatsapp'),
  failedAttempts: integer('failed_attempts').notNull().default(0), lockedUntil: ts('locked_until'),
  createdAt: created(),
}, t => [uniqueIndex('customers_whatsapp_uq').on(t.whatsapp), uniqueIndex('customers_email_uq').on(t.email)]);

export const customerNotes = pgTable('customer_notes', {
  id: id(), customerId: integer('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  staffId: integer('staff_id').references(() => staff.id), body: text('body').notNull(), createdAt: created(),
});

// ---------- Authentication ----------
export const otpCodes = pgTable('otp_codes', {
  id: id(), customerId: integer('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  purpose: text('purpose').notNull(), // verify | reset
  channel: text('channel').notNull(), codeHash: text('code_hash').notNull(), expiresAt: ts('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0), usedAt: ts('used_at'), createdAt: created(),
});
export const authSessions = pgTable('auth_sessions', {
  id: id(), tokenHash: text('token_hash').notNull().unique(), kind: text('kind').notNull(), // customer | staff
  userId: integer('user_id').notNull(), expiresAt: ts('expires_at').notNull(), createdAt: created(),
}, t => [index('auth_sessions_user').on(t.kind, t.userId)]);

// ---------- Notifications and audit ----------
export const notifications = pgTable('notifications', {
  id: id(), customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  channel: text('channel').notNull(), toAddress: text('to_address').notNull(), template: text('template').notNull(),
  body: text('body').notNull(), status: text('status').notNull().default('queued'), // queued | sent | failed | manual
  error: text('error'), createdAt: created(), sentAt: ts('sent_at'),
});
export const activityLogs = pgTable('activity_logs', {
  id: id(), actorKind: text('actor_kind').notNull(), actorId: integer('actor_id'), actorName: text('actor_name').notNull().default(''),
  action: text('action').notNull(), entity: text('entity').notNull().default(''), entityId: text('entity_id').notNull().default(''),
  details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}), createdAt: created(),
});

// ================= Phase 2: catalog, offers, bookings, payments =================
export const services = pgTable('services', {
  id: id(), categoryId: integer('category_id').notNull().references(() => serviceCategories.id),
  nameAr: text('name_ar').notNull(), nameEn: text('name_en').notNull(),
  descAr: text('desc_ar').notNull().default(''), descEn: text('desc_en').notNull().default(''),
  durationMin: integer('duration_min').notNull().default(60), price: integer('price').notNull(),
  depositPercent: integer('deposit_percent'), // null = use the default from settings
  image: text('image'), sort: integer('sort').notNull().default(0), active: boolean('active').notNull().default(true),
  createdAt: created(),
});
export const offers = pgTable('offers', {
  id: id(), nameAr: text('name_ar').notNull(), nameEn: text('name_en').notNull(),
  descAr: text('desc_ar').notNull().default(''), descEn: text('desc_en').notNull().default(''),
  percent: integer('percent').notNull().default(0), amountOff: integer('amount_off').notNull().default(0),
  startDate: date('start_date'), endDate: date('end_date'), active: boolean('active').notNull().default(true), createdAt: created(),
});
export const offerServices = pgTable('offer_services', {
  offerId: integer('offer_id').notNull().references(() => offers.id, { onDelete: 'cascade' }),
  serviceId: integer('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
}, t => [primaryKey({ columns: [t.offerId, t.serviceId] })]);

export const bookings = pgTable('bookings', {
  id: id(), customerId: integer('customer_id').notNull().references(() => customers.id),
  serviceId: integer('service_id').notNull().references(() => services.id),
  staffId: integer('staff_id').notNull().references(() => staff.id),
  serviceNameAr: text('service_name_ar').notNull(), serviceNameEn: text('service_name_en').notNull(), // snapshots: later edits never rewrite history
  startsAt: ts('starts_at').notNull(), endsAt: ts('ends_at').notNull(),
  listPrice: integer('list_price').notNull(), discountAmount: integer('discount_amount').notNull().default(0), price: integer('price').notNull(),
  offerId: integer('offer_id').references(() => offers.id, { onDelete: 'set null' }), offerName: text('offer_name').notNull().default(''),
  depositPercent: integer('deposit_percent').notNull().default(0), depositAmount: integer('deposit_amount').notNull().default(0),
  status: text('status').notNull(), // pending_deposit | pending_confirmation | confirmed | completed | cancelled
  holdExpiresAt: ts('hold_expires_at'), customerNote: text('customer_note').notNull().default(''),
  cancelReason: text('cancel_reason').notNull().default(''), cancelledBy: text('cancelled_by').notNull().default(''), cancelledAt: ts('cancelled_at'),
  completedAt: ts('completed_at'), createdAt: created(),
}, t => [index('bookings_staff_time').on(t.staffId, t.startsAt), index('bookings_customer').on(t.customerId)]);

export const payments = pgTable('payments', {
  id: id(), bookingId: integer('booking_id').notNull().references(() => bookings.id), customerId: integer('customer_id').notNull().references(() => customers.id),
  kind: text('kind').notNull(), // deposit | balance | refund
  amount: integer('amount').notNull(), method: text('method').notNull().default(''), reference: text('reference').notNull().default(''),
  proofFile: text('proof_file'), status: text('status').notNull(), // submitted | approved | rejected
  rejectReason: text('reject_reason').notNull().default(''), reviewedBy: integer('reviewed_by').references(() => staff.id), reviewedAt: ts('reviewed_at'),
  createdAt: created(),
}, t => [index('payments_booking').on(t.bookingId)]);

export const recommendations = pgTable('recommendations', {
  id: id(), bookingId: integer('booking_id').notNull().unique().references(() => bookings.id, { onDelete: 'cascade' }),
  staffId: integer('staff_id').references(() => staff.id),
  aftercare: text('aftercare').notNull().default(''), productsRecommended: text('products_recommended').notNull().default(''),
  usageInstructions: text('usage_instructions').notNull().default(''), productsToAvoid: text('products_to_avoid').notNull().default(''),
  nextPrep: text('next_prep').notNull().default(''), updatedAt: created(),
});

// ---------- Suppliers, inventory, expenses (Phase 4) ----------
export const suppliers = pgTable('suppliers', {
  id: id(), name: text('name').notNull(), phone: text('phone').notNull().default(''), email: text('email').notNull().default(''),
  notes: text('notes').notNull().default(''), active: boolean('active').notNull().default(true), createdAt: created(),
});
export const products = pgTable('products', {
  id: id(), nameAr: text('name_ar').notNull(), nameEn: text('name_en').notNull(), unit: text('unit').notNull().default('pcs'),
  sku: text('sku').notNull().default(''), stock: doublePrecision('stock').notNull().default(0), avgCost: doublePrecision('avg_cost').notNull().default(0), // EGP per unit, moving average
  reorderLevel: doublePrecision('reorder_level').notNull().default(0), supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  active: boolean('active').notNull().default(true), createdAt: created(),
});
export const serviceProducts = pgTable('service_products', {
  serviceId: integer('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  qty: doublePrecision('qty').notNull(),
}, t => [primaryKey({ columns: [t.serviceId, t.productId] })]);
export const purchases = pgTable('purchases', {
  id: id(), supplierId: integer('supplier_id').notNull().references(() => suppliers.id), invoiceNo: text('invoice_no').notNull().default(''),
  date: date('date').notNull(), total: integer('total').notNull(), note: text('note').notNull().default(''), staffId: integer('staff_id').references(() => staff.id), createdAt: created(),
});
export const stockMovements = pgTable('stock_movements', {
  id: id(), productId: integer('product_id').notNull().references(() => products.id), kind: text('kind').notNull(), // purchase | consume | adjust | waste
  qty: doublePrecision('qty').notNull(), // signed: + in, - out
  unitCost: doublePrecision('unit_cost').notNull().default(0), bookingId: integer('booking_id').references(() => bookings.id), purchaseId: integer('purchase_id').references(() => purchases.id),
  note: text('note').notNull().default(''), staffId: integer('staff_id').references(() => staff.id), createdAt: created(),
}, t => [index('stock_mv_product').on(t.productId)]);
export const expenses = pgTable('expenses', {
  id: id(), date: date('date').notNull(), category: text('category').notNull(), // rent | salaries | utilities | marketing | supplies | supplier_payment | other
  amount: integer('amount').notNull(), method: text('method').notNull().default('cash'), supplierId: integer('supplier_id').references(() => suppliers.id),
  purchaseId: integer('purchase_id').references(() => purchases.id), note: text('note').notNull().default(''), staffId: integer('staff_id').references(() => staff.id), createdAt: created(),
});

// Uploaded images (logo, offer pictures, payment proofs) live in the database so they survive on hosts with a temporary disk.
export const files = pgTable('files', {
  name: text('name').primaryKey(),
  mime: text('mime').notNull(),
  isPrivate: boolean('is_private').notNull().default(false),
  data: text('data').notNull(), // base64
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
