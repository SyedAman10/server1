const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function fixAgent() {
  const agentId = process.argv[2] || 3;
  
  try {
    console.log(`\n🔧 Fixing Agent ID: ${agentId}\n`);
    
    // Fix 1: Activate agent
    console.log('1. Activating agent...');
    await pool.query(
      'UPDATE automation_agents SET status = $1 WHERE id = $2',
      ['active', agentId]
    );
    console.log('   ✅ Agent activated');
    
    // Fix 2: Activate all workflows
    console.log('\n2. Activating workflows...');
    const result = await pool.query(
      'UPDATE automation_workflows SET status = $1 WHERE agent_id = $2 RETURNING id, name',
      ['active', agentId]
    );
    
    if (result.rows.length === 0) {
      console.log('   ⚠️  No workflows found for this agent');
      console.log('   → You need to create a workflow via API');
    } else {
      result.rows.forEach(row => {
        console.log(`   ✅ Activated workflow: ${row.name} (ID: ${row.id})`);
      });
    }
    
    // Verify
    console.log('\n3. Verifying fixes...');
    const checkQuery = await pool.query(`
      SELECT 
        a.id,
        a.name,
        a.status as agent_status,
        COUNT(w.id) as workflow_count,
        COUNT(CASE WHEN w.status = 'active' THEN 1 END) as active_workflows
      FROM automation_agents a
      LEFT JOIN automation_workflows w ON a.id = w.agent_id
      WHERE a.id = $1
      GROUP BY a.id, a.name, a.status
    `, [agentId]);
    
    if (checkQuery.rows.length > 0) {
      const status = checkQuery.rows[0];
      console.log(`\n   Agent: ${status.name}`);
      console.log(`   Status: ${status.agent_status} ${status.agent_status === 'active' ? '✅' : '❌'}`);
      console.log(`   Total workflows: ${status.workflow_count}`);
      console.log(`   Active workflows: ${status.active_workflows}`);
      
      if (status.agent_status === 'active' && status.active_workflows > 0) {
        console.log('\n🎉 SUCCESS! Agent is now ready to receive emails!');
        
        // Get email address
        const emailQuery = await pool.query(
          'SELECT email_address FROM email_agent_configs WHERE agent_id = $1',
          [agentId]
        );
        
        if (emailQuery.rows.length > 0) {
          console.log(`\n📧 Send a test email to: ${emailQuery.rows[0].email_address}`);
          console.log('⏰ Wait 60 seconds for the polling service to check');
        }
      } else if (status.active_workflows === 0) {
        console.log('\n⚠️  Agent is active but has no workflows!');
        console.log('   Create a workflow using the API:');
        console.log(`   POST /api/automation/workflows`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixAgent();

