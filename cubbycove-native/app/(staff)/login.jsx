import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { COLORS, SIZES } from '../../constants/theme';
import useAuthStore from '../../store/authStore';

export default function StaffLogin() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const { setUser } = useAuthStore();

  const handleLogin = () => {
    // Mock authorization 
    setUser({ role: 'staff', identifier });
    // router.replace('/(staff)/dashboard');
    alert("Logged in as Staff: " + identifier);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.card}>
          <View style={styles.iconBox}>
            <Text style={{fontSize: 24, color: COLORS.primary}}>🛡️</Text>
          </View>
          <Text style={styles.title}>Staff Portal</Text>
          <Text style={styles.subtitle}>Authorized CubbyCove Personnel Only</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Staff ID or Email</Text>
            <TextInput 
              style={styles.input} 
              placeholder="#STF-A1B2C3 or email@cubbycove.com"
              placeholderTextColor={COLORS.textLight}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
            />
            
            <Text style={styles.label}>Password</Text>
            <TextInput 
              style={styles.input} 
              placeholder="••••••••"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity style={styles.button} onPress={handleLogin}>
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>

            <Link href="/" asChild>
              <TouchableOpacity style={styles.linkButton}>
                <Text style={styles.linkText}>Return to Main Site</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundDark },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: SIZES.padding },
  card: { 
    backgroundColor: 'rgba(255, 255, 255, 0.05)', 
    borderRadius: SIZES.radius * 2, 
    padding: SIZES.padding,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center'
  },
  iconBox: { backgroundColor: 'rgba(76, 201, 240, 0.2)', padding: 12, borderRadius: 30, marginBottom: SIZES.base },
  title: { fontSize: SIZES.h2, fontWeight: 'bold', color: COLORS.white, marginBottom: 4 },
  subtitle: { fontSize: SIZES.body4, color: COLORS.textDarkThemeMuted, marginBottom: SIZES.padding * 1.5, textAlign: 'center' },
  form: { width: '100%' },
  label: { fontSize: 12, fontWeight: 'bold', color: COLORS.textDarkThemeMuted, textTransform: 'uppercase', marginBottom: 6, marginLeft: 4 },
  input: {
    backgroundColor: COLORS.backgroundDark,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderRadius: SIZES.radius,
    padding: 16,
    color: COLORS.white,
    marginBottom: SIZES.padding
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginTop: SIZES.base,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4
  },
  buttonText: { color: COLORS.backgroundDark, fontWeight: 'bold', fontSize: SIZES.body3 },
  linkButton: { marginTop: SIZES.padding * 1.5, alignItems: 'center' },
  linkText: { color: COLORS.textDarkThemeMuted, fontSize: 12 }
});
