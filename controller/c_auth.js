const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const bcrypt = require('bcryptjs');

const authenticate = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.redirect('/login');
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.redirect('/login');
    }

    req.user = decoded; // Simpan data pengguna
    next();
  });
};

const authorize = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).send('Access Denied: You do not have the required permissions.');
    }
    next();
  };
};

const updateUserRole = async (req, res) => {
    const { userId, role } = req.body; // ID pengguna dan role baru
  
    // Validasi input
    if (!userId || !role) {
      return res.status(400).send('User ID and role are required.');
    }
  
    const allowedRoles = ['admin', 'user', 'admin_gudang', 'admin_barang', 'admin_administrasi']; // Role yang dapat diubah
    if (!allowedRoles.includes(role)) {
      return res.status(400).send('Invalid role.');
    }
  
    try {
      // Perbarui role pengguna di database
      const result = await pool.query(
        'UPDATE users SET role = $1 WHERE id = $2 RETURNING *',
        [role, userId]
      );
  
      if (result.rowCount === 0) {
        return res.status(404).send('User not found.');
      }
  
      res.status(200).send(`User role updated to ${role}.`);
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).send('An error occurred while updating user role.');
    }
  };

  const getUsers = async (req, res) => {
    try {
      const result = await pool.query('SELECT id, username, role FROM users ORDER BY role');
      res.render('v_authentication/updateRole.ejs', { users: result.rows, message: null });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).send('Error fetching users.');
    }
  };
  
  const changePassword = async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
  
    // Validasi input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.render('v_authentication/changePassword', { message: 'All fields are required' });
    }
  
    if (newPassword !== confirmPassword) {
      return res.render('v_authentication/changePassword', { message: 'New passwords do not match' });
    }
  
    try {
      // Dapatkan pengguna dari `req.user` yang disediakan middleware `authenticate`
      const userId = req.user.userId;
  
      // Ambil data pengguna dari database
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0) {
        return res.render('v_authentication/changePassword', { message: 'User not found' });
      }
  
      const user = result.rows[0];
  
      // Verifikasi password saat ini
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.render('v_authentication/changePassword', { message: 'Current password is incorrect' });
      }
  
      // Enkripsi password baru
      const hashedPassword = await bcrypt.hash(newPassword, 10);
  
      // Perbarui password di database
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
  
      res.render('v_authentication/changePassword', { message: 'Password changed successfully!' });
    } catch (error) {
      console.error('Error changing password:', error);
      res.render('v_authentication/changePassword', { message: 'An error occurred. Please try again.' });
    }
  };
  
 
  
  
module.exports = { authenticate, authorize,updateUserRole,getUsers,changePassword };
