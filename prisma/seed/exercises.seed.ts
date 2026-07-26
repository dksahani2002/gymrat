import { PrismaClient, MuscleRole } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const MUSCLES = [
  'Chest',
  'Back',
  'Lats',
  'Upper Back',
  'Shoulders',
  'Front Delts',
  'Side Delts',
  'Rear Delts',
  'Biceps',
  'Triceps',
  'Forearms',
  'Abs',
  'Obliques',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Traps',
  'Hip Flexors',
  'Adductors',
];

const EQUIPMENT = [
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Bodyweight',
  'Kettlebell',
  'Smith Machine',
  'Resistance Band',
  'EZ Bar',
];

const CATEGORIES = ['Push', 'Pull', 'Legs', 'Core', 'Olympic', 'Cardio', 'Full Body'];

type SeedExercise = {
  name: string;
  category: string;
  equipment: string;
  primary: string[];
  secondary?: string[];
  aliases?: string[];
  description?: string;
};

const EXERCISES: SeedExercise[] = [
  {
    name: 'Bench Press',
    category: 'Push',
    equipment: 'Barbell',
    primary: ['Chest'],
    secondary: ['Triceps', 'Front Delts'],
    aliases: ['bench', 'bb bench', 'barbell bench', 'flat bench'],
  },
  {
    name: 'Incline Dumbbell Press',
    category: 'Push',
    equipment: 'Dumbbell',
    primary: ['Chest'],
    secondary: ['Front Delts', 'Triceps'],
    aliases: ['incline db press', 'incline dumbbell'],
  },
  {
    name: 'Overhead Press',
    category: 'Push',
    equipment: 'Barbell',
    primary: ['Shoulders', 'Front Delts'],
    secondary: ['Triceps'],
    aliases: ['ohp', 'military press', 'shoulder press'],
  },
  {
    name: 'Lateral Raise',
    category: 'Push',
    equipment: 'Dumbbell',
    primary: ['Side Delts'],
    aliases: ['side raise', 'db lateral raise'],
  },
  {
    name: 'Tricep Pushdown',
    category: 'Push',
    equipment: 'Cable',
    primary: ['Triceps'],
    aliases: ['pushdown', 'cable pushdown'],
  },
  {
    name: 'Dips',
    category: 'Push',
    equipment: 'Bodyweight',
    primary: ['Chest', 'Triceps'],
    secondary: ['Front Delts'],
    aliases: ['chest dips', 'parallel bar dips'],
  },
  {
    name: 'Pull Up',
    category: 'Pull',
    equipment: 'Bodyweight',
    primary: ['Lats', 'Back'],
    secondary: ['Biceps'],
    aliases: ['pullups', 'pull-ups', 'chin up'],
  },
  {
    name: 'Weighted Pull Up',
    category: 'Pull',
    equipment: 'Bodyweight',
    primary: ['Lats', 'Back'],
    secondary: ['Biceps'],
    aliases: ['weighted pullups', 'pull ups weighted'],
  },
  {
    name: 'Barbell Row',
    category: 'Pull',
    equipment: 'Barbell',
    primary: ['Back', 'Upper Back'],
    secondary: ['Biceps', 'Lats'],
    aliases: ['bent over row', 'bb row', 'pendlay row'],
  },
  {
    name: 'Lat Pulldown',
    category: 'Pull',
    equipment: 'Cable',
    primary: ['Lats'],
    secondary: ['Biceps'],
    aliases: ['pulldown', 'lat pull'],
  },
  {
    name: 'Seated Cable Row',
    category: 'Pull',
    equipment: 'Cable',
    primary: ['Back', 'Upper Back'],
    secondary: ['Biceps'],
    aliases: ['cable row', 'seated row'],
  },
  {
    name: 'Dumbbell Curl',
    category: 'Pull',
    equipment: 'Dumbbell',
    primary: ['Biceps'],
    aliases: ['db curl', 'bicep curl'],
  },
  {
    name: 'Barbell Curl',
    category: 'Pull',
    equipment: 'Barbell',
    primary: ['Biceps'],
    aliases: ['bb curl'],
  },
  {
    name: 'Face Pull',
    category: 'Pull',
    equipment: 'Cable',
    primary: ['Rear Delts'],
    secondary: ['Traps', 'Upper Back'],
    aliases: ['facepulls'],
  },
  {
    name: 'Deadlift',
    category: 'Legs',
    equipment: 'Barbell',
    primary: ['Hamstrings', 'Glutes', 'Back'],
    secondary: ['Traps', 'Forearms'],
    aliases: ['conventional deadlift', 'dl'],
  },
  {
    name: 'Romanian Deadlift',
    category: 'Legs',
    equipment: 'Barbell',
    primary: ['Hamstrings', 'Glutes'],
    secondary: ['Back'],
    aliases: ['rdl', 'stiff leg deadlift'],
  },
  {
    name: 'Back Squat',
    category: 'Legs',
    equipment: 'Barbell',
    primary: ['Quads', 'Glutes'],
    secondary: ['Hamstrings', 'Abs'],
    aliases: ['squat', 'bb squat', 'barbell squat'],
  },
  {
    name: 'Front Squat',
    category: 'Legs',
    equipment: 'Barbell',
    primary: ['Quads'],
    secondary: ['Glutes', 'Abs'],
    aliases: ['fsquat'],
  },
  {
    name: 'Leg Press',
    category: 'Legs',
    equipment: 'Machine',
    primary: ['Quads'],
    secondary: ['Glutes'],
    aliases: ['legpress'],
  },
  {
    name: 'Walking Lunge',
    category: 'Legs',
    equipment: 'Dumbbell',
    primary: ['Quads', 'Glutes'],
    aliases: ['lunges', 'db lunge'],
  },
  {
    name: 'Leg Curl',
    category: 'Legs',
    equipment: 'Machine',
    primary: ['Hamstrings'],
    aliases: ['hamstring curl'],
  },
  {
    name: 'Leg Extension',
    category: 'Legs',
    equipment: 'Machine',
    primary: ['Quads'],
    aliases: ['quad extension'],
  },
  {
    name: 'Calf Raise',
    category: 'Legs',
    equipment: 'Machine',
    primary: ['Calves'],
    aliases: ['standing calf raise'],
  },
  {
    name: 'Hip Thrust',
    category: 'Legs',
    equipment: 'Barbell',
    primary: ['Glutes'],
    secondary: ['Hamstrings'],
    aliases: ['barbell hip thrust', 'bht'],
  },
  {
    name: 'Plank',
    category: 'Core',
    equipment: 'Bodyweight',
    primary: ['Abs'],
    secondary: ['Obliques'],
    aliases: ['front plank'],
  },
  {
    name: 'Hanging Leg Raise',
    category: 'Core',
    equipment: 'Bodyweight',
    primary: ['Abs', 'Hip Flexors'],
    aliases: ['leg raises', 'hanging raise'],
  },
  {
    name: 'Cable Crunch',
    category: 'Core',
    equipment: 'Cable',
    primary: ['Abs'],
    aliases: ['kneeling cable crunch'],
  },
  {
    name: 'Russian Twist',
    category: 'Core',
    equipment: 'Bodyweight',
    primary: ['Obliques', 'Abs'],
    aliases: ['oblique twist'],
  },
  {
    name: 'Push Up',
    category: 'Push',
    equipment: 'Bodyweight',
    primary: ['Chest'],
    secondary: ['Triceps', 'Front Delts'],
    aliases: ['pushup', 'push-ups'],
  },
  {
    name: 'Goblet Squat',
    category: 'Legs',
    equipment: 'Dumbbell',
    primary: ['Quads', 'Glutes'],
    aliases: ['db goblet squat'],
  },
  {
    name: 'Kettlebell Swing',
    category: 'Full Body',
    equipment: 'Kettlebell',
    primary: ['Glutes', 'Hamstrings'],
    secondary: ['Back'],
    aliases: ['kb swing'],
  },
  {
    name: 'Farmer Carry',
    category: 'Full Body',
    equipment: 'Dumbbell',
    primary: ['Forearms', 'Traps'],
    secondary: ['Abs'],
    aliases: ["farmer's walk", 'farmers walk'],
  },
];

