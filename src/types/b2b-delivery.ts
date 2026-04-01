/**
 * B2B 諛곗넚 ????뺤쓽
 * 
 * B2B 諛곗넚 ?붿껌 諛?吏꾪뻾 ?곹깭瑜?愿由ы빀?덈떎.
 * 湲고쉷 臾몄꽌: PLANNING_B2B_BUSINESS.md
 */

/**
 * ?꾩튂 ?뺣낫 (怨듯넻)
 */
export interface Location {
  /** ???대쫫 */
  station: string;
  /** 二쇱냼 */
  address: string;
  /** ?곕씫泥?*/
  contact?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * 諛곗넚 ?붽툑 ?뺣낫
 */
export interface DeliveryPricing {
  /** 湲곕낯 諛곗넚鍮?*/
  baseFee: number;
  /** 以묐웾 異붽?鍮?(kg?? */
  weightSurcharge: number;
  /** 珥?諛곗넚鍮?*/
  totalFee: number;
  /** 湲몃윭 ?섏씡 */
  gillerEarning: number;
}

/**
 * B2B 諛곗넚 ???
 */
export type B2BDeliveryType = "on-demand" | "scheduled";

/**
 * B2B 諛곗넚 ?곹깭
 */
export type B2BDeliveryStatus = 
  | "pending"       // ?湲?以?(湲몃윭 留ㅼ묶 ??
  | "matched"       // 留ㅼ묶 ?꾨즺
  | "picked_up"     // ?쎌뾽 ?꾨즺
  | "in_transit"    // ?대룞 以?
  | "delivered"     // 諛곗넚 ?꾨즺
  | "cancelled";    // 痍⑥냼??

/**
 * B2B 諛곗넚 ?명꽣?섏씠??
 */
export interface B2BDelivery {
  /** 諛곗넚 ID */
  id: string;
  /** 怨꾩빟 ID */
  contractId: string;
  /** B2B 怨좉컼??ID */
  businessId: string;
  /** 湲몃윭 ID (留ㅼ묶 ?? */
  gillerId?: string;
  
  // 諛곗넚 ?뺣낫
  /** ?쎌뾽 ?꾩튂 */
  pickupLocation: Location;
  /** ?쒕∼?ㅽ봽 ?꾩튂 */
  dropoffLocation: Location;
  /** ?덉젙 ?쒓컙 */
  scheduledTime: Date;
  /** 臾닿쾶 (kg) */
  weight: number;
  /** ?뱀씠?ы빆 */
  notes?: string;
  
  // 留ㅼ묶
  /** 諛곗넚 ???*/
  type: B2BDeliveryType;
  /** 留ㅼ묶 ?쒓컙 */
  matchedAt?: Date;
  /** ?섎씫 ?쒓컙 */
  acceptedAt?: Date;
  
  // 吏꾪뻾 ?곹깭
  /** 諛곗넚 ?곹깭 */
  status: B2BDeliveryStatus;
  
  // ?꾨즺 ?뺣낫
  /** ?쎌뾽 ?ъ쭊 URL */
  pickupPhoto?: string;
  /** 諛곗넚 ?ъ쭊 URL */
  deliveryPhoto?: string;
  /** ?꾨즺 ?쒓컙 */
  completedAt?: Date;
  
  // ?붽툑
  /** 諛곗넚 ?붽툑 */
  pricing: DeliveryPricing;
  
