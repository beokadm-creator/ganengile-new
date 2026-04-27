import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
     
    const doc = await db.collection('system_settings').doc('nhn_alimtalk').get();

    if (!doc.exists) {
      return NextResponse.json({
        appKey: '',
        secretKey: '',
        senderKey: '',
        templates: {
          newMission: 'NEW_MISSION_V1',
          requestAccepted: 'REQUEST_ACCEPTED_V1',
          deliveryCompleted: 'DELIVERY_COMPLETED_V1',
        },
      });
    }

    return NextResponse.json(doc.data());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { appKey, secretKey, senderKey, templates } = body;

     
    await db.collection('system_settings').doc('nhn_alimtalk').set({
      appKey: appKey || '',
      secretKey: secretKey || '',
      senderKey: senderKey || '',
      templates: {
        newMission: templates?.newMission || 'NEW_MISSION_V1',
        requestAccepted: templates?.requestAccepted || 'REQUEST_ACCEPTED_V1',
        deliveryCompleted: templates?.deliveryCompleted || 'DELIVERY_COMPLETED_V1',
      },
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}