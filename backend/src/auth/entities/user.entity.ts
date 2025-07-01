import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  Index,
} from "typeorm"
import { Exclude } from "class-transformer"
import * as bcrypt from "bcrypt"

export enum UserRole {
  PLAYER = "player",
  ADMIN = "admin",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ length: 100, nullable: true }) 
  name: string

  @Column({ length: 20, nullable: true })
  username: string

  @Column({ length: 255, nullable: true })
  email: string

  @Column({ nullable: true })
  @Exclude()
  password?: string

  @Column({ unique: true, nullable: true, length: 42 })
  @Index()
  walletAddress?: string

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.PLAYER,
  })
  role: UserRole

  @Column({ default: true })
  isActive: boolean

  @Column({ default: false })
  isEmailVerified: boolean

  @Column({ nullable: true })
  @Exclude()
  passwordResetToken?: string

  @Column({ nullable: true })
  @Exclude()
  passwordResetExpires?: Date

  @Column({ nullable: true })
  @Exclude()
  emailVerificationToken?: string

  @Column({ nullable: true })
  lastLoginAt?: Date

  @Column({ nullable: true })
  lastLoginIp?: string

  @Column({ default: 0 })
  loginAttempts: number

  @Column({ nullable: true })
  lockUntil?: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @BeforeInsert()
  async setDefaultName() {
    // Set default name if not provided
    if (!this.name && this.username) {
      this.name = this.username
    }
  }

  @BeforeInsert()
  async hashPasswordBeforeInsert() {
    if (this.password) {
      const saltRounds = 12
      this.password = await bcrypt.hash(this.password, saltRounds)
    }
  }

  @BeforeUpdate()
  async hashPasswordBeforeUpdate() {
    // Only hash if password has been modified and is not already hashed
    if (this.password && !this.password.startsWith("$2b$")) {
      const saltRounds = 12
      this.password = await bcrypt.hash(this.password, saltRounds)
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    if (!this.password) return false
    try {
      return await bcrypt.compare(password, this.password)
    } catch (error) {
      console.error("Password validation error:", error)
      return false
    }
  }

  get isLocked(): boolean {
    return !!(this.lockUntil && this.lockUntil > new Date())
  }

  async incrementLoginAttempts(): Promise<void> {
    // If we have a previous lock that has expired, restart at 1
    if (this.lockUntil && this.lockUntil < new Date()) {
      this.loginAttempts = 1
      this.lockUntil = null
    } else {
      this.loginAttempts += 1
      // Lock account after 5 failed attempts for 30 minutes
      if (this.loginAttempts >= 5) {
        this.lockUntil = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      }
    }
  }

  resetLoginAttempts(): void {
    this.loginAttempts = 0
    this.lockUntil = null
  }
}
