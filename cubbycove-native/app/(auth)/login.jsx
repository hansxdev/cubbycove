import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { COLORS, SIZES } from '../../constants/theme';
import useAuthStore from '../../store/authStore';

export default function Login() {
  const [activeTab, setActiveTab] = useState('kid'); // 'kid' or 'parent'
  
  // Kid Form
  const [kidUsername, setKidUsername] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [kidPassword, setKidPassword] = useState('');

  // Parent Form
  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');

  const { setUser } = useAuthStore();

  const handleKidLogin = () => {
    // Mock login logic - later replace with Appwrite
    setUser({ role: 'kid', username: kidUsername });
    // router.replace('/(kid)/home');
  };

  const handleParentLogin = () => {
    // Mock login logic - later replace with Appwrite
    setUser({ role: 'parent', email: parentEmail });
    // router.replace('/(parent)/dashboard');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.brandTitle}>CubbyCove</Text>
          <Text style={styles.brandSubtitle}>Safe fun for everyone.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'kid' && styles.activeTabKid]}
              onPress={() => setActiveTab('kid')}
            >
              <Text style={[styles.tabText, activeTab === 'kid' && styles.activeTabTextKid]}>I'm a Kid</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'parent' && styles.activeTabParent]}
              onPress={() => setActiveTab('parent')}
            >
              <Text style={[styles.tabText, activeTab === 'parent' && styles.activeTabTextParent]}>I'm a Parent</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'kid' ? (
            <View style={styles.form}>
              <Text style={styles.formTitle}>Welcome Back! 👋</Text>
              <Text style={styles.formSubtitle}>Fill in your details to start playing.</Text>
              
              <TextInput 
                style={styles.input} 
                placeholder="Your Username" 
                placeholderTextColor={COLORS.textLight}
                value={kidUsername}
                onChangeText={setKidUsername}
              />
              <TextInput 
                style={styles.input} 
                placeholder="Parent's Email" 
                keyboardType="email-address"
                placeholderTextColor={COLORS.textLight}
                value={guardianEmail}
                onChangeText={setGuardianEmail}
              />
              <TextInput 
                style={styles.input} 
                placeholder="Your Password" 
                secureTextEntry
                placeholderTextColor={COLORS.textLight}
                value={kidPassword}
                onChangeText={setKidPassword}
              />
              
              <TouchableOpacity style={styles.kidButton} onPress={handleKidLogin}>
                <Text style={styles.kidButtonText}>LET'S PLAY! 🚀</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.formTitle}>Parent Dashboard</Text>
              <Text style={styles.formSubtitle}>Manage settings and view reports.</Text>

              <TextInput 
                style={styles.input} 
                placeholder="Email Address" 
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={COLORS.textLight}
                value={parentEmail}
                onChangeText={setParentEmail}
              />
              <TextInput 
                style={styles.input} 
                placeholder="Password" 
                secureTextEntry
                placeholderTextColor={COLORS.textLight}
                value={parentPassword}
                onChangeText={setParentPassword}
              />

              <TouchableOpacity style={styles.parentButton} onPress={handleParentLogin}>
                <Text style={styles.parentButtonText}>Sign In Securely</Text>
              </TouchableOpacity>

              <View style={styles.footerLink}>
                <Text style={styles.footerText}>New to CubbyCove? </Text>
                <Link href="/(auth)/register" asChild>
                  <TouchableOpacity><Text style={styles.linkText}>Create Parent Account</Text></TouchableOpacity>
                </Link>
              </View>
            </View>
          )}
        </View>

        <Link href="/" asChild>
          <TouchableOpacity style={styles.backButton}>
            <Text style={styles.backButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </Link>
        
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: SIZES.padding },
  header: { alignItems: 'center', marginBottom: SIZES.padding * 2 },
  brandTitle: { fontSize: SIZES.h1, fontWeight: '900', color: COLORS.primary },
  brandSubtitle: { fontSize: SIZES.body3, color: COLORS.textLight, marginTop: 4 },
  card: { 
    backgroundColor: COLORS.white, 
    borderRadius: SIZES.radius * 2, 
    padding: SIZES.padding,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5
  },
  tabContainer: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: SIZES.radius * 2, padding: 4, marginBottom: SIZES.padding },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: SIZES.radius * 1.5 },
  activeTabKid: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  activeTabParent: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: SIZES.body4, fontWeight: 'bold', color: COLORS.textLight },
  activeTabTextKid: { color: '#8B5CF6' }, // matching the purple brand
  activeTabTextParent: { color: COLORS.textDark },
  form: { paddingVertical: SIZES.base },
  formTitle: { fontSize: SIZES.h2, fontWeight: '900', color: COLORS.textDark, textAlign: 'center', marginBottom: 4 },
  formSubtitle: { fontSize: SIZES.body4, color: COLORS.textLight, textAlign: 'center', marginBottom: SIZES.padding },
  input: { 
    backgroundColor: '#F9FAFB', 
    borderWidth: 1, 
    borderColor: COLORS.borderLight, 
    borderRadius: SIZES.radius, 
    padding: 16, 
    marginBottom: SIZES.base * 2,
    fontSize: SIZES.body3,
    color: COLORS.textDark,
    fontWeight: '600'
  },
  kidButton: { backgroundColor: COLORS.secondary, padding: 18, borderRadius: SIZES.radius, alignItems: 'center', marginTop: SIZES.base },
  kidButtonText: { color: COLORS.textDark, fontWeight: '900', fontSize: SIZES.h4 },
  parentButton: { backgroundColor: '#8B5CF6', padding: 16, borderRadius: SIZES.radius, alignItems: 'center', marginTop: SIZES.base },
  parentButtonText: { color: COLORS.white, fontWeight: 'bold', fontSize: SIZES.body3 },
  footerLink: { flexDirection: 'row', justifyContent: 'center', marginTop: SIZES.padding },
  footerText: { color: COLORS.textLight, fontSize: SIZES.body4 },
  linkText: { color: '#8B5CF6', fontWeight: 'bold', fontSize: SIZES.body4 },
  backButton: { marginTop: SIZES.padding * 2, alignItems: 'center' },
  backButtonText: { color: COLORS.textLight, fontWeight: 'bold' }
});
