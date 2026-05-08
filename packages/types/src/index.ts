// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

export type ExperienceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT';
export type RiskProfile = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
export type CapitalRange = 'UNDER_500' | 'RANGE_500_2K' | 'RANGE_2K_10K' | 'OVER_10K';
export type Plan = 'FREE' | 'SCOUT' | 'PRO' | 'EXPERT';
export type SupplierPlan = 'BASIC' | 'PREMIUM';
export type ConfidenceLevel = 'LIVE' | 'FRESH' | 'AGED' | 'STALE';
export type Currency = 'USD' | 'KZT' | 'KGS' | 'UZS' | 'CNY' | 'RUB' | 'AED' | 'TRY';
export type ProductUnit = 'KG' | 'TONNE' | 'PCS' | 'BOX' | 'SET' | 'LITRE';
export type JournalStatus = 'PLANNED' | 'ORDERED' | 'PAID' | 'SHIPPED' | 'RECEIVED' | 'LISTED' | 'SOLD' | 'CANCELLED';
export type PriceTrend = 'RISING' | 'STABLE' | 'FALLING' | 'VOLATILE';
export type CompetitionLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'SATURATED';
export type AlertType = 'MARGIN_THRESHOLD' | 'PRICE_DROP' | 'PRICE_RISE' | 'WINDOW_OPENED' | 'NEW_SUPPLIER';

export type Marketplace =
  | 'KASPI_KZ'
  | 'WILDBERRIES_KZ' | 'WILDBERRIES_RU'
  | 'OZON_KZ' | 'OZON_RU'
  | 'YANDEX_MARKET'
  | 'UZUM_UZ'
  | 'OLX_KZ' | 'OLX_UZ'
  | 'ALIBABA' | 'ALIEXPRESS' | 'SHOP_1688' | 'DHGATE' | 'MADE_IN_CHINA'
  | 'DORDOY_MARKET' | 'BARAKHOL_KA' | 'FERGANA_MARKET' | 'KASHGAR_MARKET';

// ─────────────────────────────────────────────
// CORE ENTITIES
// ─────────────────────────────────────────────

export interface User {
  id: string;
  phone: string;
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  country: string;
  experience_level: ExperienceLevel;
  risk_profile: RiskProfile;
  capital_range?: CapitalRange | null;
  preferred_cats: string[];
  plan: Plan;
  telegram_id?: bigint | null;
  telegram_username?: string | null;
  referral_code: string;
  is_verified: boolean;
  onboarding_done: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Supplier {
  id: string;
  name: string;
  country: string;
  city?: string | null;
  telegram_id?: bigint | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  description?: string | null;
  rating: number;
  review_count: number;
  verified: boolean;
  plan: SupplierPlan;
  weekly_views: number;
  bot_registered: boolean;
  last_price_update?: Date | null;
}

export interface Product {
  id: string;
  name_ru: string;
  name_en?: string | null;
  slug: string;
  category_id: string;
  hs_code?: string | null;
  unit: ProductUnit;
  aliases: string[];
  is_active: boolean;
}

export interface Category {
  id: string;
  name_ru: string;
  name_en: string;
  slug: string;
  parent_id?: string | null;
  icon_emoji?: string | null;
  children?: Category[];
}

export interface Price {
  id: string;
  product_id: string;
  supplier_id?: string | null;
  marketplace?: Marketplace | null;
  source_type: 'BOT_SUBMISSION' | 'PARSER_AUTO' | 'AGENT_MANUAL' | 'API_PARTNER';
  price: number;
  currency: Currency;
  price_usd: number;
  unit: ProductUnit;
  min_qty?: number | null;
  confidence: ConfidenceLevel;
  is_buy_side: boolean;
  listing_url?: string | null;
  updated_at: Date;
}

export interface ArbitrageWindow {
  id: string;
  product_id: string;
  buy_marketplace?: Marketplace | null;
  buy_country: string;
  sell_marketplace: Marketplace;
  buy_price_usd: number;
  sell_price_usd: number;
  logistics_usd: number;
  customs_usd: number;
  marketplace_fee_pct: number;
  net_margin_usd: number;
  margin_pct: number;
  roi: number;
  risk_score: number;
  competition_level: CompetitionLevel;
  seasonal_score: number;
  trend: PriceTrend;
  confidence: ConfidenceLevel;
  is_active: boolean;
  calculated_at: Date;
  expires_at?: Date | null;
  product?: Product & { category: Category };
}

export interface TradeJournalEntry {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  supplier_name?: string | null;
  buy_price: number;
  buy_currency: Currency;
  buy_price_usd: number;
  sell_price?: number | null;
  sell_currency?: Currency | null;
  quantity: number;
  unit: ProductUnit;
  logistics_cost?: number | null;
  customs_cost?: number | null;
  platform_fee?: number | null;
  total_investment?: number | null;
  total_revenue?: number | null;
  profit?: number | null;
  roi_actual?: number | null;
  status: JournalStatus;
  planned_margin_pct?: number | null;
  buy_date?: Date | null;
  expected_sell_date?: Date | null;
  actual_sell_date?: Date | null;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
}

// ─────────────────────────────────────────────
// API PAYLOADS
// ─────────────────────────────────────────────

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
  is_new: boolean;
}

export interface NavigatorParams {
  budget_usd: number;
  city: string;
  country: string;
  categories: string[];
  max_days: number;
  risk_profile: RiskProfile;
}

export interface ParsedPriceItem {
  product: string;
  price: number;
  currency: string;
  unit: string;
  min_qty: number | null;
  notes: string | null;
}

export interface UserContext {
  plan: Plan;
  experience_level?: ExperienceLevel;
  risk_profile?: RiskProfile;
  top_categories: string[];
  avg_roi?: number;
  total_profit_usd?: number;
  completed_deals?: number;
  recent_deals?: Array<{
    product_name: string;
    status: string;
    roi_actual?: number | null;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}