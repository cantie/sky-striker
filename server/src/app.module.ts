import { join } from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { ServeStaticModule } from '@nestjs/serve-static'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthController } from './auth/auth.controller'
import { AuthGuard } from './auth/auth.guard'
import { KeycloakOidc } from './auth/oidc'
import { LeaderboardController, LeaderboardService } from './leaderboard/leaderboard'
import { Init1760000000000 } from './migrations/1760000000000-Init'
import { Player } from './players/player.entity'
import { PlayersService } from './players/players.service'
import { MeController } from './progress/me.controller'
import { PlayerProgress } from './progress/progress.entity'
import { ProgressService } from './progress/progress.service'
import { Run } from './runs/run.entity'
import { RunsController } from './runs/runs.controller'
import { RunsService } from './runs/runs.service'

const entities = [Player, PlayerProgress, Run]

/** Built game (vite `dist/`). In the Docker image it is copied to CLIENT_DIR. */
const clientDir = process.env.CLIENT_DIR?.trim() || join(__dirname, '..', '..', 'dist')

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'mysql' as const,
        url: process.env.MYSQL_URL,
        charset: 'utf8mb4',
        entities,
        migrations: [Init1760000000000],
        // Schema is owned by migrations; they run on every boot (idempotent)
        migrationsRun: true,
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature(entities),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN?.trim() || '30d') as `${number}d` },
      }),
    }),
    // The game itself, same origin as /api — one deploy serves both
    ServeStaticModule.forRoot({ rootPath: clientDir, exclude: ['/api/{*path}'] }),
  ],
  controllers: [AuthController, MeController, RunsController, LeaderboardController],
  providers: [KeycloakOidc, AuthGuard, PlayersService, ProgressService, RunsService, LeaderboardService],
})
export class AppModule {}
