import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProgressiveOverloadApplicationService } from '../../application/progressive-overload/progressive-overload.application-service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../shared/decorators/current-user.decorator';

@ApiTags('recommendations')
@ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly overload: ProgressiveOverloadApplicationService,
  ) {}

  @Get('overload')
  @ApiOperation({
    summary: 'Next-session overload suggestions for recent exercises',
  })
  @ApiResponse({ status: 200, description: 'List of overload recommendations' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.overload.listForUser(user.id);
  }

  @Get('overload/:exerciseId')
  @ApiOperation({ summary: 'Overload suggestion for one exercise' })
  @ApiResponse({ status: 200, description: 'Single exercise recommendation' })
  @ApiResponse({ status: 404, description: 'Exercise not found' })
  one(
    @CurrentUser() user: AuthenticatedUser,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
  ) {
    return this.overload.getForExercise(user.id, exerciseId);
  }
}
