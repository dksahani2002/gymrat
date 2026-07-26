import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PrType } from '../../../domain/personal-record/pr-type.enum';

export class ListPersonalRecordsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  exerciseId?: string;

  @ApiPropertyOptional({ enum: PrType })
  @IsOptional()
  @IsEnum(PrType)
  type?: PrType;

  @ApiPropertyOptional({ description: 'ISO date lower bound (achievedAt)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date upper bound (achievedAt)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cursor?: string;
}
