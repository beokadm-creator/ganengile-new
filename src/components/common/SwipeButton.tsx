import React, { useRef, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  PanResponder, 
  Dimensions, 
  LayoutChangeEvent,
  GestureResponderEvent,
  PanResponderGestureState 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, Shadows } from '../../theme';
import { Typography } from '../../theme/typography';

interface SwipeButtonProps {
  onComplete: () => void | Promise<void>;
  title?: string;
  disabled?: boolean;
}

const THUMB_SIZE = 56;
const PADDING = 4;

export function SwipeButton({ onComplete, title = '밀어서 완료하기', disabled = false }: SwipeButtonProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [completed, setCompleted] = useState(false);
  
  const pan = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const maxSlide = Math.max(0, containerWidth - THUMB_SIZE - PADDING * 2);
  const interpolateMax = Math.max(1, maxSlide);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !completed,
      onMoveShouldSetPanResponder: () => !disabled && !completed,
      onPanResponderGrant: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        pan.extractOffset();
      },
      onPanResponderMove: (e: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        let newX = gestureState.dx;
        if (newX > maxSlide) newX = maxSlide;
        if (newX < 0) newX = 0;
        pan.setValue({ x: newX, y: 0 });
      },
      onPanResponderRelease: (e: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        pan.flattenOffset();
        
        if (gestureState.dx > maxSlide * 0.8) {
          // Trigger complete
          setCompleted(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          
          Animated.timing(pan, {
            toValue: { x: maxSlide, y: 0 },
            duration: 150,
            useNativeDriver: false,
          }).start();
          
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }).start();

          (async () => {
            try {
              await onComplete();
            } catch (err) {
              // Revert on error
              setCompleted(false);
              Animated.timing(opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: false,
              }).start();
              Animated.spring(pan, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: false,
                friction: 5,
              }).start();
            }
          })();
        } else {
          // Revert back
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            friction: 5,
          }).start();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      },
    })
  ).current;

  const handleLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const backgroundColor = disabled ? Colors.gray200 : Colors.primary;
  const thumbColor = disabled ? Colors.gray400 : Colors.white;
  const iconColor = disabled ? Colors.white : Colors.primary;

  return (
    <View style={[styles.container, { backgroundColor }]} onLayout={handleLayout}>
      <Animated.Text style={[styles.title, { opacity }]}>
        {title}
      </Animated.Text>
      
      {containerWidth > 0 && (
        <Animated.View
          style={[
            styles.thumb,
            { backgroundColor: thumbColor },
            {
              transform: [
                {
                  translateX: pan.x.interpolate({
                    inputRange: [0, interpolateMax],
                    outputRange: [0, interpolateMax],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <MaterialIcons name={completed ? "check" : "keyboard-arrow-right"} size={28} color={iconColor} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 64,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    padding: PADDING,
    overflow: 'hidden',
  },
  title: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    zIndex: 1,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    ...Shadows.sm,
  },
});