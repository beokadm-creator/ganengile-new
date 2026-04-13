import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { taxApiService } from '../../../../../../../src/services/tax/tax-api-service';

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const res = await taxApiService.issueTaxInvoice({
      partnerBusinessNumber: '123-45-67890',
      partnerName: '(주)길러배송파트너스',
      partnerCeo: '김대표',
      partnerEmail: 'tax@giller.test',
      issueDate: new Date().toISOString().split('T')[0].replace(/-/g, ''),
      grossAmount: 500000,
      taxAmount: 50000,
      totalAmount: 550000,
      itemName: '2024년 10월 배송대행 수수료 (테스트 발급)'
    });

    if (res.success) {
      return NextResponse.json({ success: true, invoiceId: res.invoiceId });
    } else {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}