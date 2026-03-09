/**
 * Badge Service Stub
 * TODO: Implement actual badge service
 */

import { db } from '../config/firebase';

export const badgeService = {
  async getUserBadges(userId: string) {
    return [];
  },
  
  async awardBadge(userId: string, badgeId: string) {
    return;
  }
};
