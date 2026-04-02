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
  path?: Marker[];
  height?: number;
}

export function NaverMapCard({
  title,
  subtitle,
  center,
  markers,
  path,
  height = 240,
}: NaverMapCardProps): ReactElement {
  return (
    <StaticMapPreview
      title={title}
      subtitle={subtitle}
      center={center}
      markers={markers}
      path={path}
      height={height}
    />
  );
}

export default NaverMapCard;
