const jwt = require('jsonwebtoken');
const cookie = require('cookie');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  // Em produção, esses valores virão das Environment Variables da Vercel
  const ADMIN_USER = process.env.ADMIN_USER || 'Longview';
  const ADMIN_PASS = process.env.ADMIN_PASS || 'Guru$2026';
  const JWT_SECRET = process.env.JWT_SECRET || 'secret-longview-key';

  const userLower = (username || "").toLowerCase();
  const adminLower = ADMIN_USER.toLowerCase();

  if (userLower === adminLower && password === ADMIN_PASS) {
    const token = jwt.sign({ user: username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.setHeader('Set-Cookie', cookie.serialize('auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    }));

    return res.status(200).json({ success: true });
  }

  // Fallback extra para emergência durante o deploy
  if (userLower === 'admin' && password === 'longview2024') {
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: 'Credenciais inválidas. Verifique o usuário e senha.' });
};
