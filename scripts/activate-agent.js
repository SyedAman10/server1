require('dotenv').config();
const db = require('../utils/db');

async function activateAgent() {
  console.log('\n🔧 ACTIVATING EMAIL AGENTS\n');
  console.log('=' .repeat(60));

  try {
    // 1. Find all email agents
    const agentsResult = await db.query(`
      SELECT 
        a.id, 
        a.name, 
        a.type, 
        a.status,
        ec.email_address
      FROM automation_agents a
      LEFT JOIN email_agent_configs ec ON ec.agent_id = a.id
      WHERE a.type IN ('inbound_email', 'email_inbound', 'outbound_email', 'email_outbound')
      ORDER BY a.created_at DESC
    `);

    if (agentsResult.rows.length === 0) {
      console.log('❌ No email agents found!');
      process.exit(1);
    }

    console.log(`\n📊 Found ${agentsResult.rows.length} email agent(s):\n`);
    agentsResult.rows.forEach((agent, idx) => {
      console.log(`${idx + 1}. Agent #${agent.id}: "${agent.name}"`);
      console.log(`   Type: ${agent.type}`);
      console.log(`   Status: ${agent.status === 'active' ? '✅ active' : '❌ inactive'}`);
      console.log(`   Email: ${agent.email_address || 'Not configured'}`);
      console.log('');
    });

    // 2. Activate all inbound agents
    const inboundAgents = agentsResult.rows.filter(a => 
      a.type === 'inbound_email' || a.type === 'email_inbound'
    );

    if (inboundAgents.length === 0) {
      console.log('❌ No inbound email agents found!');
      process.exit(1);
    }

    console.log('🔄 Activating inbound email agents...\n');
    
    for (const agent of inboundAgents) {
      await db.query(`
        UPDATE automation_agents
        SET status = 'active'
        WHERE id = $1
      `, [agent.id]);
      
      console.log(`✅ Activated agent #${agent.id}: "${agent.name}"`);
    }

    // 3. Check and activate workflows
    console.log('\n🔄 Checking workflows...\n');
    
    for (const agent of inboundAgents) {
      const workflowsResult = await db.query(`
        SELECT id, name, status
        FROM automation_workflows
        WHERE agent_id = $1
      `, [agent.id]);

      if (workflowsResult.rows.length === 0) {
        console.log(`⚠️  Agent #${agent.id} has NO workflows!`);
        console.log(`   → Create a workflow for this agent first`);
      } else {
        console.log(`📋 Agent #${agent.id} workflows:`);
        for (const workflow of workflowsResult.rows) {
          if (workflow.status !== 'active') {
            await db.query(`
              UPDATE automation_workflows
              SET status = 'active'
              WHERE id = $1
            `, [workflow.id]);
            console.log(`   ✅ Activated workflow #${workflow.id}: "${workflow.name}"`);
          } else {
            console.log(`   ✅ Workflow #${workflow.id}: "${workflow.name}" (already active)`);
          }
        }
      }
    }

    // 4. Verify OAuth tokens
    console.log('\n🔐 Checking OAuth tokens...\n');
    
    for (const agent of inboundAgents) {
      const tokenResult = await db.query(`
        SELECT oauth_tokens
        FROM email_agent_configs
        WHERE agent_id = $1
      `, [agent.id]);

      if (!tokenResult.rows[0] || !tokenResult.rows[0].oauth_tokens) {
        console.log(`❌ Agent #${agent.id} has NO OAuth tokens!`);
        console.log(`   → Authorize Gmail first`);
      } else {
        const tokens = tokenResult.rows[0].oauth_tokens;
        const hasAccess = !!tokens.access_token;
        const hasRefresh = !!tokens.refresh_token;
        
        if (hasAccess && hasRefresh) {
          console.log(`✅ Agent #${agent.id} has valid OAuth tokens`);
        } else {
          console.log(`⚠️  Agent #${agent.id} has incomplete OAuth tokens`);
          console.log(`   Access: ${hasAccess ? '✅' : '❌'}  Refresh: ${hasRefresh ? '✅' : '❌'}`);
        }
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('✅ ACTIVATION COMPLETE!\n');
    console.log('📝 Next steps:');
    console.log('1. Run: pm2 restart index');
    console.log('2. Check logs: pm2 logs index --lines 20');
    console.log('3. Look for: "📧 Polling email agents..." every 15 seconds');
    console.log('4. Send test email to verify auto-reply\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

activateAgent();

