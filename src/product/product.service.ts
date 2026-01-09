import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  private async _getCategory(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found.`);
    }
    return category;
  }

  async create(createProductDto: CreateProductDto) {
    await this._getCategory(createProductDto.categoryId);
    return this.prisma.product.create({ data: createProductDto });
  }

  async findAll(categoryId?: string) {
    const where: Prisma.ProductWhereInput = {};
    if (categoryId) {
      where.categoryId = categoryId;
    }
    return this.prisma.product.findMany({ where, include: { category: true } });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found.`);
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(id); // Ensure product exists
    if (updateProductDto.categoryId) {
      await this._getCategory(updateProductDto.categoryId);
    }
    return this.prisma.product.update({
      where: { id },
      data: updateProductDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Ensure product exists
    return this.prisma.product.delete({ where: { id } });
  }
}
