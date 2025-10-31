# AI Correction Detection Flow Diagram

## 🔄 Complete Flow Visualization

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER SENDS MESSAGE                           │
│   "oh sorry invite rimal@gmail.com and class is ai support2"   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│               detectIntent() Entry Point                        │
│   • Receives: message, conversationHistory, conversationId      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│           STEP 1: Check for Corrections                         │
│                 detectCorrection()                              │
│                                                                 │
│  1️⃣  Check for correction indicators                            │
│      ✓ "sorry" found in message                                │
│                                                                 │
│  2️⃣  Get conversation history                                   │
│      ✓ Previous message: "invite john@gmail.com to teaching 1" │
│      ✓ System response: "I couldn't find teaching 1"           │
│                                                                 │
│  3️⃣  Use Gemini AI to analyze                                   │
│      Prompt: "Analyze if user is making a CORRECTION..."       │
│                                                                 │
│  4️⃣  AI Response:                                               │
│      {                                                          │
│        "isCorrection": true,                                    │
│        "originalIntent": "INVITE_STUDENTS",                     │
│        "corrections": {                                         │
│          "email": {                                             │
│            "from": "john@gmail.com",                            │
│            "to": "rimal@gmail.com"                              │
│          },                                                     │
│          "courseName": {                                        │
│            "from": "teaching 1",                                │
│            "to": "ai support2"                                  │
│          }                                                      │
│        }                                                        │
│      }                                                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         STEP 2: Extract Corrected Parameters                    │
│                                                                 │
│  • Extract emails from current message                          │
│    ✓ Found: ["rimal@gmail.com"]                                │
│                                                                 │
│  • Extract course name from AI response                         │
│    ✓ Found: "ai support2"                                      │
│                                                                 │
│  • Build corrected parameters object:                           │
│    {                                                            │
│      studentEmails: ["rimal@gmail.com"],                        │
│      courseName: "ai support2"                                  │
│    }                                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│       STEP 3: Return Intent with Corrections                    │
│                                                                 │
│  Return:                                                        │
│  {                                                              │
│    intent: "INVITE_STUDENTS",                                   │
│    confidence: 0.95,                                            │
│    parameters: {                                                │
│      studentEmails: ["rimal@gmail.com"],                        │
│      courseName: "ai support2"                                  │
│    },                                                           │
│    isCorrection: true,                                          │
│    correctionExplanation: "User corrected email and class"      │
│  }                                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│           executeAction() in actionExecution.js                 │
│                                                                 │
│  • Receives INVITE_STUDENTS intent                              │
│  • Has corrected parameters                                     │
│  • Searches for course "ai support2"                            │
│  • Invites student "rimal@gmail.com"                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUCCESS RESPONSE                             │
│   "Successfully invited rimal@gmail.com to ai support2"         │
└─────────────────────────────────────────────────────────────────┘
```

## 🔀 Alternative Flow: No Correction Detected

```
User Message
     │
     ▼
detectCorrection()
     │
     ├─ No "sorry"/"actually" keywords?
     │  └─> Return null
     │
     ├─ Empty conversation history?
     │  └─> Return null
     │
     └─ AI says not a correction?
        └─> Return null
             │
             ▼
Continue with normal detectIntent()
     │
     ▼
Use Gemini for regular intent detection
     │
     ▼
Extract parameters from current message only
     │
     ▼
Return detected intent
```

## 🎯 Key Decision Points

### 1. Correction Indicator Check
```
Message: "oh sorry invite rimal@gmail.com..."
         ↓
Contains "sorry"? ✅ YES
         ↓
Proceed to AI analysis
```

### 2. Conversation History Check
```
History exists? ✅ YES
    │
    ├─ Previous: "invite john@gmail.com to teaching 1"
    ├─ System:   "I couldn't find teaching 1"
    └─ Current:  "oh sorry invite rimal@gmail.com..."
         ↓
Has context for comparison ✅
```

### 3. AI Correction Analysis
```
Gemini AI analyzes:
    │
    ├─ Is this a correction? ✅ YES
    ├─ What changed?
    │  ├─ Email: john → rimal
    │  └─ Class: teaching 1 → ai support2
    └─ What's the intent? → INVITE_STUDENTS
