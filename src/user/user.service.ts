import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  toUserDto(user: any): UserDto | null {
    if (!user) {
      return null;
    }
    const { passwordHash, refreshTokenHash, ...result } = user;
    return result;
  }

  async create(
    createUserDto: CreateUserDto,
    role: Role = Role.USER,
    passwordChangeRequired = false,
  ) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      saltRounds,
    );

    try {
      const user = await this.prisma.user.create({
        data: {
          email: createUserDto.email,
          name: createUserDto.name,
          passwordHash: hashedPassword,
          role: role,
          passwordChangeRequired: passwordChangeRequired,
          tokensValidFrom: new Date(Date.now() - 1000),
        },
      });
      return this.toUserDto(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User with this email already exists.');
      }
      throw error;
    }
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    if (
      changePasswordDto.newPassword !==
      changePasswordDto.newPasswordConfirmation
    ) {
      throw new BadRequestException('Passwords do not match.');
    }

    const user = await this.findOne(userId, true); // Internal call, don't use DTO

    const isPasswordMatching = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!isPasswordMatching) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
      saltRounds,
    );

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashedPassword,
        passwordChangeRequired: false,
      },
    });
    return this.toUserDto(updatedUser);
  }

  async findAll() {
    const users = await this.prisma.user.findMany();
    return users.map((user) => this.toUserDto(user));
  }

  async findOne(id: string, internal: boolean = false): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    return internal ? user : this.toUserDto(user);
  }

  async findByEmail(email: string, internal: boolean = false): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException(`User with email "${email}" not found`);
    }
    return internal ? user : this.toUserDto(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id, true); // Internal call
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
    return this.toUserDto(updatedUser);
  }

  async setResetToken(id: string, resetToken: string, resetTokenExpires: Date) {
    return this.prisma.user.update({
      where: { id },
      data: {
        resetToken,
        resetTokenExpires,
      },
    });
  }

  async updatePassword(id: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id, true); // Internal call
    await this.prisma.user.delete({ where: { id } });
    return { message: `User with ID "${id}" has been successfully removed.` };
  }
}
