import { Body, Controller, Get, NotFoundException, Param, Post, Put, UseGuards } from '@nestjs/common'
import { IsObject, IsString, MaxLength } from 'class-validator'
import { AuthGuard, PlayerId } from '../auth/auth.guard'
import { pilotName } from '../players/player.entity'
import { PlayersService } from '../players/players.service'
import { ProgressService } from './progress.service'

class MergeDto {
  @IsObject() progress: Record<string, unknown>
}

class SelectPlaneDto {
  @IsString() @MaxLength(32) planeId: string
}

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(
    private readonly players: PlayersService,
    private readonly progress: ProgressService,
  ) {}

  @Get()
  async me(@PlayerId() playerId: number) {
    const player = await this.players.findById(playerId)
    if (!player) throw new NotFoundException()
    const row = await this.progress.get(playerId)
    return { user: { id: player.id, name: pilotName(player) }, progress: row.data }
  }

  @Post('merge')
  async merge(@PlayerId() playerId: number, @Body() dto: MergeDto) {
    return { progress: await this.progress.merge(playerId, dto.progress) }
  }

  @Post('planes/:id/buy')
  async buy(@PlayerId() playerId: number, @Param('id') planeId: string) {
    return { progress: await this.progress.buyPlane(playerId, planeId) }
  }

  @Put('plane')
  async select(@PlayerId() playerId: number, @Body() dto: SelectPlaneDto) {
    return { progress: await this.progress.selectPlane(playerId, dto.planeId) }
  }
}
