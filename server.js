const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Serve Static Frontend Files (Crucial for Render)
app.use(express.static(__dirname));

// 2. Connect to MongoDB 
const dbURI = 'mongodb+srv://admin:admin@cluster0.gipy0hk.mongodb.net/cit_vault?appName=Cluster0';
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => console.log('❌ MongoDB Connection Error:', err));

// 3. Database Schemas
const ConfigSchema = new mongoose.Schema({ pin: String });
const Config = mongoose.model('Config', ConfigSchema);

const ItemSchema = new mongoose.Schema({
    equipment: String,
    serials: [String],
    status: String,
    borrower: String,
    returnDate: String
});
const Item = mongoose.model('Item', ItemSchema);

const LogSchema = new mongoose.Schema({
    action: String,
    status: String,
    timestamp: String
});
const Log = mongoose.model('Log', LogSchema);

// 4. API Routes
// --- CONFIG (PASSWORD) ROUTES ---
app.get('/api/config', async (req, res) => {
    let config = await Config.findOne();
    if (!config) {
        config = new Config({ pin: 'admin' });
        await config.save();
    }
    res.json(config);
});

app.put('/api/config', async (req, res) => {
    let config = await Config.findOne();
    config.pin = req.body.pin;
    await config.save();
    res.json(config);
});

// --- ITEM ROUTES ---
app.get('/api/items', async (req, res) => {
    const items = await Item.find();
    res.json(items);
});

app.post('/api/items', async (req, res) => {
    const newItem = new Item(req.body);
    await newItem.save();
    res.json(newItem);
});

app.put('/api/items/:id', async (req, res) => {
    const updatedItem = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedItem);
});

app.delete('/api/items/:id', async (req, res) => {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item Deleted' });
});

// --- LOG ROUTES ---
app.get('/api/logs', async (req, res) => {
    const logs = await Log.find().sort({ _id: -1 }); // Get newest first
    res.json(logs);
});

app.post('/api/logs', async (req, res) => {
    const newLog = new Log(req.body);
    await newLog.save();
    res.json(newLog);
});

// 5. Start the Server (Uses Render's Port or Local 5000)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});