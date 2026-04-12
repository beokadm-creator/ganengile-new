import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

export async function sendTaxInvoiceEmail(
  toEmail: string,
  invoiceData: any,
  pdfUrl?: string
): Promise<boolean> {
  try {
    const db = admin.firestore();
    const configDoc = await db.collection('config_private').doc('email').get();
    
    if (!configDoc.exists) {
      console.warn(`[Email Service] Email config not found. Skipping real email to ${toEmail}`);
      return false; // Not configured
    }

    const config = configDoc.data() || {};
    
    if (!config.enabled || !config.smtpHost || !config.smtpUser || !config.smtpPass) {
      console.warn(`[Email Service] Email not fully configured or disabled. Skipping email to ${toEmail}`);
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 587,
      secure: config.smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });

    const mailOptions = {
      from: `"Crowd Delivery Admin" <${config.smtpUser}>`,
      to: toEmail,
      subject: `[세금계산서] ${invoiceData.period.year}년 ${invoiceData.period.month}월 크라우드 배송 정산분 세금계산서 발행 안내`,
      text: `안녕하세요.\n\n${invoiceData.period.year}년 ${invoiceData.period.month}월 귀사의 크라우드 배송 위임 정산분에 대한 세금계산서가 발행되었습니다.\n\n정산 금액: ${invoiceData.amounts.total.toLocaleString()}원\n\n감사합니다.`,
      html: `<p>안녕하세요.</p><p><strong>${invoiceData.period.year}년 ${invoiceData.period.month}월</strong> 귀사의 크라우드 배송 위임 정산분에 대한 세금계산서가 발행되었습니다.</p><p>정산 금액: <strong>${invoiceData.amounts.total.toLocaleString()}원</strong></p><p>감사합니다.</p>`,
      attachments: pdfUrl ? [
        {
          filename: `TaxInvoice_${invoiceData.period.year}_${invoiceData.period.month}.pdf`,
          path: pdfUrl // If it's a URL, nodemailer will download it and attach it
        }
      ] : []
    };

    const info = await transporter.sendMail(mailOptions);
    console.warn(`[Email Service] Message sent: %s`, info.messageId);
    return true;

  } catch (error) {
    console.error(`[Email Service] Failed to send email to ${toEmail}:`, error);
    return false;
  }
}
