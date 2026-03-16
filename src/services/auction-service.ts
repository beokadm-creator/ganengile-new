import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  runTransaction,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Auction,
  Bid,
  CreateAuctionData,
  CreateBidData,
  AuctionFilterOptions,
  AuctionListItem,
  AuctionConfig,
} from '../types/auction';
import { AuctionType, AuctionStatus, BidStatus, AUCTION_COLLECTIONS } from '../types/auction';

const DEFAULT_AUCTION_CONFIG: AuctionConfig = {
  durationMinutes: 30,
  minBidIncrement: 500,
  autoExtend: true,
  autoExtendMinutes: 5,
};

export async function createAuction(data: CreateAuctionData): Promise<Auction> {
  validateAuctionData(data);

  const now = new Date();
  const durationMinutes = data.durationMinutes || 30;
  const endsAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

  const config: AuctionConfig = {
    ...DEFAULT_AUCTION_CONFIG,
    ...data.config,
    durationMinutes,
  };

  const auctionData: Omit<Auction, 'auctionId'> = {
    auctionType: AuctionType.REVERSE_AUCTION,
    requestId: data.requestId,
    gllerId: data.gllerId,
    gllerName: data.gllerName,
    pickupStation: data.pickupStation,
    deliveryStation: data.deliveryStation,
    packageSize: data.packageSize,
    packageWeight: data.packageWeight,
    packageDescription: data.packageDescription,
    baseFee: data.baseFee,
    distanceFee: data.distanceFee || 0,
    weightFee: data.weightFee || 0,
    sizeFee: data.sizeFee || 0,
    serviceFee: data.serviceFee || 0,
    vat: Math.round((data.baseFee + (data.distanceFee || 0)) * 0.1),
    currentHighestBid: data.baseFee,
    startedAt: Timestamp.fromDate(now),
    endsAt: Timestamp.fromDate(endsAt),
    preferredPickupTime: data.preferredPickupTime,
    preferredDeliveryTime: data.preferredDeliveryTime,
    deliveryDeadline: data.deliveryDeadline ? Timestamp.fromDate(data.deliveryDeadline) : undefined,
    status: AuctionStatus.ACTIVE,
    totalBids: 0,
    config,
    specialInstructions: data.specialInstructions,
    isFragile: data.isFragile,
    isPerishable: data.isPerishable,
    recipientName: data.recipientName,
    recipientPhone: data.recipientPhone,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  const docRef = await addDoc(collection(db, AUCTION_COLLECTIONS.AUCTIONS), auctionData);

  return {
    auctionId: docRef.id,
    ...auctionData,
  };
}

export async function placeBid(data: CreateBidData): Promise<Bid> {
  const { auctionId, gllerId, gllerName, bidAmount, message } = data;

  return await runTransaction(db, async (transaction) => {
    const auctionRef = doc(db, AUCTION_COLLECTIONS.AUCTIONS, auctionId);
    const auctionDoc = await transaction.get(auctionRef);

    if (!auctionDoc.exists()) {
      throw new Error('경매를 찾을 수 없습니다.');
    }

    const auction = auctionDoc.data() as Auction;

    if (auction.status !== AuctionStatus.ACTIVE) {
      throw new Error('진행 중인 경매에만 입찰할 수 있습니다.');
    }

    if (auction.gllerId === gllerId) {
      throw new Error('자신의 경매에 입찰할 수 없습니다.');
    }

    const now = new Date();
    const endsAt = auction.endsAt.toDate();

    if (now >= endsAt) {
      throw new Error('경매가 이미 마감되었습니다.');
    }

    const minBid = auction.currentHighestBid + auction.config.minBidIncrement;
    if (bidAmount < minBid) {
      throw new Error(`최소 입찰가는 ${minBid.toLocaleString()}원입니다.`);
    }

    const bidData: Omit<Bid, 'bidId'> = {
      auctionId,
      gllerId,
      gllerName,
      bidAmount,
      message,
      status: BidStatus.PENDING,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    const bidRef = doc(collection(db, AUCTION_COLLECTIONS.BIDS));
    transaction.set(bidRef, bidData);

    let newEndsAt = auction.endsAt;
    if (auction.config.autoExtend) {
      const remainingMs = endsAt.getTime() - now.getTime();
      const extendThresholdMs = 5 * 60 * 1000;
      if (remainingMs <= extendThresholdMs) {
        newEndsAt = Timestamp.fromDate(new Date(endsAt.getTime() + auction.config.autoExtendMinutes * 60 * 1000));
      }
    }

    const updateData: Partial<Auction> = {
      currentHighestBid: bidAmount,
      currentHighestBidderId: gllerId,
      currentHighestBidderName: gllerName,
      totalBids: auction.totalBids + 1,
      endsAt: newEndsAt,
      updatedAt: serverTimestamp() as Timestamp,
    };

    transaction.update(auctionRef, updateData);

    return {
      bidId: bidRef.id,
      ...bidData,
    };
  });
}

export async function closeAuction(auctionId: string): Promise<Auction> {
  const auctionRef = doc(db, AUCTION_COLLECTIONS.AUCTIONS, auctionId);

  return await runTransaction(db, async (transaction) => {
    const auctionDoc = await transaction.get(auctionRef);

    if (!auctionDoc.exists()) {
      throw new Error('경매를 찾을 수 없습니다.');
    }

    const auction = auctionDoc.data() as Auction;

    if (auction.status !== AuctionStatus.ACTIVE) {
      throw new Error('진행 중인 경매만 마감할 수 있습니다.');
    }

    const updateData: Partial<Auction> = {
      status: auction.totalBids > 0 ? AuctionStatus.CLOSED : AuctionStatus.EXPIRED,
      updatedAt: serverTimestamp() as Timestamp,
    };

    if (auction.currentHighestBidderId) {
      updateData.winningBidAmount = auction.currentHighestBid;
      updateData.winnerId = auction.currentHighestBidderId;
      updateData.winnerName = auction.currentHighestBidderName;
      updateData.actualEndsAt = serverTimestamp() as Timestamp;
    }

    transaction.update(auctionRef, updateData);

    if (auction.currentHighestBidderId) {
      const bidsQuery = query(
        collection(db, AUCTION_COLLECTIONS.BIDS),
        where('auctionId', '==', auctionId)
      );
      const bidsSnapshot = await getDocs(bidsQuery);

      bidsSnapshot.forEach((bidDoc) => {
        const bidData = bidDoc.data();
        const newStatus = bidData.gllerId === auction.currentHighestBidderId
          ? BidStatus.WON
          : BidStatus.LOST;

        transaction.update(doc(db, AUCTION_COLLECTIONS.BIDS, bidDoc.id), {
          status: newStatus,
          updatedAt: serverTimestamp() as Timestamp,
        });
      });
    }

    return {
      ...auction,
      ...updateData,
    };
  });
}

export async function cancelAuction(auctionId: string, reason?: string): Promise<Auction> {
  const auctionRef = doc(db, AUCTION_COLLECTIONS.AUCTIONS, auctionId);
  const auctionDoc = await getDoc(auctionRef);

  if (!auctionDoc.exists()) {
    throw new Error('경매를 찾을 수 없습니다.');
  }

  const auction = auctionDoc.data() as Auction;

  if (auction.status === AuctionStatus.CLOSED || auction.status === AuctionStatus.CANCELLED) {
    throw new Error('이미 완료되거나 취소된 경매는 취소할 수 없습니다.');
  }

  await updateDoc(auctionRef, {
    status: AuctionStatus.CANCELLED,
    updatedAt: serverTimestamp() as Timestamp,
  });

  const bidsQuery = query(
    collection(db, AUCTION_COLLECTIONS.BIDS),
    where('auctionId', '==', auctionId)
  );
  const bidsSnapshot = await getDocs(bidsQuery);

  for (const bidDoc of bidsSnapshot.docs) {
    await updateDoc(doc(db, AUCTION_COLLECTIONS.BIDS, bidDoc.id), {
      status: BidStatus.CANCELLED,
      updatedAt: serverTimestamp() as Timestamp,
    });
  }

  const updatedDoc = await getDoc(auctionRef);
  return { auctionId, ...updatedDoc.data() } as Auction;
}

export function subscribeToAuction(
  auctionId: string,
  callback: (auction: Auction | null) => void
): Unsubscribe {
  const auctionRef = doc(db, AUCTION_COLLECTIONS.AUCTIONS, auctionId);

  return onSnapshot(auctionRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      callback({
        auctionId: docSnapshot.id,
        ...docSnapshot.data(),
      } as Auction);
    } else {
      callback(null);
    }
  });
}

