import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme';

export default function SplashScreen() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Timeout safeguard so the splash screen never hangs permanently
    const timer = setTimeout(() => {
      if (!isLoading) {
        if (isAuthenticated) {
          if (user?.role === 'admin') {
            router.replace('/(admin)/dashboard');
          } else {
            router.replace('/(citizen)/home');
          }
        } else {
          router.replace('/(auth)/login');
        }
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated, user]);

  return (
    <View style={styles.container}>
      <View style={styles.brandContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="construct" size={48} color={COLORS.primary} />
        </View>
        <Text style={styles.appName}>FixMyStreet</Text>
        <Text style={styles.tagline}>Community Civic Issue Reporting</Text>
      </View>

      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.checkingText}>Initializing secure session...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  brandContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  checkingText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
});
