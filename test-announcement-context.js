const { 
  generateConversationId, 
  startOngoingAction, 
  updateOngoingActionParameters, 
  isActionComplete, 
  getOngoingActionContext, 
  completeOngoingAction, 
  isNewActionAttempt, 
  getContextAwareMessage 
} = require('./services/ai/conversationManager');

// Test the announcement context flow
async function testAnnouncementContext() {
  console.log('🧪 Testing Announcement Context Flow...\n');
  
  const conversationId = 'test-announcement-context';
  
  // Step 1: Start CREATE_ANNOUNCEMENT action
  console.log('1️⃣ Starting CREATE_ANNOUNCEMENT action...');
  startOngoingAction(conversationId, 'CREATE_ANNOUNCEMENT', ['announcementText', 'courseName'], {
    courseName: 'english'
  });
  
  let context = getOngoingActionContext(conversationId);
  console.log('📋 Context after starting:', {
    action: context.action,
    missingParameters: context.missingParameters,
    collectedParameters: context.collectedParameters
  });
  
  // Step 2: Check what message should be shown
  console.log('\n2️⃣ Getting context-aware message...');
  const contextMessage = getContextAwareMessage(conversationId);
  console.log('💬 Context message:', contextMessage);
  
  // Step 3: Simulate providing announcement text
  console.log('\n3️⃣ Simulating parameter collection for "Hello class"...');
  
  // This simulates what handleParameterCollection would do
  const newParameters = { announcementText: 'Hello class' };
  updateOngoingActionParameters(conversationId, newParameters);
  
  context = getOngoingActionContext(conversationId);
  console.log('📋 Context after adding announcement text:', {
    action: context.action,
    missingParameters: context.missingParameters,
    collectedParameters: context.collectedParameters
  });
  
  // Step 4: Check if action is complete
  console.log('\n4️⃣ Checking if action is complete...');
  const isComplete = isActionComplete(conversationId);
  console.log('✅ Action complete:', isComplete);
  
  if (isComplete) {
    console.log('🎉 All parameters collected! Action ready to execute.');
  } else {
    const nextMessage = getContextAwareMessage(conversationId);
    console.log('⏳ Still missing parameters. Next message:', nextMessage);
  }
  
  // Step 5: Complete the action
  console.log('\n5️⃣ Completing the action...');
  completeOngoingAction(conversationId);
  
  context = getOngoingActionContext(conversationId);
  console.log('📋 Context after completion:', context);
  
  console.log('\n✅ Test completed successfully!');
}

testAnnouncementContext().catch(console.error);
