import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

export default function KidHome() {
  return (
    <ScrollView style={styles.container}>
      
      {/* Hero Section */}
      <View style={styles.heroCard}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>✨ Welcome to CubbyCove!</Text>
        </View>
        <Text style={styles.heroTitle}>Safe, Fun, and Educational Content</Text>
        <Text style={styles.heroSubtitle}>Discover amazing cartoons and games picked just for you.</Text>
        
        {/* Placeholder for Slider */}
        <View style={styles.sliderMock}>
          <Image 
            source={{ uri: 'https://img.youtube.com/vi/a1i436o6h1U/maxresdefault.jpg' }}
            style={styles.sliderImage}
          />
        </View>
      </View>

      {/* Quick Games */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎮 Quick Games</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          
          <TouchableOpacity style={[styles.gameCard, { backgroundColor: '#4F46E5' }]}>
            <View style={styles.gameIcon}><Text style={styles.gameIconText}>🔢</Text></View>
            <Text style={styles.gameTitle}>Math</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.gameCard, { backgroundColor: '#10B981' }]}>
            <View style={styles.gameIcon}><Text style={styles.gameIconText}>📝</Text></View>
            <Text style={styles.gameTitle}>Words</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.gameCard, { backgroundColor: '#F43F5E' }]}>
            <View style={styles.gameIcon}><Text style={styles.gameIconText}>🎨</Text></View>
            <Text style={styles.gameTitle}>Art</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>

      {/* Recommended Videos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⭐ Featured for You</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          {/* Mock Video Items */}
          {[1,2,3].map(item => (
            <View key={item} style={styles.videoCard}>
              <View style={styles.videoThumbnail} />
              <Text style={styles.videoTitle}>Fun learning video {item}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight },
  heroCard: { 
    margin: SIZES.padding, 
    padding: SIZES.padding, 
    borderRadius: SIZES.radius * 2,
    backgroundColor: COLORS.primary,
    overflow: 'hidden'
  },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
  heroBadgeText: { color: COLORS.white, fontWeight: 'bold', fontSize: SIZES.body4 },
  heroTitle: { color: COLORS.white, fontSize: SIZES.h2, fontWeight: '900', marginBottom: 8 },
  heroSubtitle: { color: COLORS.white, opacity: 0.9, fontSize: SIZES.body4, marginBottom: 16 },
  sliderMock: { height: 180, borderRadius: SIZES.radius, overflow: 'hidden', backgroundColor: '#000' },
  sliderImage: { width: '100%', height: '100%', opacity: 0.8 },
  section: { marginBottom: SIZES.padding * 1.5 },
  sectionTitle: { fontSize: SIZES.h3, fontWeight: '900', color: COLORS.textDark, marginLeft: SIZES.padding, marginBottom: SIZES.base },
  horizontalList: { paddingHorizontal: SIZES.padding, gap: 16 },
  gameCard: { width: 140, height: 140, borderRadius: SIZES.radius * 1.5, padding: 16, alignItems: 'center', justifyContent: 'center' },
  gameIcon: { width: 50, height: 50, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: SIZES.radius, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  gameIconText: { fontSize: 24 },
  gameTitle: { color: COLORS.white, fontWeight: 'bold', fontSize: SIZES.h4 },
  videoCard: { width: 220 },
  videoThumbnail: { width: '100%', height: 120, backgroundColor: COLORS.borderLight, borderRadius: SIZES.radius, marginBottom: 8 },
  videoTitle: { fontSize: SIZES.body4, fontWeight: 'bold', color: COLORS.textDark }
});
