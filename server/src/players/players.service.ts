import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { OidcIdentity } from '../auth/oidc'
import { Player } from './player.entity'

@Injectable()
export class PlayersService {
  constructor(@InjectRepository(Player) private readonly players: Repository<Player>) {}

  /** Create the account on first login; refresh name/email on every login. */
  async upsertFromIdentity(identity: OidcIdentity): Promise<Player> {
    const existing = await this.players.findOne({ where: { sub: identity.sub } })
    const player = existing ?? this.players.create({ sub: identity.sub })
    player.username = identity.username
    player.displayName = identity.displayName
    player.email = identity.email
    player.lastLoginAt = new Date()
    return this.players.save(player)
  }

  findById(id: number): Promise<Player | null> {
    return this.players.findOne({ where: { id } })
  }
}
