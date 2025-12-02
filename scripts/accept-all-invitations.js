require('dotenv').config();
const { query } = require('../utils/db');

async function acceptAllInvitations() {
  try {
    console.log('🔍 Finding AI Development course...');
    
    // Find the AI Development course
    const courseResult = await query(
      `SELECT id, name, teacher_id FROM courses WHERE name ILIKE '%ai%development%' OR name ILIKE '%ai development%'`,
      []
    );
    
    if (courseResult.rows.length === 0) {
      console.log('❌ AI Development course not found. Showing all courses:');
      const allCourses = await query('SELECT id, name, teacher_id FROM courses', []);
      console.table(allCourses.rows);
      return;
    }
    
    const course = courseResult.rows[0];
    console.log(`✅ Found course: ${course.name} (ID: ${course.id})`);
    
    // Find all invitations for this course
    console.log('\n📧 Finding all invitations...');
    const invitationsResult = await query(
      `SELECT id, invitee_email, invitee_role, status, created_at 
       FROM invitations 
       WHERE course_id = $1`,
      [course.id]
    );
    
    if (invitationsResult.rows.length === 0) {
      console.log('❌ No invitations found for this course');
      return;
    }
    
    console.log(`\n📋 Found ${invitationsResult.rows.length} invitations:`);
    console.table(invitationsResult.rows);
    
    // Accept all pending invitations and enroll users
    console.log('\n🔄 Processing invitations...');
    
    for (const invitation of invitationsResult.rows) {
      console.log(`\n📧 Processing: ${invitation.invitee_email} (${invitation.status})`);
      
      // Find or create user
      let userResult = await query(
        `SELECT id, email, role FROM users WHERE email = $1 AND role = $2`,
        [invitation.invitee_email, invitation.invitee_role]
      );
      
      let userId;
      if (userResult.rows.length === 0) {
        console.log(`  👤 Creating new ${invitation.invitee_role} user...`);
        const newUser = await query(
          `INSERT INTO users (email, name, role, password) 
           VALUES ($1, $2, $3, $4) 
           RETURNING id`,
          [
            invitation.invitee_email,
            invitation.invitee_email.split('@')[0],
            invitation.invitee_role,
            'temp_password_' + Math.random().toString(36).substring(7)
          ]
        );
        userId = newUser.rows[0].id;
        console.log(`  ✅ User created with ID: ${userId}`);
      } else {
        userId = userResult.rows[0].id;
        console.log(`  ✅ User found with ID: ${userId}`);
      }
      
      // Check if already enrolled
      const enrollmentCheck = await query(
        `SELECT * FROM course_enrollments WHERE course_id = $1 AND student_id = $2`,
        [course.id, userId]
      );
      
      if (enrollmentCheck.rows.length === 0) {
        // Enroll user
        await query(
          `INSERT INTO course_enrollments (course_id, student_id, enrolled_at) 
           VALUES ($1, $2, NOW())`,
          [course.id, userId]
        );
        console.log(`  ✅ User enrolled in course`);
      } else {
        console.log(`  ℹ️  User already enrolled`);
      }
      
      // Update invitation status to accepted
      if (invitation.status !== 'accepted') {
        await query(
          `UPDATE invitations 
           SET status = 'accepted', accepted_at = NOW(), updated_at = NOW() 
           WHERE id = $1`,
          [invitation.id]
        );
        console.log(`  ✅ Invitation marked as accepted`);
      } else {
        console.log(`  ℹ️  Invitation already accepted`);
      }
    }
    
    // Show final enrollment list
    console.log('\n\n📊 Final Enrollment List:');
    const enrollments = await query(
      `SELECT u.email, u.role, ce.enrolled_at 
       FROM course_enrollments ce
       JOIN users u ON ce.student_id = u.id
       WHERE ce.course_id = $1
       ORDER BY ce.enrolled_at DESC`,
      [course.id]
    );
    console.table(enrollments.rows);
    
    console.log('\n✅ All invitations processed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit();
  }
}

acceptAllInvitations();

