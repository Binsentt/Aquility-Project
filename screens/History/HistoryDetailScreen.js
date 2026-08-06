import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ScrollView, Share } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS, LAYOUT, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';
import { createPdfExport, createPngExport, shareExportFile } from '../../services/exportService';
import { toSafeExportMessage } from '../../services/exportErrors';
import { loadBackendWaterTest } from '../../services/waterTestRecordService';

export default function HistoryDetailScreen({ route, navigation }) {
  const { currentUser, deleteScanResult } = useAuth();
  const item = route.params?.item || {};
  const imageUri = item.imageUri || item.image || item.uri || (Array.isArray(item.images) ? item.images[0] : null);
  const createdAt = item.createdAt || new Date().toISOString();
  const [busy, setBusy] = useState(false);

  const summaryFields = useMemo(
    () => [
      { label: 'Status', value: item.status || 'Not available' },
      { label: 'Analysis status', value: item.analysisStatus || 'Not available' },
      { label: 'Scan date', value: new Date(createdAt).toLocaleString() },
      { label: 'Result summary', value: item.summary || 'Not available' },
    ],
    [createdAt, item.analysisStatus, item.status, item.summary]
  );

  const handleExport = async (type) => {
    if (busy) return;

    try {
      setBusy(true);
      const record = await loadBackendWaterTest(item.id);

      if (type === 'pdf') {
        const exported = await createPdfExport({ ...record, user: record.user || currentUser, generatedAt: createdAt });
        await shareExportFile(exported.uri, 'AQUILITY scan result exported as PDF.');
        Alert.alert('PDF export shared', 'The PDF report was generated and shared successfully.');
        return;
      }

      const backendImageUri = record.imageUri || record.image || record.uri || record.images?.[0];
      if (type === 'image' && backendImageUri) {
        const exported = await createPngExport(backendImageUri);
        await shareExportFile(exported.uri, 'AQUILITY scan image exported.');
        Alert.alert('PNG export shared', 'The image export was generated and shared successfully.');
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

        {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}

        {summaryFields.map((field) => (
          <View key={field.label} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <Text style={styles.fieldValue}>{field.value || 'Not available'}</Text>
          </View>
        ))}

        {item.location ? (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Location</Text>
            <Text style={styles.fieldValue}>{item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}</Text>
          </View>
        ) : null}

        {item.resultData && Object.keys(item.resultData).length > 0 ? (
          <View style={styles.metricsWrap}>
            {Object.entries(item.resultData).map(([key, value]) => (
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
          <TouchableOpacity style={[styles.exportBtn, busy && styles.disabledBtn]} onPress={() => Share.share({ message: `${item.title || 'AQUILITY result'}\n\n${item.summary || 'No summary available.'}` })} disabled={busy}>
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
  preview: { width: '100%', height: 220, borderRadius: RADII.control, marginBottom: SPACING.sm },
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
