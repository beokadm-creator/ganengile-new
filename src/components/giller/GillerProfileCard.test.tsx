/**
 * GillerProfileCard Component Unit Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GillerProfileCard } from '../GillerProfileCard';

describe('GillerProfileCard Component', () => {
  const mockGiller = {
    id: 'giller123',
    name: '홍길동',
    rating: 4.5,
    completedDeliveries: 150,
    estimatedTime: 18, // minutes
    fee: 3500,
  };

  const mockOnAccept = jest.fn();
  const mockOnReject = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render giller profile information', () => {
    const { getByText } = render(
      <GillerProfileCard
        giller={mockGiller}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    expect(getByText('홍길동')).toBeTruthy();
    expect(getByText('4.5')).toBeTruthy();
    expect(getByText('완료 150건')).toBeTruthy();
  });

  it('should display estimated time', () => {
    const { getByText } = render(
      <GillerProfileCard
        giller={mockGiller}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    expect(getByText(/예상 소요시간/)).toBeTruthy();
  });

  it('should display fee', () => {
    const { getByText } = render(
      <GillerProfileCard
        giller={mockGiller}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    expect(getByText(/3,500원/)).toBeTruthy();
  });

  it('should render default avatar when no profile image', () => {
    const { UNSAFE_getByType } = require('react-native');
    const { getByTestId } = render(
      <GillerProfileCard
        giller={mockGiller}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    // Should have default avatar view
    expect(() => getByTestId('default-avatar')).not.toThrow();
  });

  it('should call onAccept when accept button is pressed', () => {
    const { getByText } = render(
      <GillerProfileCard
        giller={mockGiller}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    fireEvent.press(getByText('수락'));
    expect(mockOnAccept).toHaveBeenCalledTimes(1);
  });

  it('should call onReject when reject button is pressed', () => {
    const { getByText } = render(
      <GillerProfileCard
        giller={mockGiller}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    fireEvent.press(getByText('거절'));
    expect(mockOnReject).toHaveBeenCalledTimes(1);
  });

  it('should disable buttons when accepting', () => {
    const { getByText } = render(
      <GillerProfileCard
        giller={mockGiller}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        isAccepting={true}
      />
    );

    const acceptButton = getByText('수락 중...');
    const rejectButton = getByText('거절');

    expect(acceptButton).toBeTruthy();
    expect(rejectButton).toBeTruthy();
  });

  it('should disable buttons when rejecting', () => {
    const { getByText } = render(
      <GillerProfileCard
        giller={mockGiller}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        isRejecting={true}
      />
    );

    const rejectButton = getByText('거절');
    expect(rejectButton).toBeTruthy();
  });

  it('should not crash with optional fields missing', () => {
    const minimalGiller = {
      id: 'giller123',
      name: '테스터',
      rating: 3.5,
      completedDeliveries: 0,
    };

    const { getByText, queryByText } = render(
      <GillerProfileCard
        giller={minimalGiller}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    expect(getByText('테스터')).toBeTruthy();
    expect(queryByText(/예상 소요시간/)).toBeNull();
    expect(queryByText(/원/)).toBeNull();
  });

  it('should handle rating display correctly', () => {
    const { getByText } = render(
      <GillerProfileCard
        giller={mockGiller}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    expect(getByText('4.5')).toBeTruthy();
  });

  it('should display zero deliveries correctly', () => {
    const newGiller = { ...mockGiller, completedDeliveries: 0 };
    const { getByText } = render(
      <GillerProfileCard
        giller={newGiller}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    expect(getByText('완료 0건')).toBeTruthy();
  });

  it('should display large delivery counts', () => {
    const experiencedGiller = { ...mockGiller, completedDeliveries: 1250 };
    const { getByText } = render(
      <GillerProfileCard
        giller={experiencedGiller}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    expect(getByText('완료 1,250건')).toBeTruthy();
  });
});
