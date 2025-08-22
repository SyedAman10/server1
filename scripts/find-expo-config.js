#!/usr/bin/env node

/**
 * Helper script to find your local IP and Expo configuration
 * Run this to get the values you need for config/expo.js
 */

const { networkInterfaces } = require('os');

console.log('🔍 Finding your local network configuration...\n');

// Find local network IPs
const nets = networkInterfaces();
const localIPs = [];

for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    if (net.family === 'IPv4' && !net.internal) {
      localIPs.push({
        interface: name,
        address: net.address,
        netmask: net.netmask,
        family: net.family
      });
    }
  }
}

console.log('🌐 Local Network IPs:');
if (localIPs.length === 0) {
  console.log('❌ No local network IPs found');
} else {
  localIPs.forEach((ip, index) => {
    console.log(`  ${index + 1}. ${ip.address} (${ip.interface})`);
  });
}

console.log('\n📱 Expo Configuration:');
console.log('Add this to config/expo.js:');
console.log('');

if (localIPs.length > 0) {
  const primaryIP = localIPs[0];
  console.log(`teamOverrides: {
  'your.email@company.com': {
    preferredLocalIP: '${primaryIP.address}',
    preferredPort: 8081, // Change this to your Expo port
  },
}`);
} else {
  console.log(`teamOverrides: {
  'your.email@company.com': {
    preferredLocalIP: 'YOUR_LOCAL_IP', // Run 'ipconfig' (Windows) or 'ifconfig' (Mac/Linux)
    preferredPort: 8081, // Change this to your Expo port
  },
}`);
}

console.log('\n🔧 To find your Expo port:');
console.log('1. Start Expo: npx expo start');
console.log('2. Look for: exp://IP:PORT');
console.log('3. Use that PORT in the config above');

console.log('\n📋 Quick Setup:');
console.log('1. Copy the config above');
2. Edit config/expo.js');
3. Replace with your email and port');
4. Test OAuth flow');

console.log('\n🎯 Your Expo return URL will be:');
if (localIPs.length > 0) {
  console.log(`exp://${localIPs[0].address}:8081/--/auth/callback`);
} else {
  console.log('exp://YOUR_IP:YOUR_PORT/--/auth/callback');
}
