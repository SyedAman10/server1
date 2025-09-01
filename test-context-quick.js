// Quick test for context tracking
const { 
  generateConversationId, 
  startOngoingAction, 
  updateOngoingActionParameters, 
  isActionComplete, 
  getOngoingActionContext 
} = require('./services/ai/conversationManager');

console.log('🧪 Quick Context Tracking Test\n');

// Test 1: Start action
const convId = generateConversationId();
console.log('📝 Conversation ID:', convId);

startOngoingAction(convId, 'CREATE_COURSE', ['name'], {});
console.log('✅ Started CREATE_COURSE action');

// Test 2: Check context
const context = getOngoingActionContext(convId);
console.log('📋 Context:', JSON.stringify(context, null, 2));

// Test 3: Update with name
updateOngoingActionParameters(convId, { name: 'English' });
console.log('✅ Updated with name: English');

// Test 4: Check if complete
const isComplete = isActionComplete(convId);
console.log('🎯 Action complete?', isComplete);

// Test 5: Final context
const finalContext = getOngoingActionContext(convId);
console.log('📋 Final context:', JSON.stringify(finalContext, null, 2));

console.log('\n🎉 Test completed!');
