import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common"
import { Repository } from "typeorm"
import { JwtService } from "@nestjs/jwt"
import { ConfigService } from "@nestjs/config"
import { User, UserRole } from "../entities/user.entity"
import { RegisterDto } from "../dto/register.dto"
import { AuthResponseDto } from "../dto/auth-response.dto"
import { LoginDto } from "../dto/login.dto"
import { UpdateProfileDto } from "../dto/update-profile.dto"
import { ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from "../dto/reset-password.dto"
import { WalletConnectDto, WalletAuthResponseDto } from "../dto/wallet-auth.dto"
import * as crypto from "crypto"
import { ethers } from "ethers"
import { InjectRepository } from "@nestjs/typeorm"

export interface JwtPayload {
  sub: string // user id
  email?: string
  name?: string
  username?: string
  role: UserRole
  walletAddress?: string
  iat?: number
  exp?: number
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { name, username, email, password } = registerDto

    try {
      // Check if user already exists
      const existingUser = await this.userRepository.findOne({
        where: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
      })

      if (existingUser) {
        throw new ConflictException("User with this email or username already exists")
      }

      // Create new user
      const user = this.userRepository.create({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        email: email.toLowerCase(),
        password,
        role: UserRole.PLAYER,
        emailVerificationToken: crypto.randomBytes(32).toString("hex"),
      })

      const savedUser = await this.userRepository.save(user)

      // Generate JWT token
      const payload: JwtPayload = {
        sub: savedUser.id,
        email: savedUser.email,
        name: savedUser.name,
        username: savedUser.username,
        role: savedUser.role,
      }

      const accessToken = this.jwtService.sign(payload)
      const expiresIn = this.getTokenExpirationTime()

      return {
        accessToken,
        tokenType: "Bearer",
        expiresIn,
        user: {
          id: savedUser.id,
          name: savedUser.name,
          email: savedUser.email,
          createdAt: savedUser.createdAt,
        },
      }
    } catch (error) {
      console.error("Registration error:", error)

      if (error instanceof ConflictException) {
        throw error
      }

      if (error.code === "23505") {
        // PostgreSQL unique violation
        throw new ConflictException("User with this email or username already exists")
      }

      throw new BadRequestException(`Failed to create user account: ${error.message}`)
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto

    try {
      // Find user by email
      const user = await this.userRepository.findOne({
        where: { email: email.toLowerCase() },
      })

      if (!user) {
        throw new UnauthorizedException("Invalid email or password")
      }

      // Check if account is locked
      if (user.isLocked) {
        throw new UnauthorizedException("Account is temporarily locked due to too many failed login attempts")
      }

      // Check if user is active
      if (!user.isActive) {
        throw new UnauthorizedException("Account has been deactivated")
      }

      // Validate password
      const isPasswordValid = await user.validatePassword(password)
      if (!isPasswordValid) {
        // Increment failed login attempts
        await user.incrementLoginAttempts()
        await this.userRepository.save(user)
        throw new UnauthorizedException("Invalid email or password")
      }

      // Reset login attempts on successful login
      user.resetLoginAttempts()

      // Update last login time
      await this.userRepository.update(user.id, {
        lastLoginAt: new Date(),
        loginAttempts: 0,
        lockUntil: null,
      })

      // Generate JWT token
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
        walletAddress: user.walletAddress,
      }

      const accessToken = this.jwtService.sign(payload)
      const expiresIn = this.getTokenExpirationTime()

      return {
        accessToken,
        tokenType: "Bearer",
        expiresIn,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
      }
    } catch (error) {
      console.error("Login error:", error)

      if (error instanceof UnauthorizedException) {
        throw error
      }

      throw new BadRequestException(`Login failed: ${error.message}`)
    }
  }

  async connectWallet(walletConnectDto: WalletConnectDto): Promise<WalletAuthResponseDto> {
    const { walletAddress, signature, message, email, username } = walletConnectDto

    try {
      // Verify the signature
      const isValidSignature = await this.verifyWalletSignature(walletAddress, message, signature)
      if (!isValidSignature) {
        throw new UnauthorizedException("Invalid wallet signature")
      }

      // Check if user already exists with this wallet
      let user = await this.userRepository.findOne({
        where: { walletAddress: walletAddress.toLowerCase() },
      })

      let isNewUser = false

      if (!user) {
        // Create new user with wallet
        isNewUser = true
        const defaultUsername = username?.toLowerCase() || `user_${Date.now()}`
        const defaultName = username || `User ${walletAddress.slice(0, 6)}`

        user = this.userRepository.create({
          walletAddress: walletAddress.toLowerCase(),
          email: email?.toLowerCase(),
          username: defaultUsername,
          name: defaultName,
          role: UserRole.PLAYER,
        })
        user = await this.userRepository.save(user)
      } else {
        // Update last login
        await this.userRepository.update(user.id, {
          lastLoginAt: new Date(),
        })
      }

      // Generate JWT token
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
        walletAddress: user.walletAddress,
      }

      const accessToken = this.jwtService.sign(payload)
      const expiresIn = this.getTokenExpirationTime()

      return {
        accessToken,
        tokenType: "Bearer",
        expiresIn,
        isNewUser,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          walletAddress: user.walletAddress,
          createdAt: user.createdAt,
        },
      }
    } catch (error) {
      console.error("Wallet authentication error:", error)

      if (error instanceof UnauthorizedException) {
        throw error
      }

      throw new BadRequestException(`Wallet authentication failed: ${error.message}`)
    }
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto): Promise<User> {
    const user = await this.getUserById(userId)

    // Check if email or username already exists (excluding current user)
    if (updateProfileDto.email || updateProfileDto.username) {
      const conditions = []
      if (updateProfileDto.email) {
        conditions.push({ email: updateProfileDto.email.toLowerCase() })
      }
      if (updateProfileDto.username) {
        conditions.push({ username: updateProfileDto.username.toLowerCase() })
      }

      const existingUser = await this.userRepository
        .createQueryBuilder("user")
        .where("user.id != :userId", { userId })
        .andWhere("(user.email = :email OR user.username = :username)", {
          email: updateProfileDto.email?.toLowerCase(),
          username: updateProfileDto.username?.toLowerCase(),
        })
        .getOne()

      if (existingUser) {
        throw new ConflictException("Email or username already exists")
      }
    }

    // Update user fields
    if (updateProfileDto.name) user.name = updateProfileDto.name.trim()
    if (updateProfileDto.email) user.email = updateProfileDto.email.toLowerCase()
    if (updateProfileDto.username) user.username = updateProfileDto.username.toLowerCase()

    return await this.userRepository.save(user)
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const user = await this.getUserById(userId)

    if (!user.password) {
      throw new BadRequestException("Cannot change password for wallet-only accounts")
    }

    // Verify current password
    const isCurrentPasswordValid = await user.validatePassword(changePasswordDto.currentPassword)
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException("Current password is incorrect")
    }

    // Update password
    user.password = changePasswordDto.newPassword
    await this.userRepository.save(user)
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email: forgotPasswordDto.email.toLowerCase() },
    })

    if (!user) {
      // Don't reveal whether email exists
      return
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    user.passwordResetToken = resetToken
    user.passwordResetExpires = resetExpires
    await this.userRepository.save(user)

    // TODO: Send email with reset token
    console.log(`Password reset token for ${user.email}: ${resetToken}`)
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const user = await this.userRepository.findOne({
      where: {
        passwordResetToken: resetPasswordDto.token,
      },
    })

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new BadRequestException("Invalid or expired reset token")
    }

    // Update password and clear reset token
    user.password = resetPasswordDto.newPassword
    user.passwordResetToken = null
    user.passwordResetExpires = null
    await this.userRepository.save(user)
  }

  async validateUser(payload: JwtPayload): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    })

    if (!user || !user.isActive) {
      throw new UnauthorizedException("User not found or inactive")
    }

    return user
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
    })

    if (!user) {
      throw new NotFoundException("User not found")
    }

    return user
  }

  async getAllUsers(): Promise<User[]> {
    return await this.userRepository.find({
      order: { createdAt: "DESC" },
    })
  }

  async updateUserRole(userId: string, role: UserRole): Promise<User> {
    const user = await this.getUserById(userId)
    user.role = role
    return await this.userRepository.save(user)
  }

  async deactivateUser(userId: string): Promise<void> {
    await this.userRepository.update(userId, { isActive: false })
  }

  async activateUser(userId: string): Promise<void> {
    await this.userRepository.update(userId, { isActive: true })
  }

  private async verifyWalletSignature(walletAddress: string, message: string, signature: string): Promise<boolean> {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature)
      return recoveredAddress.toLowerCase() === walletAddress.toLowerCase()
    } catch (error) {
      console.error("Signature verification error:", error)
      return false
    }
  }

  private getTokenExpirationTime(): number {
    const expiresIn = this.configService.get("JWT_EXPIRES_IN") || "15m"

    // Convert time string to seconds
    if (typeof expiresIn === "string") {
      const timeValue = Number.parseInt(expiresIn)
      const timeUnit = expiresIn.slice(-1)

      switch (timeUnit) {
        case "s":
          return timeValue
        case "m":
          return timeValue * 60
        case "h":
          return timeValue * 60 * 60
        case "d":
          return timeValue * 24 * 60 * 60
        default:
          return 900 // 15 minutes default
      }
    }

    return typeof expiresIn === "number" ? expiresIn : 900
  }
}
