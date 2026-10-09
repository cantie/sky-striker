import 'reflect-metadata'
import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

const REQUIRED = ['MYSQL_URL', 'JWT_SECRET']

async function bootstrap() {
  const missing = REQUIRED.filter((k) => !process.env[k]?.trim())
  if (missing.length) throw new Error(`Missing required env: ${missing.join(', ')}`)

  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  // Same-origin by default (the API serves the game); CORS only for split dev setups
  const cors = process.env.CORS_ORIGIN?.trim()
  if (cors) app.enableCors({ origin: cors.split(',').map((o) => o.trim()) })

  const port = Number(process.env.PORT) || 3100
  await app.listen(port)
  Logger.log(`Sky Striker server on :${port}`, 'Bootstrap')
}
void bootstrap()
