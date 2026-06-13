module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
        alias: {
          '@components': './src/components',
          '@screens': './src/screens',
          '@stores': './src/stores',
          '@services': './src/services',
          '@utils': './src/utils',
          '@apptypes': './src/types',
          '@hooks': './src/hooks',
          '@agents': './src/agents',
          '@tools': './src/tools',
          '@plugins': './src/plugins',
          '@modules': './src/modules',
          '@navigation': './src/navigation',
        },
      },
    ],
  ],
};
