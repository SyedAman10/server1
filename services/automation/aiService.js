const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

/**
 * AI Service for generating email replies
 * Supports OpenAI and Google Gemini
 */

// Generate AI reply using configured provider
async function generateAiReply({ provider, apiKey, modelName, temperature, maxTokens, systemPrompt, userMessage, emailContext }) {
  switch (provider) {
    case 'openai':
      return await generateOpenAiReply({ apiKey, modelName, temperature, maxTokens, systemPrompt, userMessage, emailContext });
    
    case 'gemini':
      return await generateGeminiReply({ apiKey, modelName, temperature, maxTokens, systemPrompt, userMessage, emailContext });
    
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

// Generate reply using OpenAI
async function generateOpenAiReply({ apiKey, modelName, temperature, maxTokens, systemPrompt, userMessage, emailContext }) {
  try {
    const openai = new OpenAI({ apiKey });

    const messages = [
      {
        role: 'system',
        content: systemPrompt || 'You are a helpful email assistant. Write professional, concise, and friendly email replies.'
      },
      {
        role: 'user',
        content: `
Email Context:
From: ${emailContext.from}
Subject: ${emailContext.subject}
Date: ${emailContext.date}

Email Body:
${userMessage}

Please generate a professional email reply based on the instructions above.
        `.trim()
      }
    ];

    const response = await openai.chat.completions.create({
      model: modelName || 'gpt-4',
      messages: messages,
      temperature: temperature || 0.7,
      max_tokens: maxTokens || 500
    });

    return {
      success: true,
      reply: response.choices[0].message.content,
      provider: 'openai',
      model: modelName,
      tokensUsed: response.usage.total_tokens
    };
  } catch (error) {
    console.error('OpenAI error:', error);
    throw new Error(`OpenAI error: ${error.message}`);
  }
}

// Generate reply using Google Gemini
async function generateGeminiReply({ apiKey, modelName, temperature, maxTokens, systemPrompt, userMessage, emailContext }) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: modelName || 'gemini-pro',
      generationConfig: {
        temperature: temperature || 0.7,
        maxOutputTokens: maxTokens || 500
      }
    });

    const prompt = `
${systemPrompt || 'You are a helpful email assistant. Write professional, concise, and friendly email replies.'}

Email Context:
From: ${emailContext.from}
Subject: ${emailContext.subject}
Date: ${emailContext.date}

Email Body:
${userMessage}

Please generate a professional email reply based on the instructions above.
    `.trim();

    const result = await model.generateContent(prompt);
    const response = result.response;
    const reply = response.text();

    return {
      success: true,
      reply: reply,
      provider: 'gemini',
      model: modelName,
      tokensUsed: null // Gemini doesn't provide token count in the same way
    };
  } catch (error) {
    console.error('Gemini error:', error);
    throw new Error(`Gemini error: ${error.message}`);
  }
}

// Test AI configuration
async function testAiConfig({ provider, apiKey, modelName }) {
  try {
    const testPrompt = 'You are a helpful assistant.';
    const testMessage = 'Reply with "Configuration test successful!" if you can read this.';
    const testContext = {
      from: 'test@example.com',
      subject: 'Test',
      date: new Date().toISOString()
    };

    const result = await generateAiReply({
      provider,
      apiKey,
      modelName,
      temperature: 0.7,
      maxTokens: 50,
      systemPrompt: testPrompt,
      userMessage: testMessage,
      emailContext: testContext
    });

    return {
      success: true,
      message: 'AI configuration is valid and working',
      reply: result.reply
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

module.exports = {
  generateAiReply,
  generateOpenAiReply,
  generateGeminiReply,
  testAiConfig
};

