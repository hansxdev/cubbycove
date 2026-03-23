import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

export default function KidGames() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Games Center</Text>
      <Text style={styles.subtitle}>Select a game to play.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.textDark },
  subtitle: { color: COLORS.textLight, marginTop: 8 }
});
