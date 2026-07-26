import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ProfileApplicationService } from '../../application/profile/profile.application-service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../shared/decorators/current-user.decorator';
import { UpdatePreferencesDto, UpdateProfileDto } from './dto/profile.dto';

type RequestWithMeta = Request & { requestId?: string };

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly profileService: ProfileApplicationService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'Full profile including derived age',
  })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getMe(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update profile fields' })
  @ApiResponse({ status: 200, description: 'Updated profile' })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
    @Req() req: RequestWithMeta,
  ) {
    return this.profileService.updateMe({
      userId: user.id,
      displayName: dto.displayName,
      dateOfBirth: dto.dateOfBirth,
      gender: dto.gender,
      heightValue: dto.heightValue,
      heightUnit: dto.heightUnit,
      fitnessGoal: dto.fitnessGoal,
      activityLevel: dto.activityLevel,
      preferredWeightUnit: dto.preferredWeightUnit,
      timezone: dto.timezone,
      context: this.contextFrom(req),
    });
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete the account (anonymizes PII, revokes sessions)',
  })
  @ApiResponse({ status: 204, description: 'Account deleted' })
  async deleteMe(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: RequestWithMeta,
  ): Promise<void> {
    await this.profileService.deleteAccount({
      userId: user.id,
      context: this.contextFrom(req),
    });
  }

  @Get('me/preferences')
  @ApiOperation({ summary: 'Get unit and notification preferences' })
  async getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getPreferences(user.id);
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Update unit and notification preferences' })
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
    @Req() req: RequestWithMeta,
  ) {
    return this.profileService.updatePreferences({
      userId: user.id,
      preferredWeightUnit: dto.preferredWeightUnit,
      heightUnit: dto.heightUnit,
      timezone: dto.timezone,
      notifications: dto.notifications,
      context: this.contextFrom(req),
    });
  }

  private contextFrom(req: RequestWithMeta) {
    return {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      requestId: req.requestId ?? null,
    };
  }
}
