import { Platform } from 'react-native';

let MapScreenComponent;

if (Platform.OS === 'web') {
  MapScreenComponent = require('./MapScreen.web').default;
} else {
  MapScreenComponent = require('./MapScreen.native').default;
}

export default MapScreenComponent;
