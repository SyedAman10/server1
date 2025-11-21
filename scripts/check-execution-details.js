const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function checkExecutionDetails() {
  const executionId = process.argv[2] || 18;
  
  try {
    console.log(`\n🔍 Checking Execution ID: ${executionId}\n`);
    console.log('═'.repeat(60));
    
    const query = await pool.query(
      'SELECT * FROM automation_executions WHERE id = $1',
      [executionId]
    );
    
    if (query.rows.length === 0) {
      console.log('❌ Execution not found!');
      return;
    }
    
    const exec = query.rows[0];
    
    console.log('\n📋 EXECUTION DETAILS:');
    console.log('─'.repeat(60));
    console.log(`ID: ${exec.id}`);
    console.log(`Agent ID: ${exec.agent_id}`);
    console.log(`Workflow ID: ${exec.workflow_id}`);
    console.log(`Status: ${exec.status}`);
    console.log(`Started: ${exec.started_at}`);
    console.log(`Completed: ${exec.completed_at}`);
    console.log(`Duration: ${exec.duration_ms}ms`);
    
    console.log('\n📨 TRIGGER DATA (Email Received):');
    console.log('─'.repeat(60));
    if (exec.trigger_data && exec.trigger_data.email) {
      const email = exec.trigger_data.email;
      console.log(`From: ${email.from}`);
      console.log(`Subject: ${email.subject}`);
      console.log(`Date: ${email.date}`);
      console.log(`Body: ${email.body?.substring(0, 200)}${email.body?.length > 200 ? '...' : ''}`);
    } else {
      console.log('No email data found');
    }
    
    console.log('\n🤖 EXECUTION DATA (What Happened):');
    console.log('─'.repeat(60));
    if (exec.execution_data) {
      console.log(JSON.stringify(exec.execution_data, null, 2));
    } else {
      console.log('No execution data');
    }
    
    if (exec.error_message) {
      console.log('\n❌ ERROR MESSAGE:');
      console.log('─'.repeat(60));
      console.log(exec.error_message);
    }
    
    console.log('\n' + '═'.repeat(60));
    
    // Check if AI reply was generated
    if (exec.execution_data) {
      const data = exec.execution_data;
      
      if (data.generatedReply) {
        console.log('✅ AI reply was generated:');
        console.log('─'.repeat(60));
        console.log(data.generatedReply);
        console.log('');
      }
      
      if (data.replyTo) {
        console.log(`✅ Reply sent to: ${data.replyTo}`);
      }
      
      if (data.aiProvider) {
        console.log(`✅ AI Provider: ${data.aiProvider} (${data.aiModel})`);
        console.log(`✅ Tokens used: ${data.tokensUsed || 'N/A'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkExecutionDetails();

