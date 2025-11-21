require('dotenv').config();
const db = require('../utils/db');

async function debugPolling() {
  console.log('\n🔍 LIVE POLLING DEBUG\n');
  console.log('=' .repeat(60));

  try {
    // 1. Check for active agents
    const agentsResult = await db.query(`
      SELECT 
        id, 
        name, 
        type, 
        status,
        oauth_tokens IS NOT NULL as has_tokens,
        created_at
      FROM automation_agents 
      WHERE status = 'active' AND type = 'inbound_email'
    `);

    console.log(`\n📊 Active Inbound Email Agents: ${agentsResult.rows.length}`);
    agentsResult.rows.forEach(agent => {
      console.log(`   - Agent #${agent.id}: "${agent.name}"`);
      console.log(`     Status: ${agent.status}`);
      console.log(`     Has OAuth: ${agent.has_tokens ? '✅' : '❌'}`);
      console.log(`     Created: ${agent.created_at}`);
    });

    if (agentsResult.rows.length === 0) {
      console.log('\n❌ NO ACTIVE AGENTS FOUND!');
      return;
    }

    // 2. Check for active workflows
    const workflowsResult = await db.query(`
      SELECT 
        w.id,
        w.agent_id,
        w.name,
        w.status,
        w.trigger,
        a.name as agent_name
      FROM automation_workflows w
      JOIN automation_agents a ON w.agent_id = a.id
      WHERE w.status = 'active' 
        AND a.status = 'active'
        AND a.type = 'inbound_email'
    `);

    console.log(`\n📊 Active Workflows: ${workflowsResult.rows.length}`);
    workflowsResult.rows.forEach(wf => {
      console.log(`   - Workflow #${wf.id}: "${wf.name}"`);
      console.log(`     Agent: ${wf.agent_name} (#${wf.agent_id})`);
      console.log(`     Status: ${wf.status}`);
      console.log(`     Trigger: ${JSON.stringify(wf.trigger).substring(0, 50)}...`);
    });

    if (workflowsResult.rows.length === 0) {
      console.log('\n❌ NO ACTIVE WORKFLOWS FOUND!');
      return;
    }

    // 3. Check OAuth token validity
    for (const agent of agentsResult.rows) {
      const tokenResult = await db.query(`
        SELECT 
          oauth_tokens,
          updated_at
        FROM automation_agents 
        WHERE id = $1
      `, [agent.id]);

      if (tokenResult.rows[0]?.oauth_tokens) {
        const tokens = tokenResult.rows[0].oauth_tokens;
        const hasAccessToken = !!tokens.access_token;
        const hasRefreshToken = !!tokens.refresh_token;
        const tokenAge = Date.now() - new Date(tokenResult.rows[0].updated_at).getTime();
        const tokenAgeMinutes = Math.floor(tokenAge / 60000);

        console.log(`\n🔐 OAuth Tokens for Agent #${agent.id}:`);
        console.log(`   Access Token: ${hasAccessToken ? '✅ Present' : '❌ Missing'}`);
        console.log(`   Refresh Token: ${hasRefreshToken ? '✅ Present' : '❌ Missing'}`);
        console.log(`   Token Age: ${tokenAgeMinutes} minutes`);
        console.log(`   Expiry: ${tokens.expiry_date ? new Date(tokens.expiry_date).toLocaleString() : 'Unknown'}`);
        
        if (tokens.expiry_date) {
          const isExpired = Date.now() > tokens.expiry_date;
          console.log(`   Status: ${isExpired ? '❌ EXPIRED' : '✅ Valid'}`);
        }
      }
    }

    // 4. Check recent executions
    const executionsResult = await db.query(`
      SELECT 
        e.id,
        e.workflow_id,
        e.status,
        e.created_at,
        e.error,
        w.name as workflow_name
      FROM automation_executions e
      JOIN automation_workflows w ON e.workflow_id = w.id
      ORDER BY e.created_at DESC
      LIMIT 10
    `);

    console.log(`\n📊 Recent Executions (Last 10):`);
    if (executionsResult.rows.length === 0) {
      console.log('   (none yet)');
    } else {
      executionsResult.rows.forEach(exec => {
        const timeAgo = Math.floor((Date.now() - new Date(exec.created_at).getTime()) / 60000);
        console.log(`   - Execution #${exec.id}: ${exec.status}`);
        console.log(`     Workflow: "${exec.workflow_name}" (#${exec.workflow_id})`);
        console.log(`     Time: ${timeAgo} minutes ago`);
        if (exec.error) {
          console.log(`     Error: ${exec.error.substring(0, 100)}...`);
        }
      });
    }

    // 5. Check if polling service is actually running
    console.log('\n\n📝 TROUBLESHOOTING CHECKLIST:\n');
    console.log('✓ Run: pm2 logs index --lines 20');
    console.log('  └─ Look for: "📧 Polling email agents..." every 15 seconds');
    console.log('');
    console.log('✓ If you DON\'T see polling messages:');
    console.log('  └─ Run: pm2 restart index');
    console.log('');
    console.log('✓ If tokens are EXPIRED:');
    console.log('  └─ Re-authorize Gmail at:');
    console.log(`     curl https://class.xytek.ai/api/automation/agents/${agentsResult.rows[0].id}/gmail-auth-url`);
    console.log('');
    console.log('✓ Send a test email to: amanullahnaqvi@gmail.com');
    console.log('  └─ Check response time (should be 15-30 seconds)');
    console.log('');

  } catch (error) {
    console.error('\n❌ Error running diagnostics:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

debugPolling();

