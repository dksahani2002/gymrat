import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MuscleRole } from '../../../domain/exercise/exercise.enums';

export class ListExercisesQueryDto {
  @ApiPropertyOptional({ description: 'Search by name, slug, or alias' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'push' })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  muscleGroupId?: string;

  @ApiPropertyOptional({ example: 'chest' })
  @IsOptional()
  @IsString()
  muscleGroupSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @ApiPropertyOptional({ description: 'Cursor for pagination (exercise id)' })
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ExerciseMuscleInputDto {
  @ApiProperty()
  @IsUUID()
  muscleGroupId!: string;

  @ApiProperty({ enum: MuscleRole, default: MuscleRole.PRIMARY })
  @IsEnum(MuscleRole)
  role!: MuscleRole;
}

export class CreateExerciseDto {
  @ApiProperty({ example: 'Cable Fly' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @ApiPropertyOptional({ type: [String], example: ['cable flyes'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  aliases?: string[];

  @ApiPropertyOptional({ type: [ExerciseMuscleInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExerciseMuscleInputDto)
  muscles?: ExerciseMuscleInputDto[];

  @ApiPropertyOptional({
    description:
      'Force custom (user-owned) exercise. Non-admins always create custom.',
  })
  @IsOptional()
  @IsBoolean()
  asCustom?: boolean;
}

export class UpdateExerciseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  equipmentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  aliases?: string[];

  @ApiPropertyOptional({ type: [ExerciseMuscleInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExerciseMuscleInputDto)
  muscles?: ExerciseMuscleInputDto[];
}
