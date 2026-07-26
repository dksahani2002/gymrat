import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { ConfigService } from '@nestjs/config';
import { AiLoggingApplicationService } from '../../application/ai-logging/ai-logging.application-service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../shared/decorators/current-user.decorator';
import { BusinessError } from '../../shared/errors/base.error';
import { ErrorCodes } from '../../shared/errors/error-codes';
import { ListParseLogsQueryDto, ParseTextDto } from './dto/ai.dto';

type UploadedAudio = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiLoggingApplicationService,
    private readonly config: ConfigService,
  ) {}

  @Post('parse-text')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Parse natural-language workout text into a draft' })
  @ApiResponse({ status: 200, description: 'Structured workout draft' })
  @ApiResponse({ status: 422, description: 'Unparseable text' })
  async parseText(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ParseTextDto,
  ) {
    return this.ai.parseText({
      userId: user.id,
      text: dto.text,
      unitHint: dto.unitHint,
      locale: dto.locale,
    });
  }

  @Post('parse-voice')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audio: { type: 'string', format: 'binary' },
        unitHint: { type: 'string', enum: ['KG', 'LB'] },
        locale: { type: 'string' },
      },
      required: ['audio'],
    },
  })
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Parse spoken workout audio into a draft' })
  async parseVoice(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedAudio | undefined,
    @Body('unitHint') unitHint?: 'KG' | 'LB',
    @Body('locale') locale?: string,
  ) {
    if (!this.config.get<boolean>('features.voiceParse', true)) {
      throw new BusinessError(
        'Voice parse is disabled',
        ErrorCodes.BUSINESS_ERROR,
        503,
      );
    }
    if (!file) {
      throw new BusinessError(
        'audio file is required',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }

    const maxBytes = this.config.get<number>(
      'ai.maxVoiceBytes',
      25 * 1024 * 1024,
    );
    if (file.size > maxBytes) {
      throw new BusinessError(
        'Audio file exceeds size limit',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }

    const allowed = [
      'audio/webm',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/mpeg',
      'audio/mp4',
      'audio/m4a',
      'audio/x-m4a',
      'application/octet-stream',
    ];
    if (!allowed.includes(file.mimetype)) {
      throw new BusinessError(
        `Unsupported audio type: ${file.mimetype}`,
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }

    return this.ai.parseVoice({
      userId: user.id,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname || 'audio.webm',
      unitHint,
      locale,
    });
  }

  @Post('parse-image')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  @ApiOperation({ summary: 'OCR workout parsing (stub)' })
  @ApiResponse({ status: 501, description: 'Not implemented' })
  parseImage() {
    if (!this.config.get<boolean>('features.imageParse', false)) {
      throw new BusinessError(
        'Image parse is disabled',
        ErrorCodes.BUSINESS_ERROR,
        503,
      );
    }
    return this.ai.parseImage();
  }

  @Get('parse-logs')
  @ApiOperation({ summary: 'List recent AI parse logs for the current user' })
  async parseLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListParseLogsQueryDto,
  ) {
    return this.ai.listLogs(user.id, query.limit ?? 20);
  }
}
