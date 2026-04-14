import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  withDelay,
} from 'react-native-reanimated';
import { Colors, Typography } from '../../../../theme';

export interface TrackingStep {
  key: string;
  label: string;
  state: 'completed' | 'current' | 'upcoming';
  description?: string;
  timestamp?: Date;
}

interface Props {
  steps: TrackingStep[];
}

export function TrackingTimeline({ steps }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);
  
  // Calculate active index
  const activeIndex = steps.findIndex(s => s.state === 'current');
  const currentIndex = activeIndex === -1 ? (steps.every(s => s.state === 'completed') ? steps.length - 1 : 0) : activeIndex;

  const handleLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const NODE_SIZE = 24;
  const INNER_DOT_SIZE = 8;

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {/* Background connecting line wrapper */}
      {containerWidth > 0 && (
        <View style={[styles.lineWrapper, { left: 30, right: 30, top: NODE_SIZE / 2 - 2 }]}>
          {steps.slice(0, -1).map((_, index) => {
            const isCompleted = index < currentIndex;
            return <LineSegment key={`line-${index}`} isCompleted={isCompleted} delay={index * 150} />;
          })}
        </View>
      )}

      {/* Nodes Layer */}
      <View style={styles.nodesWrapper}>
        {steps.map((step, index) => {
          const isActive = index === currentIndex && step.state !== 'completed';
          const isCompleted = step.state === 'completed' || index < currentIndex;

          return (
            <Node
              key={step.key}
              label={step.label}
              isActive={isActive}
              isCompleted={isCompleted}
              size={NODE_SIZE}
              innerSize={INNER_DOT_SIZE}
              delay={index * 150}
            />
          );
        })}
      </View>
    </View>
  );
}

function LineSegment({ isCompleted, delay }: { isCompleted: boolean; delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (isCompleted) {
      progress.value = withDelay(delay, withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }));
    } else {
      progress.value = withTiming(0, { duration: 200 });
    }
  }, [isCompleted, delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.lineSegment}>
      <Animated.View style={[styles.lineFill, animatedStyle]} />
    </View>
  );
}

function Node({ 
  label, 
  isActive, 
  isCompleted, 
  size, 
  innerSize,
  delay
}: { 
  label: string; 
  isActive: boolean; 
  isCompleted: boolean; 
  size: number; 
  innerSize: number;
  delay: number;
}) {
  const scale = useSharedValue(1);
  const bgColor = useSharedValue(isCompleted || isActive ? 0 : 1); // 0 = active/completed, 1 = inactive

  useEffect(() => {
    if (isCompleted || isActive) {
      bgColor.value = withDelay(delay, withTiming(0, { duration: 300 }));
    } else {
      bgColor.value = withTiming(1, { duration: 200 });
    }

    if (isActive) {
      scale.value = withDelay(
        delay + 300,
        withRepeat(
          withSequence(
            withTiming(1.25, { duration: 800, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        )
      );
    } else {
      scale.value = withTiming(1, { duration: 300 });
    }
  }, [isActive, isCompleted, delay, scale, bgColor]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <View style={styles.nodeContainer}>
      <Animated.View
        style={[
          styles.node,
          { width: size, height: size, borderRadius: size / 2 },
          isCompleted ? styles.nodeCompleted : isActive ? styles.nodeActive : styles.nodePending,
          animatedStyle,
        ]}
      >
        {(isCompleted || isActive) && (
          <View
            style={[
              styles.innerDot,
              { width: innerSize, height: innerSize, borderRadius: innerSize / 2 },
            ]}
          />
        )}
      </Animated.View>
      <Text style={[styles.label, isCompleted || isActive ? styles.labelActive : styles.labelPending]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    position: 'relative',
    backgroundColor: Colors.white,
  },
  lineWrapper: {
    position: 'absolute',
    flexDirection: 'row',
    height: 4,
    zIndex: 1,
    backgroundColor: Colors.gray100,
    borderRadius: 2,
    overflow: 'hidden',
  },
  lineSegment: {
    flex: 1,
    height: '100%',
  },
  lineFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  nodesWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  nodeContainer: {
    alignItems: 'center',
    width: 60,
  },
  node: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray200,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  nodePending: {
    backgroundColor: Colors.gray200,
  },
  nodeCompleted: {
    backgroundColor: Colors.primary,
  },
  nodeActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  innerDot: {
    backgroundColor: Colors.white,
  },
  label: {
    marginTop: 8,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    textAlign: 'center',
  },
  labelActive: {
    color: Colors.textPrimary,
  },
  labelPending: {
    color: Colors.textTertiary,
  },
});