import { Body, Controller, ForbiddenException, Get, Post } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { pilotName, type Player } from '../players/player.entity'
import { PlayersService } from '../players/players.service'
import { assertRedirectUri, KeycloakOidc } from './oidc'

class OidcLoginDto {
  @IsString() @MinLength(1) @MaxLength(4096) code: string
  @IsString() @MinLength(1) @MaxLength(2048) redirect_uri: string
  @IsString() @MinLength(43) @MaxLength(128) code_verifier: string
}

class LocalLoginDto {
  @IsString() @Matches(/^[A-Za-z0-9_.-]{3,24}$/) username: string
}

export const localLoginEnabled = () => process.env.LOCAL_LOGIN?.trim().toLowerCase() === 'true'

@Controller()
export class AuthController {
  constructor(
    private readonly oidc: KeycloakOidc,
    private readonly players: PlayersService,
    private readonly jwt: JwtService,
  ) {}

  /** Public runtime config for the client, so one build works in every environment. */
  @Get('config')
  config() {
    const issuer = process.env.KEYCLOAK_ISSUER?.trim().replace(/\/$/, '')
    const clientId = process.env.KEYCLOAK_CLIENT_ID?.trim()
    return {
      keycloak: this.oidc.isConfigured() && issuer && clientId ? { issuer, clientId } : null,
      localLogin: localLoginEnabled(),
    }
  }

  @Post('auth/oidc')
  async loginOidc(@Body() dto: OidcLoginDto) {
    assertRedirectUri(dto.redirect_uri, process.env.KEYCLOAK_REDIRECT_URIS)
    const identity = await this.oidc.exchangeCode({ code: dto.code, redirectUri: dto.redirect_uri, codeVerifier: dto.code_verifier })
    return this.session(await this.players.upsertFromIdentity(identity))
  }

  /** Dev/test login without Keycloak (only when LOCAL_LOGIN=true). */
  @Post('auth/local')
  async loginLocal(@Body() dto: LocalLoginDto) {
    if (!localLoginEnabled()) throw new ForbiddenException('Local login is disabled')
    const name = dto.username
    return this.session(await this.players.upsertFromIdentity({ sub: `local:${name.toLowerCase()}`, username: name, email: null, displayName: name }))
  }

  private session(player: Player) {
    return { access_token: this.jwt.sign({ sub: player.id }), user: { id: player.id, name: pilotName(player) } }
  }
}
