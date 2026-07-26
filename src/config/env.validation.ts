import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsString()
  NODE_ENV!: string;

  @IsInt()
  @Min(1)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  API_PREFIX!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN!: string;

  @IsInt()
  @Min(1)
  JWT_REFRESH_EXPIRES_DAYS!: number;

  @IsString()
  @IsNotEmpty()
  GOOGLE_CLIENT_IDS!: string;

  @IsUrl({ require_tld: false })
  APP_URL!: string;

  @IsUrl({ require_tld: false })
  FRONTEND_URL!: string;

  @IsString()
  @IsNotEmpty()
  MAIL_FROM!: string;

  @IsOptional()
  @IsBoolean()
  MAIL_LOG_RESET_TOKENS?: boolean;

  @IsInt()
  @Min(1000)
  THROTTLE_TTL_MS!: number;

  @IsInt()
  @Min(1)
  THROTTLE_LIMIT!: number;

  @IsInt()
  @Min(1)
  AUTH_THROTTLE_LIMIT!: number;
}

/**
 * Validates process env at bootstrap. Fails fast on misconfiguration.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  return validated;
}
