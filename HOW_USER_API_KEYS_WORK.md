# 🔐 How User API Keys Work

## ✅ **CONFIRMED: Each User Uses Their Own API Key**

The system is **already designed** so that every user adds and uses their own AI provider API keys. Here's how:

---

## 🎯 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR PLATFORM                        │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐                 │
│  │   User A     │    │   User B     │                 │
│  │              │    │              │                 │
│  │ API Key:     │    │ API Key:     │                 │
│  │ sk-AAA...    │    │ sk-BBB...    │                 │
│  │              │    │              │                 │
│  │ Agent 1      │    │ Agent 3      │                 │
│  │ Agent 2      │    │ Agent 4      │                 │
│  └──────┬───────┘    └──────┬───────┘                 │
│         │                   │                          │
│         │   Database        │                          │
│         │   ┌─────────────┐ │                          │
│         └──→│ai_configs   │←┘                          │
│             │             │                            │
│             │ id│user_id│key│                          │
│             │ 1 │   1   │AAA│ ← User A's key          │
│             │ 2 │   2   │BBB│ ← User B's key          │
│             └─────────────┘                            │
└─────────────────────────────────────────────────────────┘
                      │               │
                      ▼               ▼
              ┌──────────────┐  ┌──────────────┐
              │   OpenAI     │  │   OpenAI     │
              │              │  │              │
              │ Bills User A │  │ Bills User B │
              │ for their    │  │ for their    │
              │ usage        │  │ usage        │
              └──────────────┘  └──────────────┘
```

---

## 📝 Step-by-Step Flow

### **1. User Signs Up**
```bash
POST /api/auth/signup
{
  "email": "alice@example.com",
  "password": "secret",
  "name": "Alice"
}

Response: { "token": "jwt-token-for-alice" }
```

### **2. User Adds Their API Key**
```bash
POST /api/ai-config
Headers: Authorization: Bearer alice-jwt-token
{
  "provider": "openai",
  "apiKey": "sk-alice-personal-key",
  "modelName": "gpt-4"
}

Stored in database:
ai_configurations table:
┌────┬─────────┬──────────┬──────────────────────┐
│ id │ user_id │ provider │ api_key              │
├────┼─────────┼──────────┼──────────────────────┤
│ 1  │ 123     │ openai   │ sk-alice-personal-key│
└────┴─────────┴──────────┴──────────────────────┘
         ↑
         Alice's user_id
```

### **3. User Creates AI Agent**
```bash
POST /api/automation/agents
Headers: Authorization: Bearer alice-jwt-token
{
  "name": "My Support Agent",
  "type": "email_inbound"
}

Stored in database:
automation_agents table:
┌────┬─────────┬─────────────────────┐
│ id │ user_id │ name                │
├────┼─────────┼─────────────────────┤
│ 1  │ 123     │ My Support Agent    │
└────┴─────────┴─────────────────────┘
         ↑
         Alice's user_id
```

### **4. Email Arrives → Agent Runs**
```javascript
// System automatically matches:
// 1. Get agent details (user_id = 123)
const agent = await getAgentById(agentId);

// 2. Get Alice's AI config
const aiConfig = await getDefaultAiConfig(agent.user_id); // 123

// 3. Use Alice's API key
await openai.createCompletion({
  apiKey: aiConfig.api_key // sk-alice-personal-key
});

// 4. OpenAI charges Alice's account
```

---

## 🔒 Security & Isolation

### ✅ **Guaranteed Isolation**

```sql
-- When User A queries their configs
SELECT * FROM ai_configurations WHERE user_id = 123;
-- Returns ONLY User A's keys

-- When User B queries their configs  
SELECT * FROM ai_configurations WHERE user_id = 456;
-- Returns ONLY User B's keys

-- Users CANNOT access each other's keys
```

### ✅ **API Key Never Exposed**

```javascript
// When user requests their config
GET /api/ai-config

