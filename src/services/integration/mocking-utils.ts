/**
 * Integration Test Setup
 * Firestore Mock Utilities for Integration Tests
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';

// In-memory Firestore simulator
class MockFirestore {
  private data: Map<string, any> = new Map();

  // Simulates document path generation
  private getPath(collectionName: string, docId?: string): string {
    return docId ? `${collectionName}/${docId}` : `${collectionName}`;
  }

  // Mock collection reference
  collection(name: string) {
    return {
      path: name,
      add: (data: any) => this.addDoc(name, data),
    };
  }

  // Mock document reference
  doc(collectionName: string, docId: string) {
    return {
      id: docId,
      path: this.getPath(collectionName, docId),
      get: () => this.getDoc(collectionName, docId),
      set: (data: any) => this.setDoc(collectionName, docId, data),
      update: (data: any) => this.updateDoc(collectionName, docId, data),
      delete: () => this.deleteDoc(collectionName, docId),
    };
  }

  // Mock query
  query(collectionName: string, constraints: any[]) {
    return {
      get: () => this.getDocs(collectionName, constraints),
    };
  }

  // CRUD operations
  private async addDoc(collectionName: string, data: any): Promise<any> {
    const docId = `doc_${Date.now()}_${Math.random()}`;
    const docData = {
      ...data,
      _id: docId,
      createdAt: serverTimestamp(),
    };
    this.data.set(this.getPath(collectionName, docId), docData);
    return { id: docId };
  }

  private async getDoc(collectionName: string, docId: string): Promise<any> {
    const path = this.getPath(collectionName, docId);
    const data = this.data.get(path);

    if (!data) {
      return {
        exists: false,
        data: () => null,
        id: docId,
      };
    }

    return {
      exists: true,
      data: () => data,
      id: docId,
    };
  }

  private async getDocs(collectionName: string, constraints: any[] = []): Promise<any> {
    const docs: any[] = [];

    for (const [path, data] of this.data.entries()) {
      if (path.startsWith(collectionName + '/')) {
        // Apply constraints (simplified)
        let passesFilters = true;

        for (const constraint of constraints) {
          if (constraint.type === 'where') {
            if (data[constraint.field] !== constraint.value) {
              passesFilters = false;
              break;
            }
          }
        }

        if (passesFilters) {
          docs.push({
            id: data._id,
            data: () => data,
          });
        }
      }
    }

    return { docs };
  }

  private async setDoc(collectionName: string, docId: string, data: any): Promise<void> {
    const path = this.getPath(collectionName, docId);
    this.data.set(path, {
      ...data,
      _id: docId,
      updatedAt: serverTimestamp(),
    });
  }

  private async updateDoc(collectionName: string, docId: string, updates: any): Promise<void> {
    const path = this.getPath(collectionName, docId);
    const existing = this.data.get(path);
    if (existing) {
      this.data.set(path, {
        ...existing,
        ...updates,
        updatedAt: serverTimestamp(),
      });
    }
  }

  private async deleteDoc(collectionName: string, docId: string): Promise<void> {
    const path = this.getPath(collectionName, docId);
    this.data.delete(path);
  }

  // Utility methods
  clear(): void {
    this.data.clear();
  }

  getAll(): Map<string, any> {
    return this.data;
  }

  // Seed test data
  seedData(collectionName: string, documents: any[]): void {
    documents.forEach((doc) => {
      const docId = doc.id || `doc_${Date.now()}_${Math.random()}`;
      this.data.set(this.getPath(collectionName, docId), {
        ...doc,
        _id: docId,
        createdAt: serverTimestamp(),
      });
    });
  }
}

// Global mock Firestore instance
export const mockFirestore = new MockFirestore();

// Helper function to create test data
export function createTestData(type: string, overrides: any = {}): any {
  const templates: any = {
    user: {
      name: '테스터',
      email: 'test@example.com',
      rating: 4.5,
      completedDeliveries: 10,
      isActive: true,
      role: 'gller',
    },
    route: {
      userId: 'user123',
      startStation: { name: '서울역', stationId: 'S001' },
      endStation: { name: '강남역', stationId: 'S002' },
      departureTime: '08:30',
      daysOfWeek: [1, 2, 3, 4, 5],
      isActive: true,
    },
    request: {
      requesterId: 'user123',
      pickupStation: { name: '서울역', stationId: 'S001' },
      deliveryStation: { name: '강남역', stationId: 'S002' },
      packageInfo: {
        size: 'medium',
        weight: 'light',
      },
      fee: {
        baseFee: 3000,
        totalFee: 3500,
      },
      status: 'pending',
    },
    match: {
      requestId: 'req123',
      gillerId: 'giller456',
      matchScore: 85,
      status: 'pending',
    },
  };

  return { ...templates[type], ...overrides };
}

// Helper to wait for async operations
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper to generate random IDs
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
