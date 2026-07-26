import { IsDateString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RecomputeAnalyticsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    example: '2026-01-01',
    description: 'Inclusive local date YYYY-MM-DD',
  })
  @IsDateString()
  from!: string;

  @ApiProperty({
    example: '2026-07-26',
    description: 'Inclusive local date YYYY-MM-DD',
  })
  @IsDateString()
  to!: string;
}
