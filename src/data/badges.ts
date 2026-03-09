/**
 * Badges data stub
 * TODO: Implement actual badges data
 */

import { Badge, BadgeCategory, BadgeTier } from '../types/user';

export const INITIAL_BADGES: Badge[] = [];

export function findBadgeById(id: string): Badge | undefined {
  return INITIAL_BADGES.find(b => b.id === id);
}

export function getBadgesByCategory(category: BadgeCategory): Badge[] {
  return INITIAL_BADGES.filter(b => b.category === category);
}

export function getBadgesByTier(tier: BadgeTier): Badge[] {
  return INITIAL_BADGES.filter(b => b.tier === tier);
}
