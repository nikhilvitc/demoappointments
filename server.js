require('dotenv').config();
const Appointment = require('./models/Appointment');

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', true);

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60,
    },
  })
);

// MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('❌ MongoDB Error:', err));

// Auth middleware
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/index.html');
  next();
}

// Routes
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existing = await User.findOne({ username });
    if (existing) return res.send('Username already exists.');

    const user = new User({ username, password });
    await user.save();
    req.session.userId = user._id;
    res.redirect('/dashboard.html');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error registering user.');
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.send('User not found.');

    const ok = await user.comparePassword(password);
    if (!ok) return res.send('Incorrect password.');

    req.session.userId = user._id;
    res.redirect('/dashboard.html');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error logging in.');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/index.html'));
});

app.get('/api/me', requireLogin, async (req, res) => {
  const user = await User.findById(req.session.userId).select('-password');
  res.json(user);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
app.post('/appointments', async (req, res) => {
  if (!req.session.userId) return res.redirect('/index.html');

  const { phoneModel, issue, date } = req.body;

  try {
    const appointment = new Appointment({
      user: req.session.userId,
      phoneModel,
      issue,
      date
    });

    await appointment.save();
    res.redirect('/appointments.html');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to book appointment');
  }
});
app.get('/appointments', async (req, res) => {
  if (!req.session.userId) return res.redirect('/index.html');

  try {
    const appointments = await Appointment.find({ user: req.session.userId }).sort({ date: -1 });
    res.json(appointments);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to fetch appointments');
  }
});


