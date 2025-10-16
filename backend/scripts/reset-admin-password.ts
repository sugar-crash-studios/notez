import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function resetAdminPassword() {
  const newPassword = 'abc123!';
  const SALT_ROUNDS = 10;

  try {
    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update the admin user
    const user = await prisma.user.update({
      where: { username: 'admin' },
      data: {
        passwordHash,
        mustChangePassword: false, // Set to false so you don't need to change it immediately
      },
    });

    console.log('✅ Admin password reset successfully!');
    console.log(`Username: ${user.username}`);
    console.log(`Email: ${user.email}`);
    console.log(`New Password: ${newPassword}`);
    console.log('\n⚠️  Remember to change this password after logging in!');
  } catch (error) {
    console.error('❌ Error resetting password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword();
