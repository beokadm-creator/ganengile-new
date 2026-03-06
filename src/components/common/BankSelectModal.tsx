/**
 * Bank Select Modal
 * 한국 은행 리스트 선택 모달
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Platform } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (bank: string) => void;
  selectedBank?: string;
}

const KOREAN_BANKS = [
  'KB국민은행',
  '신한은행',
  '우리은행',
  '하나은행',
  'KEB하나은행',
  'SC제일은행',
  '국민은행',
  '농협은행',
  '지역농축협동조합',
  'Sh수협동은행',
  '부산은행',
  '대구은행',
  '광주은행',
  '제주은행',
  '전북은행',
  '경남은행',
  '산업은행',
  '중소기업은행',
  '수협은행',
  '저축은행',
  '새마을금고',
  '신협은행',
  '카카오뱅크',
  '토스뱅크',
  '케이뱅크',
] as const;

export default function BankSelectModal({ visible, onClose, onSelect, selectedBank }: Props) {
  const [search, setSearch] = useState('');

  const filteredBanks = KOREAN_BANKS.filter((bank) =>
    bank.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>은행 선택</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInputModal
              visible={false}
              value={search}
              onChangeText={setSearch}
              placeholder="은행 검색"
            />
          </View>

          {/* Bank List */}
          <ScrollView style={styles.bankList}>
            {filteredBanks.map((bank) => {
              const isSelected = selectedBank === bank;
              return (
                <TouchableOpacity
                  key={bank}
                  style={[styles.bankItem, isSelected && styles.bankItemSelected]}
                  onPress={() => {
                    onSelect(bank);
                    onClose();
                  }}
                >
                  <Text style={[styles.bankName, isSelected && styles.bankNameSelected]}>
                    {bank}
                  </Text>
                  {isSelected && (
                    <Text style={styles.checkIcon}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

import TextInputModal from './TextInputModal';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f5f5f5',
    margin: 15,
    borderRadius: 8,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  bankList: {
    padding: 15,
  },
  bankItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  bankItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  bankName: {
    fontSize: 16,
  },
  bankNameSelected: {
    color: '#1976d2',
    fontWeight: '600',
  },
  checkIcon: {
    fontSize: 18,
    color: '#1976d2',
    fontWeight: 'bold',
  },
});
