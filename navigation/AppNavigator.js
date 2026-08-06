import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/Splash/SplashScreen';
import WelcomeScreen from '../screens/Welcome/WelcomeScreen';
import LoginScreen from '../screens/Login/LoginScreen';
import RegisterScreen from '../screens/Register/RegisterScreen';
import GuestInfoScreen from '../screens/GuestInfo/GuestInfoScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import ProfileSettings from '../screens/Settings/ProfileSettings';
import EditProfileScreen from '../screens/Settings/EditProfileScreen';
import NotificationsSettings from '../screens/Settings/NotificationsSettings';
import ApplicationSettings from '../screens/Settings/ApplicationSettings';
import AboutSettings from '../screens/Settings/AboutSettings';
import PrivacyNoticeScreen from '../screens/Settings/PrivacyNoticeScreen';
import TermsOfUseScreen from '../screens/Settings/TermsOfUseScreen';
import HelpGuideScreen from '../screens/Settings/HelpGuideScreen';
import HistoryDetailScreen from '../screens/History/HistoryDetailScreen';
import ResultScreen from '../screens/Result/ResultScreen';
import FullMapScreen from '../screens/Map/FullMapScreen';
import MainTabs from './MainTabs';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="GuestInfo" component={GuestInfoScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SettingsProfile" component={ProfileSettings} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="SettingsNotifications" component={NotificationsSettings} />
      <Stack.Screen name="SettingsApplication" component={ApplicationSettings} />
      <Stack.Screen name="SettingsAbout" component={AboutSettings} />
      <Stack.Screen name="PrivacyNotice" component={PrivacyNoticeScreen} />
      <Stack.Screen name="TermsOfUse" component={TermsOfUseScreen} />
      <Stack.Screen name="HelpGuide" component={HelpGuideScreen} />
      <Stack.Screen name="HistoryDetail" component={HistoryDetailScreen} />
      <Stack.Screen name="Result" component={ResultScreen} />
      <Stack.Screen name="FullMap" component={FullMapScreen} />
    </Stack.Navigator>
  );
}
