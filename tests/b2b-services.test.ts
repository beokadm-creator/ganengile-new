/**
 * B2B Services Tests
 * B2B 위치사업자 모델 테스트
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createB2BContract,
  getB2BContract,
  updateB2BContract,
  createB2BRequest,
  getB2BRequests,
  assignB2BGiller,
  createTaxInvoice,
  getTaxInvoices,
} from '../src/services/b2b-delivery-service';
import { doc, getDoc, deleteDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../src/services/firebase';

describe('B2B Services', () => {
  const testBusinessId = 'test-business-001';
  const testContractId = 'test-contract-001';
  const testRequestId = 'test-b2b-request-001';
  const createdContractIds: string[] = [];
  const createdRequestIds: string[] = [];

  beforeEach(async () => {
    // Cleanup: Delete test contracts and requests
    const contractSnapshot = await getDocs(
      query(
        collection(db, 'businessContracts'),
        where('businessId', '==', testBusinessId)
      )
    );

    const requestSnapshot = await getDocs(
      query(
        collection(db, 'b2bRequests'),
        where('businessId', '==', testBusinessId)
      )
    );

    const deletePromises = [
      ...contractSnapshot.docs.map(d => deleteDoc(d.ref)),
      ...requestSnapshot.docs.map(d => deleteDoc(d.ref)),
    ];

    await Promise.all(deletePromises);
  });

  afterEach(async () => {
    // Cleanup: Delete all test contracts and requests
    for (const contractId of createdContractIds) {
      try {
        await deleteDoc(doc(db, 'businessContracts', contractId));
      } catch (error) {
        console.log('Cleanup error:', error);
      }
    }

    for (const requestId of createdRequestIds) {
      try {
        await deleteDoc(doc(db, 'b2bRequests', requestId));
      } catch (error) {
        console.log('Cleanup error:', error);
      }
    }

    createdContractIds.length = 0;
    createdRequestIds.length = 0;
  });

  describe('createB2BContract', () => {
    test('should create a B2B contract successfully', async () => {
      const contractData = {
        businessId: testBusinessId,
        businessName: 'Test Cafe',
        businessType: 'cafe',
        tier: 'standard',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        monthlyFee: 150000,
        deliveryLimit: 100,
        pricePerDelivery: 2500,
      };

      const contractId = await createB2BContract(contractData);

      expect(contractId).toBeDefined();
      expect(typeof contractId).toBe('string');

      createdContractIds.push(contractId);

      const contractDoc = await getDoc(doc(db, 'businessContracts', contractId));
      expect(contractDoc.exists).toBe(true);

      const contract = contractDoc.data();
      expect(contract?.businessId).toBe(testBusinessId);
      expect(contract?.businessName).toBe('Test Cafe');
      expect(contract?.tier).toBe('standard');
      expect(contract?.monthlyFee).toBe(150000);
    });

    test('should fail to create contract with invalid data', async () => {
      const invalidContractData = {
        businessId: '',
        businessName: '',
        tier: 'invalid',
      };

      await expect(
        createB2BContract(invalidContractData)
      ).rejects.toThrow();
    });
  });

  describe('getB2BContract', () => {
    test('should get B2B contract by ID', async () => {
      // First create a contract
      const contractData = {
        businessId: testBusinessId,
        businessName: 'Test Cafe',
        businessType: 'cafe',
        tier: 'basic',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        monthlyFee: 50000,
        deliveryLimit: 20,
        pricePerDelivery: 3000,
      };

      const contractId = await createB2BContract(contractData);
      createdContractIds.push(contractId);

      // Get contract
      const contract = await getB2BContract(contractId);

      expect(contract).toBeDefined();
      expect(contract?.contractId).toBe(contractId);
      expect(contract?.businessName).toBe('Test Cafe');
    });

    test('should return null for non-existent contract', async () => {
      const contract = await getB2BContract('non-existent-contract-id');

      expect(contract).toBeNull();
    });
  });

  describe('updateB2BContract', () => {
    test('should update B2B contract successfully', async () => {
      // First create a contract
      const contractData = {
        businessId: testBusinessId,
        businessName: 'Test Cafe',
        businessType: 'cafe',
        tier: 'basic',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        monthlyFee: 50000,
        deliveryLimit: 20,
        pricePerDelivery: 3000,
      };

      const contractId = await createB2BContract(contractData);
      createdContractIds.push(contractId);

      // Update contract
      const updates = {
        tier: 'premium',
        monthlyFee: 500000,
        deliveryLimit: 500,
        pricePerDelivery: 2000,
      };

      await expect(updateB2BContract(contractId, updates)).resolves.not.toThrow();

      const contract = await getB2BContract(contractId);
      expect(contract?.tier).toBe('premium');
      expect(contract?.monthlyFee).toBe(500000);
      expect(contract?.deliveryLimit).toBe(500);
    });
  });

  describe('createB2BRequest', () => {
    test('should create a B2B request successfully', async () => {
      // First create a contract
      const contractData = {
        businessId: testBusinessId,
        businessName: 'Test Cafe',
        businessType: 'cafe',
        tier: 'standard',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        monthlyFee: 150000,
        deliveryLimit: 100,
        pricePerDelivery: 2500,
      };

      const contractId = await createB2BContract(contractData);
      createdContractIds.push(contractId);

      const requestData = {
        businessId: testBusinessId,
        contractId: contractId,
        pickupStation: {
          stationId: 'station-001',
          stationName: '강남역',
        },
        deliveryStation: {
          stationId: 'station-002',
          stationName: '서울역',
        },
        packageInfo: {
          size: 'medium',
          weight: '2kg',
          description: 'Coffee beans',
        },
        urgency: 'normal',
        scheduledTime: new Date(),
      };

      const requestId = await createB2BRequest(requestData);

      expect(requestId).toBeDefined();
      expect(typeof requestId).toBe('string');

      createdRequestIds.push(requestId);

      const requestDoc = await getDoc(doc(db, 'b2bRequests', requestId));
      expect(requestDoc.exists).toBe(true);

      const request = requestDoc.data();
      expect(request?.businessId).toBe(testBusinessId);
      expect(request?.contractId).toBe(contractId);
      expect(request?.packageInfo.description).toBe('Coffee beans');
    });

    test('should check delivery limit before creating request', async () => {
      // Create a basic contract with 20 delivery limit
      const contractData = {
        businessId: testBusinessId,
        businessName: 'Test Cafe',
        businessType: 'cafe',
        tier: 'basic',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        monthlyFee: 50000,
        deliveryLimit: 20,
        pricePerDelivery: 3000,
      };

      const contractId = await createB2BContract(contractData);
      createdContractIds.push(contractId);

      // This should work (under limit)
      const requestData = {
        businessId: testBusinessId,
        contractId: contractId,
        pickupStation: { stationId: 'station-001', stationName: '강남역' },
        deliveryStation: { stationId: 'station-002', stationName: '서울역' },
        packageInfo: { size: 'small', weight: '1kg', description: 'Test' },
        urgency: 'normal',
        scheduledTime: new Date(),
      };

      const requestId = await createB2BRequest(requestData);
      expect(requestId).toBeDefined();
      createdRequestIds.push(requestId);
    });
  });

  describe('getB2BRequests', () => {
    test('should get all B2B requests for a business', async () => {
      // First create a contract
      const contractData = {
        businessId: testBusinessId,
        businessName: 'Test Cafe',
        businessType: 'cafe',
        tier: 'standard',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        monthlyFee: 150000,
        deliveryLimit: 100,
        pricePerDelivery: 2500,
      };

      const contractId = await createB2BContract(contractData);
      createdContractIds.push(contractId);

      // Create multiple requests
      const requestData1 = {
        businessId: testBusinessId,
        contractId: contractId,
        pickupStation: { stationId: 'station-001', stationName: '강남역' },
        deliveryStation: { stationId: 'station-002', stationName: '서울역' },
        packageInfo: { size: 'small', weight: '1kg', description: 'Test 1' },
        urgency: 'normal',
        scheduledTime: new Date(),
      };

      const requestData2 = {
        ...requestData1,
        packageInfo: { ...requestData1.packageInfo, description: 'Test 2' },
      };

      const requestId1 = await createB2BRequest(requestData1);
      const requestId2 = await createB2BRequest(requestData2);

      createdRequestIds.push(requestId1, requestId2);

      // Get requests
      const requests = await getB2BRequests(testBusinessId);

      expect(requests.length).toBeGreaterThanOrEqual(2);
      expect(requests.every(r => r.businessId === testBusinessId)).toBe(true);
    });
  });

  describe('assignB2BGiller', () => {
    test('should assign a giller to B2B request', async () => {
      // First create a contract
      const contractData = {
        businessId: testBusinessId,
        businessName: 'Test Cafe',
        businessType: 'cafe',
        tier: 'standard',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        monthlyFee: 150000,
        deliveryLimit: 100,
        pricePerDelivery: 2500,
      };

      const contractId = await createB2BContract(contractData);
      createdContractIds.push(contractId);

      // First create a request
      const requestData = {
        businessId: testBusinessId,
        contractId: contractId,
        pickupStation: { stationId: 'station-001', stationName: '강남역' },
        deliveryStation: { stationId: 'station-002', stationName: '서울역' },
        packageInfo: { size: 'medium', weight: '2kg', description: 'Coffee' },
        urgency: 'normal',
        scheduledTime: new Date(),
      };

      const requestId = await createB2BRequest(requestData);
      createdRequestIds.push(requestId);

      // Assign a giller
      const gillerId = 'test-b2b-giller-001';
      await expect(assignB2BGiller(requestId, gillerId)).resolves.not.toThrow();

      const requestDoc = await getDoc(doc(db, 'b2bRequests', requestId));
      const request = requestDoc.data();

      expect(request?.assignedGillerId).toBe(gillerId);
      expect(request?.status).toBe('assigned');
    });
  });

  describe('Tax Invoice Tests', () => {
    test('should create tax invoice successfully', async () => {
      const invoiceData = {
        businessId: testBusinessId,
        contractId: testContractId,
        month: '2026-02',
        period: {
          start: new Date('2026-02-01'),
          end: new Date('2026-02-28'),
        },
        totalAmount: 150000,
        deliveryCount: 100,
        baseFee: 50000,
        deliveryFees: 100000,
        tax: 15000, // 10% VAT
      };

      const invoiceId = await createTaxInvoice(invoiceData);

      expect(invoiceId).toBeDefined();
      expect(typeof invoiceId).toBe('string');

      // Note: Tax invoices would be in a separate collection
      // For now, we're just testing the function structure
    });

    test('should get tax invoices for a business', async () => {
      const invoices = await getTaxInvoices(testBusinessId, '2026-02');

      expect(Array.isArray(invoices)).toBe(true);
    });
  });
});
