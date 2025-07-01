import { ApiProperty } from "@nestjs/swagger"
import { IsString, IsNotEmpty, IsOptional } from "class-validator"

export class WalletConnectDto {
  @ApiProperty({
    description: "Wallet address",
    example: "0x742d35Cc6634C0532925a3b8D6Ac17c2db3c2DfF",
  })
  @IsString()
  @IsNotEmpty()
  walletAddress: string

  @ApiProperty({
    description: "Signature from wallet",
    example: "0x123...abc",
  })
  @IsString()
  @IsNotEmpty()
  signature: string

  @ApiProperty({
    description: "Message that was signed",
    example: "Sign this message to authenticate with NFT Scavenger Hunt",
  })
  @IsString()
  @IsNotEmpty()
  message: string

  @ApiProperty({
    description: "Optional user email for account linking",
    required: false,
  })
  @IsOptional()
  @IsString()
  email?: string

  @ApiProperty({
    description: "Optional username",
    required: false,
  })
  @IsOptional()
  @IsString()
  username?: string
}

export class WalletAuthResponseDto {
  @ApiProperty({
    description: "JWT access token",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  accessToken: string

  @ApiProperty({
    description: "Token type",
    example: "Bearer",
  })
  tokenType: string

  @ApiProperty({
    description: "Token expiration time in seconds",
    example: 900,
  })
  expiresIn: number

  @ApiProperty({
    description: "Whether this is a new user",
    example: false,
  })
  isNewUser: boolean

  @ApiProperty({
    description: "User information",
  })
  user: {
    id: string
    name?: string
    email?: string
    username?: string
    walletAddress: string
    createdAt: Date
  }
}
