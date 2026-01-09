/*
  Warnings:

  - You are about to drop the `OrdersOnProducts` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `description` on table `Product` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_fkey";

-- DropForeignKey
ALTER TABLE "OrdersOnProducts" DROP CONSTRAINT "OrdersOnProducts_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrdersOnProducts" DROP CONSTRAINT "OrdersOnProducts_productId_fkey";

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "description" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "refreshToken" TEXT,
ALTER COLUMN "name" SET NOT NULL;

-- DropTable
DROP TABLE "OrdersOnProducts";

-- CreateTable
CREATE TABLE "OrderProductItem" (
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderProductItem_pkey" PRIMARY KEY ("orderId","productId")
);

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProductItem" ADD CONSTRAINT "OrderProductItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProductItem" ADD CONSTRAINT "OrderProductItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
