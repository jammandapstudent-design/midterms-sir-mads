const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors()); // Allow frontend to communicate with backend
app.use(express.json()); // Allow server to read JSON data

// ==========================================
// 1. MONGODB CONNECTION
// ==========================================
// Replace this string with your actual MongoDB connection string if using Atlas
const mongoURI = 'mongodb://127.0.0.1:27017/cit_inventory'; 

mongoose.connect(mongoURI)
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => console.log('❌ MongoDB Connection Error: ', err));
    
// ==========================================
// 2. DATABASE SCHEMAS (MODELS)
// ==========================================
// Vault Items
const ItemSchema = new mongoose.Schema({
    equipment: String,
    serials: [String],
    status: { type: String, default: 'Available' },
    borrower: { type: String, default: '' },
    returnDate: { type: String, default: '' }
});
const Item = mongoose.model('Item', ItemSchema);

// Audit Logs
const LogSchema = new mongoose.Schema({
    action: String,
    status: String,
    timestamp: String
});
const Log = mongoose.model('Log', LogSchema);

// System Config (PINs & Keys)
const ConfigSchema = new mongoose.Schema({
    pin: { type: String, default: '1234' },
    masterKey: { type: String, default: '1234' }
});
const Config = mongoose.model('Config', ConfigSchema);

// ==========================================
// 3. API ROUTES (ENDPOINTS)
// ==========================================

// --- ITEMS API ---
// Get all items
app.get('/api/items', async (req, res) => {
    const items = await Item.find();
    res.json(items);
});

// Add a new item
app.post('/api/items', async (req, res) => {
    const newItem = new Item(req.body);
    await newItem.save();
    res.json(newItem);
});

// Update an item (Borrow/Return)
app.put('/api/items/:id', async (req, res) => {
    const updatedItem = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedItem);
});

// Delete an item
app.delete('/api/items/:id', async (req, res) => {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item deleted' });
});

// --- AUDIT LOGS API ---
// Get all logs
app.get('/api/logs', async (req, res) => {
    const logs = await Log.find().sort({ _id: -1 }); // Sort newest first
    res.json(logs);
});

// Add a log
app.post('/api/logs', async (req, res) => {
    const newLog = new Log(req.body);
    await newLog.save();
    res.json(newLog);
});

// --- CONFIG API (PIN/MASTER KEY) ---
// Get config
app.get('/api/config', async (req, res) => {
    let config = await Config.findOne();
    if (!config) {
        config = new Config(); // Create default if it doesn't exist
        await config.save();
    }
    res.json(config);
});

// Update config
app.put('/api/config', async (req, res) => {
    let config = await Config.findOne();
    config.pin = req.body.pin || config.pin;
    config.masterKey = req.body.masterKey || config.masterKey;
    await config.save();
    res.json(config);
});

// ==========================================
// 4. START SERVER
// ==========================================
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});