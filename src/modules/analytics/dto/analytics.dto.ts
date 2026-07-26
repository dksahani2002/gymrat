import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export enum VolumePeriodDto {
  day = 'day',
  week = 'week',
  month = 'month',
  year = 'year',
}

export enum ChartTypeDto {
  volume_over_time = 'volume_over_time',
  muscle_volume_breakdown = 'muscle_volume_breakdown',
  muscle_volume_over_time = 'muscle_volume_over_time',
  frequency_heatmap = 'frequency_heatmap',
  e1rm_over_time = 'e1rm_over_time',
  body_weight_over_time = 'body_weight_over_time',
  duration_over_time = 'duration_over_time',
}

export class AnalyticsRangeQueryDto {
  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-07-26' })
  @IsDateString()
  to!: string;
}

export class VolumeQueryDto extends AnalyticsRangeQueryDto {
  @ApiPropertyOptional({ enum: VolumePeriodDto, default: VolumePeriodDto.day })
  @IsOptional()
  @IsEnum(VolumePeriodDto)
  period?: VolumePeriodDto;
}

export class MuscleVolumeQueryDto extends AnalyticsRangeQueryDto {
  @ApiPropertyOptional({
    description: 'If true, return daily series instead of breakdown',
  })
  @IsOptional()
  series?: string;
}

export class Estimated1rmQueryDto extends AnalyticsRangeQueryDto {
  @ApiProperty()
  @IsUUID()
  exerciseId!: string;
}

export class ConsistencyQueryDto {
  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-26' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 28 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  targetDays?: number;
}

export class ChartQueryDto extends AnalyticsRangeQueryDto {
  @ApiPropertyOptional({ enum: VolumePeriodDto })
  @IsOptional()
  @IsEnum(VolumePeriodDto)
  interval?: VolumePeriodDto;

  @ApiPropertyOptional({ description: 'Required for e1rm_over_time' })
  @IsOptional()
  @IsUUID()
  exerciseId?: string;
}
