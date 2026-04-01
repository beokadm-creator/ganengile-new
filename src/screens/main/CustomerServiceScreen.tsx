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
    answer: '요청 화면에서 즉시형 또는 예약형으로 배송 요청을 만들 수 있어요.',
    category: 'request',
  },
  {
    id: 'request-2',
    question: '매칭이 안 되면 어떻게 하나요?',
    answer: '긴급 재매칭으로 금액을 조정하거나 예약형으로 전환해 다시 잡을 수 있어요.',
    category: 'request',
  },
  {
    id: 'giller-1',
    question: '길러 승급에는 무엇이 필요한가요?',
    answer: '본인 확인, 정산 계좌 준비, 운영 심사 흐름을 완료해야 해요.',
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 16 },
  header: { gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#64748B' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    textAlignVertical: 'top',
    color: '#0F172A',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: '#2563EB',
  },
  primaryButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#DBEAFE' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  chipTextActive: { color: '#1D4ED8' },
  faqCard: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12, gap: 8 },
  faqQuestion: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  faqAnswer: { fontSize: 14, lineHeight: 20, color: '#475569' },
});
