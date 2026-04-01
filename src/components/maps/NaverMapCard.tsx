import type { ReactElement } from 'react';
import StaticMapPreview from './StaticMapPreview';

type Marker = {
  latitude: number;
  longitude: number;
  label?: string;
};

interface NaverMapCardProps {
  title?: string;
  subtitle?: string;
  center: Marker;
  markers: Marker[];
  height?: number;
}

export function NaverMapCard({
  title,
  subtitle,
  center,
  markers,
  height = 240,
}: NaverMapCardProps): ReactElement {
  return (
    <StaticMapPreview
      title={title}
      subtitle={subtitle}
      center={center}
      markers={markers}
      height={height}
    />
  );
}

export default NaverMapCard;
