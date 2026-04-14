import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BorderRadius, Colors, Shadows, Spacing } from '../../theme';
import { Typography } from '../../theme/typography';
import { searchRoadAddresses, type RoadAddressSearchItem } from '../../services/address-search-service';

interface AddressSearchModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSelectAddress: (item: RoadAddressSearchItem) => void;
}

export default function AddressSearchModal({
  visible,
  title,
  onClose,
  onSelectAddress,
}: AddressSearchModalProps) {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RoadAddressSearchItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const helperText = useMemo(() => {
    if (errorMessage) {
      return errorMessage;
    }

    if (!keyword.trim()) {
      return '도로명, 건물명, 지번으로 검색할 수 있습니다.';
    }

    if (keyword.trim().length < 2) {
      return '검색어를 2자 이상 입력해 주세요.';
    }

    return '';
  }, [errorMessage, keyword]);

  async function handleSearch() {
    const trimmed = keyword.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const items = await searchRoadAddresses(trimmed);
      setResults(items);
      if (items.length === 0) {
        setErrorMessage('검색 결과가 없습니다. 다른 키워드로 다시 시도해 주세요.');
      }
    } catch (error) {
      setResults([]);
      setErrorMessage(error instanceof Error ? error.message : '주소 검색에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(item: RoadAddressSearchItem) {
    onSelectAddress(item);
    onClose();
    setKeyword('');
    setResults([]);
    setErrorMessage('');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeText}>닫기</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.input}
              value={keyword}
              onChangeText={setKeyword}
              placeholder="도로명 주소 검색"
              placeholderTextColor={Colors.gray400}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => {
                void handleSearch();
              }}
            />
            <TouchableOpacity style={styles.searchButton} onPress={() => void handleSearch()}>
              <Text style={styles.searchButtonText}>검색</Text>
            </TouchableOpacity>
          </View>

          {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

          <ScrollView style={styles.resultList} contentContainerStyle={styles.resultContent}>
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : (
              results.map((item) => (
                <TouchableOpacity
                  key={`${item.admCd}-${item.rnMgtSn}-${item.bdMgtSn}-${item.roadAddress}`}
                  style={styles.resultItem}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={styles.resultTitle}>{item.roadAddress}</Text>
                  <Text style={styles.resultMeta}>
                    {item.jibunAddress || '지번 주소 정보 없음'}
                    {item.zipCode ? ` · ${item.zipCode}` : ''}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    maxHeight: '82%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['4xl'],
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
  },
  closeText: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
  },
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.gray50,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
  },
  searchButton: {
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.bold,
  },
  helperText: {
    marginTop: Spacing.sm,
    color: Colors.textSecondary,
    ...Typography.bodySmall,
  },
  resultList: {
    marginTop: Spacing.md,
  },
  resultContent: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  resultItem: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    gap: 4,
  },
  resultTitle: {
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.bold,
  },
  resultMeta: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
  },
  center: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