async function upsertBySlug<T extends { id: string }>(
  find: () => Promise<T | null>,
  create: () => Promise<T>,
): Promise<T> {
  const existing = await find();
  if (existing) return existing;
  return create();
}

async function main(): Promise<void> {
  const muscleByName = new Map<string, string>();
  for (const name of MUSCLES) {
    const slug = slugify(name);
    const row = await upsertBySlug(
      () => prisma.muscleGroup.findUnique({ where: { slug } }),
      () => prisma.muscleGroup.create({ data: { slug, name } }),
    );
    muscleByName.set(name, row.id);
  }

  const equipmentByName = new Map<string, string>();
  for (const name of EQUIPMENT) {
    const slug = slugify(name);
    const row = await upsertBySlug(
      () => prisma.equipment.findUnique({ where: { slug } }),
      () => prisma.equipment.create({ data: { slug, name } }),
    );
    equipmentByName.set(name, row.id);
  }

  const categoryByName = new Map<string, string>();
  for (const name of CATEGORIES) {
    const slug = slugify(name);
    const row = await upsertBySlug(
      () => prisma.exerciseCategory.findUnique({ where: { slug } }),
      () => prisma.exerciseCategory.create({ data: { slug, name } }),
    );
    categoryByName.set(name, row.id);
  }

  for (const exercise of EXERCISES) {
    const slug = slugify(exercise.name);
    const existing = await prisma.exercise.findUnique({ where: { slug } });
    const categoryId = categoryByName.get(exercise.category);
    const equipmentId = equipmentByName.get(exercise.equipment);

    const row =
      existing ??
      (await prisma.exercise.create({
        data: {
          slug,
          name: exercise.name,
          description: exercise.description ?? null,
          categoryId: categoryId ?? null,
          equipmentId: equipmentId ?? null,
          isCustom: false,
          isActive: true,
        },
      }));

    if (existing) {
      await prisma.exercise.update({
        where: { id: existing.id },
        data: {
          name: exercise.name,
          description: exercise.description ?? null,
          categoryId: categoryId ?? null,
          equipmentId: equipmentId ?? null,
          isActive: true,
          deletedAt: null,
        },
      });
    }

    await prisma.exerciseMuscle.deleteMany({ where: { exerciseId: row.id } });
    for (const muscle of exercise.primary) {
      const muscleGroupId = muscleByName.get(muscle);
      if (!muscleGroupId) continue;
      await prisma.exerciseMuscle.create({
        data: {
          exerciseId: row.id,
          muscleGroupId,
          role: MuscleRole.PRIMARY,
        },
      });
    }
    for (const muscle of exercise.secondary ?? []) {
      const muscleGroupId = muscleByName.get(muscle);
      if (!muscleGroupId) continue;
      await prisma.exerciseMuscle.create({
        data: {
          exerciseId: row.id,
          muscleGroupId,
          role: MuscleRole.SECONDARY,
        },
      });
    }

    for (const alias of exercise.aliases ?? []) {
      const normalized = alias.trim().toLowerCase();
      const existingAlias = await prisma.exerciseAlias.findUnique({
        where: { alias: normalized },
      });
      if (!existingAlias) {
        await prisma.exerciseAlias.create({
          data: { exerciseId: row.id, alias: normalized },
        });
      } else if (existingAlias.exerciseId !== row.id) {
        // Keep first-wins for unique aliases across re-seeds
        continue;
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${MUSCLES.length} muscles, ${EQUIPMENT.length} equipment, ${CATEGORIES.length} categories, ${EXERCISES.length} exercises`,
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
