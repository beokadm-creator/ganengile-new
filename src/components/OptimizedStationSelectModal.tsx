import React from 'react';
import StationSelectModal from './common/StationSelectModal';
import type { Station } from '../types/config';

interface OptimizedStationSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectStation: (station: Station) => void;
  stations?: Station[];
  title?: string;
}

export const OptimizedStationSelectModal: React.FC<OptimizedStationSelectModalProps> = ({
  visible,
  onClose,
  onSelectStation,
  stations = [],
  title = '역 선택',
}) => (
  <StationSelectModal
    visible={visible}
    onClose={onClose}
    onStationSelect={onSelectStation}
    title={title}
    stations={stations}
  />
);

export default OptimizedStationSelectModal;
