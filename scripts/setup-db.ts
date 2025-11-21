import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dex-order-engine';

async function setupDatabase() {
  try {
    console.log('🔧 Setting up database...');
    console.log(`📍 Connecting to: ${MONGODB_URI}`);

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const dbName = db.databaseName;

    console.log(`📊 Database name: ${dbName}`);

    // Create indexes for Order collection
    const ordersCollection = db.collection('orders');

    await ordersCollection.createIndex({ type: 1 });
    await ordersCollection.createIndex({ pair: 1 });
    await ordersCollection.createIndex({ status: 1 });
    await ordersCollection.createIndex({ createdAt: -1 });
    await ordersCollection.createIndex({ txHash: 1 });
    await ordersCollection.createIndex({ status: 1, createdAt: -1 });
    await ordersCollection.createIndex({ pair: 1, status: 1 });

    console.log('✅ Indexes created successfully');

    // List all indexes
    const indexes = await ordersCollection.indexes();
    console.log('\n📋 Current indexes:');
    indexes.forEach((index, i) => {
      console.log(`  ${i + 1}. ${JSON.stringify(index.key)} - ${index.name}`);
    });

    console.log('\n✅ Database setup complete!');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

setupDatabase();
