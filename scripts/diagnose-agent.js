const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function diagnoseAgent() {
  const agentId = process.argv[2] || 3;
  
  try {
    console.log(`\n🔍 Diagnosing Agent ID: ${agentId}\n`);
    console.log('═'.repeat(60));
    
    // Check agent
    console.log('\n1️⃣  AGENT STATUS:');
    console.log('─'.repeat(60));
    const agentQuery = await pool.query(
      'SELECT id, name, type, status, user_id FROM automation_agents WHERE id = $1',
      [agentId]
    );
    
    if (agentQuery.rows.length === 0) {
      console.log('❌ Agent not found!');
      return;
    }
    
    const agent = agentQuery.rows[0];
    console.log(`   Name: ${agent.name}`);
    console.log(`   Type: ${agent.type}`);
    console.log(`   Status: ${agent.status} ${agent.status === 'active' ? '✅' : '❌'}`);
    console.log(`   User ID: ${agent.user_id}`);
    
    // Check email config
    console.log('\n2️⃣  EMAIL CONFIGURATION:');
    console.log('─'.repeat(60));
    const emailConfigQuery = await pool.query(
      'SELECT agent_id, email_address, oauth_tokens FROM email_agent_configs WHERE agent_id = $1',
      [agentId]
    );
    
    if (emailConfigQuery.rows.length === 0) {
      console.log('❌ No email configuration found!');
      console.log('   → Need to connect Gmail OAuth');
    } else {
      const emailConfig = emailConfigQuery.rows[0];
      console.log(`   ✅ Email: ${emailConfig.email_address}`);
      console.log(`   ✅ OAuth tokens: ${emailConfig.oauth_tokens ? 'Present' : 'Missing'}`);
    }
    
    // Check workflows
    console.log('\n3️⃣  WORKFLOWS:');
    console.log('─'.repeat(60));
    const workflowQuery = await pool.query(
      'SELECT id, name, status, trigger_config, actions FROM automation_workflows WHERE agent_id = $1',
      [agentId]
    );
    
    if (workflowQuery.rows.length === 0) {
      console.log('❌ No workflows found!');
      console.log('   → Need to create a workflow');
    } else {
      workflowQuery.rows.forEach((workflow, index) => {
        console.log(`\n   Workflow ${index + 1}:`);
        console.log(`   - ID: ${workflow.id}`);
        console.log(`   - Name: ${workflow.name}`);
        console.log(`   - Status: ${workflow.status} ${workflow.status === 'active' ? '✅' : '❌'}`);
        console.log(`   - Trigger: ${workflow.trigger_config?.type || 'N/A'}`);
        console.log(`   - Actions: ${workflow.actions?.length || 0} action(s)`);
        if (workflow.actions && workflow.actions.length > 0) {
          workflow.actions.forEach((action, i) => {
            console.log(`     ${i + 1}. ${action.type}`);
          });
        }
      });
    }
    
    // Check active workflows (what the polling service sees)
    console.log('\n4️⃣  ACTIVE WORKFLOWS (What Polling Service Sees):');
    console.log('─'.repeat(60));
    const activeWorkflowQuery = await pool.query(`
      SELECT w.id, w.name, w.status as workflow_status, a.status as agent_status
      FROM automation_workflows w
      LEFT JOIN automation_agents a ON w.agent_id = a.id
      WHERE w.agent_id = $1
    `, [agentId]);
    
    if (activeWorkflowQuery.rows.length === 0) {
      console.log('❌ No workflows in database');
    } else {
      activeWorkflowQuery.rows.forEach((row, index) => {
        const isActive = row.workflow_status === 'active' && row.agent_status === 'active';
        console.log(`\n   Workflow ${index + 1}: ${row.name}`);
        console.log(`   - Workflow Status: ${row.workflow_status} ${row.workflow_status === 'active' ? '✅' : '❌'}`);
        console.log(`   - Agent Status: ${row.agent_status} ${row.agent_status === 'active' ? '✅' : '❌'}`);
        console.log(`   - Will be polled? ${isActive ? '✅ YES' : '❌ NO'}`);
      });
    }
    
    // Check AI configuration for the user
    console.log('\n5️⃣  AI CONFIGURATION:');
    console.log('─'.repeat(60));
    const aiConfigQuery = await pool.query(
      'SELECT provider, model_name, is_default FROM ai_configurations WHERE user_id = $1',
      [agent.user_id]
    );
    
    if (aiConfigQuery.rows.length === 0) {
      console.log('❌ No AI configuration found!');
      console.log('   → User needs to add their OpenAI/Gemini API key');
    } else {
      aiConfigQuery.rows.forEach((config, index) => {
        console.log(`\n   Config ${index + 1}:`);
        console.log(`   - Provider: ${config.provider}`);
        console.log(`   - Model: ${config.model_name}`);
        console.log(`   - Default: ${config.is_default ? 'Yes' : 'No'}`);
      });
    }
    
    // Check recent executions
    console.log('\n6️⃣  RECENT EXECUTIONS:');
    console.log('─'.repeat(60));
    const executionsQuery = await pool.query(
      'SELECT id, workflow_id, status, created_at FROM automation_executions WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 5',
      [agentId]
    );
    
    if (executionsQuery.rows.length === 0) {
      console.log('❌ No executions yet');
      console.log('   → Agent has never received/processed an email');
    } else {
      executionsQuery.rows.forEach((exec, index) => {
        console.log(`\n   Execution ${index + 1}:`);
        console.log(`   - ID: ${exec.id}`);
        console.log(`   - Workflow: ${exec.workflow_id}`);
        console.log(`   - Status: ${exec.status}`);
        console.log(`   - Date: ${exec.created_at}`);
      });
    }
    
    // Summary
    console.log('\n═'.repeat(60));
    console.log('📊 SUMMARY:');
    console.log('═'.repeat(60));
    
    const checks = [
      { name: 'Agent exists', passed: agent !== null },
      { name: 'Agent is active', passed: agent.status === 'active' },
      { name: 'Email configured', passed: emailConfigQuery.rows.length > 0 },
      { name: 'Workflows exist', passed: workflowQuery.rows.length > 0 },
      { name: 'Workflow is active', passed: workflowQuery.rows.some(w => w.status === 'active') },
      { name: 'AI configured', passed: aiConfigQuery.rows.length > 0 }
    ];
    
    console.log('');
    checks.forEach(check => {
      console.log(`${check.passed ? '✅' : '❌'} ${check.name}`);
    });
    
    const allPassed = checks.every(c => c.passed);
    
    console.log('\n' + '═'.repeat(60));
    if (allPassed) {
      console.log('✅ ALL CHECKS PASSED! Agent should be working.');
      console.log('');
      console.log('Next steps:');
      console.log('1. Send a test email to:', emailConfigQuery.rows[0]?.email_address);
      console.log('2. Wait 60 seconds (polling interval)');
      console.log('3. Check executions again');
    } else {
      console.log('❌ ISSUES FOUND! Follow the fixes below:');
      console.log('');
      
      if (agent.status !== 'active') {
        console.log('→ Activate agent:');
        console.log(`   UPDATE automation_agents SET status = 'active' WHERE id = ${agentId};`);
      }
      
      if (workflowQuery.rows.length === 0) {
        console.log('→ Create a workflow via API');
      } else if (!workflowQuery.rows.some(w => w.status === 'active')) {
        console.log('→ Activate workflow:');
        console.log(`   UPDATE automation_workflows SET status = 'active' WHERE agent_id = ${agentId};`);
      }
      
      if (emailConfigQuery.rows.length === 0) {
        console.log('→ Connect Gmail OAuth for this agent');
      }
      
      if (aiConfigQuery.rows.length === 0) {
        console.log('→ Add AI configuration via API');
      }
    }
    console.log('');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

diagnoseAgent();

