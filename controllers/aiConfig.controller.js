const aiConfigModel = require('../models/aiConfiguration.model');
const aiService = require('../services/automation/aiService');

/**
 * AI Configuration Controller
 * Manages AI provider configurations for users
 */

// Create or update AI configuration
const upsertAiConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const { provider, apiKey, modelName, temperature, maxTokens, isDefault } = req.body;

    // Validate required fields
    if (!provider || !apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Provider and API key are required'
      });
    }

    // Validate provider
    const validProviders = ['openai', 'gemini', 'anthropic'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({
        success: false,
        error: `Invalid provider. Must be one of: ${validProviders.join(', ')}`
      });
    }

    // Test the configuration before saving
    console.log(`🧪 Testing ${provider} configuration...`);
    const testResult = await aiService.testAiConfig({
      provider,
      apiKey,
      modelName: modelName || (provider === 'openai' ? 'gpt-4' : 'gemini-pro')
    });

    if (!testResult.success) {
      return res.status(400).json({
        success: false,
        error: `AI configuration test failed: ${testResult.message}`
      });
    }

    // Save the configuration
    const config = await aiConfigModel.upsertAiConfig({
      userId,
      provider,
      apiKey,
      modelName: modelName || (provider === 'openai' ? 'gpt-4' : 'gemini-pro'),
      temperature: temperature || 0.7,
      maxTokens: maxTokens || 500,
      isDefault: isDefault || false
    });

    // Don't send the API key back to the client
    const sanitizedConfig = {
      ...config,
      api_key: `${config.api_key.substring(0, 10)}...`
    };

    res.json({
      success: true,
      message: `${provider} configuration saved successfully`,
      config: sanitizedConfig,
      testResult: testResult.reply
    });
  } catch (error) {
    console.error('Error saving AI config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get AI configuration
const getAiConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const { provider } = req.params;

    const config = await aiConfigModel.getAiConfig(userId, provider);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'AI configuration not found'
      });
    }

    // Don't send the full API key back to the client
    const sanitizedConfig = {
      ...config,
      api_key: `${config.api_key.substring(0, 10)}...`
    };

    res.json({
      success: true,
      config: sanitizedConfig
    });
  } catch (error) {
    console.error('Error getting AI config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get all AI configurations for user
const getAllAiConfigs = async (req, res) => {
  try {
    const userId = req.user.id;

    const configs = await aiConfigModel.getAllAiConfigs(userId);

    // Don't send the full API keys back to the client
    const sanitizedConfigs = configs.map(config => ({
      ...config,
      api_key: `${config.api_key.substring(0, 10)}...`
    }));

    res.json({
      success: true,
      configs: sanitizedConfigs
    });
  } catch (error) {
    console.error('Error getting AI configs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Delete AI configuration
const deleteAiConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const { provider } = req.params;

    const deletedConfig = await aiConfigModel.deleteAiConfig(userId, provider);

    if (!deletedConfig) {
      return res.status(404).json({
        success: false,
        error: 'AI configuration not found'
      });
    }

    res.json({
      success: true,
      message: `${provider} configuration deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting AI config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Test AI configuration
const testAiConfig = async (req, res) => {
  try {
    const { provider, apiKey, modelName } = req.body;

    if (!provider || !apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Provider and API key are required'
      });
    }

    const result = await aiService.testAiConfig({
      provider,
      apiKey,
      modelName: modelName || (provider === 'openai' ? 'gpt-4' : 'gemini-pro')
    });

    res.json(result);
  } catch (error) {
    console.error('Error testing AI config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  upsertAiConfig,
  getAiConfig,
  getAllAiConfigs,
  deleteAiConfig,
  testAiConfig
};

