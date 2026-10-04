import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ScrollView, Share } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, LAYOUT, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';
import { savePdfExport, savePngExport, exportOutcomeNotice } from '../../services/exportService';
import { toSafeExportMessage } from '../../services/exportErrors';
import { loadBackendWaterTest } from '../../services/waterTestRecordService';
import { cleanClientRemarks } from '../../services/apiMappers';
import { canonicalizeSampleClass, canonicalizeSampleCode } from '../../services/sampleSites';

function safeImageDebugUrl(uri) {
  if (!uri || typeof uri !== 'string') return null;
  try {
    const parsed = new URL(uri);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return uri.split('?')[0];
  }
}

function logHistoryImage(event, recordId, imageUri) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  console.info('[AQUALITY HISTORY IMAGE DEBUG]', {
    event,
    recordId: recordId || null,
    imageUriExists: Boolean(imageUri),
    imageUrl: safeImageDebugUrl(imageUri),
  });
}

export default function HistoryDetailScreen({ route, navigation }) {
  const { currentUser, deleteScanResult } = useAuth();
  const routeItem = route.params?.item || {};
  const [detailItem, setDetailItem] = useState(routeItem);
  const [detailLoading, setDetailLoading] = useState(Boolean(routeItem.id));
  const [detailError, setDetailError] = useState(null);
  const [imageState, setImageState] = useState(
    routeItem.imageUri || routeItem.image || routeItem.uri || routeItem.images?.[0] ? 'loading' : 'unavailable'
  );
  const item = detailItem || routeItem;
  const sampleClass = canonicalizeSampleClass(item.sampleClass) || item.sampleClass;
  const sampleCode = canonicalizeSampleCode(item.sampleCode) || item.sampleCode;
  const imageUri = item.imageUri || item.image || item.uri || (Array.isArray(item.images) ? item.images[0] : null);
  const createdAt = item.createdAt || new Date().toISOString();
  const [busy, setBusy] = useState(false);

  const refreshDetail = useCallback(async (isActive = () => true) => {
    if (!routeItem.id) {
      if (isActive()) setDetailLoading(false);
      return null;
    }

    if (isActive()) {
      setDetailLoading(true);
      setDetailError(null);
    }

    try {
      const record = await loadBackendWaterTest(routeItem.id);
      if (isActive()) setDetailItem(record);
      return record;
    } catch (error) {
      if (isActive()) setDetailError(error?.message || 'Unable to refresh this saved water-test record.');
      throw error;
    } finally {
      if (isActive()) setDetailLoading(false);
    }
  }, [routeItem.id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      refreshDetail(() => active).catch(() => undefined);
      return () => { active = false; };
    }, [refreshDetail])
  );

  useEffect(() => {
    setImageState(imageUri ? 'loading' : 'unavailable');
  }, [imageUri]);

  const summaryFields = useMemo(
    () => [
      { label: 'Scan Status', value: item.scanStatus || 'Completed' },
      { label: 'Scan date', value: new Date(createdAt).toLocaleString() },
      { label: 'Result summary', value: cleanClientRemarks(item.summary) || 'Not available' },
    ],
    [createdAt, item.scanStatus, item.summary]
  );

  const handleExport = async (type) => {
    if (busy) return;

    try {
      setBusy(true);
      const record = await loadBackendWaterTest(item.id);

      if (type === 'pdf') {
        const outcome = await savePdfExport({ ...record, user: record.user || currentUser, generatedAt: createdAt });
        const notice = exportOutcomeNotice('PDF', outcome);
        if (notice) Alert.alert(notice.title, notice.message);
        return;
      }

      const backendImageUri = record.imageUri || record.image || record.uri || record.images?.[0];
      if (type === 'image' && backendImageUri) {
        const outcome = await savePngExport(backendImageUri, record);
        const notice = exportOutcomeNotice('Image', outcome);
        if (notice) Alert.alert(notice.title, notice.message);
        return;
      }

      Alert.alert('Export unavailable', 'A real image export is only available when a scan image exists for this result.');
    } catch (error) {
      Alert.alert('Export failed', toSafeExportMessage(error, 'Unable to export this record. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!item?.id) return;
    try {
      setBusy(true);
      await deleteScanResult(item.id);
      navigation.goBack();
      Alert.alert('Scan result deleted', 'The water-test record has been permanently deleted.');
    } catch (error) {
      Alert.alert('Delete failed', error?.message || 'Unable to delete this water-test record.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    if (!item?.id || busy) return;
    Alert.alert(
      'Delete Scan Result',
      'Are you sure you want to permanently delete this scan result? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Permanently', style: 'destructive', onPress: confirmDelete },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.subHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Details</Text>
      </View>

      <View style={[styles.card, SHADOWS.strong]}>
        <Text style={styles.title}>{item.title || 'Analysis Report'}</Text>
        <Text style={styles.meta}>{new Date(createdAt).toLocaleString()}</Text>

        {detailLoading ? <Text style={styles.loadingText}>Refreshing saved record…</Text> : null}

        {imageUri && imageState !== 'unavailable' ? (
          <View style={styles.previewWrap}>
            {imageState === 'loading' ? <Text style={styles.loadingText}>Loading image...</Text> : null}
            <Image
              source={{ uri: imageUri }}
              style={styles.preview}
              onLoadStart={() => setImageState('loading')}
              onLoad={() => {
                setImageState('loaded');
                logHistoryImage('load-success', item.id, imageUri);
              }}
              onError={() => {
                setImageState('unavailable');
                logHistoryImage('load-failure', item.id, imageUri);
              }}
            />
          </View>
        ) : (
          <View style={styles.imageUnavailable}>
            <Text style={styles.loadingText}>Image unavailable</Text>
            {item.id ? <TouchableOpacity onPress={() => refreshDetail().catch(() => undefined)}><Text style={styles.retryText}>Retry</Text></TouchableOpacity> : null}
          </View>
        )}

        {summaryFields.map((field) => (
          <View key={field.label} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <Text style={styles.fieldValue}>{field.value || 'Not available'}</Text>
          </View>
        ))}

        {item.location && Number.isFinite(Number(item.location.latitude)) && Number.isFinite(Number(item.location.longitude)) ? (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Location</Text>
            <Text style={styles.fieldValue}>{Number(item.location.latitude).toFixed(4)}, {Number(item.location.longitude).toFixed(4)}</Text>
          </View>
        ) : null}

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Sample</Text>
          <Text style={styles.fieldValue}>{sampleCode || 'Not selected'}</Text>
        </View>
        {item.gpsAccuracyMeters != null ? (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>GPS accuracy</Text>
            <Text style={styles.fieldValue}>±{Number(item.gpsAccuracyMeters).toFixed(1)} m</Text>
          </View>
        ) : null}

        {sampleClass || item.siteName || item.sourceType ? (
          <>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Sample class</Text>
              <Text style={styles.fieldValue}>{sampleClass || 'Unknown'}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Sampling site</Text>
              <Text style={styles.fieldValue}>{item.siteName || 'Unknown sampling site'}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Water source</Text>
              <Text style={styles.fieldValue}>{item.sourceType || 'Unknown'}</Text>
            </View>
          </>
        ) : null}

        {detailError ? <Text style={styles.errorText}>{detailError}</Text> : null}

        {item.resultData && Object.keys(item.resultData).some((key) => ['pH', 'pH Category', 'Nitrite', 'Nitrite Status'].includes(key)) ? (
          <View style={styles.metricsWrap}>
            {Object.entries(item.resultData).filter(([key]) => ['pH', 'pH Category', 'Nitrite', 'Nitrite Status'].includes(key)).map(([key, value]) => (
              <View key={key} style={styles.metricBox}>
                <Text style={styles.metricLabel}>{key}</Text>
                <Text style={styles.metricValue}>{String(value || 'Not available')}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {item.recommendations?.length ? (
          <View style={styles.fileList}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {item.recommendations.map((entry) => (
              <Text key={entry} style={styles.fileText}>• {entry}</Text>
            ))}
          </View>
        ) : null}

        {Array.isArray(item.files) && item.files.length ? (
          <View style={styles.fileList}>
            <Text style={styles.sectionTitle}>Saved files</Text>
            {item.files.map((filePath) => (
              <Text key={filePath} style={styles.fileText}>{filePath}</Text>
            ))}
          </View>
        ) : null}

        <View style={styles.exportRow}>
          <TouchableOpacity style={[styles.exportBtn, busy && styles.disabledBtn]} onPress={() => handleExport('pdf')} disabled={busy}>
            <MaterialCommunityIcons name="file-pdf-box" size={18} color={COLORS.white} />
            <Text style={styles.exportText}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn, busy && styles.disabledBtn]} onPress={() => handleExport('image')} disabled={busy}>
            <MaterialCommunityIcons name="image" size={18} color={COLORS.white} />
            <Text style={styles.exportText}>Image</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn, busy && styles.disabledBtn]} onPress={() => Share.share({ message: `${item.title || 'AQUALITY result'}\n\n${cleanClientRemarks(item.summary) || 'No summary available.'}` })} disabled={busy}>
            <MaterialCommunityIcons name="share" size={18} color={COLORS.white} />
            <Text style={styles.exportText}>Share</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.deleteButton, busy && styles.disabledBtn]} onPress={handleDelete} disabled={busy}>
          <MaterialCommunityIcons name="delete-outline" size={18} color={COLORS.danger} />
          <Text style={styles.deleteText}>Delete record</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F7FBFF', flex: 1 },
  content: { width: '100%', maxWidth: SIZES.contentMaxWidth, alignSelf: 'center', padding: LAYOUT.pagePadding, paddingBottom: LAYOUT.bottomTabClearance },
  card: { backgroundColor: COLORS.white, borderRadius: RADII.card, padding: SPACING.lg },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.navy },
  meta: { color: COLORS.muted, marginTop: SPACING.xs, marginBottom: SPACING.sm },
  previewWrap: { marginBottom: SPACING.sm },
  preview: { width: '100%', height: 220, borderRadius: RADII.control, marginTop: SPACING.xs },
  loadingText: { color: COLORS.muted, lineHeight: 20, marginTop: SPACING.xs },
  imageUnavailable: { backgroundColor: COLORS.soft, borderRadius: RADII.control, padding: SPACING.md, marginBottom: SPACING.sm },
  retryText: { color: COLORS.primary, fontWeight: '800', marginTop: SPACING.xs },
  errorText: { color: COLORS.danger, lineHeight: 20, marginTop: SPACING.md },
  fieldRow: { marginTop: 8 },
  fieldLabel: { color: COLORS.muted, fontSize: 12 },
  fieldValue: { color: COLORS.text, fontWeight: '800', marginTop: 4 },
  metricsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  metricBox: {
    minWidth: 130,
    flex: 1,
    backgroundColor: COLORS.soft,
    borderRadius: RADII.control,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  metricLabel: { color: COLORS.muted, fontSize: 12 },
  metricValue: { color: COLORS.text, fontWeight: '800', marginTop: 6 },
  exportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  exportBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADII.control,
    minWidth: 96,
    minHeight: SIZES.touchTarget,
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  exportText: { color: COLORS.white, marginLeft: 8, fontWeight: '800' },
  disabledBtn: { opacity: 0.7 },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  backButton: {
    width: SIZES.touchTarget,
    height: SIZES.touchTarget,
    borderRadius: RADII.control,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.navy,
  },
  fileList: { marginTop: 16 },
  sectionTitle: { color: COLORS.navy, fontWeight: '800', marginBottom: 8 },
  fileText: { color: COLORS.text, lineHeight: 20, marginBottom: 6 },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    minHeight: SIZES.touchTarget,
    paddingVertical: 10,
    borderRadius: RADII.control,
    backgroundColor: '#FFF1F1',
  },
  deleteText: { color: COLORS.danger, fontWeight: '800', marginLeft: 8 },
});
