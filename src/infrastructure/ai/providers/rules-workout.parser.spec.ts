import { RulesWorkoutParser } from '../../../infrastructure/ai/providers/rules-workout.parser';
import { BusinessError } from '../../../shared/errors/base.error';

describe('RulesWorkoutParser', () => {
  const parser = new RulesWorkoutParser();

  it('parses Bench 80kg 5x5 into 5 sets', async () => {
    const result = await parser.parse({ text: 'Bench 80kg 5x5' });
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].rawName).toBe('Bench');
    expect(result.exercises[0].sets).toHaveLength(5);
    expect(result.exercises[0].sets[0]).toMatchObject({
      weight: 80,
      reps: 5,
      unit: 'KG',
    });
  });

  it('parses Squat 225lbs 3 sets of 5', async () => {
    const result = await parser.parse({ text: 'Squat 225lbs 3 sets of 5' });
    expect(result.exercises[0].sets).toHaveLength(3);
    expect(result.exercises[0].sets[0]).toMatchObject({
      weight: 225,
      reps: 5,
      unit: 'LB',
    });
  });

  it('parses bodyweight comma reps', async () => {
    const result = await parser.parse({ text: 'Pull ups bodyweight 8,8,6' });
    expect(result.exercises[0].sets.map((s) => s.reps)).toEqual([8, 8, 6]);
    expect(result.exercises[0].sets[0].weight).toBe(0);
  });

  it('parses multiple exercises with then', async () => {
    const result = await parser.parse({
      text: 'Bench 80kg 5x5 then incline db 30kg 3x10',
    });
    expect(result.exercises).toHaveLength(2);
    expect(result.exercises[1].rawName.toLowerCase()).toContain('incline');
    expect(result.exercises[1].sets).toHaveLength(3);
  });

  it('parses weighted pull ups for reps and sets', async () => {
    const result = await parser.parse({
      text: 'Weighted pull ups 20kg for 5 reps and 5 sets',
    });
    expect(result.exercises[0].sets).toHaveLength(5);
    expect(result.exercises[0].sets[0]).toMatchObject({
      weight: 20,
      reps: 5,
      unit: 'KG',
    });
  });

  it('throws UNPARSEABLE for gibberish', async () => {
    await expect(parser.parse({ text: 'hello world' })).rejects.toBeInstanceOf(
      BusinessError,
    );
  });
});
