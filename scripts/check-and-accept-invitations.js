require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkAndAcceptInvitations() {
  try {
    console.log('='.repeat(80));
    console.log('🔍 CHECKING COURSES AND INVITATIONS');
    console.log('='.repeat(80));
    
    // 1. Check for AI Development course
    console.log('\n📚 Looking for AI Development course...');
    const aiCourseResult = await pool.query(`
      SELECT id, name, description, section, room, teacher_id, created_at
      FROM courses
      WHERE LOWER(name) LIKE '%ai%development%' OR LOWER(name) LIKE '%development%';
    `);
    
    if (aiCourseResult.rows.length > 0) {
      console.log(`✅ Found ${aiCourseResult.rows.length} development course(s):`);
      for (const course of aiCourseResult.rows) {
        console.log(`  📖 ${course.name} (ID: ${course.id})`);
        console.log(`     Description: ${course.description || 'N/A'}`);
        console.log(`     Teacher ID: ${course.teacher_id}`);
        console.log(`     Created: ${new Date(course.created_at).toLocaleString()}`);
      }
    } else {
      console.log('⚠️  No AI development course found.');
    }
    
    // 2. Show all courses
    console.log('\n📚 ALL COURSES IN DATABASE:');
    const allCoursesResult = await pool.query(`
      SELECT c.id, c.name, c.teacher_id, 
             u.name as teacher_name, u.email as teacher_email,
             COUNT(DISTINCT ce.student_id) as student_count,
             c.created_at
      FROM courses c
      LEFT JOIN users u ON c.teacher_id = u.id
      LEFT JOIN course_enrollments ce ON c.id = ce.course_id
      GROUP BY c.id, c.name, c.teacher_id, u.name, u.email, c.created_at
      ORDER BY c.created_at DESC;
    `);
    
    if (allCoursesResult.rows.length === 0) {
      console.log('  ⚠️  No courses found in database.');
    } else {
      console.log(`  Total courses: ${allCoursesResult.rows.length}\n`);
      for (const course of allCoursesResult.rows) {
        console.log(`  📖 ${course.name} (ID: ${course.id})`);
        console.log(`     Teacher: ${course.teacher_name || 'N/A'} (${course.teacher_email || 'N/A'})`);
        console.log(`     Students: ${course.student_count}`);
        console.log(`     Created: ${new Date(course.created_at).toLocaleString()}`);
        console.log('');
      }
    }
    
    // 3. Check for ALL pending invitations
    console.log('\n📧 CHECKING ALL PENDING INVITATIONS:');
    const invitationsResult = await pool.query(`
      SELECT i.*, 
             c.name as course_name,
             u.name as inviter_name,
             u.email as inviter_email
      FROM invitations i
      LEFT JOIN courses c ON i.course_id = c.id
      LEFT JOIN users u ON i.inviter_user_id = u.id
      WHERE i.status = 'pending'
      ORDER BY i.created_at DESC;
    `);
    
    const invitations = invitationsResult.rows;
    console.log(`Found ${invitations.length} pending invitation(s)\n`);
    
    if (invitations.length === 0) {
      console.log('✅ No pending invitations found. All users have been invited and accepted!\n');
      
      // Show all invitations (including accepted)
      console.log('📊 ALL INVITATION HISTORY:');
      const allInvitationsResult = await pool.query(`
        SELECT i.*, 
               c.name as course_name,
               u.name as inviter_name
        FROM invitations i
        LEFT JOIN courses c ON i.course_id = c.id
        LEFT JOIN users u ON i.inviter_user_id = u.id
        ORDER BY i.created_at DESC
        LIMIT 20;
      `);
      
      if (allInvitationsResult.rows.length === 0) {
        console.log('  No invitations in database.');
      } else {
        for (const inv of allInvitationsResult.rows) {
          console.log(`  📨 ${inv.invitee_email} → ${inv.course_name}`);
          console.log(`     Status: ${inv.status.toUpperCase()}`);
          console.log(`     Role: ${inv.invitee_role}`);
          console.log(`     Created: ${new Date(inv.created_at).toLocaleString()}`);
          if (inv.accepted_at) {
            console.log(`     Accepted: ${new Date(inv.accepted_at).toLocaleString()}`);
          }
          console.log('');
        }
      }
      
      return;
    }
    
    // Display pending invitations
    console.log('📋 PENDING INVITATIONS TO ACCEPT:\n');
    for (const invitation of invitations) {
      console.log(`  📧 Email: ${invitation.invitee_email}`);
      console.log(`     Course: ${invitation.course_name || 'N/A'} (ID: ${invitation.course_id})`);
      console.log(`     Role: ${invitation.invitee_role}`);
      console.log(`     Invited by: ${invitation.inviter_name || 'N/A'}`);
      console.log(`     Expires: ${new Date(invitation.expires_at).toLocaleString()}`);
      console.log('');
    }
    
    // Ask for confirmation
    console.log('='.repeat(80));
    console.log('🚀 STARTING AUTO-ACCEPTANCE PROCESS');
    console.log('='.repeat(80));
    console.log('This will:');
    console.log('  1. Create user accounts if they don\'t exist (password: TempPassword123!)');
    console.log('  2. Enroll users in their respective courses');
    console.log('  3. Mark invitations as accepted\n');
    
    // Auto-accept all invitations
    for (const invitation of invitations) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📧 Processing: ${invitation.invitee_email}`);
      console.log(`   Course: ${invitation.course_name}`);
      console.log(`   Role: ${invitation.invitee_role}`);
      
      // Check if user already exists
      let userResult = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [invitation.invitee_email]
      );
      
      let userId;
      
      if (userResult.rows.length === 0) {
        // Create new user account
        console.log('   👤 Creating new user account...');
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
        console.log(`   ✅ User created with ID: ${userId}`);
        console.log(`   🔑 Default password: TempPassword123!`);
      } else {
        userId = userResult.rows[0].id;
        console.log(`   ✅ User already exists with ID: ${userId}`);
      }
      
      // Enroll the user in the course
      console.log('   📚 Enrolling in course...');
      
      try {
        if (invitation.invitee_role === 'student') {
          const enrollResult = await pool.query(`
            INSERT INTO course_enrollments (course_id, student_id, enrolled_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (course_id, student_id) DO NOTHING
            RETURNING *;
          `, [invitation.course_id, userId]);
          
          if (enrollResult.rows.length > 0) {
            console.log(`   ✅ Enrolled as ${invitation.invitee_role}`);
          } else {
            console.log(`   ℹ️  Already enrolled as ${invitation.invitee_role}`);
          }
        } else if (invitation.invitee_role === 'teacher') {
          // For teachers, add them to course_enrollments as well
          await pool.query(`
            INSERT INTO course_enrollments (course_id, student_id, enrolled_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (course_id, student_id) DO NOTHING;
          `, [invitation.course_id, userId]);
          console.log(`   ✅ Enrolled as ${invitation.invitee_role}`);
        }
      } catch (enrollError) {
        console.log(`   ⚠️  Enrollment warning: ${enrollError.message}`);
      }
      
      // Update invitation status
      await pool.query(`
        UPDATE invitations
        SET status = 'accepted',
            accepted_user_id = $1,
            accepted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2;
      `, [userId, invitation.id]);
      
      console.log('   ✅ Invitation accepted!');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 ALL PENDING INVITATIONS HAVE BEEN ACCEPTED!');
    console.log('='.repeat(80));
    
    // Show summary for each course
    console.log('\n📊 COURSE ENROLLMENT SUMMARY:\n');
    for (const course of allCoursesResult.rows) {
      const enrolledResult = await pool.query(`
        SELECT u.id, u.name, u.email, u.role, ce.enrolled_at
        FROM course_enrollments ce
        JOIN users u ON ce.student_id = u.id
        WHERE ce.course_id = $1
        ORDER BY u.name;
      `, [course.id]);
      
      console.log(`📖 ${course.name} (ID: ${course.id})`);
      console.log(`   Students enrolled: ${enrolledResult.rows.length}`);
      if (enrolledResult.rows.length > 0) {
        for (const student of enrolledResult.rows) {
          console.log(`   - ${student.name} (${student.email}) - Enrolled: ${new Date(student.enrolled_at).toLocaleString()}`);
        }
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
checkAndAcceptInvitations()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

