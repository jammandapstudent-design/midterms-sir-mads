const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); 

// --- DATABASE CONNECTION ---
// Updated to use Render environment variables, falling back to local for dev
const dbURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cit_vault';

mongoose.connect(dbURI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ MongoDB Connection Error:', err));

// --- SCHEMAS ---
// Added 'username' to the schema so the frontend receives it correctly
const Config = mongoose.model('Config', new mongoose.Schema({ 
    username: String, 
    pin: String 
}));

const Item = mongoose.model('Item', new mongoose.Schema({
    // Original Fields
    equipment: String,
    serials: [String],
    status: String,
    borrower: String,
    returnDate: String,
    
    // Core Details
    category: String,
    description: String,
    price: Number,
    transactionId: String,
    purpose: String,

    // Maintenance & Repair Fields
    repairStatus: String,
    issueDescription: String,
    reportedBy: String,
    dateReported: String,
    sentTo: String,
    repairCost: Number,
    estimatedReturnDate: String,
    maintenanceNotes: String
}));

const Log = mongoose.model('Log', new mongoose.Schema({
    action: String,
    status: String,
    timestamp: String
}));

// --- API ROUTES ---
app.get('/api/config', async (req, res) => {
    // Fixed: Now defaults to username: 'admin', pin: '1234' on fresh startup
    let config = await Config.findOne() || await new Config({ username: 'admin', pin: '1234' }).save();
    res.json(config);
});

app.put('/api/config', async (req, res) => {
    const config = await Config.findOneAndUpdate({}, { pin: req.body.pin }, { new: true });
    res.json(config);
});

app.get('/api/items', async (req, res) => res.json(await Item.find()));

app.post('/api/items', async (req, res) => res.json(await new Item(req.body).save()));

app.put('/api/items/:id', async (req, res) => {
    res.json(await Item.findByIdAndUpdate(req.params.id, req.body, { new: true }));
});

app.delete('/api/items/:id', async (req, res) => {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
});

app.get('/api/logs', async (req, res) => res.json(await Log.find().sort({ _id: -1 })));

app.post('/api/logs', async (req, res) => res.json(await new Log(req.body).save()));

// --- FRONTEND CATCH-ALL ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- PORT ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));

module.exports = app;