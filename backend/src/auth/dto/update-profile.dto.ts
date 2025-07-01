import { ApiProperty } from "@nestjs/swagger"
import { IsString, IsOptional, MinLength, MaxLength, IsEmail } from "class-validator"

export class UpdateProfileDto {
  @ApiProperty({
    description: "User full name",
    example: "John Doe",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Name must be at least 2 characters long" })
  @MaxLength(100, { message: "Name must not exceed 100 characters" })
  name?: string

  @ApiProperty({
    description: "Username",
    example: "john_doe_updated",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: "Username must be at least 3 characters long" })
  @MaxLength(20, { message: "Username must not exceed 20 characters" })
  username?: string

  @ApiProperty({
    description: "Email address",
    example: "john.updated@example.com",
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: "Please provide a valid email address" })
  email?: string
}
