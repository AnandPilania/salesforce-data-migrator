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

    static async getMongoDb(dbUri, dbName) {
        const { MongoClient } = require('mongodb');
        const client = new MongoClient(dbUri);
        await client.connect();
        return { client, db: client.db(dbName) };
    }

    static async getPgPool(dbUri, dbName) {
        const { Pool } = require('pg');
        const { URL } = require('url');
            const uri = new URL(dbUri);
            const pool = new Pool({
                user: uri.username,
                password: uri.password,
                host: uri.hostname,
                port: uri.port || 5432,
                database: dbName,
                ssl: uri.searchParams.get('sslmode') === 'require'
            });

        return pool;
    }

    static async insertRecordsMongo(dbUri, dbName, collectionName, records) {
        const { client, db } = await DatabaseManager.getMongoDb(dbUri, dbName);
        try {
            const collection = db.collection(collectionName.toLowerCase());
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
            let result = { upsertedCount: 0, modifiedCount: 0 };
            if (operations.length > 0) {
                result = await collection.bulkWrite(operations, { ordered: false });
            }
            return result;
        } finally {
            await client.close();
        }
    }

    static async insertRecordsPostgres(dbUri, dbName, tableName, records, fields) {
        const pool = await DatabaseManager.getPgPool(dbUri, dbName);
        const client = await pool.connect();
        try {
            await DatabaseManager.createTableIfNotExists(client, tableName, fields, records[0]);
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
            return { upsertedCount: insertedCount };
        } finally {
            client.release();
            await pool.end();
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

    static async upsertObjectSchemaPostgres(dbUri, dbName, objectSchema) {
        const pool = await DatabaseManager.getPgPool(dbUri, dbName);
        const client = await pool.connect();
        try {
            await client.query(`CREATE TABLE IF NOT EXISTS objects (
                id SERIAL PRIMARY KEY,
                instance_id VARCHAR(64),
                name VARCHAR(255),
                api_name VARCHAR(255),
                label VARCHAR(255),
                description TEXT,
                last_updated TIMESTAMP DEFAULT NOW()
            )`);
            await client.query(`INSERT INTO objects (instance_id, name, api_name, label, description, last_updated)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (name) DO UPDATE SET api_name = $3, label = $4, description = $5, last_updated = NOW()`,
                [objectSchema.instanceId, objectSchema.name, objectSchema.apiName, objectSchema.label, objectSchema.description]);
        } finally {
            client.release();
            await pool.end();
        }
    }
    static async upsertFieldSchemaPostgres(dbUri, dbName, fields) {
        const pool = await DatabaseManager.getPgPool(dbUri, dbName);
        const client = await pool.connect();
        try {
            await client.query(`CREATE TABLE IF NOT EXISTS fields (
                id SERIAL PRIMARY KEY,
                object_name VARCHAR(255),
                name VARCHAR(255),
                label VARCHAR(255),
                type VARCHAR(64),
                nillable BOOLEAN,
                length INTEGER,
                precision INTEGER,
                scale INTEGER,
                external_id BOOLEAN,
                formula TEXT,
                unique_field BOOLEAN,
                required BOOLEAN,
                visible_lines INTEGER,
                value_set JSONB,
                description TEXT,
                reference_to VARCHAR(255),
                relationship_label VARCHAR(255),
                relationship_name VARCHAR(255),
                last_updated TIMESTAMP DEFAULT NOW()
            )`);
            for (const field of fields) {
                await client.query(`INSERT INTO fields (object_name, name, label, type, nillable, length, precision, scale, external_id, formula, unique_field, required, visible_lines, value_set, description, reference_to, relationship_label, relationship_name, last_updated)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
                    ON CONFLICT (object_name, name) DO UPDATE SET label = $3, type = $4, nillable = $5, length = $6, precision = $7, scale = $8, external_id = $9, formula = $10, unique_field = $11, required = $12, visible_lines = $13, value_set = $14, description = $15, reference_to = $16, relationship_label = $17, relationship_name = $18, last_updated = NOW()`,
                    [field.objectName, field.name, field.label, field.type, field.nillable, field.length, field.precision, field.scale, field.externalId, field.formula, field.unique, field.required, field.visibleLines, field.valueSet ? JSON.stringify(field.valueSet) : null, field.description, field.referenceTo, field.relationshipLabel, field.relationshipName]);
            }
        } finally {
            client.release();
            await pool.end();
        }
    }

    static async upsertObjectSchemaMongo(dbUri, dbName, objectSchema) {
        const { client, db } = await DatabaseManager.getMongoDb(dbUri, dbName);
        try {
            const objects = db.collection('objects');
            await objects.updateOne(
                { name: objectSchema.name },
                { $set: { ...objectSchema, lastUpdated: new Date() } },
                { upsert: true }
            );
        } finally {
            await client.close();
        }
    }
    
    static async upsertFieldSchemaMongo(dbUri, dbName, fields) {
        const { client, db } = await DatabaseManager.getMongoDb(dbUri, dbName);
        try {
            const fieldsCol = db.collection('fields');
            for (const field of fields) {
                await fieldsCol.updateOne(
                    { objectName: field.objectName, name: field.name },
                    { $set: { ...field, lastUpdated: new Date() } },
                    { upsert: true }
                );
            }
        } finally {
            await client.close();
        }
    }
}

module.exports = DatabaseManager;
