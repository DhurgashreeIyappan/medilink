const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('./db');  // Import the database connection

const app = express();
const JWT_SECRET_KEY = 'your_secret_key'; // Use a strong secret key

app.use(express.json());  // For parsing application/json
app.use(express.static(path.join(__dirname, 'frontend')));  // Serve frontend static files

// Register route
app.post('/register', (req, res) => {
  const { fullname, email, password, role } = req.body;

  const sql = 'INSERT INTO users (fullname, email, password, role) VALUES (?, ?, ?, ?)';
  db.query(sql, [fullname, email, password, role], (err, result) => {
    if (err) {
      console.error('Error registering user:', err);
      return res.status(500).json({ message: 'Error registering user' });
    }
    res.status(200).send('User registered successfully');
  });
});

// Login route with JWT token
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const sql = 'SELECT * FROM users WHERE email = ? AND password = ?';
  db.query(sql, [email, password], (err, results) => {
    if (err) {
      console.error('Error logging in:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (results.length > 0) {
      const user = results[0];
      
      // Create JWT Token
      const token = jwt.sign(
        { user_id: user.user_id, role: user.role },
        JWT_SECRET_KEY,
        { expiresIn: '1h' }  // Token expires in 1 hour
      );

      let redirectUrl = '';
      if (user.role === 'admin') {
        redirectUrl = '/admin-dashboard.html';
      } else if (user.role === 'pharmacist') {
        redirectUrl = '/pharmacist-dashboard.html';
      } else if (user.role === 'customer') {
        redirectUrl = '/customer-dashboard.html';
      } else {
        return res.status(400).json({ success: false, message: 'Unknown user role' });
      }

      // Send the token and redirection URL
      return res.status(200).json({ 
        success: true, 
        message: 'Login successful', 
        token,  // Send JWT token
        redirectUrl
      });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  });
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization');
  
  if (!token) {
    return res.status(401).json({ message: 'Access denied, no token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY);
    req.user = decoded;  // Attach user info to the request object
    next();  // Proceed to the next middleware or route handler
  } catch (err) {
    return res.status(400).json({ message: 'Invalid or expired token' });
  }
};

// Place order route (for customer-dashboard)
app.post('/place-order', verifyToken, (req, res) => {
  const { medicine, quantity } = req.body;
  const user_id = req.user.user_id;  // Get user_id from decoded JWT

  const sql = 'INSERT INTO orders (customer_id, medicine, quantity) VALUES (?, ?, ?)';
  db.query(sql, [user_id, medicine, quantity], (err, result) => {
    if (err) {
      console.error('Error placing order:', err);
      return res.status(500).json({ success: false, message: 'Error placing order' });  // ✅ JSON
    }
    res.json({ success: true, message: 'Order placed successfully' });
  });
});

// Get customer orders (protected)
app.get('/customer-orders', verifyToken, (req, res) => {
  const customerId = req.user.user_id;  // Extracted from JWT

  const sql = `
    SELECT order_id, medicine, quantity, status, order_date
    FROM orders
    WHERE customer_id = ?
    ORDER BY order_date DESC
  `;

  db.query(sql, [customerId], (err, results) => {
    if (err) {
      console.error('Error fetching customer orders:', err);
      return res.status(500).json({ success: false, message: 'Error fetching orders' });
    }

    res.status(200).json({ success: true, orders: results });
  });
});


// Approve or reject order (for pharmacist-dashboard)
app.post('/update-order', verifyToken, (req, res) => {
  const { order_id, status } = req.body;

  const sql = 'UPDATE orders SET status = ? WHERE order_id = ?';
  db.query(sql, [status, order_id], (err, result) => {
    if (err) {
      console.error('Error updating order:', err);
      return res.status(500).json({ success: false, message: 'Failed to update order' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.status(200).json({ success: true, message: 'Order updated successfully' });
  });
});

// Admin dashboard route (to fetch all user data)
app.get('/admin-data', verifyToken, (req, res) => {
  const userRole = req.user.role;

  if (userRole !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admins only.' });
  }

  const sql = 'SELECT user_id, fullname, email, role FROM users';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching user data:', err);
      return res.status(500).json({ message: 'Failed to fetch users' });
    }

    res.status(200).json(results);
  });
});



// Get all orders for pharmacist dashboard
app.get('/all-orders', verifyToken, (req, res) => {
  if (req.user.role !== 'pharmacist') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const sql = `
    SELECT o.order_id, u.fullname AS customer, o.medicine, o.quantity, o.status
    FROM orders o
    JOIN users u ON o.customer_id = u.user_id
    ORDER BY o.order_date DESC
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching all orders:', err);
      return res.status(500).json({ message: 'Error fetching orders' });
    }
    res.json(results);
  });
});

// Delete user route
app.delete('/delete-user/:id', verifyToken, (req, res) => {
  const userRole = req.user.role;

  if (userRole !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admins only.' });
  }

  const userId = req.params.id;

  const sql = 'DELETE FROM users WHERE user_id = ?';
  db.query(sql, [userId], (err, result) => {
    if (err) {
      console.error('Error deleting user:', err);
      return res.status(500).json({ message: 'Failed to delete user' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User deleted successfully' });
  });
});



// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
