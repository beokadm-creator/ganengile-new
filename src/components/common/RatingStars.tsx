import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Colors, Spacing, BorderRadius } from '../../theme';

interface RatingStarsProps {
  rating: number;
  maxRating?: number;
  size?: number;
  color?: string;
  editable?: boolean;
  onRatingChange?: (rating: number) => void;
}

export default function RatingStars({
  rating,
  maxRating = 5,
  size = 24,
  color = Colors.accent,
  editable = false,
  onRatingChange,
}: RatingStarsProps) {
  const [hoverRating, setHoverRating] = useState(0);

  const handlePress = (selectedRating: number) => {
    if (editable && onRatingChange) {
      onRatingChange(selectedRating);
    }
  };

  const renderStar = (index: number) => {
    const starNumber = index + 1;
    const filled = starNumber <= Math.floor(rating);
    const half = !filled && starNumber === Math.ceil(rating) && rating % 1 !== 0;
    const showFilled = editable && starNumber <= hoverRating && starNumber > rating;

    const starStyle = {
      fontSize: size,
      color: filled || showFilled ? color : Colors.gray300,
      marginRight: index < maxRating - 1 ? Spacing.xs : 0,
    };

    return (
      <TouchableOpacity
        key={index}
        onPress={() => handlePress(starNumber)}
        onLongPress={() => (editable ? setHoverRating(starNumber) : undefined)}
        onPressOut={() => setHoverRating(0)}
        disabled={!editable}
        activeOpacity={0.7}
        accessibilityLabel={`${starNumber} star${starNumber !== 1 ? 's' : ''}`}
        accessibilityRole={editable ? 'button' : 'text'}
        accessibilityState={{ selected: starNumber === rating }}
      >
        <Text style={starStyle}>
          {filled ? '★' : half ? '✫' : '☆'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {Array.from({ length: maxRating }, (_, index) => renderStar(index))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
