import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category: 'request' | 'giller' | 'payment';
};

const FAQS: FaqItem[] = [
  {
    id: 'request-1',
    question: '배송 요청은 어떻게 만들어요?',
    answer: '배송 요청 화면 하나에서 지금 보내기와 예약 보내기를 선택할 수 있어요.',
    category: 'request',
  },
  {
    id: 'request-2',
    question: '매칭이 안 되면 어떻게 하나요?',
    answer: '긴급 재매칭으로 금액을 조정하거나 예약 보내기로 바꿔 다시 잡을 수 있어요.',
    category: 'request',
  },
  {
    id: 'giller-1',
    question: '길러 전환에는 무엇이 필요한가요?',
    answer: '본인 확인, 정산 계좌 준비, 길러 신청 및 운영 심사 흐름을 완료해야 해요.',
    category: 'giller',
  },
  {
    id: 'payment-1',
    question: '정산과 출금은 언제 처리되나요?',
    answer: '배송 완료 후 정산 조건을 확인하고, 출금 가능 상태가 되면 요청할 수 있어요.',
    category: 'payment',
  },
];

function getCategoryLabel(category: 'all' | FaqItem['category']): string {
  switch (category) {
    case 'request':
      return '요청';
    case 'giller':
      return '길러';
    case 'payment':
      return '정산';
    default:
      return '전체';
  }
}

export default function CustomerServiceScreen() {
  const [category, setCategory] = useState<'all' | FaqItem['category']>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inquiryText, setInquiryText] = useState('');

  const filteredFaqs = useMemo(() => {
    if (category === 'all') {
      return FAQS;
    }

    return FAQS.filter((item) => item.category === category);
  }, [category]);

  const submitInquiry = (): void => {
    if (!inquiryText.trim()) {
      Alert.alert(
        '문의 내용을 입력해 주세요',
        '간단한 상황 설명을 적어 주시면 운영팀이 더 빠르게 확인할 수 있어요.'
      );
      return;
    }

    Alert.alert('문의 접수 완료', '운영팀이 내용을 확인하고 순서대로 안내해 드릴게요.');
    setInquiryText('');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>고객센터</Text>
        <Text style={styles.subtitle}>
          자주 묻는 질문과 1:1 문의를 같은 화면에서 정리해 두었어요.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>문의 접수</Text>
        <TextInput
          style={styles.textArea}
          value={inquiryText}
          onChangeText={setInquiryText}
          placeholder="문의하실 내용이나 문제 상황을 적어 주세요"
          multiline
        />
        <TouchableOpacity style={styles.primaryButton} onPress={submitInquiry}>
          <Text style={styles.primaryButtonText}>문의 접수</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>FAQ</Text>
        <View style={styles.chipRow}>
          {(['all', 'request', 'giller', 'payment'] as const).map((value) => {
            const active = category === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.chip, active ? styles.chipActive : undefined]}
                onPress={() => setCategory(value)}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : undefined]}>
                  {getCategoryLabel(value)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {filteredFaqs.map((item) => {
          const expanded = expandedId === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.faqCard}
              onPress={() => setExpandedId(expanded ? null : item.id)}
            >
              <Text style={styles.faqQuestion}>{item.question}</Text>
              {expanded ? <Text style={styles.faqAnswer}>{item.answer}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.lg },
  header: { gap: Spacing.sm },
  title: { fontSize: Typography.fontSize['3xl'], fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: Typography.fontSize.base, lineHeight: 22, color: Colors.textSecondary },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md },
  sectionTitle: { fontSize: Typography.fontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.base,
    textAlignVertical: 'top',
    color: Colors.textPrimary,
    backgroundColor: Colors.gray100,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
  },
  primaryButtonText: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.surface },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primaryMint },
  chipText: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary },
  faqCard: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md, gap: Spacing.sm },
  faqQuestion: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.textPrimary },
  faqAnswer: { fontSize: Typography.fontSize.base, lineHeight: 20, color: Colors.textSecondary },
});