export function subscribeToAuctionBids(
  auctionId: string,
  callback: (bids: Bid[]) => void
): Unsubscribe {
  const bidsQuery = query(
    collection(db, AUCTION_COLLECTIONS.BIDS),
    where('auctionId', '==', auctionId),
    orderBy('bidAmount', 'desc'),
    limit(20)
  );

  return onSnapshot(bidsQuery, (snapshot) => {
    const bids: Bid[] = [];
    snapshot.forEach((docSnapshot) => {
      bids.push({
        bidId: docSnapshot.id,
        ...docSnapshot.data(),
      } as Bid);
    });
    callback(bids);
  });
}

export async function getAuctionById(auctionId: string): Promise<Auction | null> {
  const docRef = doc(db, AUCTION_COLLECTIONS.AUCTIONS, auctionId);
  const docSnapshot = await getDoc(docRef);

  if (!docSnapshot.exists()) {
    return null;
  }

  return {
    auctionId: docSnapshot.id,
    ...docSnapshot.data(),
  } as Auction;
}

export async function getActiveAuctions(options?: AuctionFilterOptions): Promise<Auction[]> {
  let q = query(
    collection(db, AUCTION_COLLECTIONS.AUCTIONS),
    where('status', '==', AuctionStatus.ACTIVE),
    orderBy('endsAt', 'asc')
  );

  if (options?.limit) {
    q = query(q, limit(options.limit));
  }

  const snapshot = await getDocs(q);
  const auctions: Auction[] = [];

  snapshot.forEach((docSnapshot) => {
    auctions.push({
      auctionId: docSnapshot.id,
      ...docSnapshot.data(),
    } as Auction);
  });

  return auctions;
}

