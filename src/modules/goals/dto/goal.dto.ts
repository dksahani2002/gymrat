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
import { GoalStatus, GoalType } from '../../../domain/goal/goal.enums';

export class CreateGoalDto {
  @ApiProperty({ enum: GoalType })
  @IsEnum(GoalType)
  type!: GoalType;

  @ApiProperty({ example: 'Bench 100kg' })
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  targetValue?: number;

  @ApiPropertyOptional({ example: 'KG' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  targetUnit?: string;

  @ApiPropertyOptional({ description: 'Required for STRENGTH goals' })
  @IsOptional()
  @IsUUID()
  exerciseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  targetDate?: string;
}

export class UpdateGoalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  targetValue?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  targetUnit?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  exerciseId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  targetDate?: string | null;

  @ApiPropertyOptional({ enum: GoalStatus })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;
}

export class ListGoalsQueryDto {
  @ApiPropertyOptional({ enum: GoalStatus })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  @ApiPropertyOptional({ enum: GoalType })
  @IsOptional()
  @IsEnum(GoalType)
  type?: GoalType;

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
