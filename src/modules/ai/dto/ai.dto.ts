import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ParseTextDto {
  @ApiProperty({ example: 'Bench 80kg 5x5 then incline db 30kg 3x10' })
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  text!: string;

  @ApiPropertyOptional({ enum: ['KG', 'LB'], default: 'KG' })
  @IsOptional()
  @IsEnum(['KG', 'LB'] as const)
  unitHint?: 'KG' | 'LB';

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;
}

export class ListParseLogsQueryDto {
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
