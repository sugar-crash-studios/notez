/**
 * Seed script for load testing
 *
 * Creates test users, folders, notes, and tags for load testing
 *
 * Run: npx tsx scripts/seed-load-test.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const TEST_USER_COUNT = 12;
const NOTES_PER_USER = 100;
const FOLDERS_PER_USER = 10;
const TAGS_PER_USER = 20;
const TASKS_PER_USER = 30;

const TEST_PASSWORD = 'LoadTest123!';

// Sample content for notes
const NOTE_TEMPLATES = [
  {
    title: 'Meeting Notes - {date}',
    content: `<h2>Meeting Notes</h2>
<p>Discussed project timeline and deliverables.</p>
<ul>
  <li>Review requirements by Friday</li>
  <li>Schedule follow-up meeting</li>
  <li>Update documentation</li>
</ul>
<p>Action items assigned to team members.</p>`,
  },
  {
    title: 'Project Ideas - {topic}',
    content: `<h2>Project Ideas</h2>
<p>Brainstorming session for new features.</p>
<ol>
  <li>Improve search functionality</li>
  <li>Add collaboration features</li>
  <li>Enhance mobile experience</li>
</ol>
<p>Need to prioritize based on user feedback.</p>`,
  },
  {
    title: 'Todo List - {date}',
    content: `<h2>Tasks for Today</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">Complete code review</li>
  <li data-type="taskItem" data-checked="true">Update dependencies</li>
  <li data-type="taskItem" data-checked="false">Write unit tests</li>
</ul>`,
  },
  {
    title: 'Research Notes - {topic}',
    content: `<h2>Research Summary</h2>
<p>Key findings from the research phase.</p>
<h3>Key Points</h3>
<ul>
  <li>Important finding one</li>
  <li>Important finding two</li>
  <li>Important finding three</li>
</ul>
<blockquote>Notable quote or reference</blockquote>`,
  },
  {
    title: 'Weekly Review - Week {week}',
    content: `<h2>Weekly Review</h2>
<h3>Accomplishments</h3>
<ul>
  <li>Completed feature implementation</li>
  <li>Fixed critical bugs</li>
  <li>Improved performance</li>
</ul>
<h3>Challenges</h3>
<p>Some challenges encountered during the week.</p>
<h3>Next Week</h3>
<p>Planning for upcoming tasks.</p>`,
  },
];

const FOLDER_NAMES = [
  'Work',
  'Personal',
  'Projects',
  'Archive',
  'Ideas',
  'Research',
  'Meetings',
  'Tasks',
  'Documentation',
  'Notes',
];

const TAG_NAMES = [
  'important',
  'urgent',
  'work',
  'personal',
  'project',
  'meeting',
  'idea',
  'todo',
  'review',
  'archive',
  'research',
  'documentation',
  'planning',
  'follow-up',
  'completed',
  'in-progress',
  'blocked',
  'question',
  'decision',
  'reference',
];

const TOPICS = [
  'Authentication',
  'Database Design',
  'API Architecture',
  'Frontend Components',
  'Testing Strategy',
  'Deployment',
  'Security',
  'Performance',
  'User Experience',
  'Documentation',
];

async function main() {
  console.log('🌱 Starting load test seed...\n');

  // Hash password once
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  console.log(`Creating ${TEST_USER_COUNT} test users...`);

  for (let i = 1; i <= TEST_USER_COUNT; i++) {
    const username = `loadtest_${i}`;

    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { username },
    });

    if (existing) {
      console.log(`  User ${username} already exists, skipping...`);
      continue;
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email: `${username}@test.local`,
        passwordHash,
        role: 'user',
        isActive: true,
      },
    });

    console.log(`  Created user: ${username}`);

    // Create folders
    const folders = [];
    for (let f = 0; f < FOLDERS_PER_USER; f++) {
      const folder = await prisma.folder.create({
        data: {
          name: `${FOLDER_NAMES[f % FOLDER_NAMES.length]} ${Math.floor(f / FOLDER_NAMES.length) || ''}`.trim(),
          userId: user.id,
        },
      });
      folders.push(folder);
    }

    // Create tags
    const tags = [];
    for (let t = 0; t < TAGS_PER_USER; t++) {
      const tag = await prisma.tag.create({
        data: {
          name: TAG_NAMES[t % TAG_NAMES.length],
          userId: user.id,
        },
      });
      tags.push(tag);
    }

    // Create notes
    for (let n = 0; n < NOTES_PER_USER; n++) {
      const template = NOTE_TEMPLATES[n % NOTE_TEMPLATES.length];
      const topic = TOPICS[n % TOPICS.length];
      const date = new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const week = Math.floor(n / 7) + 1;

      const title = template.title
        .replace('{date}', date)
        .replace('{topic}', topic)
        .replace('{week}', week.toString());

      const folder = folders[n % folders.length];
      const noteTags = [tags[n % tags.length], tags[(n + 1) % tags.length]];

      await prisma.note.create({
        data: {
          title,
          content: template.content,
          userId: user.id,
          folderId: Math.random() > 0.2 ? folder.id : null, // 20% unfiled
          tags: {
            create: noteTags.map((tag) => ({ tagId: tag.id })),
          },
        },
      });
    }

    // Create tasks
    for (let t = 0; t < TASKS_PER_USER; t++) {
      const dueDate = new Date(Date.now() + (t - 15) * 24 * 60 * 60 * 1000);

      await prisma.task.create({
        data: {
          title: `Task ${t + 1} for ${username}`,
          description: 'A test task for load testing purposes.',
          status: ['PENDING', 'IN_PROGRESS', 'COMPLETED'][t % 3] as any,
          priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'][t % 4] as any,
          dueDate: Math.random() > 0.3 ? dueDate : null,
          userId: user.id,
          folderId: Math.random() > 0.5 ? folders[t % folders.length].id : null,
        },
      });
    }

    console.log(`    Created ${FOLDERS_PER_USER} folders, ${TAGS_PER_USER} tags, ${NOTES_PER_USER} notes, ${TASKS_PER_USER} tasks`);
  }

  console.log('\n✅ Load test seed completed!');
  console.log(`\nTest credentials:`);
  console.log(`  Username: loadtest_1 through loadtest_${TEST_USER_COUNT}`);
  console.log(`  Password: ${TEST_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
