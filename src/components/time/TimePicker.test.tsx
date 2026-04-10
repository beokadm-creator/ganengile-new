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
    const { getAllByText } = render(
      <TimePicker
        value=""
        onChange={mockOnChange}
      />
    );

    const button = getAllByText('시간 선택')[0];
    fireEvent.press(button);

    expect(getAllByText('시간 선택')).toHaveLength(2);
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

    expect(mockOnChange).toHaveBeenCalledWith('00:00');
  });

  it('should handle custom minute intervals', async () => {
    const { getByText, getAllByText } = render(
      <TimePicker
        value=""
        onChange={mockOnChange}
        minuteInterval={15}
      />
    );

    fireEvent.press(getByText('시간 선택'));

    await waitFor(() => {
      expect(getAllByText('00').length).toBeGreaterThan(0);
      expect(getAllByText('15').length).toBeGreaterThan(0);
      expect(getAllByText('30').length).toBeGreaterThan(0);
      expect(getAllByText('45').length).toBeGreaterThan(0);
    });
  });

  it('should close modal when cancel is pressed', async () => {
    const { getAllByText, getByText, queryAllByText } = render(
      <TimePicker
        value=""
        onChange={mockOnChange}
      />
    );

    fireEvent.press(getAllByText('시간 선택')[0]);

    await waitFor(() => {
      expect(getByText('취소')).toBeTruthy();
    });

    fireEvent.press(getByText('취소'));

    await waitFor(() => {
      expect(queryAllByText('시간 선택')).toHaveLength(1);
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
      expect(getByText('출근 08:00')).toBeTruthy();
      expect(getByText('퇴근 18:00')).toBeTruthy();
    });

    // Test commute time quick select
    fireEvent.press(getByText('출근 08:00'));

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
