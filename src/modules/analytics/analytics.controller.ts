import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  AnalyticsApplicationService,
  ChartType,
} from '../../application/analytics/analytics.application-service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../shared/decorators/current-user.decorator';
import {
  AnalyticsRangeQueryDto,
  ChartQueryDto,
  ChartTypeDto,
  ConsistencyQueryDto,
  Estimated1rmQueryDto,
  MuscleVolumeQueryDto,
  VolumeQueryDto,
} from './dto/analytics.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsApplicationService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Streak, frequency, and volume summary' })
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.overview(user.id);
  }

  @Get('volume')
  @ApiOperation({ summary: 'Volume series by day/week/month/year' })
  volume(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: VolumeQueryDto,
  ) {
    return this.analytics.volumeSeries({
      userId: user.id,
      from: query.from.slice(0, 10),
      to: query.to.slice(0, 10),
      period: query.period,
    });
  }

  @Get('volume/exercise/:exerciseId')
  @ApiOperation({ summary: 'Exercise volume series' })
  exerciseVolume(
    @CurrentUser() user: AuthenticatedUser,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
    @Query() query: AnalyticsRangeQueryDto,
  ) {
    return this.analytics.exerciseVolume({
      userId: user.id,
      exerciseId,
      from: query.from.slice(0, 10),
      to: query.to.slice(0, 10),
    });
  }

  @Get('volume/muscle')
  @ApiOperation({ summary: 'Muscle volume breakdown or series' })
  muscleVolume(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MuscleVolumeQueryDto,
  ) {
    return this.analytics.muscleVolume({
      userId: user.id,
      from: query.from.slice(0, 10),
      to: query.to.slice(0, 10),
      series: query.series === 'true' || query.series === '1',
    });
  }

  @Get('estimated-1rm')
  @ApiOperation({ summary: 'Estimated 1RM series for an exercise' })
  estimated1rm(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Estimated1rmQueryDto,
  ) {
    return this.analytics.estimated1rm({
      userId: user.id,
      exerciseId: query.exerciseId,
      from: query.from.slice(0, 10),
      to: query.to.slice(0, 10),
    });
  }

  @Get('frequency')
  @ApiOperation({ summary: 'Training frequency over a range' })
  frequency(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsRangeQueryDto,
  ) {
    return this.analytics.frequency({
      userId: user.id,
      from: query.from.slice(0, 10),
      to: query.to.slice(0, 10),
    });
  }

  @Get('consistency')
  @ApiOperation({ summary: 'Consistency score (trained / target days)' })
  consistency(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ConsistencyQueryDto,
  ) {
    return this.analytics.consistency({
      userId: user.id,
      from: query.from?.slice(0, 10),
      to: query.to?.slice(0, 10),
      targetDays: query.targetDays,
    });
  }

  @Get('duration')
  @ApiOperation({ summary: 'Workout duration series' })
  duration(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsRangeQueryDto,
  ) {
    return this.analytics.duration({
      userId: user.id,
      from: query.from.slice(0, 10),
      to: query.to.slice(0, 10),
    });
  }

  @Get('charts/:chartType')
  @ApiOperation({ summary: 'Normalized chart payload' })
  @ApiParam({ name: 'chartType', enum: ChartTypeDto })
  charts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('chartType') chartType: ChartType,
    @Query() query: ChartQueryDto,
  ) {
    return this.analytics.chart({
      userId: user.id,
      chartType,
      from: query.from.slice(0, 10),
      to: query.to.slice(0, 10),
      interval: query.interval,
      exerciseId: query.exerciseId,
    });
  }
}
