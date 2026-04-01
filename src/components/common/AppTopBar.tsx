import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme';

interface AppTopBarProps {
  title: string;
  onBack: () => void;
  rightSlot?: React.ReactNode;
  style?: ViewStyle;
}

export default function AppTopBar({ title, onBack, rightSlot, style }: AppTopBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 8) }, style]}>
      <Pressable
        onPress={onBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="뒤로 가기"
        hitSlop={10}
      >
        <MaterialIcons name="arrow-back-ios-new" size={22} color={Colors.textPrimary} />
      </Pressable>
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={styles.rightSlot}>{rightSlot || null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderBottomColor: Colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 60,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    borderColor: Colors.gray300,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  rightSlot: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 36,
  },
  title: {
    color: Colors.textPrimary,
    flex: 1,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
});
