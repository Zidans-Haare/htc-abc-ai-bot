const { createUser } = require('../controllers/authController.cjs');

async function createAdmin() {
  try {
    console.log('Creating admin user...');
    const user = await createUser('admin', 'admin', 'admin');
    console.log('Admin user created:', user);
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    process.exit(0);
  }
}

createAdmin();