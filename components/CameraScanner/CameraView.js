import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Image,
  ScrollView,
} from 'react-native';
import { CameraView as ExpoCameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScannerOverlay from './ScannerOverlay';
import CaptureButton from './CaptureButton';
import GalleryButton from './GalleryButton';
import ThumbnailStrip from './ThumbnailStrip';
import { createDocumentDetector } from './documentDetector';
import { useAuth } from '../../context/AuthContext';
import { analyzeDocument } from '../../services/waterAnalysisService';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const CameraView = React.memo(function CameraView({
  navigation,
  onCapture,
  onImageSelected,
  onClose,
  autoScanDefault = true,
}) {
  const cameraRef = useRef(null);
  const pinchStartRef = useRef(0);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [flashMode, setFlashMode] = useState('off');
  const [autoScan, setAutoScan] = useState(autoScanDefault);
  const [zoom, setZoom] = useState(0);
  const [focusRing, setFocusRing] = useState(null);
  const [capturedImages, setCapturedImages] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [isDocumentAligned, setIsDocumentAligned] = useState(false);
  const [alignmentMessage, setAlignmentMessage] = useState('Center the water-test strip in the guide.');
  const [selectedImage, setSelectedImage] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [submitCommitted, setSubmitCommitted] = useState(false);
  const detectorRef = useRef(createDocumentDetector());
  const { addScanResult, currentUser } = useAuth();
  const insets = useSafeAreaInsets();
  const submitLockRef = useRef(false);
  const captureLockRef = useRef(false);
  const focusTimerRef = useRef(null);
  const isMountedRef = useRef(true);
  const bottomInset = Math.max(insets.bottom, 16);

  useEffect(() => {
    if (permission?.status === 'undetermined') {
      requestPermission().catch(() => {
        if (isMountedRef.current) {
          Alert.alert('Camera unavailable', 'AQUILITY could not request camera access. Please try again.');
        }
      });
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, []);

  const handleImageCaptured = useCallback(
    (uri) => {
      if (!uri) return;

      setCapturedImages((current) => [uri, ...current].slice(0, 12));
      setSelectedImage(uri);
      setIsDocumentAligned(true);
      setSubmitCommitted(false);
      setAlignmentMessage(autoScan ? 'Assisted capture saved the test-strip image.' : 'Test-strip image captured successfully.');
      detectorRef.current.markCaptured();
      if (typeof onCapture === 'function') {
        onCapture(uri);
      }
      if (typeof onImageSelected === 'function') {
        onImageSelected(uri);
      }
    },
    [autoScan, onCapture, onImageSelected]
  );

  const handleManualCapture = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || captureLockRef.current) return;

    captureLockRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: true,
        exif: false,
      });

      if (photo?.uri && isMountedRef.current) {
        handleImageCaptured(photo.uri);
      }
    } catch {
      if (isMountedRef.current) {
        Alert.alert('Camera unavailable', 'Unable to capture a photo right now. Please try again.');
      }
    } finally {
      captureLockRef.current = false;
    }
  }, [cameraReady, handleImageCaptured]);

  const handleImportFromGallery = useCallback(async () => {
    try {
      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!mediaPermission.granted) {
        Alert.alert(
          'Photo access required',
          'Allow AQUILITY to access your photos so you can select a water-test strip image for this analysis.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets?.[0]?.uri && isMountedRef.current) {
        handleImageCaptured(result.assets[0].uri);
      }
    } catch {
      if (isMountedRef.current) {
        Alert.alert('Gallery unavailable', 'Unable to open the photo library right now.');
      }
    }
  }, [handleImageCaptured]);

  const handleGalleryButton = useCallback(() => {
    if (capturedImages.length) {
      setShowReview((current) => !current);
      return;
    }

    handleImportFromGallery();
  }, [capturedImages.length, handleImportFromGallery]);

  const handlePinchGesture = useCallback((event) => {
    const nextZoom = clamp(event.nativeEvent.scale - 1, 0, 1);
    setZoom(nextZoom);
  }, []);

  const handlePinchStateChange = useCallback(
    (event) => {
      if (event.nativeEvent.state === State.END) {
        pinchStartRef.current = zoom;
      }
    },
    [zoom]
  );

  const handleTapFocus = useCallback((event) => {
    const { locationX, locationY } = event.nativeEvent || {};

    if (
      typeof locationX !== 'number' ||
      typeof locationY !== 'number' ||
      !cameraRef.current ||
      typeof cameraRef.current.focus !== 'function'
    ) {
      return;
    }

    const centerAligned = locationX > 110 && locationX < 310 && locationY > 180 && locationY < 520;
    setIsDocumentAligned(centerAligned);
    setAlignmentMessage(
      centerAligned
        ? autoScan
          ? 'Test strip aligned. Assisted capture is ready.'
          : 'Test strip aligned. Capture when ready.'
        : 'Move the water-test strip into the center guide.'
    );

    if (autoScan) {
      const result = detectorRef.current.observe({ isAligned: centerAligned, now: Date.now() });
      if (result.shouldCapture) {
        detectorRef.current.markCaptured();
        handleManualCapture();
      }
    }

    cameraRef.current.focus({ x: locationX, y: locationY });
    setFocusRing({ x: locationX - 32, y: locationY - 32 });
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) setFocusRing(null);
    }, 420);
  }, [autoScan, handleManualCapture]);

  const handleGenerate = useCallback(async () => {
    if (submitLockRef.current || processing || submitCommitted || !isMountedRef.current) {
      return;
    }

    if (!capturedImages.length) {
      Alert.alert('No image selected', 'Please capture or select a water-test strip image first.');
      return;
    }

    if (!currentUser?.id) {
      Alert.alert('Profile required', 'Please create or restore your AQUILITY profile before analysing a water-test strip.');
      return;
    }

    submitLockRef.current = true;
    setProcessing(true);
    setSubmitCommitted(true);

    try {
      let location = null;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          location = currentLocation?.coords || null;
        }
      } catch {}

      const result = await analyzeDocument({
        images: capturedImages,
        imageUri: capturedImages[0],
        userId: currentUser.id,
        location,
        barangay: currentUser.barangay,
        municipality: currentUser.municipality,
        capturedAt: new Date().toISOString(),
      });

      if (!isMountedRef.current) {
        return;
      }

      let scanPayload = result;

      if (typeof addScanResult === 'function') {
        scanPayload = await addScanResult(scanPayload);
      }

      if (navigation && typeof navigation.navigate === 'function') {
        navigation.navigate('Result', scanPayload);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setSubmitCommitted(false);
        Alert.alert('Analysis failed', error?.message || 'Unable to process this water-test strip right now.');
      }
    } finally {
      if (isMountedRef.current) {
        submitLockRef.current = false;
        setProcessing(false);
      }
    }
  }, [addScanResult, capturedImages, currentUser, navigation, processing, submitCommitted]);

  const recentImages = useMemo(() => capturedImages.slice(0, 6), [capturedImages]);

  const handleRemoveImage = useCallback((uriToRemove) => {
    setCapturedImages((current) => current.filter((item) => item !== uriToRemove));
    setSelectedImage((current) => (current === uriToRemove ? null : current));
    setShowReview(false);
  }, []);

  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#fff" />
      </View>
    );
  }

  if (permission.status !== 'granted') {
    const deniedPermanently = permission.status === 'denied' && permission.canAskAgain === false;

    const handlePermissionAction = async () => {
      try {
        if (deniedPermanently) {
          const fallbackUrl = 'app-settings:';
          const supported = await Linking.canOpenURL(fallbackUrl);
          if (supported) {
            await Linking.openURL(fallbackUrl);
            return;
          }
          await Linking.openSettings();
          return;
        }

        await requestPermission();
      } catch {
        Alert.alert('Camera permission unavailable', 'Please open your device settings and allow camera access for AQUILITY.');
      }
    };

    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera access required</Text>
        <Text style={styles.permissionText}>
          Camera access is required to scan a water-test strip. Please grant access to continue.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={handlePermissionAction}>
          <Text style={styles.permissionButtonText}>{deniedPermanently ? 'Open Settings' : 'Request Permission'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PinchGestureHandler
        onGestureEvent={handlePinchGesture}
        onHandlerStateChange={handlePinchStateChange}
      >
        <View style={styles.cameraWrap}>
          <ExpoCameraView
            ref={cameraRef}
            style={styles.camera}
            ratio="16:9"
            zoom={zoom}
            flashMode={flashMode}
            onCameraReady={() => setCameraReady(true)}
            onTouchStart={handleTapFocus}
            focusable
            autoFocus="on"
          />
        </View>
      </PinchGestureHandler>

      <ScannerOverlay detected={isDocumentAligned} />

      {focusRing ? (
        <View
          pointerEvents="none"
          style={[
            styles.focusRing,
            {
              left: focusRing.x,
              top: focusRing.y,
            },
          ]}
        />
      ) : null}

      <View style={[styles.topControls, { top: insets.top + 10 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.topButton}
          activeOpacity={0.8}
          onPress={() => {
            if (typeof onClose === 'function') {
              onClose();
              return;
            }
            navigation?.goBack?.();
          }}
        >
          <Text style={styles.topButtonText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.topRightGroup} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.topButton}
            activeOpacity={0.8}
            onPress={() => setFlashMode((current) => (current === 'off' ? 'on' : 'off'))}
          >
            <Text style={styles.topButtonText}>{flashMode === 'off' ? 'Flash' : 'On'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.topButton, styles.topButtonAccent]}
            activeOpacity={0.8}
            onPress={() => setAutoScan((current) => !current)}
          >
            <Text style={styles.topButtonText}>{autoScan ? 'Auto' : 'Manual'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.assistBanner, { top: insets.top + 68 }]} pointerEvents="box-none">
        <Text style={styles.assistTitle}>{autoScan ? 'Assisted capture' : 'Manual capture'}</Text>
        <Text style={[styles.assistText, isDocumentAligned && styles.assistTextActive]}>{alignmentMessage}</Text>
      </View>

      {recentImages.length ? (
        <View style={[styles.thumbnailPanel, { bottom: 132 + bottomInset }]}>
          <ThumbnailStrip images={recentImages} onSelect={(uri) => setSelectedImage(uri)} onRemove={handleRemoveImage} />
        </View>
      ) : null}

      {showReview && capturedImages.length ? (
        <View style={styles.reviewSheet} pointerEvents="box-none">
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewTitle}>Current scan photos</Text>
            <TouchableOpacity onPress={() => setShowReview(false)}>
              <Text style={styles.reviewClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewContent}>
            {capturedImages.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.reviewCard}>
                <Image source={{ uri }} style={styles.reviewImage} />
                <TouchableOpacity style={styles.reviewRemove} onPress={() => handleRemoveImage(uri)}>
                  <Text style={styles.reviewRemoveText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.reviewAddButton} onPress={() => handleImportFromGallery()}>
            <Text style={styles.reviewAddButtonText}>Add more photos</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={[styles.bottomControls, { paddingBottom: Math.max(bottomInset, 20) }]} pointerEvents="box-none">
        <View style={styles.bottomLeftGroup}>
          <GalleryButton onPress={handleGalleryButton} />
          {capturedImages.length ? (
            <TouchableOpacity style={styles.previewBadge} onPress={() => setShowReview((current) => !current)}>
              <Text style={styles.previewBadgeText}>{capturedImages.length} photos</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <CaptureButton onPress={handleManualCapture} />

        <TouchableOpacity
          style={[styles.nextButton, (processing || !capturedImages.length) && styles.nextButtonDisabled]}
          activeOpacity={0.9}
          onPress={handleGenerate}
          disabled={processing || !capturedImages.length}
        >
          <Text style={styles.nextButtonText}>{processing ? 'Processing...' : capturedImages.length ? 'Analyze' : 'No image'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#061820' },
  loadingContainer: { flex: 1, backgroundColor: '#061820', alignItems: 'center', justifyContent: 'center' },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#F7FBFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  permissionTitle: { fontSize: 22, fontWeight: '900', color: '#082744', marginBottom: 12 },
  permissionText: { fontSize: 15, lineHeight: 22, color: '#17324B', textAlign: 'center', marginBottom: 20 },
  permissionButton: {
    backgroundColor: '#0D4C7A',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permissionButtonText: { color: '#fff', fontWeight: '800' },
  cameraWrap: { flex: 1 },
  camera: { flex: 1 },
  focusRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#6FE7FF',
    backgroundColor: 'transparent',
  },
  topControls: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topButton: {
    minHeight: 42,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(7, 16, 25, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  topRightGroup: { flexDirection: 'row', gap: 8 },
  topButtonAccent: { backgroundColor: 'rgba(19, 114, 164, 0.72)' },
  topButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  assistBanner: {
    position: 'absolute',
    top: 72,
    left: 18,
    right: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(7, 16, 25, 0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  assistTitle: { color: '#fff', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  assistText: { marginTop: 4, color: '#D6EAF8', fontSize: 13 },
  assistTextActive: { color: '#6FE7FF' },
  bottomControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: 'rgba(4, 13, 20, 0.7)',
  },
  thumbnailPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 3,
  },
  bottomLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    flex: 1,
  },
  previewBadge: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  previewBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  reviewSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 128,
    backgroundColor: 'rgba(7, 16, 25, 0.9)',
    borderRadius: 18,
    padding: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reviewTitle: {
    color: '#fff',
    fontWeight: '800',
  },
  reviewClose: {
    color: '#6FE7FF',
    fontWeight: '700',
  },
  reviewContent: {
    paddingRight: 6,
  },
  reviewCard: {
    width: 120,
    marginRight: 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#102534',
  },
  reviewImage: {
    width: 120,
    height: 90,
    resizeMode: 'cover',
  },
  reviewRemove: {
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(216, 77, 77, 0.92)',
  },
  reviewRemoveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  reviewAddButton: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(19, 114, 164, 0.72)',
    borderRadius: 10,
  },
  reviewAddButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  nextButton: {
    minWidth: 104,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#0D4C7A',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    minHeight: 52,
  },
  nextButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  nextButtonDisabled: { opacity: 0.7 },
});

export default CameraView;
