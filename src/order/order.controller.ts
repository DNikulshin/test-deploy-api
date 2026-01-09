import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum'; // ИСПРАВЛЕННЫЙ ИМПОРТ

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @UseGuards(AccessTokenGuard)
  create(@Req() req, @Body() createOrderDto: CreateOrderDto) {
    const userId = req.user.id;
    return this.orderService.create(userId, createOrderDto);
  }

  @Get()
  @UseGuards(AccessTokenGuard)
  findAll(@Req() req) {
    const userId = req.user.id;
    return this.orderService.findAll(userId);
  }

  @Get('/admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN) // ТЕПЕРЬ ИСПОЛЬЗУЕТСЯ ПРАВИЛЬНЫЙ ENUM
  findAllForAdmin() {
    return this.orderService.findAllForAdmin();
  }

  @Get(':id')
  @UseGuards(AccessTokenGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.orderService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN) // ТЕПЕРЬ ИСПОЛЬЗУЕТСЯ ПРАВИЛЬНЫЙ ENUM
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.orderService.update(id, updateOrderDto);
  }

  @Delete(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN) // ТЕПЕРЬ ИСПОЛЬЗУЕТСЯ ПРАВИЛЬНЫЙ ENUM
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.orderService.remove(id);
  }
}
