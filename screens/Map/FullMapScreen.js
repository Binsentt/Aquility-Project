import { Platform } from 'react-native';

let FullMapScreenComponent;

if (Platform.OS === 'web') {
  FullMapScreenComponent = require('./FullMapScreen.web').default;
} else {
  FullMapScreenComponent = require('./FullMapScreen.native').default;
}

export default FullMapScreenComponent;
