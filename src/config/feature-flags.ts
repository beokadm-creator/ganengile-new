// 프로덕션 빌드에서는 절대 true가 되지 않도록 __DEV__ 조건 추가
export const PASS_TEST_MODE = __DEV__ && process.env.EXPO_PUBLIC_PASS_TEST_MODE === 'true';
