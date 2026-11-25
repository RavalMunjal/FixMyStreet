import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Loading from '../../components/Loading';
import { userService } from '../../services/api';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();

  const [stats, setStats] = useState({
    totalComplaints: 0,
    pendingCount: 0,
    inProgressCount: 0,
    resolvedCount: 0,
  });
  const [loading, setLoading] = useState(true);

  // Edit profile state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState('');

  const fetchProfileData = useCallback(async () => {
    try {
      const res = await userService.getProfile();
      if (res?.data?.stats) {
        setStats(res.data.stats);
      }
      if (res?.data?.user) {
        setName(res.data.user.name);
        setEmail(res.data.user.email);
      }
    } catch (e) {
      console.warn('Profile fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfileData();
    }, [fetchProfileData])
  );

  const handleUpdateProfile = async () => {
    setEditError('');
    if (!name.trim()) {
      setEditError('Please enter your full name');
      return;
    }

    try {
      setUpdating(true);
      const payload = {
        name: name.trim(),
        email: email.trim(),
      };

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      await userService.updateProfile(payload);
      await refreshUser();
      setCurrentPassword('');
      setNewPassword('');
      setEditModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      setEditError(error.message || 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of FixMyStreet?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="My Profile" />
        <Loading message="Loading profile..." fullScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header title="Citizen Profile" subtitle="Account settings & statistics" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>
              {user?.name
                ? user.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : 'U'}
            </Text>
          </View>
          <Text style={styles.profileName}>{user?.name || 'Citizen'}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <View style={styles.roleTag}>
            <Ionicons name="shield-outline" size={14} color={COLORS.primary} />
            <Text style={styles.roleTagText}>Registered Citizen</Text>
          </View>
        </View>

        {/* Complaints Statistics */}
        <Text style={styles.sectionTitle}>My Reporting Activity</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statCount}>{stats.totalComplaints}</Text>
            <Text style={styles.statLabel}>Filed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statCount, { color: COLORS.pending }]}>
              {stats.pendingCount}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statCount, { color: COLORS.inProgress }]}>
              {stats.inProgressCount}
            </Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statCount, { color: COLORS.resolved }]}>
              {stats.resolvedCount}
            </Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <Card style={styles.card}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => setEditModalVisible(true)}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="create-outline" size={20} color={COLORS.text} />
              <Text style={styles.actionItemText}>Edit Profile Information</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() =>
              Alert.alert(
                'FixMyStreet App Info',
                'Version: 1.0.0\nCollege Final Year Submission 2026\nDesigned for Citizens & Municipal Administrators.'
              )
            }
          >
            <View style={styles.actionLeft}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={COLORS.text}
              />
              <Text style={styles.actionItemText}>About Application</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Logout Button */}
        <Button
          title="Sign Out"
          onPress={handleLogout}
          variant="outline"
          icon="log-out-outline"
          style={styles.logoutBtn}
          textStyle={{ color: COLORS.danger }}
        />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {editError ? (
              <View style={styles.modalError}>
                <Text style={styles.modalErrorText}>{editError}</Text>
              </View>
            ) : null}

            <ScrollView>
              <Input
                label="Full Name"
                value={name}
                onChangeText={setName}
                placeholder="Enter name"
                icon="person-outline"
              />

              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="Enter email"
                keyboardType="email-address"
                icon="mail-outline"
              />

              <Text style={styles.changePasswordLabel}>
                Change Password (Optional):
              </Text>
              <Input
                label="Current Password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Required if changing password"
                isPassword
                icon="lock-closed-outline"
              />

              <Input
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Minimum 6 characters"
                isPassword
                icon="key-outline"
              />

              <Button
                title="Save Profile Changes"
                onPress={handleUpdateProfile}
                loading={updating}
                style={styles.saveBtn}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  avatarCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
  },
  profileName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
  },
  profileEmail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginTop: SPACING.sm,
  },
  roleTagText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statCount: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  card: {
    padding: 0,
    marginBottom: SPACING.lg,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionItemText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  logoutBtn: {
    borderColor: COLORS.dangerBorder,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalError: {
    padding: SPACING.sm,
    backgroundColor: COLORS.dangerBg,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
  },
  modalErrorText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.xs,
  },
  changePasswordLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  saveBtn: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
});
