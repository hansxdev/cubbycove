import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { COLORS, SIZES } from '../constants/theme';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>CubbyCove</Text>
      <Text style={styles.subtitle}>Welcome to the safe space for kids.</Text>
      
      <Link href="/(auth)/login" asChild>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: COLORS.backgroundLight,
    padding: SIZES.padding
  },
  title: { 
    fontSize: SIZES.largeTitle, 
    fontWeight: '900', 
    color: COLORS.primary, 
    marginBottom: SIZES.base 
  },
  subtitle: {
    fontSize: SIZES.body3,
    color: COLORS.textLight,
    marginBottom: SIZES.padding * 2
  },
  button: { 
    backgroundColor: COLORS.primary, 
    paddingVertical: 16, 
    paddingHorizontal: 40, 
    borderRadius: SIZES.radius * 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  buttonText: { 
    color: COLORS.white, 
    fontWeight: 'bold', 
    fontSize: SIZES.h4 
  }
});
