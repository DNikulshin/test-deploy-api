import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { UserDto } from './dto/user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';
import { AllowPasswordChange } from '../auth/allow-password-change.decorator';
import { PasswordChangeGuard } from '../auth/guards/password-change.guard';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(AccessTokenGuard, PasswordChangeGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Return current user profile.',
    type: UserDto,
  })
  getProfile(@Req() req: any) {
    return this.userService.findOne(String(req.user.id));
  }

  @UseGuards(AccessTokenGuard, PasswordChangeGuard)
  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'The user profile has been successfully updated.',
    type: UserDto,
  })
  updateProfile(@Req() req: any, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(req.user.id, updateUserDto);
  }

  @UseGuards(AccessTokenGuard, PasswordChangeGuard)
  @ApiBearerAuth()
  @Delete('me')
  @ApiOperation({ summary: 'Delete current user account' })
  @ApiResponse({
    status: 200,
    description: 'The user account has been successfully deleted.',
  })
  deleteProfile(@Req() req: any) {
    return this.userService.remove(req.user.id);
  }

  @UseGuards(AccessTokenGuard, PasswordChangeGuard)
  @AllowPasswordChange()
  @ApiBearerAuth()
  @Patch('me/password')
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({
    status: 200,
    description: 'The user password has been successfully changed.',
    type: UserDto,
  })
  changePassword(
    @Req() req: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.userService.changePassword(req.user.id, changePasswordDto);
  }

  @Get() // Added missing @Get() decorator
  @UseGuards(AccessTokenGuard, PasswordChangeGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiResponse({
    status: 200,
    description: 'Return all users.',
    type: [UserDto],
  })
  findAll() {
    return this.userService.findAll();
  }

  @UseGuards(AccessTokenGuard, PasswordChangeGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by id (Admin only)' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiResponse({
    status: 200,
    description: 'Return user by id.',
    type: UserDto,
  })
  @Get(':id') // It's better to add the path here
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @UseGuards(AccessTokenGuard, PasswordChangeGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user by id (Admin only)' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiResponse({
    status: 200,
    description: 'The user has been successfully updated.',
    type: UserDto,
  })
  @Patch(':id') // It's better to add the path here
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @UseGuards(AccessTokenGuard, PasswordChangeGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user by id (Admin only)' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiResponse({
    status: 200,
    description: 'The user has been successfully deleted.',
  })
  @Delete(':id') // It's better to add the path here
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @UseGuards(AccessTokenGuard, PasswordChangeGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post('admin')
  @ApiOperation({ summary: 'Create a new admin user (Admin only)' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiResponse({
    status: 201,
    description: 'The admin user has been successfully created.',
    type: UserDto,
  })
  @HttpCode(HttpStatus.CREATED)
  createAdmin(@Body() createAdminUserDto: CreateAdminUserDto) {
    return this.userService.create(createAdminUserDto, Role.ADMIN);
  }
}
