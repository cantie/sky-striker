import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsString, MaxLength } from 'class-validator'
import { AuthGuard, PlayerId } from '../auth/auth.guard'
import { RunsService } from './runs.service'

class RunDto {
  @IsInt() stageId: number
  @IsInt() score: number
  @IsBoolean() won: boolean
  @IsInt() goldStars: number
  @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) earned: string[]
  @IsString() @MaxLength(32) planeId: string
  @IsInt() kills: number
  @IsInt() spawned: number
}

@Controller('runs')
@UseGuards(AuthGuard)
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Post()
  async submit(@PlayerId() playerId: number, @Body() dto: RunDto) {
    return { progress: await this.runs.submit(playerId, dto) }
  }
}
