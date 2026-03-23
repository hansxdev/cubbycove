import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';
import useAuthStore from '../../store/authStore';

const { width } = Dimensions.get('window');

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const [activeChild, setActiveChild] = useState(null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      
      {/* Top Welcome & Kids Selection (Mobile Sidebar replacement) */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}><Text style={styles.avatarText}>M</Text></View>
          <Text style={styles.userName}>Hello, {user?.email || 'Parent'}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kidsScroll}>
           <TouchableOpacity style={[styles.kidChip, activeChild === '1' && styles.kidChipActive]} onPress={() => setActiveChild('1')}>
             <Text style={activeChild === '1' ? styles.kidChipTextActive : styles.kidChipText}>Child 1</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.addKidChip}>
             <Text style={styles.addKidChipText}>+ Add Kid</Text>
           </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.dashboardGrid}>
        
        {/* Activity Log */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Activity Log</Text>
            <View style={[styles.iconBox, { backgroundColor: '#EEF9EC' }]}><Text>⏱️</Text></View>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Select a child to view activity</Text>
          </View>
        </View>

        {/* Screen Time */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardSubtitle}>SCREEN TIME</Text>
              <Text style={styles.statLarge}>0 hrs 0 min</Text>
            </View>
          </View>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.emptyStateText}>[ Chart Graphic expected here ]</Text>
          </View>
        </View>

        {/* Notifications */}
        <View style={[styles.card, { backgroundColor: '#FBFFF2', borderColor: '#E9F3D5' }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Notifications</Text>
          </View>
          <View style={styles.innerCard}>
            <Text style={styles.emptyStateText}>No recent notifications.</Text>
          </View>
        </View>

        {/* Safety Alerts */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Safety Alerts</Text>
            <View style={[styles.iconBox, { backgroundColor: '#FFF1F2' }]}><Text>⚠️</Text></View>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No safety alerts detected.</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
           <TouchableOpacity style={styles.actionButton} onPress={logout}>
             <Text style={styles.actionButtonText}>Log Out</Text>
           </TouchableOpacity>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  scrollContent: { padding: SIZES.padding },
  header: { marginBottom: SIZES.padding },
  userInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: SIZES.base * 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#8A51FC', alignItems: 'center', justifyContent: 'center', marginRight: SIZES.base },
  avatarText: { color: COLORS.white, fontWeight: 'bold', fontSize: SIZES.h3 },
  userName: { fontSize: SIZES.h3, fontWeight: '900', color: COLORS.textDark },
  kidsScroll: { flexDirection: 'row', paddingVertical: SIZES.base },
  kidChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.white, marginRight: 10, borderWidth: 1, borderColor: COLORS.borderLight },
  kidChipActive: { backgroundColor: '#8A51FC', borderColor: '#8A51FC' },
  kidChipText: { color: COLORS.textLight, fontWeight: 'bold' },
  kidChipTextActive: { color: COLORS.white, fontWeight: 'bold' },
  addKidChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: COLORS.borderLight, borderStyle: 'dashed' },
  addKidChipText: { color: '#8A51FC', fontWeight: 'bold' },
  dashboardGrid: { gap: SIZES.padding },
  card: { backgroundColor: COLORS.white, borderRadius: SIZES.radius * 2, padding: SIZES.padding, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SIZES.padding },
  cardTitle: { fontSize: SIZES.h4, fontWeight: 'bold', color: COLORS.textDark },
  cardSubtitle: { fontSize: 12, fontWeight: 'bold', color: COLORS.textLight, marginBottom: 4 },
  statLarge: { fontSize: 32, fontWeight: '900', color: '#1C1D21' },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emptyState: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  emptyStateText: { color: COLORS.textLight, fontWeight: '500' },
  chartPlaceholder: { height: 180, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', borderRadius: SIZES.radius },
  innerCard: { backgroundColor: COLORS.white, borderRadius: SIZES.radius * 1.5, padding: SIZES.padding, minHeight: 120, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  actionsContainer: { marginTop: SIZES.base },
  actionButton: { width: '100%', paddingVertical: 14, backgroundColor: '#FFF1F2', borderRadius: SIZES.radius, alignItems: 'center', borderWidth: 1, borderColor: '#FFE4E6' },
  actionButtonText: { color: '#E11D48', fontWeight: 'bold', fontSize: SIZES.body3 }
});
