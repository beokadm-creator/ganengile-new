/**
 * Terms Screen
 * 약관 및 정책 화면
 * 이용약관, 개인정보처리방침, 보증금 정책 등
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

interface Policy {
  id: string;
  title: string;
  content: string[];
  effectiveDate: string;
}

// 더미데이터
const policies: Policy[] = [
  {
    id: 'terms',
    title: '이용약관',
    content: [
      '제1조(목적)',
      '이 약관은 "가는길에"(이하 "회사")가 제공하는 배송 중개 서비스의 이용조건 및 절차를 규정합니다.',
      '',
      '제2조(용어 정의)',
      '"글러"는 배송을 의뢰하는 이용자를 말합니다.',
      '"길러"는 배송을 수행하는 배송자를 말합니다.',
      '"동선"은 길러가 자주 이용하는 지하철 경로를 말합니다.',
      '',
      '제3조(이용 계약의 성립)',
      '회원가입 신청 후 승낙으로 계약이 성립합니다.',
      '만 14세 미만은 이용할 수 없습니다.',
      '',
      '제4조(회원의 의무)',
      '회원은 본인의 실명 정보를 제공해야 합니다.',
      '비밀번호를 안전하게 관리해야 합니다.',
      '타인의 계정을 사용하지 않아야 합니다.',
      '',
      '제5조(서비스 이용)',
      '글러는 배송 요청을 할 수 있습니다.',
      '길러는 동선을 등록하고 배송을 수행할 수 있습니다.',
      '부적절한 목적의 이용을 금지합니다.',
      '',
      '제6조(수수료 및 요금)',
      '플랫폼 수수료: 총 요금의 10%',
      '원천징수세: 수익의 3.3%',
      '보증금: 길러 50,000원, 글러 30,000원',
      '',
      '제7조(페널티)',
      '노쇼: 3회 이상 → 정지 30일',
      '지각: 10분 이상 → 페널티 -50점',
      '취소: 잦은 취소 → 페널티 -30점',
    ],
    effectiveDate: '2026-01-01',
  },
  {
    id: 'privacy',
    title: '개인정보처리방침',
    content: [
      '제1조(개인정보 수집 항목)',
      '필수정보: 이메일, 비밀번호, 이름, 전화번호',
      '선택정보: 프로필 사진, 생년월일',
      '서비스 이용 기록, 결제 기록',
      '',
      '제2조(수집 목적)',
      '회원 관리 및 본인 확인',
      '서비스 제공 및 매칭',
      '결제 및 정산',
      '안전한 배송 환경 조성',
      '',
      '제3조(보관 및 이용 기간)',
      '회원정보: 탈퇴 후 30일',
      '결제기록: 5년',
      '배송기록: 3년',
      '법적 요구 보관: 관련 법령에 따름',
      '',
      '제4조(제3자 제공)',
      '원칙적으로 제3자에게 제공하지 않습니다.',
      '길러의 연락처는 매칭 후 글러에게만 제공됩니다.',
      '법적 요구 시 예외적으로 제공됩니다.',
      '',
      '제5조(이용자의 권리)',
      '개인정보 열람 요구',
      '오류 정정 요구',
      '삭제 요구',
      '처리 정지 요구',
    ],
    effectiveDate: '2026-01-01',
  },
  {
    id: 'deposit',
    title: '보증금 정책',
    content: [
      '보증금 납부 기준',
      '길러: 50,000원',
      '글러: 30,000원',
      '첫 배송/요청 전 납부 필요',
      '',
      '보증금 사용 우선순위',
      '1. 페널티 차감',
      '2. 손해배상',
      '3. 잔액 환불',
      '',
      '페널티 차감 기준',
      '지각: -2,500원 (10분 이상)',
      '노쇼: -10,000원 (사전 연락 없이 불참)',
      '취소: -5,000원 (임의 취소)',
      '불완료: -20,000원 (배송 미완료)',
      '',
      '보증금 환급',
      '회원 탈퇴 시',
      '활동 정지 기간 경과 후',
      '1~5영업일 이내 환불',
      '',
      '보증금 추가 납부',
      '잔액이 10,000원 미만 시',
      '재활동 전 추가 납부 필요',
    ],
    effectiveDate: '2026-02-01',
  },
  {
    id: 'tax',
    title: '세금 정책',
    content: [
      '원천징수세',
      '수익의 3.3% 원천징수',
      '매월 다음달 10일 납부',
      '',
      '종합소득세 신고',
      '연간 수익 300만 원 초과 시',
      '익년 5월 1일~31일 신고',
      '',
      '비과세 대상',
      '연간 수익 300만 원 이하',
      '별도 신고 불필요',
      '',
      '세금 계산 예시',
      '배송 수익: 5,000원',
      '수수료(10%): -500원',
      '세금(3.3%): -149원',
      '실수익: 4,351원',
    ],
    effectiveDate: '2026-02-01',
  },
];

export default function TermsScreen({ navigation: _navigation }: Props) {
  const [selectedPolicy, setSelectedPolicy] = useState<Policy>(policies[0]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>약관 및 정책</Text>
        <Text style={styles.headerSubtitle}>서비스 이용을 위한 필수 약관</Text>
      </View>

      <View style={styles.contentContainer}>
        {/* Sidebar Navigation */}
        <ScrollView
          style={styles.sidebar}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sidebarContent}
        >
          {policies.map((policy) => (
            <TouchableOpacity
              key={policy.id}
              style={[
                styles.sidebarItem,
                selectedPolicy.id === policy.id && styles.sidebarItemActive,
              ]}
              onPress={() => setSelectedPolicy(policy)}
            >
              <Text
                style={[
                  styles.sidebarItemText,
                  selectedPolicy.id === policy.id && styles.sidebarItemTextActive,
                ]}
              >
                {policy.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Policy Content */}
        <ScrollView
          style={styles.policyContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.policyCard}>
            <View style={styles.policyHeader}>
              <Text style={styles.policyTitle}>{selectedPolicy.title}</Text>
              <Text style={styles.policyDate}>
                시행일: {selectedPolicy.effectiveDate}
              </Text>
            </View>

            <View style={styles.policyBody}>
              {selectedPolicy.content.map((paragraph, index) => (
                <Text
                  key={index}
                  style={[
                    styles.policyParagraph,
                    paragraph === '' && styles.policyParagraphSpacing,
                  ]}
                >
                  {paragraph}
                </Text>
              ))}
            </View>
          </View>

          {/* Additional Info */}
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>📌</Text>
            <Text style={styles.infoText}>
              약관 변경 시 최소 30일 전에 공지됩니다. 변경 약관에 동의하지 않을 경우 회원 탈퇴가
              가능합니다.
            </Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>📞</Text>
            <Text style={styles.infoText}>
              약관 관련 문의: 고객센터 또는 support@ganengile.com
            </Text>
          </View>
        </ScrollView>
      </View>

      {/* Agree Button (Optional - for registration flow) */}
      {/* <TouchableOpacity style={styles.agreeButton}>
        <Text style={styles.agreeButtonText}>확인했습니다</Text>
      </TouchableOpacity> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#9E9E9E',
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
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sidebar: {
    width: 120,
    marginRight: 12,
  },
  sidebarContent: {
    paddingBottom: 16,
  },
  sidebarItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sidebarItemActive: {
    backgroundColor: '#9E9E9E',
    borderColor: '#9E9E9E',
  },
  sidebarItemText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  sidebarItemTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  policyContent: {
    flex: 1,
  },
  policyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  policyHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  policyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  policyDate: {
    fontSize: 12,
    color: '#999',
  },
  policyBody: {
    paddingBottom: 16,
  },
  policyParagraph: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    marginBottom: 8,
  },
  policyParagraphSpacing: {
    height: 12,
    marginVertical: 8,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1976D2',
    lineHeight: 20,
  },
  agreeButton: {
    backgroundColor: '#9E9E9E',
    borderRadius: 12,
    margin: 16,
    padding: 16,
    alignItems: 'center',
  },
  agreeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
