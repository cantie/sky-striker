import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import type { SagaProgress } from './progress.logic'

/** One cloud save per player, plus denormalised leaderboard columns. */
@Entity({ name: 'player_progress' })
export class PlayerProgress {
  @PrimaryColumn({ name: 'player_id', type: 'int' })
  playerId: number

  /** Stored as text JSON so it works on both MySQL and MariaDB. */
  @Column({ type: 'simple-json' })
  data: SagaProgress

  @Index()
  @Column({ name: 'total_score', type: 'bigint', default: 0, transformer: { to: (v: number) => v, from: (v: string | number) => Number(v) } })
  totalScore: number

  @Index()
  @Column({ name: 'saga_stars', type: 'int', default: 0 })
  sagaStars: number

  /** Gold stars ever collected (spending in the hangar doesn't lower it). */
  @Index()
  @Column({ name: 'gold_stars_lifetime', type: 'int', default: 0 })
  goldStarsLifetime: number

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
