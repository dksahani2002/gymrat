import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CalendarRangeQueryDto {
  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-07-31' })
  @IsDateString()
  to!: string;
}

export class CreatePlannedWorkoutDto {
  @ApiProperty({ example: '2026-07-28' })
  @IsDateString()
  plannedDate!: string;

  @ApiPropertyOptional({ example: 'Push Day' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdatePlannedWorkoutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