```

## 📊 Data Flow Example

### Input Data:
```javascript
{
  message: "oh sorry invite rimal@gmail.com and class is ai support2",
  conversationId: "user-123",
  conversationHistory: [
    {
      role: "user",
      content: "invite john@gmail.com to teaching 1"
    },
    {
      role: "assistant",
      content: "I couldn't find any courses matching 'teaching 1'"
    }
  ]
}
```

### AI Processing:
```javascript
// Step 1: Detect correction
const correctionData = {
  isCorrection: true,
  originalIntent: "INVITE_STUDENTS",
  corrections: {
    email: { from: "john@gmail.com", to: "rimal@gmail.com" },
    courseName: { from: "teaching 1", to: "ai support2" }
  }
}

// Step 2: Extract corrected params
const correctedParams = {
  studentEmails: ["rimal@gmail.com"],
  courseName: "ai support2"
}
```

### Output Data:
```javascript
{
  intent: "INVITE_STUDENTS",
  confidence: 0.95,
  parameters: {
    studentEmails: ["rimal@gmail.com"],
    courseName: "ai support2"
  },
  isCorrection: true,
  correctionExplanation: "User corrected both email and course name"
}
```

## 🧠 AI Prompt Structure

### Correction Detection Prompt:
```
┌──────────────────────────────────────┐
│  Analyze if user is making CORRECTION│
│                                       │
│  Conversation History:                │
│  - user: invite john@gmail...        │
│  - assistant: I couldn't find...     │
│                                       │
│  Current Message:                     │
│  "oh sorry invite rimal@gmail..."    │
│                                       │
│  Extract:                             │
│  - Is it a correction? (true/false)  │
│  - What was original intent?         │
│  - What changed? (from → to)         │
└──────────────────────────────────────┘
         │
         ▼
    Gemini AI
         │
         ▼
┌──────────────────────────────────────┐
│  JSON Response:                       │
│  {                                    │
│    "isCorrection": true,              │
│    "originalIntent": "INVITE_STUDENTS"│
│    "corrections": {...}               │
│  }                                    │
└──────────────────────────────────────┘
```

## 🔧 System Components

```
┌────────────────────────────────────────────────────────────┐
│                    Intent Detection Layer                   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        detectCorrection()                            │  │
│  │  • Check correction indicators                       │  │
│  │  • Get conversation history                          │  │
│  │  • Call Gemini AI                                    │  │
│  │  • Return correction data or null                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        detectIntent()                                │  │
│  │  • Check ongoing actions                             │  │
│  │  • Call detectCorrection() first                     │  │
│  │  • Extract parameters                                │  │
│  │  • Use Gemini for normal detection                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │     Return Intent Object                             │  │
│  │  {                                                   │  │
│  │    intent, confidence, parameters,                   │  │
│  │    isCorrection?, correctionExplanation?             │  │
│  │  }                                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│                  Action Execution Layer                     │
│                                                             │
│  executeAction(intent, message, token, req)                │
│  • Process INVITE_STUDENTS with corrected params           │
│  • Search for course "ai support2"                         │
│  • Invite student "rimal@gmail.com"                        │
└────────────────────────────────────────────────────────────┘
```

## 📈 Performance Characteristics

### Time Complexity:
```
Total Time: ~2-3 seconds
│
├─ Correction Detection: ~1-1.5s
│  ├─ History retrieval: <10ms
│  ├─ Indicator check: <1ms
│  └─ Gemini AI call: ~1-1.5s
│
└─ Parameter Extraction: <50ms
   ├─ Email regex: <5ms
   ├─ Course name extract: <5ms
   └─ Object building: <5ms
```

### API Calls:
```
Per Correction:
└─ 1 Gemini API call (correction detection)

Per Message (if not correction):
└─ 1 Gemini API call (normal intent detection)
```

## ✅ Quality Assurance

### Validation Points:
```
1. ✅ Correction indicator present?
2. ✅ Conversation history exists?
3. ✅ AI returns valid JSON?
4. ✅ isCorrection is true?
5. ✅ Parameters extracted correctly?
6. ✅ Original intent preserved?
7. ✅ Confidence >= 0.95?
```

---

**This flow ensures accurate, context-aware correction detection using AI intelligence!**

