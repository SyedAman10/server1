require('dotenv').config();
const db = require('../utils/db');

async function checkAgentType() {
  console.log('\n🔍 Checking Agent Types\n');
  console.log('=' .repeat(60));

  try {
    const result = await db.query(`
      SELECT 
        a.id,
        a.name,
        a.type,
        a.status,
        ec.email_address
      FROM automation_agents a
      LEFT JOIN email_agent_configs ec ON ec.agent_id = a.id
      WHERE a.status = 'active'
      ORDER BY a.created_at DESC;
    `);

    console.log(`\n📊 Active Agents: ${result.rows.length}\n`);
    
    result.rows.forEach(agent => {
      console.log(`Agent #${agent.id}: "${agent.name}"`);
      console.log(`   Type: ${agent.type}`);
      console.log(`   Status: ${agent.status}`);
      console.log(`   Email: ${agent.email_address || 'N/A'}`);
      console.log('');
    });

    // Check which agents would be polled
    const pollingResult = await db.query(`
      SELECT ec.*, a.id as agent_id, a.name as agent_name, a.type, a.user_id, a.status as agent_status
      FROM email_agent_configs ec
      JOIN automation_agents a ON ec.agent_id = a.id
      WHERE a.status = 'active' 
        AND a.type = 'email_inbound'
      ORDER BY ec.last_checked_at ASC NULLS FIRST;
    `);

    console.log('=' .repeat(60));
    console.log(`\n🔄 Agents that will be polled: ${pollingResult.rows.length}\n`);
    
    pollingResult.rows.forEach(agent => {
      console.log(`   - ${agent.agent_name} (Type: ${agent.type})`);
    });

    if (pollingResult.rows.length === 0) {
      console.log('   (none - no inbound agents configured)');
    }

    console.log('\n' + '=' .repeat(60));
    console.log('\n💡 Agent Type Guidelines:\n');
    console.log('   email_inbound  → Receives emails, gets polled');
    console.log('   email_outbound → Sends emails, NOT polled');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkAgentType();

