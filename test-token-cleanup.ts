import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTokenCleanup() {
  console.log('Testing token cleanup functionality...');
  
  // Проверим количество токенов до очистки
  const tokensBefore = await prisma.refreshToken.count();
  console.log(`Tokens before cleanup: ${tokensBefore}`);
  
  // Здесь можно добавить код для создания тестовых токенов и проверки очистки
  
  console.log('Test completed.');
}

testTokenCleanup()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });