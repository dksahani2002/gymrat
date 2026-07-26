import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

enum WeightUnitDto {
  KG = 'KG',
  LB = 'LB',
}

export class CreateBodyWeightDto {
  @ApiProperty({ example: 82.5 })
  @IsNumber()
  @Min(0.1)
  @Max(500)
  weight!: number;

  @ApiPropertyOptional({ enum: WeightUnitDto, default: WeightUnitDto.KG })
  @IsOptional()
  @IsEnum(WeightUnitDto)
  unit?: WeightUnitDto;

  @ApiPropertyOptional({ description: 'ISO timestamp; defaults to now' })
  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ListBodyWeightQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 30 })
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
