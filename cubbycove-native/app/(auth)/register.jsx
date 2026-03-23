import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { Link, router } from 'expo-router';
import { COLORS, SIZES } from '../../constants/theme';

export default function Register() {
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleNext = () => {
    // Basic multi-step logic
    if (step < 3) setStep(step + 1);
    else {
      // Finalize registration
      alert("Registration Sent! (Mock)");
      router.replace('/(auth)/login');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.headerSubtitle}>Join the safest community for kids.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.stepIndicator}>Step {step} of 3</Text>
          
          {step === 1 && (
            <View>
              <Text style={styles.sectionTitle}>Basic Info</Text>
              <TextInput style={styles.input} placeholder="First Name" value={firstName} onChangeText={setFirstName} />
              <TextInput style={styles.input} placeholder="Last Name" value={lastName} onChangeText={setLastName} />
              <TextInput style={styles.input} placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
              <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.sectionTitle}>Verify Identity</Text>
              <Text style={styles.description}>Please upload a valid Government ID.</Text>
              <TouchableOpacity style={styles.uploadBox}>
                <Text style={styles.uploadText}>Tap to Select ID File</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.sectionTitle}>Set up Face ID</Text>
              <Text style={styles.description}>Take a selfie for security approvals.</Text>
              <View style={styles.cameraPlaceholder}>
                <Text style={styles.cameraText}>[ Camera View ]</Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={handleNext}>
            <Text style={styles.buttonText}>{step === 3 ? "Complete Registration" : "Continue"}</Text>
          </TouchableOpacity>
        </View>

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.backButton}>
            <Text style={styles.backButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: SIZES.padding },
  header: { marginBottom: SIZES.padding * 1.5, alignItems: 'center' },
  headerTitle: { fontSize: SIZES.h1, fontWeight: '900', color: COLORS.textDark },
  headerSubtitle: { fontSize: SIZES.body3, color: COLORS.textLight, marginTop: 4 },
  card: { backgroundColor: COLORS.white, borderRadius: SIZES.radius * 2, padding: SIZES.padding, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  stepIndicator: { fontSize: SIZES.body4, color: COLORS.primary, fontWeight: 'bold', marginBottom: SIZES.padding },
  sectionTitle: { fontSize: SIZES.h3, fontWeight: '900', color: COLORS.textDark, marginBottom: SIZES.base },
  description: { fontSize: SIZES.body4, color: COLORS.textLight, marginBottom: SIZES.padding },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: SIZES.radius, padding: 16, marginBottom: SIZES.base * 2 },
  uploadBox: { borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.borderLight, borderRadius: SIZES.radius, padding: SIZES.padding * 2, alignItems: 'center', marginVertical: SIZES.base },
  uploadText: { color: COLORS.primary, fontWeight: 'bold' },
  cameraPlaceholder: { backgroundColor: COLORS.textDark, height: 250, borderRadius: SIZES.radius, justifyContent: 'center', alignItems: 'center', marginVertical: SIZES.base },
  cameraText: { color: COLORS.white, fontWeight: 'bold' },
  button: { backgroundColor: COLORS.primary, padding: 16, borderRadius: SIZES.radius, alignItems: 'center', marginTop: SIZES.padding },
  buttonText: { color: COLORS.white, fontWeight: 'bold', fontSize: SIZES.body3 },
  backButton: { marginTop: SIZES.padding * 2, alignItems: 'center' },
  backButtonText: { color: COLORS.textLight, fontWeight: 'bold' }
});
