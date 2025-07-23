const { MongoClient } = require('mongodb');
const { Pool } = require('pg');
const Logger = require('../utils/logger');

class DatabaseManager {
    constructor() {
        this.mongoClient = null;
        this.mongoDb = null;
        this.pgPool = null;
    }

    async init() {
        if (process.env.MONGODB_URI) {
            await this.initMongo();
        }

        if (process.env.POSTGRES_URI) {
            await this.initPostgres();
        }

        if (!this.mongoClient && !this.pgPool) {
            throw new Error('No database connection configured. Set MONGODB_URI or POSTGRES_URI');
        }
    }

    async initMongo() {
        try {
            this.mongoClient = new MongoClient(process.env.MONGODB_URI);
            await this.mongoClient.connect();
            this.mongoDb = this.mongoClient.db(process.env.MONGODB_NAME || 'salesforce_sync');
            Logger.info('Connected to MongoDB');
        } catch (error) {
            Logger.error('MongoDB connection failed:', error);
            throw error;
        }
    }

    async initPostgres() {
        try {
            this.pgPool = new Pool({
                connectionString: process.env.POSTGRES_URI,
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });

            await this.pgPool.query('SELECT NOW()');
            Logger.info('Connected to PostgreSQL');
        } catch (error) {
            Logger.error('PostgreSQL connection failed:', error);
            throw error;
        }
    }

    async insertRecordsMongo(collectionName, records) {
        if (!this.mongoDb) {
            throw new Error('MongoDB not initialized');
        }

        try {
            const collection = this.mongoDb.collection(collectionName.toLowerCase());

            await collection.createIndex({ Id: 1 }, { unique: true });

            const operations = records.map(record => ({
                replaceOne: {
                    filter: { Id: record.Id },
                    replacement: {
                        ...record,
                        _syncedAt: new Date(),
                        _source: 'salesforce'
                    },
                    upsert: true
                }
            }));

            if (operations.length > 0) {
                const result = await collection.bulkWrite(operations, { ordered: false });
                Logger.info(`MongoDB: Upserted ${result.upsertedCount} and modified ${result.modifiedCount} records in ${collectionName}`);
                return result;
            }
        } catch (error) {
            Logger.error(`Error inserting records to MongoDB collection ${collectionName}:`, error);
            throw error;
        }
    }

    async insertRecordsPostgres(tableName, records, fields) {
        if (!this.pgPool) {
            throw new Error('PostgreSQL not initialized');
        }

        try {
            const client = await this.pgPool.connect();

            try {
                await this.createTableIfNotExists(client, tableName, fields, records[0]);

                const columns = Object.keys(records[0]).filter(key => key !== 'attributes');
                const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
                const conflictColumns = columns.map(col => `${col} = EXCLUDED.${col}`).join(', ');

                const query = `
          INSERT INTO ${tableName.toLowerCase()} (${columns.join(', ')}, _synced_at, _source)
          VALUES (${placeholders}, NOW(), 'salesforce')
          ON CONFLICT (id) DO UPDATE SET ${conflictColumns}, _synced_at = NOW()
        `;

                let insertedCount = 0;
                for (const record of records) {
                    const values = columns.map(col => record[col]);
                    await client.query(query, values);
                    insertedCount++;
                }

                Logger.info(`PostgreSQL: Upserted ${insertedCount} records in ${tableName}`);
                return { upsertedCount: insertedCount };
            } finally {
                client.release();
            }
        } catch (error) {
            Logger.error(`Error inserting records to PostgreSQL table ${tableName}:`, error);
            throw error;
        }
    }

    async createTableIfNotExists(client, tableName, fields, sampleRecord) {
        const fieldDefinitions = fields.map(field => {
            let pgType = this.mapSalesforceToPgType(field.type, field.length, field.precision, field.scale);
            const nullable = field.nillable ? '' : ' NOT NULL';
            return `${field.name} ${pgType}${nullable}`;
        }).join(', ');

        const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${tableName.toLowerCase()} (
        ${fieldDefinitions},
        _synced_at TIMESTAMP DEFAULT NOW(),
        _source VARCHAR(50) DEFAULT 'salesforce',
        PRIMARY KEY (id)
      )
    `;

        await client.query(createTableQuery);

        const indexQuery = `CREATE INDEX IF NOT EXISTS idx_${tableName.toLowerCase()}_synced_at ON ${tableName.toLowerCase()} (_synced_at)`;
        await client.query(indexQuery);
    }

    mapSalesforceToPgType(sfType, length, precision, scale) {
        switch (sfType.toLowerCase()) {
            case 'id':
            case 'reference':
                return 'VARCHAR(18)';
            case 'string':
            case 'textarea':
            case 'url':
            case 'email':
            case 'phone':
                return length ? `VARCHAR(${Math.min(length, 4000)})` : 'TEXT';
            case 'picklist':
            case 'multipicklist':
                return length ? `VARCHAR(${length})` : 'VARCHAR(255)';
            case 'boolean':
                return 'BOOLEAN';
            case 'int':
                return 'INTEGER';
            case 'double':
            case 'currency':
            case 'percent':
                if (precision && scale) {
                    return `NUMERIC(${precision}, ${scale})`;
                }
                return 'NUMERIC';
            case 'date':
                return 'DATE';
            case 'datetime':
                return 'TIMESTAMP';
            case 'time':
                return 'TIME';
            default:
                return 'TEXT';
        }
    }

    async getRecordCount(database, tableName) {
        try {
            if (database === 'mongodb' && this.mongoDb) {
                const collection = this.mongoDb.collection(tableName.toLowerCase());
                return await collection.countDocuments();
            } else if (database === 'postgresql' && this.pgPool) {
                const result = await this.pgPool.query(`SELECT COUNT(*) FROM ${tableName.toLowerCase()}`);
                return parseInt(result.rows[0].count);
            }
            return 0;
        } catch (error) {
            Logger.error(`Error getting record count for ${tableName}:`, error);
            return 0;
        }
    }

    async close() {
        if (this.mongoClient) {
            await this.mongoClient.close();
            Logger.info('MongoDB connection closed');
        }

        if (this.pgPool) {
            await this.pgPool.end();
            Logger.info('PostgreSQL connection closed');
        }
    }
}

module.exports = DatabaseManager;
