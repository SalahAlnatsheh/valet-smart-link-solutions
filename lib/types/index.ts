// ============ Global / Slug ============
export interface SlugDoc {
  tenantId: string;
}

// ============ Country profiles ============
export interface CountryProfile {
  countryCode: string;
  currency: string;
  currencySymbol: string;
  name: string;
}

// ============ Tenant ============
export interface TenantBranding {
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  logoUrl?: string;
}

export interface TenantPayment {
  provider: string;
  enabled: boolean;
  providerConfig?: Record<string, unknown>;
}

export interface TenantPricing {
  baseValetPrice: number;
  currency: string;
}

export interface GeofenceConfig {
  lat: number;
  lng: number;
  radiusMeters: number;
}

export type KeyStorageMode = "off" | "slots" | "tags";

/** Which fields are required when staff create a new ticket. Admin configurable in Settings. */
export interface NewTicketRequiredFields {
  plateNumber?: boolean;
  carColor?: boolean;
  carType?: boolean;
  carMake?: boolean;
  notes?: boolean;
  plateImage?: boolean;
  carImage?: boolean;
  tagNumber?: boolean;
}

export interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  country: string;
  currency: string;
  onlineFeePercent?: number;
  pricing: TenantPricing;
  payment: TenantPayment;
  cashEnabled: boolean;
  branding: TenantBranding;
  geofence?: GeofenceConfig;
  keyStorageMode?: KeyStorageMode;
  keyStorageSlotsCount?: number;
  newTicketRequired?: NewTicketRequiredFields;
  createdAt?: string;
  updatedAt?: string;
}

// ============ Users (per tenant) ============
export type UserRole = "admin" | "manager" | "valet";

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ============ Ticket status ============
export type TicketStatus =
  | "PARKED"
  | "REQUESTED"
  | "IN_PROGRESS"
  | "READY"
  | "DELIVERED";

// ============ Tickets ============
export interface CarMeta {
  color?: string;
  type?: string; // sedan, SUV, van, pickup
  make?: string;
}

export interface TicketTimestamps {
  arrivedAt?: string;
  parkedAt?: string;
  requestedAt?: string;
  inProgressAt?: string;
  readyAt?: string;
  deliveredAt?: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  status: TicketStatus;
  plateNumber: string;
  carMeta: CarMeta;
  timestamps: TicketTimestamps;
  assignedToUserId?: string;
  spot?: string;
  zone?: string;
  slotNumber?: number | null;
  tagNumber?: string | null;
  publicId: string;
  tokenHash: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
}

export interface PublicTicket {
  publicId: string;
  status: TicketStatus;
  requestedAt?: string;
  readyAt?: string;
  deliveredAt?: string;
  updatedAt: string;
}

// ============ Events ============
export type EventType =
  | "TICKET_CREATED"
  | "NFC_LINKED"
  | "REQUESTED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "READY"
  | "DELIVERED"
  | "PAYMENT_CREATED"
  | "PAYMENT_PAID"
  | "PAYMENT_FAILED"
  | "SHIFT_CHECK_IN"
  | "SHIFT_CHECK_OUT";

export interface EventRecord {
  id: string;
  ticketId?: string;
  actorUserId?: string;
  type: EventType;
  at: string;
  meta?: Record<string, unknown>;
}

// ============ Payments ============
export type PaymentMethod = "cash" | "online" | "card";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface Payment {
  id: string;
  ticketId: string;
  baseAmount: number;
  feePercent: number;
  feeAmount: number;
  total: number;
  currency: string;
  method: PaymentMethod;
  provider?: string;
  providerRef?: string;
  status: PaymentStatus;
  createdAt: string;
  paidAt?: string;
}

// ============ Shifts (HR) ============
export interface ShiftLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface Shift {
  id: string;
  userId: string;
  tenantId: string;
  checkInAt: string;
  checkOutAt?: string;
  checkInLocation?: ShiftLocation;
  checkOutLocation?: ShiftLocation;
  deviceId?: string;
}
