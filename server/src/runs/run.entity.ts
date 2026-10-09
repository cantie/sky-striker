import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import type { ObjectiveId } from '../game/rules'

/** One finished attempt at a stage, as reported by a logged-in client. */
@Entity({ name: 'runs' })
@Index(['playerId', 'createdAt'])
export class Run {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'player_id', type: 'int' })
  playerId: number

  @Column({ name: 'stage_id', type: 'int' })
  stageId: number

  @Column({ type: 'int' })
  score: number

  @Column({ type: 'boolean' })
  won: boolean

  @Column({ name: 'gold_stars', type: 'int' })
  goldStars: number

  @Column({ type: 'simple-json' })
  objectives: ObjectiveId[]

  @Column({ name: 'plane_id', type: 'varchar', length: 32 })
  planeId: string

  @Column({ type: 'int', default: 0 })
  kills: number

  @Column({ type: 'int', default: 0 })
  spawned: number

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
