import React from 'react';
import CameraView from '../../components/CameraScanner/CameraView';
import { useNavigation } from '@react-navigation/native';

export default function ScanScreen() {
  const navigation = useNavigation();

  return <CameraView navigation={navigation} onClose={() => navigation.navigate('Home')} />;
}
