require('dotenv').config();
const db = require('../utils/db');

async function deleteAllAutomations() {
  console.log('\n🗑️  DELETING ALL AUTOMATION DATA\n');
  console.log('=' .repeat(60));
  console.log('\n⚠️  WARNING: This will permanently delete:\n');
  console.log('   - All automation agents');
  console.log('   - All workflows');
  console.log('   - All execution history');
  console.log('   - All email agent configs');
  console.log('   - All AI configurations');
  console.log('   - All recipient lists\n');
  console.log('=' .repeat(60));

  try {
    // Count existing data
    const counts = {
      agents: await db.query('SELECT COUNT(*) FROM automation_agents'),
      workflows: await db.query('SELECT COUNT(*) FROM automation_workflows'),
      executions: await db.query('SELECT COUNT(*) FROM automation_executions'),
      emailConfigs: await db.query('SELECT COUNT(*) FROM email_agent_configs'),
      aiConfigs: await db.query('SELECT COUNT(*) FROM ai_configurations'),
      recipientLists: await db.query('SELECT COUNT(*) FROM recipient_lists')
    };

    console.log('\n📊 Current Data:\n');
    console.log(`   Automation Agents: ${counts.agents.rows[0].count}`);
    console.log(`   Workflows: ${counts.workflows.rows[0].count}`);
    console.log(`   Executions: ${counts.executions.rows[0].count}`);
    console.log(`   Email Configs: ${counts.emailConfigs.rows[0].count}`);
    console.log(`   AI Configs: ${counts.aiConfigs.rows[0].count}`);
    console.log(`   Recipient Lists: ${counts.recipientLists.rows[0].count}`);

    const totalItems = parseInt(counts.agents.rows[0].count) + 
                       parseInt(counts.workflows.rows[0].count) + 
                       parseInt(counts.executions.rows[0].count) + 
                       parseInt(counts.emailConfigs.rows[0].count) + 
                       parseInt(counts.aiConfigs.rows[0].count) +
                       parseInt(counts.recipientLists.rows[0].count);

    if (totalItems === 0) {
      console.log('\n✅ No automation data found. Database is already clean!\n');
      process.exit(0);
    }

    console.log('\n' + '=' .repeat(60));
    console.log('\n🗑️  Starting deletion process...\n');

    // Delete in order (respecting foreign key constraints)
    
    // 1. Delete execution history
    console.log('1️⃣  Deleting execution history...');
    const executionResult = await db.query('DELETE FROM automation_executions RETURNING id');
    console.log(`   ✅ Deleted ${executionResult.rows.length} execution(s)`);

    // 2. Delete workflows
    console.log('\n2️⃣  Deleting workflows...');
    const workflowResult = await db.query('DELETE FROM automation_workflows RETURNING id, name');
    console.log(`   ✅ Deleted ${workflowResult.rows.length} workflow(s)`);
    workflowResult.rows.forEach(w => {
      console.log(`      - Workflow #${w.id}: "${w.name}"`);
    });

    // 3. Delete email agent configs
    console.log('\n3️⃣  Deleting email agent configs...');
    const emailConfigResult = await db.query('DELETE FROM email_agent_configs RETURNING id, email_address');
    console.log(`   ✅ Deleted ${emailConfigResult.rows.length} email config(s)`);
    emailConfigResult.rows.forEach(ec => {
      console.log(`      - Email: ${ec.email_address}`);
    });

    // 4. Delete recipient lists
    console.log('\n4️⃣  Deleting recipient lists...');
    const recipientListResult = await db.query('DELETE FROM recipient_lists RETURNING id, name');
    console.log(`   ✅ Deleted ${recipientListResult.rows.length} recipient list(s)`);
    recipientListResult.rows.forEach(rl => {
      console.log(`      - List #${rl.id}: "${rl.name}"`);
    });

    // 5. Delete automation agents
    console.log('\n5️⃣  Deleting automation agents...');
    const agentResult = await db.query('DELETE FROM automation_agents RETURNING id, name, type');
    console.log(`   ✅ Deleted ${agentResult.rows.length} agent(s)`);
    agentResult.rows.forEach(a => {
      console.log(`      - Agent #${a.id}: "${a.name}" (${a.type})`);
    });

    // 6. Delete AI configurations (optional - keeping user's AI keys might be useful)
    console.log('\n6️⃣  Deleting AI configurations...');
    const aiConfigResult = await db.query('DELETE FROM ai_configurations RETURNING id, provider, model_name');
    console.log(`   ✅ Deleted ${aiConfigResult.rows.length} AI config(s)`);
    aiConfigResult.rows.forEach(ai => {
      console.log(`      - ${ai.provider} (${ai.model_name})`);
    });

    // Verify deletion
    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ DELETION COMPLETE!\n');
    
    const finalCounts = {
      agents: await db.query('SELECT COUNT(*) FROM automation_agents'),
      workflows: await db.query('SELECT COUNT(*) FROM automation_workflows'),
      executions: await db.query('SELECT COUNT(*) FROM automation_executions'),
      emailConfigs: await db.query('SELECT COUNT(*) FROM email_agent_configs'),
      aiConfigs: await db.query('SELECT COUNT(*) FROM ai_configurations'),
      recipientLists: await db.query('SELECT COUNT(*) FROM recipient_lists')
    };

    console.log('📊 Final Data:\n');
    console.log(`   Automation Agents: ${finalCounts.agents.rows[0].count}`);
    console.log(`   Workflows: ${finalCounts.workflows.rows[0].count}`);
    console.log(`   Executions: ${finalCounts.executions.rows[0].count}`);
    console.log(`   Email Configs: ${finalCounts.emailConfigs.rows[0].count}`);
    console.log(`   AI Configs: ${finalCounts.aiConfigs.rows[0].count}`);
    console.log(`   Recipient Lists: ${finalCounts.recipientLists.rows[0].count}`);

    console.log('\n' + '=' .repeat(60));
    console.log('\n🎉 All automation data has been deleted!\n');
    console.log('💡 Tip: You can now create fresh agents from the frontend.\n');

  } catch (error) {
    console.error('\n❌ Error during deletion:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

deleteAllAutomations();


