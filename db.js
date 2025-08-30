const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',  // Replace with your MySQL host
  user: 'root', // Replace with your MySQL username
  password: 'Dhurga16!', // Replace with your MySQL password
  database: 'medilink' // Replace with your MySQL database name
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
    return;
  }
  console.log('Connected to the database as id ' + db.threadId);
});

module.exports = db;
