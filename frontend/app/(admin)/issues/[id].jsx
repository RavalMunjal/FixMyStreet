import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../../components/Header';
import Badge from '../../../components/Badge';
import Card from '../../../components/Card';
import Input from '../../../components/Input';
import Button from '../../../components/Button';
import Loading from '../../../components/Loading';
import { issueService, adminService, uploadService } from '../../../services/api';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../../constants/theme';

export default function AdminIssueReviewScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Status update & resolution state
  const [status, setStatus] = useState('Pending');
  const [adminNote, setAdminNote] = useState('');
  const [resolutionAsset, setResolutionAsset] = useState(null);
  const [removedExistingProof, setRemovedExistingProof] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchIssue = useCallback(async () => {
    try {
      const res = await issueService.getById(id);
      const data = res?.data?.issue;
      setIssue(data);
      if (data) {
        setStatus(data.status);
        setAdminNote(data.adminNote || '');
        setRemovedExistingProof(false);
      }
    } catch (e) {
      console.warn('Error loading issue for admin:', e);
      Alert.alert('Error', e.message || 'Unable to fetch complaint details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchIssue();
    }, [fetchIssue])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchIssue();
  };

  // Pick resolution proof image
  const pickResolutionImage = async () => {
    if (updating) return;
    try {
      const { status: perm } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery access is needed.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.65,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const selected = res.assets[0];
        if (selected.fileSize && selected.fileSize > 5 * 1024 * 1024) {
          Alert.alert('Photo Too Large', 'Please choose an image under 5MB.');
          return;
        }
        setResolutionAsset(selected);
        setRemovedExistingProof(false);
      }
    } catch (err) {
      console.warn('Resolution image picker error:', err);
      Alert.alert('Error', 'Unable to pick photo.');
    }
  };

  // Handle status update
  const handleUpdateStatus = async () => {
    if (updating) return;
    try {
      setUpdating(true);
      let uploadedResolutionUrl = removedExistingProof
        ? ''
        : issue.resolutionImageUrl || '';

      // If a new resolution photo was chosen, upload it first
      if (resolutionAsset?.uri) {
        const uploadRes = await uploadService.uploadImage(resolutionAsset);
        uploadedResolutionUrl = uploadRes?.data?.url || '';
        if (!uploadedResolutionUrl) {
          throw new Error('Resolution photo upload failed.');
        }
      }

      if (status === 'Resolved') {
        await adminService.resolve(id, adminNote, uploadedResolutionUrl);
      } else {
        await adminService.updateStatus(id, status, adminNote);
      }

      setResolutionAsset(null);
      await fetchIssue();

      Alert.alert(
        'Success',
        `Complaint has been updated to ${status} in MongoDB.`,
        [
          {
            text: 'Back to List',
            onPress: () => router.back(),
          },
          { text: 'Stay Here' },
        ]
      );
    } catch (error) {
      console.error('Update status error:', error);
      Alert.alert('Update Failed', error.message || 'Could not update status');
    } finally {
      setUpdating(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Header title="Complaint Review" showBack />
        <Loading message="Loading complaint details..." fullScreen />
      </SafeAreaView>
    );
  }

  if (!issue) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Header title="Complaint Review" showBack />
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Complaint not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayedProofUri =
    resolutionAsset?.uri || (!removedExistingProof ? issue.resolutionImageUrl : null);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header
        title="Review & Resolve"
        subtitle={`Complaint #${issue._id?.slice(-6)}`}
        showBack
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.secondary]}
            />
          }
        >
          {/* Original Reported Photo */}
          <View style={styles.imageBox}>
            <Image source={{ uri: issue.imageUrl }} style={styles.issueImage} />
            <View style={styles.badgesOverlay}>
              <Badge category={issue.category} />
              <Badge status={issue.status} />
            </View>
          </View>

          {/* Complaint Info Card */}
          <Card style={styles.card}>
            <Text style={styles.issueTitle}>{issue.title}</Text>
            <Text style={styles.issueDesc}>{issue.description}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color={COLORS.secondary} />
              <Text style={styles.locationText}>{issue.address}</Text>
            </View>
            <Text style={styles.reporterText}>
              Reported by: {issue.reportedBy?.name} ({issue.reportedBy?.email})
            </Text>
          </Card>

          {/* Status Transition Control Card */}
          <Card style={styles.card}>
            <Text style={styles.sectionHeading}>Update Complaint Status</Text>
            <Text style={styles.helperText}>
              Select the new operational status for this issue:
            </Text>

            <View style={styles.statusButtonsRow}>
              {['Pending', 'In Progress', 'Resolved'].map((st) => {
                const isSelected = status === st;
                return (
                  <TouchableOpacity
                    key={st}
                    disabled={updating}
                    onPress={() => setStatus(st)}
                    style={[
                      styles.statusChoiceBtn,
                      isSelected && styles.statusChoiceBtnSelected,
                      st === 'Pending' && isSelected && { borderColor: COLORS.pending },
                      st === 'In Progress' && isSelected && { borderColor: COLORS.inProgress },
                      st === 'Resolved' && isSelected && { borderColor: COLORS.resolved },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChoiceText,
                        isSelected && styles.statusChoiceTextSelected,
                      ]}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Admin Note Input */}
            <Input
              label="Administrator Note / Resolution Details"
              placeholder="e.g. Work crew dispatched to repair road surface"
              value={adminNote}
              onChangeText={setAdminNote}
              multiline
              numberOfLines={3}
              editable={!updating}
              style={styles.adminNoteInput}
            />

            {/* Resolution Proof Photo */}
            <Text style={styles.fieldLabel}>
              Resolution Proof Photo (Recommended for Resolved)
            </Text>
            {displayedProofUri ? (
              <View style={styles.resolutionPreviewContainer}>
                <Image
                  source={{ uri: displayedProofUri }}
                  style={styles.resolutionThumb}
                />
                <TouchableOpacity
                  disabled={updating}
                  onPress={() => {
                    setResolutionAsset(null);
                    setRemovedExistingProof(true);
                  }}
                  style={styles.removeProofBtn}
                >
                  <Ionicons name="trash-outline" size={16} color="#ffffff" />
                  <Text style={styles.removeProofText}>Remove Proof</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                disabled={updating}
                onPress={pickResolutionImage}
                style={styles.uploadProofBtn}
              >
                <Ionicons
                  name="cloud-upload-outline"
                  size={22}
                  color={COLORS.secondary}
                />
                <Text style={styles.uploadProofText}>
                  Attach Resolution Proof Photo
                </Text>
              </TouchableOpacity>
            )}

            <Button
              title={updating ? 'Saving Changes...' : 'Save & Update Status'}
              onPress={handleUpdateStatus}
              loading={updating}
              disabled={updating}
              variant="secondary"
              style={styles.saveBtn}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  imageBox: {
    position: 'relative',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  issueImage: {
    width: '100%',
    height: 220,
    backgroundColor: COLORS.surfaceAlt,
  },
  badgesOverlay: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  card: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  issueTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  issueDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    fontWeight: '600',
    marginLeft: 4,
    flex: 1,
  },
  reporterText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  helperText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  statusButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  statusChoiceBtn: {
    flexGrow: 1,
    minWidth: '28%',
    paddingVertical: SPACING.sm,
    paddingHorizontal: 6,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  statusChoiceBtnSelected: {
    backgroundColor: COLORS.surface,
  },
  statusChoiceText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  statusChoiceTextSelected: {
    color: COLORS.text,
  },
  adminNoteInput: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  uploadProofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.secondaryLight,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.secondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  uploadProofText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.secondary,
    marginLeft: SPACING.xs,
  },
  resolutionPreviewContainer: {
    position: 'relative',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  resolutionThumb: {
    width: '100%',
    height: 160,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
  },
  removeProofBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  removeProofText: {
    color: '#ffffff',
    fontSize: FONT_SIZE.xs,
    marginLeft: 4,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: COLORS.secondary,
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.danger,
  },
});
