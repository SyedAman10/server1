const { pool } = require('../config/database');

(async () => {
try {
    await pool.query(`
        ALTER TABLE companies
        ADD CONSTRAINT unique_teacher_id UNIQUE (teacher_id);
      `);
      console.log('Unique constraint added to teacher_id.');
process.exit(0);
} catch (error) {
console.error('Error adding unique constraint:', error);
process.exit(1);
}
})();