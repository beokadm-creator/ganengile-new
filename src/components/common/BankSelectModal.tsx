import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Typography } from '../../theme';

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
  'SC제일은행',
  '기업은행',
  'NH농협은행',
  '수협은행',
  '부산은행',
  '대구은행',
  '광주은행',
  '전북은행',
  '경남은행',
  '카카오뱅크',
  '케이뱅크',
  '토스뱅크',
  '새마을금고',
  '우체국',
] as const;

export default function BankSelectModal({ visible, onClose, onSelect, selectedBank }: Props) {
  const [search, setSearch] = useState('');

  const filteredBanks = useMemo(
    () => KOREAN_BANKS.filter((bank) => bank.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>은행 선택</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>닫기</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Text style={styles.searchLabel}>검색</Text>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="은행 이름 검색"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <ScrollView style={styles.bankList} keyboardShouldPersistTaps="handled">
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
                  <Text style={[styles.bankName, isSelected && styles.bankNameSelected]}>{bank}</Text>
                  {isSelected ? <Text style={styles.checkIcon}>선택됨</Text> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
    color: '#0F172A',
  },
  closeButton: {
    fontSize: Typography.fontSize.base,
    color: '#64748B',
    fontWeight: Typography.fontWeight.bold,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 8,
  },
  searchLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: '#64748B',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: Typography.fontSize.base,
    color: '#0F172A',
  },
  bankList: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  bankItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  bankItemSelected: {
    backgroundColor: '#F0FDFA',
  },
  bankName: {
    fontSize: Typography.fontSize.lg,
    color: '#0F172A',
  },
  bankNameSelected: {
    color: '#0F766E',
    fontWeight: Typography.fontWeight.extrabold,
  },
  checkIcon: {
    fontSize: Typography.fontSize.sm,
    color: '#0F766E',
    fontWeight: Typography.fontWeight.extrabold,
  },
});
