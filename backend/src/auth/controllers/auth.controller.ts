import { Controller, Post, Get, Put, UseGuards, HttpStatus, HttpCode, Param } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from "@nestjs/swagger"
import { AuthService } from "../services/auth.service"
import { Auth } from "../decorators/auth-decorator"
import { AuthType } from "../enums/auth-type.enum"
import { AuthResponseDto } from "../dto/auth-response.dto"
import { RegisterDto } from "../dto/register.dto"
import { LoginDto } from "../dto/login.dto"
import { UpdateProfileDto } from "../dto/update-profile.dto"
import { ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from "../dto/reset-password.dto"
import { WalletConnectDto, WalletAuthResponseDto } from "../dto/wallet-auth.dto"
import { JwtAuthGuard } from "../guards/jwt-auth.guard"
import { User, UserRole } from "../entities/user.entity"
import { CurrentUser } from "../decorators/current-user.decorator"
import { RolesGuard } from "../guards/roles.guard"
import { Roles } from "../decorators/roles.decorator"

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Auth(AuthType.None)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Register a new user",
    description: "Create a new user account with email and password. Password will be securely hashed.",
  })
  @ApiResponse({
    status: 201,
    description: "User successfully registered",
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - validation failed",
  })
  @ApiResponse({
    status: 409,
    description: "Conflict - user already exists",
  })
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    return await this.authService.register(registerDto)
  }

  @Post("login")
  @Auth(AuthType.None)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "User login",
    description: "Authenticate user with email and password, returns JWT access token",
  })
  @ApiResponse({
    status: 200,
    description: "Login successful",
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - invalid credentials",
  })
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    return await this.authService.login(loginDto)
  }

  @Post("wallet/connect")
  @Auth(AuthType.None)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Connect wallet for authentication",
    description: "Authenticate user using wallet signature (StarkNet/Ethereum compatible)",
  })
  @ApiResponse({
    status: 200,
    description: "Wallet authentication successful",
    type: WalletAuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Invalid wallet signature",
  })
  async connectWallet(walletConnectDto: WalletConnectDto): Promise<WalletAuthResponseDto> {
    return await this.authService.connectWallet(walletConnectDto)
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get current user profile',
    description: 'Retrieve the profile information of the currently authenticated user'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile retrieved successfully' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - invalid or expired token' 
  })
  async getProfile(@CurrentUser() user: User) {
    const { password, passwordResetToken, passwordResetExpires, emailVerificationToken, ...userProfile } = user;
    return {
      message: 'Profile retrieved successfully',
      user: userProfile,
    };
  }

  @Put("profile")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update user profile",
    description: "Update the profile information of the currently authenticated user",
  })
  @ApiResponse({
    status: 200,
    description: "Profile updated successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - invalid or expired token",
  })
  @ApiResponse({
    status: 409,
    description: "Conflict - email or username already exists",
  })
  async updateProfile(@CurrentUser() user: User, updateProfileDto: UpdateProfileDto) {
    const updatedUser = await this.authService.updateProfile(user.id, updateProfileDto)
    const { password, passwordResetToken, passwordResetExpires, emailVerificationToken, ...userProfile } = updatedUser
    return {
      message: "Profile updated successfully",
      user: userProfile,
    }
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Change user password",
    description: "Change the password for the currently authenticated user",
  })
  @ApiResponse({
    status: 200,
    description: "Password changed successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - invalid current password",
  })
  async changePassword(@CurrentUser() user: User, changePasswordDto: ChangePasswordDto) {
    await this.authService.changePassword(user.id, changePasswordDto)
    return {
      message: "Password changed successfully",
    }
  }

  @Post("forgot-password")
  @Auth(AuthType.None)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Request password reset",
    description: "Send password reset email to user",
  })
  @ApiResponse({
    status: 200,
    description: "Password reset email sent (if email exists)",
  })
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    await this.authService.forgotPassword(forgotPasswordDto)
    return {
      message: "If the email exists, a password reset link has been sent",
    }
  }

  @Post("reset-password")
  @Auth(AuthType.None)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Reset password",
    description: "Reset user password using reset token",
  })
  @ApiResponse({
    status: 200,
    description: "Password reset successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid or expired reset token",
  })
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    await this.authService.resetPassword(resetPasswordDto)
    return {
      message: "Password reset successfully",
    }
  }

  @Post('validate-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Validate JWT token',
    description: 'Check if the provided JWT token is valid and not expired'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token is valid' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Token is invalid or expired' 
  })
  async validateToken(@CurrentUser() user: User) {
    return {
      message: 'Token is valid',
      valid: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        walletAddress: user.walletAddress,
      },
    };
  }

  // Admin endpoints
  @Get("admin/users")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get all users (Admin only)",
    description: "Retrieve all users in the system",
  })
  @ApiResponse({
    status: 200,
    description: "Users retrieved successfully",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - admin access required",
  })
  async getAllUsers() {
    const users = await this.authService.getAllUsers()
    return {
      message: "Users retrieved successfully",
      users: users.map((user) => {
        const { password, passwordResetToken, passwordResetExpires, emailVerificationToken, ...userInfo } = user
        return userInfo
      }),
    }
  }

  @Put("admin/users/:id/role")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiParam({ name: "id", description: "User ID" })
  @ApiOperation({
    summary: "Update user role (Admin only)",
    description: "Update the role of a specific user",
  })
  @ApiResponse({
    status: 200,
    description: "User role updated successfully",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - admin access required",
  })
  async updateUserRole(@Param('id') userId: string, body: { role: UserRole }) {
    const updatedUser = await this.authService.updateUserRole(userId, body.role)
    const { password, passwordResetToken, passwordResetExpires, emailVerificationToken, ...userInfo } = updatedUser
    return {
      message: "User role updated successfully",
      user: userInfo,
    }
  }

  @Put('admin/users/:id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiOperation({ 
    summary: 'Deactivate user (Admin only)',
    description: 'Deactivate a specific user account'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User deactivated successfully' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - admin access required' 
  })
  async deactivateUser(@Param('id') userId: string) {
    await this.authService.deactivateUser(userId);
    return {
      message: 'User deactivated successfully',
    };
  }

  @Put('admin/users/:id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiOperation({ 
    summary: 'Activate user (Admin only)',
    description: 'Activate a specific user account'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User activated successfully' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - admin access required' 
  })
  async activateUser(@Param('id') userId: string) {
    await this.authService.activateUser(userId);
    return {
      message: 'User activated successfully',
    };
  }
}
