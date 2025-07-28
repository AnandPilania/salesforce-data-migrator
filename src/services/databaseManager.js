const { MongoClient } = require('mongodb');
const { Pool } = require('pg');
const Logger = require('../utils/logger');

class DatabaseManager {
    constructor() {
        this.client = null;
        this.db = null;
        this.uri = process.env.DB_URI;
        this.name = process.env.DB_NAME;
    }

    async init() {
        if (!this.uri || !this.name) {
            throw new Error('DB_URI and DB_NAME must be set in environment');
        }
        await this.initMongo();
    }

    async initMongo() {
        try {
            const { MongoClient } = require('mongodb');
            this.client = new MongoClient(this.uri);
            await this.client.connect();
            this.db = this.client.db(this.name);
            Logger.info('Connected to MongoDB');
        } catch (error) {
            Logger.error('MongoDB connection failed:', error);
            throw error;
        }
    }

    async getCollection(name) {
        if (!this.db) throw new Error('MongoDB not initialized');
        return this.db.collection(name);
    }

    // Core CRUD for instances
    async getAllInstances() {
        const col = await this.getCollection('instances');
        return await col.find({}).toArray();
    }
    async saveInstance(instance) {
        const col = await this.getCollection('instances');
        await col.updateOne({ id: instance.id }, { $set: instance }, { upsert: true });
    }
    async deleteInstance(id) {
        const col = await this.getCollection('instances');
        await col.deleteOne({ id });
    }

    // Core CRUD for schedules
    async getAllSchedules() {
        const col = await this.getCollection('schedules');
        return await col.find({}).toArray();
    }
    async saveSchedule(schedule) {
        const col = await this.getCollection('schedules');
        await col.updateOne({ id: schedule.id }, { $set: schedule }, { upsert: true });
    }
    async deleteSchedule(id) {
        const col = await this.getCollection('schedules');
        await col.deleteOne({ id });
    }

    // Core CRUD for sync history
    async getAllSyncHistory() {
        const col = await this.getCollection('sync_history');
        return await col.find({}).toArray();
    }
    async saveSyncHistory(sync) {
        const col = await this.getCollection('sync_history');
        await col.updateOne({ id: sync.id }, { $set: sync }, { upsert: true });
    }
    async deleteSyncHistory(id) {
        const col = await this.getCollection('sync_history');
        await col.deleteOne({ id });
    }

    async close() {
        if (this.client) {
            await this.client.close();
            Logger.info('MongoDB connection closed');
        }
    }

    static async upsertObjectSchemaPostgres(dbUri, dbName, objectSchema) {
        const pool = await DatabaseManager.getPgPool(dbUri, dbName);
        const client = await pool.connect();
        try {
            await client.query(`CREATE TABLE IF NOT EXISTS objects (
                id SERIAL PRIMARY KEY,
                instance_id VARCHAR(64),
                name VARCHAR(255) UNIQUE,
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
                last_updated TIMESTAMP DEFAULT NOW(),
                UNIQUE (object_name, name)
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

    static mapFieldTypeToPgType(field) {
        // Basic mapping from Salesforce/JS types to PostgreSQL types
        switch ((field.type || '').toLowerCase()) {
            case 'string':
            case 'id':
            case 'reference':
            case 'picklist':
            case 'email':
            case 'phone':
            case 'url':
                return field.length ? `VARCHAR(${field.length})` : 'VARCHAR(255)';
            case 'boolean':
                return 'BOOLEAN';
            case 'int':
            case 'integer':
                return 'INTEGER';
            case 'double':
            case 'currency':
            case 'percent':
            case 'number':
                return 'DOUBLE PRECISION';
            case 'date':
                return 'DATE';
            case 'datetime':
                return 'TIMESTAMP';
            case 'json':
            case 'jsonb':
                return 'JSONB';
            case 'text':
            case 'textarea':
                return 'TEXT';
            default:
                return 'TEXT';
        }
    }

    static async insertRecordsPostgres(dbUri, dbName, tableName, records, fields) {
        if (!records || records.length === 0) return { upsertedCount: 0, modifiedCount: 0 };
        tableName = tableName.toLowerCase();
        const pool = await DatabaseManager.getPgPool(dbUri, dbName);
        const client = await pool.connect();
        try {
            const columns = fields.sort((a, b) => {
                if (a.name.toLowerCase() === 'id') return -1;
                if (b.name.toLowerCase() === 'id') return 1;
                return 0;
            }).map(f => f.name.toLowerCase());

            let pk = '';
            if (tableName === 'fields') {
                pk = ', PRIMARY KEY (object_name, name)';
            } else {
                pk = `, PRIMARY KEY (${columns[0]})`;
            }
            const columnDefs = fields.map(f => {
                const type = DatabaseManager.mapFieldTypeToPgType(f);
                const nullable = f.nillable === false ? 'NOT NULL' : '';
                return `"${f.name.toLowerCase()}" ${type} ${nullable}`.trim();
            }).join(', ');

            await client.query(`DROP TABLE IF EXISTS "${tableName}"`);
            await client.query(`CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs}${pk})`);

            const existingColsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [tableName]);
            const existingCols = existingColsRes.rows.map(r => r.column_name.toLowerCase());
            const missingCols = [];

            for (const field of fields) {
                const colName = field.name.toLowerCase();
                if (!existingCols.includes(colName)) {
                    const colType = DatabaseManager.mapFieldTypeToPgType(field);
                    const nullable = field.nillable === false ? 'NOT NULL' : '';
                    missingCols.push(colName);
                    await client.query(`ALTER TABLE "${tableName}" ADD COLUMN "${colName}" ${colType} ${nullable}`.trim());
                }
            }
            if (missingCols.length > 0) {
                console.log(`[DB] Table ${tableName} - Existing columns:`, existingCols);
                console.log(`[DB] Table ${tableName} - Adding missing columns:`, missingCols);
                await new Promise(r => setTimeout(r, 200));
            }

            // Convert records to lowercase keys and remove duplicates based on conflict columns
            let conflictCols = [];
            if (tableName === 'objects') conflictCols = ['name'];
            else if (tableName === 'fields') conflictCols = ['object_name', 'name'];
            else conflictCols = [columns[0]];

            // Create a map to store unique records based on conflict columns
            const uniqueRecordsMap = new Map();
            
            records.forEach(record => {
                const lowerRecord = {};
                for (const key in record) {
                    lowerRecord[key.toLowerCase()] = record[key];
                }
                
                // Create a key based on the conflict columns
                const recordKey = conflictCols
                    .map(col => lowerRecord[col])
                    .join('|');
                
                // Keep only the last occurrence of each record
                uniqueRecordsMap.set(recordKey, lowerRecord);
            });
            
            // Convert back to array
            const uniqueRecords = Array.from(uniqueRecordsMap.values());
            
            // Generate placeholders and values for the query
            const valuePlaceholders = uniqueRecords.map((_, i) => 
                `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
            ).join(', ');
            
