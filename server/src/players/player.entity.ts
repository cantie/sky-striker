import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/** A pilot account, keyed by the Keycloak subject (or `local:<name>` for dev logins). */
@Entity({ name: 'players' })
export class Player {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 255, unique: true })
  sub: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string | null

  @Column({ name: 'display_name', type: 'varchar', length: 255, nullable: true })
  displayName: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}

/** Public name shown on leaderboards (never the email). */
export function pilotName(p: Pick<Player, 'displayName' | 'username' | 'id'>): string {
  return p.displayName?.trim() || p.username?.trim() || `Pilot ${p.id}`
}
