import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { BodyMeasurementApplicationService } from '../../application/body-measurement/body-measurement.application-service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../shared/decorators/current-user.decorator';
import {
  CreateBodyMeasurementDto,
  ListBodyMeasurementQueryDto,
} from './dto/measurement.dto';

type RequestWithMeta = Request & { requestId?: string };

@ApiTags('measurements')
@ApiBearerAuth()
@Controller('measurements')
export class MeasurementsController {
  constructor(
    private readonly measurements: BodyMeasurementApplicationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Log body circumference measurements (cm)' })
  @ApiResponse({ status: 201, description: 'Created entry' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBodyMeasurementDto,
    @Req() req: RequestWithMeta,
  ) {
    return this.measurements.create({
      userId: user.id,
      measurements: dto.measurements,
      recordedAt: dto.recordedAt,
      notes: dto.notes,
      context: this.contextFrom(req),
    });
  }

  @Get()
  @ApiOperation({ summary: 'List measurement history' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListBodyMeasurementQueryDto,
  ) {
    return this.measurements.list({
      userId: user.id,
      from: query.from,
      to: query.to,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a measurement entry' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithMeta,
  ): Promise<void> {
    await this.measurements.softDelete(user.id, id, this.contextFrom(req));
  }

  private contextFrom(req: RequestWithMeta) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
    };
  }
}