export async function getAuctionsByGller(gllerId: string): Promise<Auction[]> {
  const q = query(
    collection(db, AUCTION_COLLECTIONS.AUCTIONS),
    where('gllerId', '==', gllerId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  const auctions: Auction[] = [];

  snapshot.forEach((docSnapshot) => {
    auctions.push({
      auctionId: docSnapshot.id,
      ...docSnapshot.data(),
    } as Auction);
  });

  return auctions;
}

export async function getBidsByGller(gllerId: string): Promise<(Bid & { auction?: Auction })[]> {
  const q = query(
    collection(db, AUCTION_COLLECTIONS.BIDS),
    where('gllerId', '==', gllerId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  const bids: (Bid & { auction?: Auction })[] = [];

  for (const docSnapshot of snapshot.docs) {
    const bid = {
      bidId: docSnapshot.id,
      ...docSnapshot.data(),
    } as Bid;

    const auction = await getAuctionById(bid.auctionId);
    bids.push({ ...bid, auction: auction || undefined });
  }

  return bids;
}

export async function getAuctionBids(auctionId: string): Promise<Bid[]> {
  const q = query(
    collection(db, AUCTION_COLLECTIONS.BIDS),
    where('auctionId', '==', auctionId),
    orderBy('bidAmount', 'desc')
  );

  const snapshot = await getDocs(q);
  const bids: Bid[] = [];

  snapshot.forEach((docSnapshot) => {
    bids.push({
      bidId: docSnapshot.id,
      ...docSnapshot.data(),
    } as Bid);
  });

  return bids;
}

export function toAuctionListItem(auction: Auction, userId?: string): AuctionListItem {
  const now = new Date();
  const endsAt = auction.endsAt.toDate();
  const remainingMs = Math.max(0, endsAt.getTime() - now.getTime());
  const remainingSeconds = Math.floor(remainingMs / 1000);

  return {
    auctionId: auction.auctionId,
    pickupStationName: auction.pickupStation.stationName,
    deliveryStationName: auction.deliveryStation.stationName,
    currentHighestBid: auction.currentHighestBid,
    baseFee: auction.baseFee,
    remainingSeconds,
    totalBids: auction.totalBids,
    status: auction.status,
    packageSize: auction.packageSize,
    gllerName: auction.gllerName,
    createdAt: auction.createdAt,
    endsAt: auction.endsAt,
  };
}

function validateAuctionData(data: CreateAuctionData): void {
  if (!data.gllerId) {
    throw new Error('요청자 ID가 필요합니다.');
  }

  if (!data.pickupStation || !data.deliveryStation) {
    throw new Error('픽업 역과 배송 역을 선택해주세요.');
  }

  if (data.pickupStation.stationId === data.deliveryStation.stationId) {
    throw new Error('픽업 역과 배송 역이 같을 수 없습니다.');
  }

  if (!data.baseFee || data.baseFee < 3000) {
    throw new Error('기본 요금은 3,000원 이상이어야 합니다.');
  }

  if (data.packageWeight && data.packageWeight > 30) {
    throw new Error('무게는 30kg 이하여야 합니다.');
  }
}

export async function getAuctionStatistics(gllerId?: string): Promise<{
  totalAuctions: number;
  activeAuctions: number;
  completedAuctions: number;
  totalBids: number;
  averageWinningBid: number;
  totalTransactionAmount: number;
}> {
  let q = query(collection(db, AUCTION_COLLECTIONS.AUCTIONS));

  if (gllerId) {
    q = query(q, where('gllerId', '==', gllerId));
  }

  const snapshot = await getDocs(q);
  const auctions: Auction[] = [];

  snapshot.forEach((docSnapshot) => {
    auctions.push({
      auctionId: docSnapshot.id,
      ...docSnapshot.data(),
    } as Auction);
  });

  const totalAuctions = auctions.length;
  const activeAuctions = auctions.filter(a => a.status === AuctionStatus.ACTIVE).length;
  const completedAuctions = auctions.filter(a => a.status === AuctionStatus.CLOSED).length;

  const closedAuctions = auctions.filter(a => a.status === AuctionStatus.CLOSED && a.winningBidAmount);
  const totalBids = auctions.reduce((sum, a) => sum + a.totalBids, 0);
  const totalTransactionAmount = closedAuctions.reduce((sum, a) => sum + (a.winningBidAmount || 0), 0);
  const averageWinningBid = closedAuctions.length > 0
    ? totalTransactionAmount / closedAuctions.length
    : 0;

  return {
    totalAuctions,
    activeAuctions,
    completedAuctions,
    totalBids,
    averageWinningBid,
    totalTransactionAmount,
  };
}

const auctionService = {
  createAuction,
  placeBid,
  closeAuction,
  cancelAuction,
  subscribeToAuction,
  subscribeToAuctionBids,
  getAuctionById,
  getActiveAuctions,
  getAuctionsByGller,
  getBidsByGller,
  getAuctionBids,
  toAuctionListItem,
  getAuctionStatistics,
};

export default auctionService;
