import axios from 'axios';
import * as functions from 'firebase-functions';

// 환경 변수에서 NHN Cloud 설정 로드 (실제 프로젝트 환경에 맞게 설정 필요)
// firebase functions:config:set nhn.appkey="YOUR_APP_KEY" nhn.secretkey="YOUR_SECRET_KEY" nhn.senderkey="YOUR_SENDER_KEY"
const getNHNConfig = () => {
  return {
    appKey: process.env.NHN_APP_KEY || functions.config().nhn?.appkey || 'DEMO_APP_KEY',
    secretKey: process.env.NHN_SECRET_KEY || functions.config().nhn?.secretkey || 'DEMO_SECRET_KEY',
    senderKey: process.env.NHN_SENDER_KEY || functions.config().nhn?.senderkey || 'DEMO_SENDER_KEY',
  };
};

export interface AlimtalkParams {
  recipientNo: string;
  templateCode: string;
  templateParams: Record<string, string>;
}

/**
 * NHN Cloud Notification (Kakao Alimtalk) Service
 */
export class NHNAlimtalkService {
  /**
   * 카카오 알림톡 전송
   */
  static async sendAlimtalk(params: AlimtalkParams): Promise<boolean> {
    const config = getNHNConfig();

    if (config.appKey === 'DEMO_APP_KEY') {
      console.warn(`[NHN Alimtalk] DEMO 모드: 실제 발송 생략. To: ${params.recipientNo}, Template: ${params.templateCode}`);
      console.warn(`[NHN Alimtalk] Params:`, params.templateParams);
      return true; // 데모 모드에서는 항상 성공으로 간주
    }

    try {
      const url = `https://api-alimtalk.cloud.toast.com/alimtalk/v2.2/appkeys/${config.appKey}/messages`;
      
      const payload = {
        senderKey: config.senderKey,
        templateCode: params.templateCode,
        recipientList: [
          {
            recipientNo: params.recipientNo.replace(/[^0-9]/g, ''), // 숫자만 추출
            templateParameter: params.templateParams,
          }
        ]
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'X-Secret-Key': config.secretKey,
        },
        timeout: 5000,
      });

      if (response.data.header.isSuccessful) {
        console.log(`[NHN Alimtalk] 발송 성공: ${params.recipientNo}`);
        return true;
      } else {
        console.error(`[NHN Alimtalk] 발송 실패:`, response.data.header);
        return false;
      }
    } catch (error: any) {
      console.error(`[NHN Alimtalk] API 호출 에러:`, error.response?.data || error.message);
      return false;
    }
  }

  /**
   * 템플릿: 길러에게 새로운 미션(배송 요청) 매칭 알림
   */
  static async sendNewMissionAlimtalk(recipientNo: string, missionData: {
    pickup: string;
    dropoff: string;
    reward: string;
  }): Promise<boolean> {
    return this.sendAlimtalk({
      recipientNo,
      templateCode: 'NEW_MISSION_V1', // NHN 콘솔에 등록된 템플릿 코드
      templateParams: {
        pickup: missionData.pickup,
        dropoff: missionData.dropoff,
        reward: missionData.reward,
      }
    });
  }
}