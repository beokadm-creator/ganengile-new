/**
 * 세금계산서 및 원천징수 신고 자동화를 위한 외부 API (예: 볼타 Volta, 팝빌 등) 연동 추상화 서비스입니다.
 * 현재는 인터페이스 및 스터브(Stub) 형태로 구성되어 있으며, 실제 API Key 및 엔드포인트 연동 시
 * 이 파일을 수정하여 B2B 정산 스케줄러와 연결합니다.
 */

export interface TaxApiConfig {
  provider: 'volta' | 'popbill' | 'custom';
  apiKey: string;
  corpNum: string; // 본사 사업자번호
}

export interface IssueTaxInvoiceRequest {
  partnerBusinessNumber: string; // 공급받는자(전문 배송업체) 사업자번호
  partnerName: string;           // 상호
  partnerCeo: string;            // 대표자명
  partnerEmail: string;          // 수신 이메일
  issueDate: string;             // 작성일자 (YYYYMMDD)
  grossAmount: number;           // 공급가액
  taxAmount: number;             // 세액 (부가세)
  totalAmount: number;           // 합계
  itemName: string;              // 품목명 (예: "2024년 10월 배송대행 수수료")
}

export interface ReportWithholdingTaxRequest {
  gillerId: string;
  gillerName: string;
  gillerResidentNumber: string;  // 주민등록번호 (보안 처리 필요)
  incomeMonth: string;           // 귀속월 (YYYYMM)
  grossIncome: number;           // 지급총액 (세전)
  businessTax: number;           // 사업소득세 (3%)
  localTax: number;              // 지방소득세 (0.3%)
}

export class TaxApiService {
  private config: TaxApiConfig;

  constructor(config?: TaxApiConfig) {
    // 향후 Firebase Remote Config나 Secret Manager에서 로드하도록 변경
    this.config = config || {
      provider: 'volta',
      apiKey: process.env.TAX_API_KEY || 'dummy_key',
      corpNum: '123-45-67890',
    };
  }

  /**
   * [B2B 정산용] 매입 세금계산서를 외부 API를 통해 역발행(또는 정발행 요청)합니다.
   */
  async issueTaxInvoice(request: IssueTaxInvoiceRequest): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
    console.log(`[TaxApiService] 세금계산서 API 호출 준비 (Provider: ${this.config.provider})`, request);
    
    try {
      // TODO: 실제 볼타(Volta) 또는 팝빌 API 연동 로직 구현
      /*
      const response = await fetch('https://api.volta.co.kr/v1/tax-invoices', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
        body: JSON.stringify(request)
      });
      */
      
      // 임시 스터브 반환
      return {
        success: true,
        invoiceId: `TAX-API-${Date.now()}`,
      };
    } catch (error: any) {
      console.error('[TaxApiService] 세금계산서 발행 실패:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * [일반 길러용] 3.3% 사업소득에 대한 원천징수 이행상황신고서를 외부 API를 통해 자동 전송합니다.
   * (일반적으로 매월 10일까지 전월 지급분에 대해 신고)
   */
  async reportWithholdingTax(request: ReportWithholdingTaxRequest): Promise<{ success: boolean; reportId?: string; error?: string }> {
    console.log(`[TaxApiService] 원천징수 신고 API 호출 준비 (Provider: ${this.config.provider})`, request);
    
    try {
      // TODO: 원천세 자동 신고 API 연동 로직 구현
      
      // 임시 스터브 반환
      return {
        success: true,
        reportId: `WHT-${Date.now()}`,
      };
    } catch (error: any) {
      console.error('[TaxApiService] 원천세 신고 실패:', error);
      return { success: false, error: error.message };
    }
  }
}

// 싱글톤 인스턴스 익스포트
export const taxApiService = new TaxApiService();
