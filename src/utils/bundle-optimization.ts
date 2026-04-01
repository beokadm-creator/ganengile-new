/**
 * Bundle optimization helpers.
 * These utilities are intentionally lightweight and avoid legacy screen imports.
 */

export const optimizeImports = () => {
  return;
};

export const analyzeBundleSize = () => {
  const analyzer = {
    start: () => console.warn('Starting bundle analysis...'),
    report: (size: number) => {
      const sizeMb = Number((size / 1024 / 1024).toFixed(2));

      if (sizeMb > 5) {
        console.warn('Bundle size exceeds 5MB.');
        return;
      }

      if (sizeMb > 3) {
        console.warn(`Bundle size is ${sizeMb}MB. Consider optimization.`);
        return;
      }

      console.warn(`Bundle size is healthy at ${sizeMb}MB.`);
    },
  };

  return analyzer;
};

export const dynamicImport = () => {
  return {
    ProfileScreen: () => import('../screens/main/ProfileScreen'),
    ChatScreen: () => import('../screens/main/ChatScreen'),
  };
};
