// Expo Configuration for Team Members
// Update these values based on your local setup

module.exports = {
  // Development settings
  development: {
    // Common Expo ports - add your preferred port here
    ports: [8081, 8082, 19000, 19001, 19002],
    
    // Preferred local IP (optional - leave null for auto-detection)
    preferredLocalIP: null, // e.g., '192.168.1.100'
    
    // Custom return URL scheme (optional)
    customScheme: null, // e.g., 'myapp://auth/callback'
  },
  
  // Production settings
  production: {
    // Production app scheme
    appScheme: 'aiclassroom://auth/callback',
    
    // Fallback web URL (if needed)
    fallbackUrl: 'https://class.xytek.ai/auth/callback',
  },
  
  // Team member overrides
  teamOverrides: {
    // Add your name and preferred settings here
    // 'john.doe@company.com': {
    //   preferredLocalIP: '192.168.1.50',
    //   preferredPort: 8081,
    // },
    // 'jane.smith@company.com': {
    //   preferredLocalIP: '10.0.0.100',
    //   preferredPort: 19000,
    // },
  }
};
