require('dotenv').config();
const db = require('../utils/db');

async function transferAgents() {
  const targetUserId = 1; // User ID 1 (teacher@example.com)
  
  console.log('\n🔄 Transferring Agents to User ID 1\n');
  console.log('=' .repeat(60));

  try {
    // Get target user info
    const userResult = await db.query(`
      SELECT id, name, email, role 
      FROM users 
      WHERE id = $1
    `, [targetUserId]);

    if (userResult.rows.length === 0) {
      console.log(`❌ User ID ${targetUserId} not found!`);
      process.exit(1);
    }

    const targetUser = userResult.rows[0];
    
    console.log(`\n📊 Target User:\n`);
    console.log(`   ID: ${targetUser.id}`);
    console.log(`   Name: ${targetUser.name}`);
    console.log(`   Email: ${targetUser.email}`);
    console.log(`   Role: ${targetUser.role}`);
    
    // Find all agents NOT owned by target user
    const agentsResult = await db.query(`
      SELECT 
        a.id,
        a.name,
        a.type,
        a.user_id,
        u.name as owner_name,
        u.email as owner_email
      FROM automation_agents a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.user_id != $1 OR a.user_id IS NULL
      ORDER BY a.created_at DESC
    `, [targetUserId]);

    if (agentsResult.rows.length === 0) {
      console.log('\n✅ All agents already belong to user ID 1!\n');
      process.exit(0);
    }

    console.log(`\n📋 Found ${agentsResult.rows.length} agent(s) to transfer:\n`);
    
    agentsResult.rows.forEach(agent => {
      console.log(`   Agent #${agent.id}: "${agent.name}"`);
      console.log(`      Type: ${agent.type}`);
      console.log(`      Current Owner: ${agent.owner_name || 'None'} (ID: ${agent.user_id || 'NULL'})`);
      console.log('');
    });

    // Transfer all agents to target user
    const updateResult = await db.query(`
      UPDATE automation_agents
      SET user_id = $1
      WHERE user_id != $1 OR user_id IS NULL
      RETURNING id, name, type
    `, [targetUserId]);

    console.log('=' .repeat(60));
    console.log(`\n✅ Transferred ${updateResult.rows.length} agent(s) to ${targetUser.name}!\n`);
    
    updateResult.rows.forEach(agent => {
      console.log(`   ✅ Agent #${agent.id}: "${agent.name}" (${agent.type})`);
    });

    // Also transfer workflows
    const workflowResult = await db.query(`
      UPDATE automation_workflows w
      SET user_id = $1
      FROM automation_agents a
      WHERE w.agent_id = a.id AND a.user_id = $1
      RETURNING w.id, w.name
    `, [targetUserId]);

    if (workflowResult.rows.length > 0) {
      console.log(`\n✅ Also updated ${workflowResult.rows.length} workflow(s)\n`);
    }

    console.log('\n' + '=' .repeat(60));
    console.log('\n🎉 Transfer complete! User can now see all agents.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

transferAgents();

