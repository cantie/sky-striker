import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { DataSource } from 'typeorm'

/** Liveness/readiness for the container platform (Docker HEALTHCHECK, Dokploy). */
@Controller('health')
export class HealthController {
  constructor(private readonly db: DataSource) {}

  @Get()
  async health() {
    try {
      await this.db.query('SELECT 1')
    } catch {
      throw new ServiceUnavailableException({ ok: false, db: 'down' })
    }
    return { ok: true }
  }
}
