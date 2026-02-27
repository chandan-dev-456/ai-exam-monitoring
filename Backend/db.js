const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);
const dbName = 'exam_proctoring';

let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db(dbName);
        console.log('✅ Connected to MongoDB');
        
        // Create indexes (optional)
        try {
            await db.collection('users').createIndex({ regNo: 1 }, { unique: true });
        } catch (e) {}
        
        return db;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

function getDB() {
    if (!db) throw new Error('Database not initialized');
    return db;
}

module.exports = { connectDB, getDB };