import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'

export interface AuthedRequest extends Request {
  playerId?: number
}

/** Reads `Authorization: Bearer <jwt>`; returns the player id or null. */
export function playerIdFromRequest(jwt: JwtService, req: Request): number | null {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null
  try {
    const payload = jwt.verify<{ sub: number }>(token)
    return typeof payload.sub === 'number' ? payload.sub : null
  } catch {
    return null
  }
}

/** Requires a valid game JWT. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>()
    const id = playerIdFromRequest(this.jwt, req)
    if (id === null) throw new UnauthorizedException()
    req.playerId = id
    return true
  }
}

export const PlayerId = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().playerId as number)
