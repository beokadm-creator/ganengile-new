/**
 * @deprecated src/theme/index.ts 를 사용하세요.
 * 이 파일은 하위 호환을 위해 유지합니다.
 */
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../theme';

export const theme = {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} as const;

export { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme';
