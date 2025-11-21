require('dotenv').config();
const db = require('../utils/db');

async function showOwnership() {
  console.log('\n👥 Agent Ownership Report\n');
  console.log('=' .repeat(60));

  try {
    // Get all users
    const usersResult = await db.query(`
      SELECT id, name, email, role 
      FROM users 
      ORDER BY id
    `);

    console.log(`\n📊 Users in System:\n`);
    usersResult.rows.forEach(user => {
      console.log(`   User ID ${user.id}: ${user.name} (${user.email}) - ${user.role}`);
    });

    // Get all agents with ownership
    const agentsResult = await db.query(`
      SELECT 
        a.id,
        a.name,
        a.type,
        a.status,
        a.user_id,
        u.name as owner_name,
        u.email as owner_email,
        ec.email_address as agent_email
      FROM automation_agents a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN email_agent_configs ec ON ec.agent_id = a.id
      ORDER BY a.created_at DESC
    `);

    console.log(`\n\n📋 Agents (${agentsResult.rows.length} total):\n`);
    console.log('=' .repeat(60));
    
    agentsResult.rows.forEach(agent => {
      console.log(`\nAgent #${agent.id}: "${agent.name}"`);
      console.log(`   Type: ${agent.type}`);
      console.log(`   Status: ${agent.status}`);
      console.log(`   Agent Email: ${agent.agent_email || 'N/A'}`);
      console.log(`   Owner: ${agent.owner_name || 'NONE'} (User ID: ${agent.user_id || 'NULL'})`);
      console.log(`   Owner Email: ${agent.owner_email || 'N/A'}`);
    });

    // Get workflow counts per agent
    const workflowsResult = await db.query(`
      SELECT 
        agent_id,
        COUNT(*) as workflow_count
      FROM automation_workflows
      GROUP BY agent_id
    `);

    if (workflowsResult.rows.length > 0) {
      console.log('\n\n📊 Workflow Counts:\n');
      workflowsResult.rows.forEach(row => {
        console.log(`   Agent #${row.agent_id}: ${row.workflow_count} workflow(s)`);
      });
    }

    console.log('\n' + '=' .repeat(60));
    console.log('\n💡 Tip: Run "node scripts/transfer-agents-to-user.js" to transfer\n   all agents to User ID 1\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

showOwnership();

