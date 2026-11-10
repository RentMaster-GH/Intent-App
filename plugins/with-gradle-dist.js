const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withGradleDist(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const file = path.join(
        config.modRequest.platformProjectRoot,
        'gradle/wrapper/gradle-wrapper.properties'
      );
      if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf-8');
        content = content.replace(
          'networkTimeout=10000',
          'networkTimeout=300000'
        );
        fs.writeFileSync(file, content);
      }
      return config;
    },
  ]);
};