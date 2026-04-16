import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { InteractiveNaverMap } from './InteractiveNaverMap';
import { Typography } from '../../theme/typography';

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
    <View style={styles.wrapper}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.mapWrap}>
        <InteractiveNaverMap center={center} markers={markers} path={path} height={height} />
      </View>
    </View>
  );
}

export default NaverMapCard;

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 4,
    fontSize: Typography.fontSize.sm,
    color: '#64748b',
  },
  mapWrap: {
    marginTop: 12,
  },
});
