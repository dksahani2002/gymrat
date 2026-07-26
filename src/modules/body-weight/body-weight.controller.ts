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
import { BodyWeightApplicationService } from '../../application/body-weight/body-weight.application-service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../shared/decorators/current-user.decorator';
import {
  CreateBodyWeightDto,
  ListBodyWeightQueryDto,
} from './dto/body-weight.dto';

type RequestWithMeta = Request & { requestId?: string };

@ApiTags('body-weight')
@ApiBearerAuth()
@Controller('body-weight')
export class BodyWeightController {
  constructor(private readonly bodyWeight: BodyWeightApplicationService) {}

  @Post()
  @ApiOperation({ summary: 'Log a body weight entry' })
  @ApiResponse({ status: 201, description: 'Created entry' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBodyWeightDto,
    @Req() req: RequestWithMeta,
  ) {
    return this.bodyWeight.create({
      userId: user.id,
      weight: dto.weight,
      unit: dto.unit,
      recordedAt: dto.recordedAt,
      notes: dto.notes,
      context: this.contextFrom(req),
    });
  }

  @Get()
  @ApiOperation({ summary: 'List body weight history' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListBodyWeightQueryDto,
  ) {
    return this.bodyWeight.list({
      userId: user.id,
      from: query.from,
      to: query.to,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a body weight entry' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithMeta,
  ): Promise<void> {
    await this.bodyWeight.softDelete(user.id, id, this.contextFrom(req));
  }

  private contextFrom(req: RequestWithMeta) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
    };
  }
}
