import { readUsers, writeUsers } from './src/lib/db-kv';

async function fix() {
  const users = await readUsers();
  let changed = false;
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (user.email === 'carlos@guru.dev.br' || user.email === 'eduardo@longview.com.br' || user.role === 'Desenvolvedor' || user.id === '1') {
      if (user.profile && user.profile.mustChangePassword) {
        user.profile.mustChangePassword = false;
        changed = true;
        console.log('Fixed mustChangePassword for', user.email);
      }
    }
  }
  if (changed) {
    await writeUsers(users);
    console.log('User profile fixes applied.');
  } else {
    console.log('No changes needed.');
  }
}

fix().catch(console.error);