  /** ?앹꽦 ?쇱떆 */
  createdAt: Date;
  /** ?낅뜲?댄듃 ?쇱떆 */
  updatedAt: Date;
}

/**
 * B2B 諛곗넚 ?앹꽦 ?곗씠??
 */
export interface CreateB2BDeliveryData {
  /** 계약 ID */
  contractId: string;
  businessId: string;
  /** ?쎌뾽 ?꾩튂 */
  pickupLocation: Location;
  /** ?쒕∼?ㅽ봽 ?꾩튂 */
  dropoffLocation: Location;
  /** ?덉젙 ?쒓컙 */
  scheduledTime: Date;
  /** 臾닿쾶 (kg) */
  weight: number;
  /** ?뱀씠?ы빆 */
  notes?: string;
}

/**
 * 以묐웾 異붽?鍮?怨꾩궛 ?곸닔
 */
export const WEIGHT_SURCHARGE_RATE = 200; // 200??kg

/**
 * 湲곕낯 諛곗넚鍮??곸닔
 */
export const BASE_DELIVERY_FEES = {
  small: 5000,   // 5km 誘몃쭔
  medium: 7000,  // 5-10km
  large: 9000     // 10km 珥덇낵
} as const;

/**
 * B2B 怨꾩빟 ???
 */
export interface B2BContract {
  /** 怨꾩빟 ID */
  contractId: string;
  /** B2B 怨좉컼??ID */
  businessId: string;
  /** 怨좉컼?щ챸 */
  businessName: string;
  /** ?낆쥌 */
  businessType: string;
  /** ?깃툒 (basic, standard, premium) */
  tier: string;
  /** 怨꾩빟 ?쒖옉??*/
  startDate: Date;
  /** 怨꾩빟 醫낅즺??*/
  endDate: Date;
  /** ???댁슜猷?*/
  monthlyFee: number;
  /** ??諛곗넚 ?쒕룄 */
  deliveryLimit: number;
  /** 嫄대떦 諛곗넚鍮?*/
  pricePerDelivery: number;
  /** ?곹깭 (active, suspended, cancelled) */
  status?: string;
  /** ?앹꽦 ?쇱떆 */
  createdAt?: Date;
  /** ?낅뜲?댄듃 ?쇱떆 */
  updatedAt?: Date;
}

/**
 * B2B 怨꾩빟 ?앹꽦 ?곗씠??
 */
export interface CreateB2BContractData {
  /** B2B 怨좉컼??ID */
  businessId: string;
  /** 怨좉컼?щ챸 */
  businessName: string;
  /** ?낆쥌 */
  businessType?: string;
  /** ?깃툒 (basic, standard, premium) */
  tier?: string;
  /** 怨꾩빟 ?쒖옉??*/
  startDate: Date;
  /** 怨꾩빟 醫낅즺??*/
  endDate: Date;
  /** ???댁슜猷?*/
  monthlyFee: number;
  /** ??諛곗넚 ?쒕룄 */
  deliveryLimit: number;
  /** 嫄대떦 諛곗넚鍮?*/
  pricePerDelivery: number;
}

/**
 * B2B ?붿껌 ???
 */
export interface B2BRequest {
  /** ?붿껌 ID */
  requestId: string;
  /** B2B 怨좉컼??ID */
  businessId: string;
  /** 怨꾩빟 ID */
  contractId: string;
  /** ?쎌뾽 ???뺣낫 */
  pickupStation: {
    stationId: string;
    stationName: string;
  };
  /** 諛곗넚 ???뺣낫 */
  deliveryStation: {
    stationId: string;
    stationName: string;
  };
  /** ?⑦궎吏 ?뺣낫 */
  packageInfo: {
    size: string;
    weight: string;
    description: string;
  };
  /** 湲닿툒??*/
  urgency: string;
  /** ?덉젙 ?쒓컙 */
  scheduledTime: Date;
  /** 諛곗젙??湲몃윭 ID */
  assignedGillerId?: string;
  /** ?곹깭 (pending, assigned, in_progress, completed, cancelled) */
  status?: string;
  /** ?앹꽦 ?쇱떆 */
  createdAt?: Date;
  /** ?낅뜲?댄듃 ?쇱떆 */
  updatedAt?: Date;
}

/**
 * B2B ?붿껌 ?앹꽦 ?곗씠??
 */
export interface CreateB2BRequestData {
  /** B2B 怨좉컼??ID */
  businessId: string;
  /** 怨꾩빟 ID */
  contractId: string;
  /** ?쎌뾽 ???뺣낫 */
  pickupStation: {
    stationId: string;
    stationName: string;
  };
  /** 諛곗넚 ???뺣낫 */
  deliveryStation: {
    stationId: string;
    stationName: string;
  };
  /** ?⑦궎吏 ?뺣낫 */
  packageInfo: {
    size: string;
    weight: string;
    description: string;
  };
  /** 湲닿툒??*/
  urgency?: string;
  /** ?덉젙 ?쒓컙 */
  scheduledTime: Date;
}

/**
 * ?멸툑 怨꾩궛?????
 */
export interface TaxInvoice {
  /** 怨꾩궛??ID */
  invoiceId: string;
  /** B2B 怨좉컼??ID */
  businessId: string;
  /** 怨꾩빟 ID */
  contractId: string;
  /** ?????*/
  month: string;
  /** 湲곌컙 */
  period: {
    start: Date;
    end: Date;
  };
  /** 珥?湲덉븸 */
  totalAmount: number;
  /** 諛곗넚 嫄댁닔 */
  deliveryCount: number;
  /** 湲곕낯猷?*/
  baseFee: number;
  /** 諛곗넚鍮?*/
  deliveryFees: number;
  /** 遺媛??(10%) */
  tax: number;
  /** ?앹꽦 ?쇱떆 */
  createdAt?: Date;
}

