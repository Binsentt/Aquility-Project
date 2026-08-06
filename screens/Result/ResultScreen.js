import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, LAYOUT, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';
import { createPdfExport, createPngExport, shareExportFile } from '../../services/exportService';
import { toSafeExportMessage } from '../../services/exportErrors';
import { loadBackendWaterTest } from '../../services/waterTestRecordService';

export default function ResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { currentUser, scanHistory } = useAuth();
  const routeParams = route.params || {};
  const routePayload =
    typeof routeParams.id === 'string'
      ? scanHistory.find((entry) => entry.id === routeParams.id) || routeParams
      : routeParams;
  const [backendPayload, setBackendPayload] = useState(null);
  const [backendError, setBackendError] = useState(null);
  const payload = backendPayload || routePayload;
  const payloadFound = Boolean(payload?.id || routeParams?.id || payload?.title || payload?.images?.length || payload?.imageUri || payload?.image || payload?.uri);
  const imageUri = payload?.imageUri || payload?.image || payload?.uri || (Array.isArray(payload?.images) ? payload.images[0] : null);
  const createdAt = payload.generatedAt || payload.createdAt || new Date().toISOString();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!routePayload?.id) return undefined;
    loadBackendWaterTest(routePayload.id)
      .then((record) => {
        if (active) {
          setBackendPayload(record);
          setBackendError(null);
        }
      })
      .catch((error) => {
        if (active) setBackendError(error?.message || 'Unable to refresh this saved water-test record.');
      });
    return () => { active = false; };
  }, [routePayload?.id]);

  const metrics = useMemo(() => {
    const source = payload.resultData || {};
    return Object.entries(source).slice(0, 6);
  }, [payload.resultData]);

  const handleExportPdf = async () => {
    if (saving) return;

    try {
      setSaving(true);
      const record = await loadBackendWaterTest(payload?.id);
      const exported = await createPdfExport({
        ...record,
        user: record.user || currentUser,
        generatedAt: createdAt,
      });
      await shareExportFile(exported.uri, 'AQUILITY result exported as PDF.');
      Alert.alert('PDF export shared', 'The PDF report was generated and shared successfully.');
    } catch (error) {
      Alert.alert('PDF Export Failed', toSafeExportMessage(error, 'Unable to generate or share the PDF report. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleExportImage = async () => {
    if (saving) return;

    try {
      const record = await loadBackendWaterTest(payload?.id);
      const backendImageUri = record.imageUri || record.image || record.uri || record.images?.[0];
      if (!backendImageUri) {
        Alert.alert('No image available', 'This scan result has no source image to export.');
        return;
      }

      setSaving(true);
      const exported = await createPngExport(backendImageUri);
      await shareExportFile(exported.uri, 'AQUILITY scan image exported.');
      Alert.alert('PNG export shared', 'The image export was generated and shared successfully.');
    } catch (error) {
      Alert.alert('PNG Export Failed', toSafeExportMessage(error, 'Unable to generate or share the image export. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Water Result</Text>
      </View>

      {!payloadFound ? (
        <View style={[styles.heroCard, SHADOWS.strong]}>
          <Text style={styles.heroTitle}>No scan found</Text>
          <Text style={styles.secondaryText}>This result could not be resolved from the saved history. Return to History and try again.</Text>
        </View>
      ) : (
        <>
          <View style={[styles.heroCard, SHADOWS.strong]}>
            <Text style={styles.heroTitle}>{payload.title || 'Water Test'}</Text>
            <Text style={styles.heroDate}>{new Date(createdAt).toLocaleString()}</Text>
            {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}

            <View style={styles.statusRow}>
              <View style={styles.statusBadge}>
                <MaterialCommunityIcons name="information-outline" size={16} color={COLORS.primary} />
                <Text style={styles.statusText}>{payload.status || 'Analysis unavailable'}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.sectionCard, SHADOWS.card]}>
            <Text style={styles.sectionTitle}>Report overview</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Scan ID</Text>
              <Text style={styles.metaValue}>{payload.id || 'Unavailable'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Images</Text>
              <Text style={styles.metaValue}>{Array.isArray(payload.images) ? payload.images.length : 1}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Analysis status</Text>
              <Text style={styles.metaValue}>{payload.analysisStatus || 'Analysis unavailable'}</Text>
            </View>
            {payload.location ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Location</Text>
                <Text style={styles.metaValue}>{payload.location.latitude.toFixed(4)}, {payload.location.longitude.toFixed(4)}</Text>
              </View>
            ) : null}
            <Text style={styles.summaryText}>{payload.summary || 'No summary available yet.'}</Text>
            <Text style={styles.secondaryText}>{payload.interpretation || 'Results are estimates based on the current water-test analysis settings.'}</Text>
            {backendError ? <Text style={styles.secondaryText}>{backendError}</Text> : null}
          </View>

          {payload.warnings?.length ? (
            <View style={[styles.sectionCard, SHADOWS.card]}>
              <Text style={styles.sectionTitle}>Notes</Text>
              {payload.warnings.map((warning) => (
                <Text key={warning} style={styles.warningText}>• {warning}</Text>
              ))}
            </View>
          ) : null}

          {payload.recommendations?.length ? (
            <View style={[styles.sectionCard, SHADOWS.card]}>
              <Text style={styles.sectionTitle}>Recommendations</Text>
              {payload.recommendations.map((item) => (
                <Text key={item} style={styles.warningText}>• {item}</Text>
              ))}
            </View>
          ) : null}

          {metrics.length > 0 ? (
            <View style={[styles.sectionCard, SHADOWS.card]}>
              <Text style={styles.sectionTitle}>Parameters</Text>
              <View style={styles.metricsWrap}>
                {metrics.map(([key, value]) => (
                  <View key={key} style={styles.metricBox}>
                    <Text style={styles.metricLabel}>{key}</Text>
                    <Text style={styles.metricValue}>{String(value || 'Not available')}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={[styles.sectionCard, SHADOWS.card]}>
            <Text style={styles.sectionTitle}>Export report</Text>
            <Text style={styles.secondaryText}>Export a PDF or image snapshot for your water-quality records. Files are saved in app storage when supported.</Text>
            <View style={styles.exportRow}>
              <TouchableOpacity style={[styles.exportBtn, saving && styles.disabledBtn]} onPress={handleExportPdf} disabled={saving}>
                <MaterialCommunityIcons name="file-pdf-box" size={18} color={COLORS.white} />
                <Text style={styles.exportText}>Save PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.exportBtn, saving && styles.disabledBtn]} onPress={handleExportImage} disabled={saving}>
                <MaterialCommunityIcons name="image" size={18} color={COLORS.white} />
                <Text style={styles.exportText}>Save Image</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FBFF' },
  content: { width: '100%', maxWidth: SIZES.contentMaxWidth, alignSelf: 'center', padding: LAYOUT.pagePadding, paddingBottom: LAYOUT.bottomTabClearance },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  backButton: {
    width: SIZES.touchTarget,
    height: SIZES.touchTarget,
    borderRadius: RADII.control,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    ...SHADOWS.card,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.navy },
  heroCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.hero,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  heroTitle: { fontSize: 20, fontWeight: '900', color: COLORS.navy },
  heroDate: { marginTop: SPACING.xs, color: COLORS.muted },
  preview: { width: '100%', height: 220, borderRadius: RADII.control, marginTop: SPACING.md, resizeMode: 'cover' },
  statusRow: { marginTop: SPACING.md },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF4FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADII.pill,
    alignSelf: 'flex-start',
  },
  statusText: { marginLeft: 8, color: COLORS.primary, fontWeight: '800' },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.card,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.navy, marginBottom: SPACING.sm },
  summaryText: { color: COLORS.text, lineHeight: 22, marginTop: 8 },
  secondaryText: { marginTop: 8, color: COLORS.muted, lineHeight: 20 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  metaLabel: { color: COLORS.muted, fontSize: 12 },
  metaValue: { color: COLORS.text, fontWeight: '700', flexShrink: 1 },
  metricsWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  metricBox: {
    width: '48%',
    minWidth: 130,
    flexGrow: 1,
    backgroundColor: COLORS.soft,
    borderRadius: RADII.control,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  metricLabel: { color: COLORS.muted, fontSize: 12 },
  metricValue: { marginTop: 6, fontWeight: '800', color: COLORS.text },
  warningText: { color: COLORS.text, lineHeight: 21, marginBottom: 6 },
  exportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADII.control,
    minWidth: 132,
    minHeight: SIZES.touchTarget,
    paddingVertical: 10,
  },
  exportText: { color: COLORS.white, fontWeight: '800', marginLeft: 8 },
  disabledBtn: { opacity: 0.7 },
});
