import { PrismaClient, Role, User, Product, Order, Category } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  const saltRounds = 10;

  // 1. Seed Categories
  console.log('Seeding categories...');
  const categoriesData = [
    { name: 'T-Shirts' },
    { name: 'Hoodies' },
    { name: 'Mugs' },
    { name: 'Stickers' },
    { name: 'Posters' },
  ];
  const categories: Category[] = [];
  for (const cat of categoriesData) {
    const category = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: { name: cat.name },
    });
    categories.push(category);
  }
  console.log(`Seeded ${categories.length} categories.`);

  // 2. Seed Admin User
  const initialAdminPassword = 'admin123';
  const hashedPassword = await bcrypt.hash(initialAdminPassword, saltRounds);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@admin.ru' },
    update: {
      passwordHash: hashedPassword,
      passwordChangeRequired: true,
    },
    create: {
      email: 'admin@admin.ru',
      name: 'Admin User',
      passwordHash: hashedPassword,
      role: Role.ADMIN,
      passwordChangeRequired: true,
    },
  });
  console.log('Admin user seeded successfully:', { admin });

  // 3. Seed Mock Users
  console.log('Seeding 10 mock users...');
  const users: User[] = [];
  const userPassword = await bcrypt.hash('password123', saltRounds);
  for (let i = 1; i <= 10; i++) {
    const user = await prisma.user.upsert({
      where: { email: `user${i}@example.com` },
      update: {},
      create: {
        email: `user${i}@example.com`,
        name: `User ${i}`,
        passwordHash: userPassword,
        role: Role.USER,
        passwordChangeRequired: false,
      },
    });
    users.push(user);
  }
  console.log(`Seeded ${users.length} users.`);

  // 4. Seed Mock Products
  console.log('Seeding 100 mock products...');
  const products: Product[] = [];
  await prisma.product.deleteMany({}); // Clear old products to ensure consistency
  for (let i = 1; i <= 100; i++) {
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const product = await prisma.product.create({
      data: {
        name: `Product ${i}`,
        description: `Description for product ${i}`,
        price: parseFloat((Math.random() * 100 + 10).toFixed(2)),
        stock: Math.floor(Math.random() * 100),
        imageUrl: `https://picsum.photos/seed/${i}/400/400`,
        categoryId: randomCategory.id,
      },
    });
    products.push(product);
  }
  console.log(`Seeded ${products.length} products.`);

  // 5. Seed Mock Orders
  console.log('Seeding 200 mock orders...');
  await prisma.order.deleteMany({}); // Clear old orders
  for (let i = 1; i <= 200; i++) {
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const numProducts = Math.floor(Math.random() * 5) + 1;
    const selectedProducts = products.sort(() => 0.5 - Math.random()).slice(0, numProducts);

    let totalPrice = 0;
    const orderProducts = selectedProducts.map(p => {
      const quantity = Math.floor(Math.random() * 3) + 1;
      totalPrice += p.price * quantity;
      return {
        productId: p.id,
        quantity: quantity,
        price: p.price, // Record price at time of purchase
      };
    });

    await prisma.order.create({
      data: {
        userId: randomUser.id,
        shippingAddress: `${i} Seed Street, Seed City`,
        totalPrice: parseFloat(totalPrice.toFixed(2)),
        products: {
          create: orderProducts,
        },
      },
    });
  }
  console.log('Seeded 200 orders.');

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
