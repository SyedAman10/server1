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
async function testAnnouncementFix() {
  console.log('🧪 Testing Announcement Context Fix...\n');
  
  const conversationId = 'test-announcement-fix';
  
  // Step 1: Simulate "Create announcement in english" - should start action with courseName
  console.log('1️⃣ Simulating "Create announcement in english"...');
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
  
  // Step 3: Simulate providing announcement text "Hello class"
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
    console.log('📝 Final parameters:', context.collectedParameters);
  } else {
    const nextMessage = getContextAwareMessage(conversationId);
    console.log('⏳ Still missing parameters. Next message:', nextMessage);
  }
  
  console.log('\n✅ Test completed successfully!');
}

testAnnouncementFix().catch(console.error);
