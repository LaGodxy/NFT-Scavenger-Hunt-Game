import { ApiProperty } from "@nestjs/swagger"
import { IsEmail, IsString, IsNotEmpty, MinLength, Matches } from "class-validator"

export class ForgotPasswordDto {
  @ApiProperty({
    description: "User email address",
    example: "john.doe@example.com",
  })
  @IsEmail({}, { message: "Please provide a valid email address" })
  @IsNotEmpty()
  email: string
}

export class ResetPasswordDto {
  @ApiProperty({
    description: "Password reset token",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  @IsString()
  @IsNotEmpty()
  token: string

  @ApiProperty({
    description: "New password",
    example: "NewSecurePass123!",
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
  })
  newPassword: string
}

export class ChangePasswordDto {
  @ApiProperty({
    description: "Current password",
    example: "CurrentPass123!",
  })
  @IsString()
  @IsNotEmpty()
  currentPassword: string

  @ApiProperty({
    description: "New password",
    example: "NewSecurePass123!",
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
  })
  newPassword: string
}
