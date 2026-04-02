import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ParamListBase } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getPolicyHistoryConfigs } from '../../services/config-service';
import { Colors } from '../../theme';

type NavigationProp = StackNavigationProp<ParamListBase>;

interface Props {
  navigation: NavigationProp;
}

interface Policy {
  id: string;
  title: string;
  content: string[];
  effectiveDate: string;
}

const defaultPolicies: Policy[] = [
  {
    id: 'policy-fallback',
    title: '약관 문서',
    effectiveDate: '2026-04-03',
    content: ['관리자에서 등록한 최신 약관을 불러오지 못했습니다.', '잠시 후 다시 시도해 주세요.'],
  },
];

export default function TermsScreen({ navigation: _navigation }: Props) {
  const [policies, setPolicies] = useState<Policy[]>(defaultPolicies);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy>(defaultPolicies[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPolicies = async () => {
      try {
        const configs = await getPolicyHistoryConfigs();
        if (configs.length > 0) {
          const loaded = configs.map((item) => ({
            id: item.policyId,
            title: item.version ? `${item.title} · ${item.version}` : item.title,
            content: item.content,
            effectiveDate: item.effectiveDate,
          }));
          setPolicies(loaded);
          setSelectedPolicy(loaded[0]);
        }
      } catch (error) {
        console.error('약관 문서를 불러오지 못했습니다.', error);
      } finally {
        setLoading(false);
      }
    };

    void loadPolicies();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>약관 문서를 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerKicker}>POLICY CENTER</Text>
        <Text style={styles.headerTitle}>약관 및 동의 이력</Text>
        <Text style={styles.headerSubtitle}>
          관리자에 등록된 약관과 동의 문서를 버전 및 시행일 기준으로 확인할 수 있습니다.
        </Text>
      </View>

      <View style={styles.contentContainer}>
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
                selectedPolicy.id === policy.id ? styles.sidebarItemActive : undefined,
              ]}
              onPress={() => setSelectedPolicy(policy)}
            >
              <Text
                style={[
                  styles.sidebarItemText,
                  selectedPolicy.id === policy.id ? styles.sidebarItemTextActive : undefined,
                ]}
              >
                {policy.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={styles.policyContent} showsVerticalScrollIndicator={false}>
          <View style={styles.policyCard}>
            <View style={styles.policyHeader}>
              <Text style={styles.policyTitle}>{selectedPolicy.title}</Text>
              <Text style={styles.policyDate}>시행일 {selectedPolicy.effectiveDate}</Text>
            </View>

            <View style={styles.policyBody}>
              {selectedPolicy.content.map((paragraph, index) => (
                <Text
                  key={`${selectedPolicy.id}-${index}`}
                  style={[
                    styles.policyParagraph,
                    paragraph === '' ? styles.policyParagraphSpacing : undefined,
                  ]}
                >
                  {paragraph}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>안내</Text>
            <Text style={styles.infoText}>
              현재 화면은 활성 약관뿐 아니라 이전 버전까지 함께 보여주도록 정리되어 있습니다.
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  header: {
    backgroundColor: Colors.textPrimary,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerKicker: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  headerTitle: {
    marginTop: 8,
    color: Colors.surface,
    fontSize: 26,
    fontWeight: '700',
  },
  headerSubtitle: {
    marginTop: 8,
    color: Colors.border,
    fontSize: 14,
    lineHeight: 20,
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 20,
    gap: 16,
  },
  sidebar: {
    width: 160,
  },
  sidebarContent: {
    gap: 10,
  },
  sidebarItem: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sidebarItemActive: {
    backgroundColor: Colors.primary,
  },
  sidebarItemText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  sidebarItemTextActive: {
    color: Colors.surface,
  },
  policyContent: {
    flex: 1,
  },
  policyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
  },
  policyHeader: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
    marginBottom: 16,
  },
  policyTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  policyDate: {
    marginTop: 6,
    color: Colors.textSecondary,
    fontSize: 13,
  },
  policyBody: {
    gap: 10,
  },
  policyParagraph: {
    color: Colors.textPrimary,
    fontSize: 15,
    lineHeight: 24,
  },
  policyParagraphSpacing: {
    minHeight: 8,
  },
  infoBox: {
    marginTop: 14,
    backgroundColor: Colors.gray50,
    borderRadius: 16,
    padding: 16,
  },
  infoTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  infoText: {
    marginTop: 6,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
});
