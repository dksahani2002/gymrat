import { ProfileApplicationService } from './profile.application-service';
import {
  ActivityLevel,
  FitnessGoal,
  Gender,
  HeightUnit,
  WeightUnit,
} from '../../domain/profile/profile.enums';
import { UserProfile } from '../../domain/profile/user-profile.entity';
import { NotFoundError, BusinessError } from '../../shared/errors/base.error';

describe('ProfileApplicationService', () => {
  const context = { ip: '127.0.0.1', userAgent: 'jest', requestId: 'req-1' };

  const profiles = {
    findByUserId: jest.fn(),
    updateProfile: jest.fn(),
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
    softDeleteAccount: jest.fn(),
  };

  const refreshTokens = {
    revokeAllForUser: jest.fn(),
  };

  const audit = { record: jest.fn() };
  const events = { publish: jest.fn() };

  let service: ProfileApplicationService;

  const sampleProfile = UserProfile.create({
    id: 'profile-1',
    userId: 'user-1',
    email: 'athlete@gymrat.app',
    role: 'USER',
    displayName: 'Alex',
    dateOfBirth: new Date('1995-06-15T00:00:00.000Z'),
    gender: Gender.MALE,
    heightValue: 178,
    heightUnit: HeightUnit.CM,
    fitnessGoal: FitnessGoal.BUILD_MUSCLE,
    activityLevel: ActivityLevel.ACTIVE,
    preferredWeightUnit: WeightUnit.KG,
    timezone: 'UTC',
    emailVerifiedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProfileApplicationService(
      profiles as never,
      refreshTokens as never,
      audit as never,
      events as never,
    );
  });

  describe('getMe', () => {
    it('returns profile view with age', async () => {
      profiles.findByUserId.mockResolvedValue(sampleProfile);

      const result = await service.getMe('user-1');

      expect(result.email).toBe('athlete@gymrat.app');
      expect(result.dateOfBirth).toBe('1995-06-15');
      expect(result.age).toBeGreaterThanOrEqual(30);
      expect(result.heightValue).toBe(178);
    });

    it('throws when profile missing', async () => {
      profiles.findByUserId.mockResolvedValue(null);
      await expect(service.getMe('missing')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('updateMe', () => {
    it('updates profile and audits', async () => {
      profiles.findByUserId.mockResolvedValue(sampleProfile);
      const updated = UserProfile.create({
        ...sampleProfile,
        displayName: 'Alex Updated',
        timezone: 'Asia/Kolkata',
        fitnessGoal: FitnessGoal.STRENGTH,
      });
      profiles.updateProfile.mockResolvedValue(updated);

      const result = await service.updateMe({
        userId: 'user-1',
        displayName: 'Alex Updated',
        timezone: 'Asia/Kolkata',
        fitnessGoal: FitnessGoal.STRENGTH,
        context,
      });

      expect(result.displayName).toBe('Alex Updated');
      expect(result.timezone).toBe('Asia/Kolkata');
      expect(audit.record).toHaveBeenCalled();
      expect(events.publish).toHaveBeenCalledWith('profile.updated', expect.anything());
    });

    it('rejects invalid timezone', async () => {
      profiles.findByUserId.mockResolvedValue(sampleProfile);

      await expect(
        service.updateMe({
          userId: 'user-1',
          timezone: 'Not/AZone',
          context,
        }),
      ).rejects.toBeInstanceOf(BusinessError);
    });

    it('rejects future date of birth', async () => {
      profiles.findByUserId.mockResolvedValue(sampleProfile);

      await expect(
        service.updateMe({
          userId: 'user-1',
          dateOfBirth: '2099-01-01',
          context,
        }),
      ).rejects.toBeInstanceOf(BusinessError);
    });
  });

  describe('preferences', () => {
    const prefs = {
      preferredWeightUnit: WeightUnit.KG,
      heightUnit: HeightUnit.CM,
      timezone: 'UTC',
      notifications: {
        emailEnabled: true,
        pushEnabled: true,
        workoutReminders: true,
        prAlerts: true,
        weeklySummary: true,
      },
    };

    it('returns preferences', async () => {
      profiles.getPreferences.mockResolvedValue(prefs);
      await expect(service.getPreferences('user-1')).resolves.toEqual(prefs);
    });

    it('updates notification toggles', async () => {
      profiles.getPreferences.mockResolvedValue(prefs);
      profiles.updatePreferences.mockResolvedValue({
        ...prefs,
        preferredWeightUnit: WeightUnit.LB,
        notifications: { ...prefs.notifications, emailEnabled: false },
      });

      const result = await service.updatePreferences({
        userId: 'user-1',
        preferredWeightUnit: WeightUnit.LB,
        notifications: { emailEnabled: false },
        context,
      });

      expect(result.preferredWeightUnit).toBe(WeightUnit.LB);
      expect(result.notifications.emailEnabled).toBe(false);
    });
  });

  describe('deleteAccount', () => {
    it('soft-deletes, revokes sessions, and emits event', async () => {
      profiles.findByUserId.mockResolvedValue(sampleProfile);

      await service.deleteAccount({ userId: 'user-1', context });

      expect(profiles.softDeleteAccount).toHaveBeenCalledWith('user-1');
      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('user-1');
      expect(events.publish).toHaveBeenCalledWith(
        'profile.account_deleted',
        expect.anything(),
      );
    });
  });
});