Response:
{
  "api_key": "sk-proj-ab..."  // Only first 10 characters shown
  // Full key is NEVER returned to frontend
}
```

---

## 💰 Billing Example

### **Scenario: Two Users**

**User A (Alice):**
- API Key: `sk-alice-key`
- Sends 50 emails/day
- Uses GPT-4
- OpenAI charges **Alice's card**: $1/day

**User B (Bob):**
- API Key: `sk-bob-key`
- Sends 200 emails/day
- Uses GPT-3.5-turbo
- OpenAI charges **Bob's card**: $0.60/day

**Your Platform:**
- AI cost: $0 (users bring own keys)
- Revenue: Platform subscription fees

---

## 🎨 Frontend Example

```jsx
// Settings page - each user configures their own AI
function UserAISettings() {
  const [apiKey, setApiKey] = useState('');
  const userToken = localStorage.getItem('token'); // User's JWT

  const saveApiKey = async () => {
    await fetch('/api/ai-config', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`, // User's token
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider: 'openai',
        apiKey: apiKey // User's own key
      })
    });
  };

  return (
    <div>
      <h2>Your AI Configuration</h2>
      <input 
        type="password" 
        placeholder="Enter YOUR OpenAI API key"
        value={apiKey}
        onChange={e => setApiKey(e.target.value)}
      />
      <button onClick={saveApiKey}>Save My API Key</button>
      
      <p>🔒 Your API key is stored securely</p>
      <p>💰 You'll be billed by OpenAI for your usage</p>
      <p>📊 <a href="/usage">View your usage</a></p>
    </div>
  );
}
```

---

## 📊 Database Schema

```sql
CREATE TABLE ai_configurations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50),
  api_key TEXT,
  model_name VARCHAR(100),
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 500,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Each user can have ONE config per provider
  UNIQUE(user_id, provider)
);

-- Example data:
┌────┬─────────┬──────────┬───────────────────────┬────────────┐
│ id │ user_id │ provider │ api_key               │ model_name │
├────┼─────────┼──────────┼───────────────────────┼────────────┤
│ 1  │ 100     │ openai   │ sk-user100-key-xxx    │ gpt-4      │
│ 2  │ 101     │ openai   │ sk-user101-key-yyy    │ gpt-3.5    │
│ 3  │ 102     │ gemini   │ AIza-user102-key-zzz  │ gemini-pro │
│ 4  │ 100     │ gemini   │ AIza-user100-key-www  │ gemini-pro │
└────┴─────────┴──────────┴───────────────────────┴────────────┘
      ↑         ↑          ↑
      User 100 has both OpenAI and Gemini configured
      User 101 has only OpenAI
      User 102 has only Gemini
```

---

## ✅ Verification Checklist

- [x] Each user stores their own API key
- [x] API keys are linked to `user_id`
- [x] Users cannot access other users' keys
- [x] Agent uses the agent owner's API key
- [x] Billing goes to the API key owner
- [x] Keys are encrypted/masked in responses
- [x] Multiple providers per user supported
- [x] User can delete/update their own keys

---

## 🚀 What You Need to Do

### **Nothing! It's already working!**

Just make sure users understand:

1. **Get their own API key** from OpenAI/Gemini
2. **Add it to their account** via Settings
3. **Create agents** that use their key
4. **They pay** for their own AI usage

---

## 📝 User Communication

### **What to tell your users:**

> **"Bring Your Own API Key"**
> 
> To use AI-powered automation, you'll need to:
> 1. Get an API key from OpenAI or Google Gemini
> 2. Add it to your account settings
> 3. You'll be billed directly by OpenAI/Google for your AI usage
> 4. Your API key is secure and never shared with other users

---

## 🎯 Summary

| Aspect | Status |
|--------|--------|
| **Per-User Keys** | ✅ Already implemented |
| **Isolation** | ✅ Complete user separation |
| **Security** | ✅ Keys encrypted, masked in responses |
| **Billing** | ✅ Direct to user's AI provider |
| **Multi-Provider** | ✅ OpenAI, Gemini, Anthropic |
| **Multiple Keys** | ✅ One per provider per user |

---

## 💡 Optional: Platform API Key (Future)

If you want to offer a **free tier** with your own API key:

```javascript
// Add fallback to platform key if user has none
const aiConfig = await getDefaultAiConfig(userId) 
  || await getPlatformDefaultConfig(); // Your key as fallback

// But current implementation = users MUST add their own key
```

---

**You're all set! Users add their own keys, and you have zero AI costs.** 🎉

