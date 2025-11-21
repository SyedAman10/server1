require('dotenv').config();
const db = require('../utils/db');

async function fixInactiveAgents() {
  console.log('\n🔧 FIXING INACTIVE AGENTS\n');
  console.log('=' .repeat(60));

  try {
    // Activate ALL inactive agents
    const result = await db.query(`
      UPDATE automation_agents
      SET status = 'active'
      WHERE status = 'inactive'
      RETURNING id, name, type;
    `);

    if (result.rows.length === 0) {
      console.log('✅ All agents are already active!');
    } else {
      console.log(`\n✅ Activated ${result.rows.length} agent(s):\n`);
      result.rows.forEach(agent => {
        console.log(`   - Agent #${agent.id}: "${agent.name}" (${agent.type})`);
      });
    }

    console.log('\n' + '=' .repeat(60));
    console.log('✅ DONE!\n');
    console.log('📝 Next steps:');
    console.log('1. Run: pm2 restart index');
    console.log('2. Check: pm2 logs index --lines 20');
    console.log('3. You should see: "📧 Polling email agents..." every 15 seconds\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

fixInactiveAgents();

