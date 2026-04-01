import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();

  const [
    stationsCount,
    travelTimesCount,
    expressCount,
    congestionCount,
    draftCount,
    missionCount,
    deliveryLegCount,
    aiConfigSnap,
  ] = await Promise.all([
    db.collection('config_stations').count().get(),
    db.collection('config_travel_times').count().get(),
    db.collection('config_express_trains').count().get(),
    db.collection('config_congestion').count().get(),
    db.collection('request_drafts').count().get(),
    db.collection('missions').count().get(),
    db.collection('delivery_legs').count().get(),
    db.collection('config_integrations').doc('ai').get(),
  ]);

  const aiConfig = (aiConfigSnap.data() ?? {}) as Record<string, unknown>;

  return NextResponse.json({
    stationCatalog: {
      totalStations: stationsCount.data().count,
      stationsReady: stationsCount.data().count > 0,
    },
    routing: {
      travelTimeEdges: travelTimesCount.data().count,
      expressLines: expressCount.data().count,
      congestionLines: congestionCount.data().count,
    },
    beta1Engine: {
      requestDrafts: draftCount.data().count,
      missions: missionCount.data().count,
      deliveryLegs: deliveryLegCount.data().count,
    },
    ai: {
      enabled: Boolean(aiConfig.enabled ?? false),
      provider: typeof aiConfig.provider === 'string' ? aiConfig.provider : 'unknown',
      model: typeof aiConfig.model === 'string' ? aiConfig.model : 'unknown',
      disableThinking: Boolean(aiConfig.disableThinking ?? true),
    },
  });
}
