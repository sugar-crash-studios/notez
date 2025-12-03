import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as readline from 'readline';

const prisma = new PrismaClient();

function promptForPassword(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter new password for admin user: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function resetAdminPassword() {
  const SALT_ROUNDS = 10;

  try {
    // Get password from command line argument or prompt
    let newPassword = process.argv[2];

    if (!newPassword) {
      newPassword = await promptForPassword();
    }

    if (!newPassword || newPassword.length < 6) {
      console.error('❌ Password must be at least 6 characters');
      process.exit(1);
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update the admin user
    const user = await prisma.user.update({
      where: { username: 'admin' },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    console.log('✅ Admin password reset successfully!');
    console.log(`Username: ${user.username}`);
    console.log(`Email: ${user.email}`);
    console.log('\n⚠️  Remember to change this password after logging in!');
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword();
