/**
 * TimePicker Component Unit Tests
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TimePicker from '../time/TimePicker';

describe('TimePicker Component', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render label and placeholder', () => {
    const { getByText } = render(
      <TimePicker
        value=""
        onChange={mockOnChange}
        label="출발 시간"
        placeholder="시간을 선택하세요"
      />
    );

    expect(getByText('출발 시간')).toBeTruthy();
    expect(getByText('시간을 선택하세요')).toBeTruthy();
  });

  it('should render current time value', () => {
    const { getByText } = render(
      <TimePicker
        value="09:30"
        onChange={mockOnChange}
        label="출발 시간"
      />
    );

    expect(getByText('오전 9:30')).toBeTruthy();
  });

  it('should open modal when button is pressed', () => {
    const { getByText, getByTestId } = render(
      <TimePicker
        value=""
        onChange={mockOnChange}
      />
    );

    const button = getByText('시간 선택');
    fireEvent.press(button);

    // Modal should be visible
    waitFor(() => {
      expect(getByText('시간 선택')).toBeTruthy(); // Modal title
    });
  });

  it('should call onChange when time is confirmed', async () => {
    const { getByText } = render(
      <TimePicker
        value=""
        onChange={mockOnChange}
      />
    );

    // Open modal
    fireEvent.press(getByText('시간 선택'));

    // Wait for modal to appear
    await waitFor(() => {
      expect(getByText('확인')).toBeTruthy();
    });

    // Confirm time
    fireEvent.press(getByText('확인'));

    expect(mockOnChange).toHaveBeenCalledWith('09:00');
  });

  it('should handle custom minute intervals', async () => {
    const { getByText, queryByText } = render(
      <TimePicker
        value=""
        onChange={mockOnChange}
        minuteInterval={15}
      />
    );

    fireEvent.press(getByText('시간 선택'));

    await waitFor(() => {
      // Should show 15-minute intervals (00, 15, 30, 45)
      expect(getByText('00')).toBeTruthy();
      expect(getByText('15')).toBeTruthy();
      expect(getByText('30')).toBeTruthy();
      expect(getByText('45')).toBeTruthy();
      // Should not show 10-minute intervals
      expect(queryByText('10')).toBeNull();
    });
  });

  it('should close modal when cancel is pressed', async () => {
    const { getByText, queryByText } = render(
      <TimePicker
        value=""
        onChange={mockOnChange}
      />
    );

    fireEvent.press(getByText('시간 선택'));

    await waitFor(() => {
      expect(getByText('취소')).toBeTruthy();
    });

    fireEvent.press(getByText('취소'));

    await waitFor(() => {
      expect(queryByText('시간 선택')).toBeNull(); // Modal title should disappear
    });
  });

  it('should handle quick select buttons', async () => {
    const { getByText } = render(
      <TimePicker
        value=""
        onChange={mockOnChange}
      />
    );

    fireEvent.press(getByText('시간 선택'));

    await waitFor(() => {
      expect(getByText('출근 (8:00)')).toBeTruthy();
      expect(getByText('퇴근 (18:00)')).toBeTruthy();
    });

    // Test commute time quick select
    fireEvent.press(getByText('출근 (8:00)'));

    await waitFor(() => {
      expect(getByText('확인')).toBeTruthy();
    });

    fireEvent.press(getByText('확인'));

    expect(mockOnChange).toHaveBeenCalledWith('08:00');
  });

  it('should display afternoon times correctly', () => {
    const { getByText } = render(
      <TimePicker
        value="14:30"
        onChange={mockOnChange}
      />
    );

    expect(getByText('오후 2:30')).toBeTruthy();
  });

  it('should display midnight correctly', () => {
    const { getByText } = render(
      <TimePicker
        value="00:00"
        onChange={mockOnChange}
      />
    );

    expect(getByText('오전 12:00')).toBeTruthy();
  });

  it('should display noon correctly', () => {
    const { getByText } = render(
      <TimePicker
        value="12:00"
        onChange={mockOnChange}
      />
    );

    expect(getByText('오후 12:00')).toBeTruthy();
  });
});
