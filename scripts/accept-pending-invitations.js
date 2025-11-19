require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function acceptPendingInvitations() {
  try {
    console.log('🔍 Finding pending invitations for AI support3...');
    
    // Get pending invitations for AI support3
    const invitationsResult = await pool.query(`
      SELECT i.*, c.name as course_name
      FROM invitations i
      JOIN courses c ON i.course_id = c.id
      WHERE c.name = 'AI support3' AND i.status = 'pending';
    `);
    
    const invitations = invitationsResult.rows;
    console.log(`Found ${invitations.length} pending invitation(s)`);
    
    if (invitations.length === 0) {
      console.log('No pending invitations found.');
      return;
    }
    
    for (const invitation of invitations) {
      console.log(`\n📧 Processing invitation for: ${invitation.invitee_email}`);
      
      // Check if user already exists
      let userResult = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [invitation.invitee_email]
      );
      
      let userId;
      
      if (userResult.rows.length === 0) {
        // Create new user account
        console.log('  👤 Creating new user account...');
        const hashedPassword = await bcrypt.hash('TempPassword123!', 10);
        
        const newUserResult = await pool.query(`
          INSERT INTO users (email, password, name, role, created_at, updated_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *;
        `, [
          invitation.invitee_email,
          hashedPassword,
          invitation.invitee_email.split('@')[0], // Use email prefix as name
          invitation.invitee_role || 'student'
        ]);
        
        userId = newUserResult.rows[0].id;
        console.log(`  ✅ User created with ID: ${userId}`);
      } else {
        userId = userResult.rows[0].id;
        console.log(`  ✅ User already exists with ID: ${userId}`);
      }
      
      // Enroll the user in the course
      console.log('  📚 Enrolling in course...');
      
      if (invitation.invitee_role === 'student') {
        await pool.query(`
          INSERT INTO course_enrollments (course_id, student_id, enrolled_at)
          VALUES ($1, $2, CURRENT_TIMESTAMP)
          ON CONFLICT (course_id, student_id) DO NOTHING;
        `, [invitation.course_id, userId]);
      } else {
        // For teachers, update the course teacher_id
        await pool.query(`
          UPDATE courses SET teacher_id = $1 WHERE id = $2;
        `, [userId, invitation.course_id]);
      }
      
      console.log(`  ✅ Enrolled as ${invitation.invitee_role}`);
      
      // Update invitation status
      await pool.query(`
        UPDATE invitations
        SET status = 'accepted',
            accepted_user_id = $1,
            accepted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2;
      `, [userId, invitation.id]);
      
      console.log('  ✅ Invitation accepted!');
    }
    
    console.log('\n🎉 All pending invitations accepted!');
    
    // Show enrolled students
    const enrolledResult = await pool.query(`
      SELECT u.id, u.name, u.email, u.role
      FROM course_enrollments ce
      JOIN users u ON ce.student_id = u.id
      JOIN courses c ON ce.course_id = c.id
      WHERE c.name = 'AI support3';
    `);
    
    console.log(`\n📋 Students now enrolled in AI support3: ${enrolledResult.rows.length}`);
    enrolledResult.rows.forEach(s => {
      console.log(`  - ${s.name} (${s.email})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

acceptPendingInvitations();

