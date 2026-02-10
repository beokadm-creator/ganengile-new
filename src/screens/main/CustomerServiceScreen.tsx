/**
 * Customer Service Screen
 * 고객센터 화면
 * 도움말, 문의하기, FAQ
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

// 더미데이터
const faqs: FAQ[] = [
  {
    id: '1',
    question: '배송 요청은 어떻게 하나요?',
    answer: '홈 화면에서 "배송 요청하기" 버튼을 눌러 출발역, 도착역, 시간을 입력하면 됩니다.',
    category: '이용',
  },
  {
    id: '2',
    question: '동선은 최대 몇 개까지 등록할 수 있나요?',
    answer: '최대 5개까지 동선을 등록할 수 있습니다.',
    category: '이용',
  },
  {
    id: '3',
    question: '수익은 언제 지급되나요?',
    answer: '배송 완료 후 즉시 지급됩니다. 최소 10,000원부터 출금 가능합니다.',
    category: '길러',
  },
  {
    id: '4',
    question: '플랫폼 수수료는 얼마인가요?',
    answer: '총 요금의 10%가 수수료로 차감되며, 별도 3.3%의 원천징수세가 부과됩니다.',
    category: '요금',
  },
  {
    id: '5',
    question: '매칭이 안되면 어떻게 하나요?',
    answer: '30분 내 매칭이 실패하면 알림이 발송됩니다. 시간대를 변경하거나 요금을 증액하여 재요청할 수 있습니다.',
    category: '이용',
  },
  {
    id: '6',
    question: '길러 신원 확인은 왜 필요한가요?',
    answer: '안전한 배송을 위해 실명 확인과 신분증 인증이 필요합니다.',
    category: '길러',
  },
];

export default function CustomerServiceScreen({ navigation }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [inquiryText, setInquiryText] = useState('');

  const categories = ['전체', '이용', '길러', '요금'];

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredFaqs = selectedCategory === '전체'
    ? faqs
    : faqs.filter((faq) => faq.category === selectedCategory);

  const handleSubmitInquiry = () => {
    if (!inquiryText.trim()) {
      Alert.alert('알림', '문의 내용을 입력해주세요.');
      return;
    }

    Alert.alert(
      '문의 접수',
      '문의가 접수되었습니다. 24시간 이내에 답변 드리겠습니다.',
      [
        {
          text: '확인',
          onPress: () => {
            setInquiryText('');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>고객센터</Text>
        <Text style={styles.headerSubtitle}>도움이 필요하시면 문의해주세요</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Contact Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>문의하기</Text>

          <TouchableOpacity style={styles.contactCard}>
            <Text style={styles.contactIcon}>💬</Text>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>1:1 채팅 상담</Text>
              <Text style={styles.contactSubtitle}>평일 09:00 - 18:00</Text>
            </View>
            <Text style={styles.contactArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactCard}>
            <Text style={styles.contactIcon}>📞</Text>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>전화 상담</Text>
              <Text style={styles.contactSubtitle}>1588-0000</Text>
            </View>
            <Text style={styles.contactArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactCard}>
            <Text style={styles.contactIcon}>📧</Text>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>이메일 문의</Text>
              <Text style={styles.contactSubtitle}>support@ganengile.com</Text>
            </View>
            <Text style={styles.contactArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Inquiry Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>문의 작성하기</Text>

          <View style={styles.formCard}>
            <Text style={styles.formLabel}>문의 내용</Text>
            <TextInput
              style={styles.formInput}
              placeholder="문의하실 내용을 입력해주세요"
              value={inquiryText}
              onChangeText={setInquiryText}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmitInquiry}>
              <Text style={styles.submitButtonText}>문의 접수</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>자주 묻는 질문</Text>

          {/* Category Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryFilter}
            contentContainerStyle={styles.categoryFilterContent}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  selectedCategory === category && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === category && styles.categoryChipTextActive,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* FAQ List */}
          {filteredFaqs.map((faq) => (
            <TouchableOpacity
              key={faq.id}
              style={styles.faqCard}
              onPress={() => toggleExpand(faq.id)}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <Text style={styles.faqExpandIcon}>{expandedId === faq.id ? '▼' : '▶'}</Text>
              </View>

              {expandedId === faq.id && (
                <View style={styles.faqAnswerContainer}>
                  <View style={styles.faqCategoryBadge}>
                    <Text style={styles.faqCategoryText}>{faq.category}</Text>
                  </View>
                  <Text style={styles.faqAnswer}>{faq.answer}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#607D8B',
    padding: 20,
    paddingTop: 60,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  contactIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  contactSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  contactArrow: {
    fontSize: 24,
    color: '#999',
    fontWeight: 'bold',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#607D8B',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  categoryFilter: {
    marginBottom: 12,
  },
  categoryFilterContent: {
    paddingRight: 8,
  },
  categoryChip: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryChipActive: {
    backgroundColor: '#607D8B',
    borderColor: '#607D8B',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#666',
  },
  categoryChipTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  faqCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    paddingRight: 8,
  },
  faqExpandIcon: {
    fontSize: 14,
    color: '#999',
  },
  faqAnswerContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    padding: 16,
    backgroundColor: '#f9f9f9',
  },
  faqCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  faqCategoryText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '600',
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
