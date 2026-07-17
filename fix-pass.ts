import { readUsers, writeUsers } from './src/lib/db-kv';

async function fix() {
  const users = await readUsers();
  let changed = false;
  for (let i = 0; i < users.length; i++) {
    if (users[i].email === 'carlos@guru.dev.br' || users[i].email === 'eduardo@longview.com.br' || users[i].role === 'Desenvolvedor' || users[i].id === '1') {
      if (users[i].profile) {
        if (users[i].profile.mustChangePassword) {
          users[i].profile.mustChangePassword = false;
          changed = true;
          console.log('Fixed mustChangePassword for', users[i].email);
        }
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
