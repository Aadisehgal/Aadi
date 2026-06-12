const { getDefaultConfig } = require('@react-native/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow loading GLB/GLTF assets if they're added later
config.resolver.assetExts.push('glb', 'gltf', 'bin', 'hdr');

// Stub expo-* packages used by some legacy 3D code paths
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (['expo-asset', 'expo-file-system', 'expo-gl', 'expo-modules-core'].includes(moduleName)) {
    return {
      filePath: path.resolve(__dirname, 'src/utils/expoMock.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
