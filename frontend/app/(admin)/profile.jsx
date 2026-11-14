import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';

export default function AdminProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Sign out of administrator session?',
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Admin Settings"
        subtitle="Privileged administrative account"
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Admin Identity Card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="shield-checkmark" size={40} color={COLORS.secondary} />
          </View>
          <Text style={styles.profileName}>{user?.name || 'Administrator'}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>System Administrator</Text>
          </View>
        </View>

        {/* Security Info Card */}
        <Card style={styles.card}>
          <Text style={styles.cardHeading}>Security & Access Scope</Text>
          <Text style={styles.cardBody}>
            This account possesses full review and resolution authorization. All
            status updates, notes, and uploaded resolution proof photos are logged
            with your administrator ID in MongoDB audit history.
          </Text>
        </Card>

        {/* Logout Button */}
        <Button
          title="Sign Out of Admin"
          onPress={handleLogout}
          variant="outline"
          icon="log-out-outline"
          style={styles.logoutBtn}
          textStyle={{ color: COLORS.danger }}
        />
      </ScrollView>
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
    backgroundColor: COLORS.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
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
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginTop: SPACING.sm,
  },
  roleTagText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.secondary,
    fontWeight: '700',
  },
  card: {
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  cardHeading: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  cardBody: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  logoutBtn: {
    borderColor: COLORS.dangerBorder,
  },
});
