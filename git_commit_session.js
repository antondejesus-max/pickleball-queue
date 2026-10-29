import git from 'isomorphic-git';
import fs from 'fs';

const projectDir = 'd:/pickleball-queue';

async function commitChanges() {
  const statusMatrix = await git.statusMatrix({ fs, dir: projectDir });
  const changedFiles = statusMatrix
    .filter(row => row[2] !== row[3] || row[1] !== row[2]) // modified or unstaged
    .map(row => row[0]);

  console.log('Changed files:', changedFiles);

  for (const filepath of changedFiles) {
    if (filepath.endsWith('.log') || filepath.startsWith('scratch_')) continue;
    await git.add({ fs, dir: projectDir, filepath });
  }

  const sha = await git.commit({
    fs,
    dir: projectDir,
    message: 'Add meet-up session management: fresh start, purge history, and new Reclub loader',
    author: {
      name: 'Pickleball Admin',
      email: 'admin@pickleball-queue.local'
    }
  });

  console.log('New commit created:', sha);
}

commitChanges().catch(console.error);