            const values = uniqueRecords.flatMap(record => 
                columns.map(col => record[col])
            );
            
            console.log(`[DB] Processing ${uniqueRecords.length} unique records out of ${records.length} total records`);
            const updateSet = columns.filter(col => !conflictCols.includes(col)).map(col => `"${col}" = EXCLUDED."${col}"`).join(', ');
            const sql = `INSERT INTO "${tableName}" (${columns.map(col => `"${col}"`).join(', ')}) VALUES ${valuePlaceholders} ON CONFLICT (${conflictCols.map(col => `"${col}"`).join(', ')}) DO UPDATE SET ${updateSet}`;
            console.log('[DB] Final SQL:', sql);
            console.log('[DB] Values:', values);
            const result = await client.query(sql, values);
            return { upsertedCount: result.rowCount, modifiedCount: result.rowCount };
        } finally {
            client.release();
            await pool.end();
        }
    }

    static async upsertObjectSchemaMongo(dbUri, dbName, objectSchema) {
        const { client, db } = await DatabaseManager.getMongoDb(dbUri, dbName);
        try {
            const objects = db.collection('objects');
            // Ensure unique index on name
            await objects.createIndex({ name: 1 }, { unique: true });
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
            // Ensure unique index on (objectName, name)
            await fieldsCol.createIndex({ objectName: 1, name: 1 }, { unique: true });
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

    static async insertRecordsMongo(dbUri, dbName, collectionName, records, fields) {
        if (!records || records.length === 0) return { upsertedCount: 0, modifiedCount: 0 };
        const { client, db } = await DatabaseManager.getMongoDb(dbUri, dbName);
        try {
            // Create collection if it does not exist
            const collections = await db.listCollections({ name: collectionName }).toArray();
            if (collections.length === 0) {
                await db.createCollection(collectionName);
            }
            const col = db.collection(collectionName);
            // Optionally create unique index if fields suggest one
            if (fields && fields.length > 0) {
                let uniqueFields = [];
                if (collectionName === 'objects') uniqueFields = ['name'];
                else if (collectionName === 'fields') uniqueFields = ['objectName', 'name'];
                else uniqueFields = [fields[0].name];
                // Try to create unique index, ignore error if already exists
                try {
                    await col.createIndex(Object.fromEntries(uniqueFields.map(f => [f, 1])), { unique: true });
                } catch (e) { }
            }
            // Upsert each record, ensuring all fields are present and nillable respected
            let upsertedCount = 0, modifiedCount = 0;
            for (const record of records) {
                let filter = {};
                if (collectionName === 'objects') filter = { name: record.name };
                else if (collectionName === 'fields') filter = { objectName: record.objectName, name: record.name };
                else filter = { [fields[0].name]: record[fields[0].name] };
                // Ensure all fields are present in the upserted document, respect nillable
                const doc = { ...record };
                for (const field of fields) {
                    if (!(field.name in doc)) {
                        doc[field.name] = field.nillable !== false ? null : undefined;
                    }
                }
                // Remove undefined fields (for non-nillable missing fields)
                Object.keys(doc).forEach(k => doc[k] === undefined && delete doc[k]);
                const res = await col.updateOne(filter, { $set: doc }, { upsert: true });
                if (res.upsertedCount) upsertedCount += res.upsertedCount;
                if (res.modifiedCount) modifiedCount += res.modifiedCount;
            }
            return { upsertedCount, modifiedCount };
        } finally {
            await client.close();
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
}

module.exports = DatabaseManager;
