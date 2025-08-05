// Expo Mobile Authentication Implementation
// This file shows how to implement Google OAuth with Expo using your existing backend

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { makeRedirectUri } from 'expo-auth-session';

// Your backend configuration
const BACKEND_URL = 'https://class.xytek.ai'; // Production
// const BACKEND_URL = 'http://localhost:3000'; // Development

// Google OAuth configuration
const GOOGLE_CLIENT_ID = 'your_google_client_id_here'; // Replace with your actual client ID
const GOOGLE_CLIENT_SECRET = 'your_google_client_secret_here'; // Replace with your actual client secret

// OAuth scopes for your app
const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.announcements',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/meetings',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/classroom.rosters',
  'https://www.googleapis.com/auth/spreadsheets.readonly'
];

export default function MobileAuthScreen() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // Function to get OAuth URL from your backend
  const getOAuthUrl = async (role) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/google?role=${role}&platform=mobile`);
      const data = await response.json();
      
      if (data.success) {
        return data.url;
      } else {
        throw new Error(data.error || 'Failed to get OAuth URL');
      }
    } catch (error) {
      console.error('Error getting OAuth URL:', error);
      throw error;
    }
  };

  // Function to handle mobile OAuth
  const handleMobileAuth = async (role) => {
    setLoading(true);
    
    try {
      // Step 1: Get OAuth URL from your backend
      const oauthUrl = await getOAuthUrl(role);
      console.log('🔗 OAuth URL:', oauthUrl);

      // Step 2: Open OAuth URL in browser
      const result = await WebBrowser.openAuthSessionAsync(
        oauthUrl,
        makeRedirectUri({
          scheme: 'your-app-scheme', // Replace with your app scheme
          path: 'auth/callback'
        })
      );

      console.log('🔍 Auth Result:', result);

      if (result.type === 'success') {
        // Step 3: Extract authorization code from URL
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        
        if (code) {
          console.log('✅ Authorization code received:', code);
          
          // Step 4: Send code to your backend
          await exchangeCodeForToken(code, role);
        } else {
          throw new Error('No authorization code received');
        }
      } else if (result.type === 'cancel') {
        console.log('❌ User cancelled authentication');
        Alert.alert('Authentication Cancelled', 'You cancelled the authentication process.');
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('❌ Mobile auth error:', error);
      Alert.alert('Authentication Error', error.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  // Function to exchange authorization code for tokens
  const exchangeCodeForToken = async (code, role) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/google/mobile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          role: role
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Authentication successful:', data.user);
        setUser(data.user);
        
        // Store the token securely (use expo-secure-store in production)
        // await SecureStore.setItemAsync('authToken', data.token);
        // await SecureStore.setItemAsync('userData', JSON.stringify(data.user));
        
        Alert.alert('Success', `Welcome ${data.user.name}!`);
      } else {
        throw new Error(data.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('❌ Token exchange error:', error);
      throw error;
    }
  };

  // Function to logout
  const handleLogout = () => {
    setUser(null);
    // Clear stored tokens
    // await SecureStore.deleteItemAsync('authToken');
    // await SecureStore.deleteItemAsync('userData');
    Alert.alert('Logged Out', 'You have been logged out successfully.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Classroom Assistant</Text>
      
      {!user ? (
        <View style={styles.authContainer}>
          <Text style={styles.subtitle}>Choose your role to sign in:</Text>
          
          <TouchableOpacity
            style={[styles.button, styles.teacherButton]}
            onPress={() => handleMobileAuth('teacher')}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Signing in...' : 'Sign in as Teacher'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.studentButton]}
            onPress={() => handleMobileAuth('student')}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Signing in...' : 'Sign in as Student'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.adminButton]}
            onPress={() => handleMobileAuth('super_admin')}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Signing in...' : 'Sign in as Admin'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.userContainer}>
          <Text style={styles.welcomeText}>Welcome, {user.name}!</Text>
          <Text style={styles.userInfo}>Email: {user.email}</Text>
          <Text style={styles.userInfo}>Role: {user.role}</Text>
          
          <TouchableOpacity
            style={[styles.button, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: '#666',
    textAlign: 'center',
  },
  authContainer: {
    width: '100%',
    maxWidth: 300,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: 'center',
  },
  teacherButton: {
    backgroundColor: '#4285f4',
  },
  studentButton: {
    backgroundColor: '#34a853',
  },
  adminButton: {
    backgroundColor: '#ea4335',
  },
  logoutButton: {
    backgroundColor: '#666',
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  userContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  userInfo: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
  },
}); 