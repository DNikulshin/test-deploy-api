import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding admin user...');

  const saltRounds = 10;
  const initialAdminPassword = 'admin123';
  const hashedPassword = await bcrypt.hash(initialAdminPassword, saltRounds);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@admin.ru' },
    // By leaving `update` empty, we ensure that if the admin already exists,
    // their password is not reset on every application restart.
    update: {},
    create: {
      email: 'admin@admin.ru',
      name: 'admin',
      passwordHash: hashedPassword,
      role: Role.ADMIN,
      // Force password change on first login for security.
      passwordChangeRequired: true,
    },
  });

  console.log('Admin user seeding complete. User details:', { id: admin.id, email: admin.email });
}

main()
  .catch((e) => {
    console.error('Error during admin seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
