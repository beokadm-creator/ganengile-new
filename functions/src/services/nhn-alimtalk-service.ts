import axios from 'axios';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

export interface NHNConfig {
  appKey: string;
  secretKey: string;
  senderKey: string;
  templates: {
    newMission: string;
    requestAccepted: string;
    deliveryCompleted: string;
  };
}

// 환경 변수 및 Firestore에서 NHN Cloud 설정 로드
const getNHNConfig = async (): Promise<NHNConfig> => {
  const defaultTemplates = {
    newMission: 'NEW_MISSION_V1',
    requestAccepted: 'REQUEST_ACCEPTED_V1',
    deliveryCompleted: 'DELIVERY_COMPLETED_V1',
  };

  try {
    const db = admin.firestore();
    const doc = await db.collection('system_settings').doc('nhn_alimtalk').get();
    
    if (doc.exists) {
      const data = doc.data();
      return {
        appKey: data?.appKey || process.env.NHN_APP_KEY || functions.config().nhn?.appkey || 'DEMO_APP_KEY',
        secretKey: data?.secretKey || process.env.NHN_SECRET_KEY || functions.config().nhn?.secretkey || 'DEMO_SECRET_KEY',
        senderKey: data?.senderKey || process.env.NHN_SENDER_KEY || functions.config().nhn?.senderkey || 'DEMO_SENDER_KEY',
        templates: {
          newMission: data?.templates?.newMission || defaultTemplates.newMission,
          requestAccepted: data?.templates?.requestAccepted || defaultTemplates.requestAccepted,
          deliveryCompleted: data?.templates?.deliveryCompleted || defaultTemplates.deliveryCompleted,
        },
      };
    }
  } catch (error) {
    console.error('[NHN Alimtalk] Failed to load config from Firestore, falling back to env variables:', error);
  }

  // Fallback to env variables
  return {
    appKey: process.env.NHN_APP_KEY || functions.config().nhn?.appkey || 'DEMO_APP_KEY',
    secretKey: process.env.NHN_SECRET_KEY || functions.config().nhn?.secretkey || 'DEMO_SECRET_KEY',
    senderKey: process.env.NHN_SENDER_KEY || functions.config().nhn?.senderkey || 'DEMO_SENDER_KEY',
    templates: defaultTemplates,
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
    const config = await getNHNConfig();

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
        console.info(`[NHN Alimtalk] 발송 성공: ${params.recipientNo}`);
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
    const config = await getNHNConfig();
    return this.sendAlimtalk({
      recipientNo,
      templateCode: config.templates.newMission,
      templateParams: {
        pickup: missionData.pickup,
        dropoff: missionData.dropoff,
        reward: missionData.reward,
      }
    });
  }
}