// Script to generate password hashes and create users
// Usage: npx tsx server/create-user.ts

import bcrypt from 'bcrypt';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

async function createUser() {
  console.log('\n🔐 Create New User\n');
  
  const username = await question('Username: ');
  const email = await question('Email: ');
  const password = await question('Password: ');
  const roleInput = await question('Role (admin/user) [user]: ');
  const role = roleInput.toLowerCase() === 'admin' ? 'admin' : 'user';

  if (!username || !email || !password) {
    console.log('❌ All fields are required!');
    rl.close();
    return;
  }

  try {
    const passwordHash = await hashPassword(password);

    const result = await db
      .insert(users)
      .values({
        username,
        email,
        passwordHash,
        role,
        isActive: true,
      })
      .returning();

    console.log('\n✅ User created successfully!');
    console.log({
      id: result[0].id,
      username: result[0].username,
      email: result[0].email,
      role: result[0].role,
    });
  } catch (error: any) {
    if (error.code === '23505') {
      console.log('\n❌ Username or email already exists!');
    } else {
      console.log('\n❌ Error creating user:', error.message);
    }
  }

  rl.close();
}

async function generatePasswordHash() {
  console.log('\n🔑 Generate Password Hash\n');
  
  const password = await question('Enter password to hash: ');
  
  if (!password) {
    console.log('❌ Password is required!');
    rl.close();
    return;
  }

  const hash = await hashPassword(password);
  console.log('\n✅ Password hash:');
  console.log(hash);
  console.log('\nUse this hash in SQL:');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE username = 'your-username';`);

  rl.close();
}

async function listUsers() {
  console.log('\n👥 Users List\n');
  
  const allUsers = await db.select({
    id: users.id,
    username: users.username,
    email: users.email,
    role: users.role,
    isActive: users.isActive,
    createdAt: users.createdAt,
  }).from(users);

  if (allUsers.length === 0) {
    console.log('No users found.');
  } else {
    console.table(allUsers);
  }

  rl.close();
}

async function updatePassword() {
  console.log('\n🔄 Update User Password\n');
  
  const username = await question('Username: ');
  const newPassword = await question('New Password: ');

  if (!username || !newPassword) {
    console.log('❌ All fields are required!');
    rl.close();
    return;
  }

  try {
    const passwordHash = await hashPassword(newPassword);

    const result = await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.username, username))
      .returning();

    if (result.length === 0) {
      console.log(`❌ User "${username}" not found!`);
    } else {
      console.log(`✅ Password updated for "${username}"`);
    }
  } catch (error: any) {
    console.log('❌ Error updating password:', error.message);
  }

  rl.close();
}

async function main() {
  console.log('\n═══════════════════════════════════');
  console.log('   FMD CRM User Management Tool');
  console.log('═══════════════════════════════════\n');
  console.log('1. Create new user');
  console.log('2. Generate password hash');
  console.log('3. List all users');
  console.log('4. Update user password');
  console.log('5. Exit');
  
  const choice = await question('\nSelect an option (1-5): ');

  switch (choice.trim()) {
    case '1':
      await createUser();
      break;
    case '2':
      await generatePasswordHash();
      break;
    case '3':
      await listUsers();
      break;
    case '4':
      await updatePassword();
      break;
    case '5':
      console.log('👋 Goodbye!');
      rl.close();
      break;
    default:
      console.log('❌ Invalid option');
      rl.close();
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
