module.exports = {
  testRunner: {
    args: {
      '--disable-automation': true,
      '--gpu': 'surface',
    },
    configs: {
      'ios.sim.debug': {
        binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/ganengile.app',
        type: 'ios.app',
      },
      'android.emu.debug': {
        binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
        type: 'android.apk',
      },
    },
    'behavior': {
      'init': {
        'setup-javascript_timeout': 120000, // 2 minutes
      },
      'launch-app': {
        'timeout': 180000, // 3 minutes
        'launch-retries': 3,
      },
      'wait-for-launch-timeout': 180000,
    },
  },
  };
};
