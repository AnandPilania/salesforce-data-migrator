require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const SalesforceManager = require('./services/salesforceManager');
const DatabaseManager = require('./services/databaseManager');
const SyncManager = require('./services/syncManager');
const ScheduleManager = require('./services/scheduleManager');
const Logger = require('./utils/logger');
const { authMiddleware, adminMiddleware, instanceAccessMiddleware } = require('./utils/middlewares');

const { router: usersRouter, createDefaultAdminUser } = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

const databaseManager = new DatabaseManager();
const salesforceManager = new SalesforceManager(databaseManager);
const syncManager = new SyncManager(salesforceManager, databaseManager);
const scheduleManager = new ScheduleManager(syncManager, databaseManager);

app.use('/api', usersRouter);

app.get('/api/instances', async (req, res) => {
    try {
        const instances = await salesforceManager.getInstances();
        res.json(instances);
    } catch (error) {
        Logger.error('Error fetching instances:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/instances', adminMiddleware, async (req, res) => {
    try {
        const instance = await salesforceManager.addInstance(req.body);
        res.json(instance);
    } catch (error) {
        Logger.error('Error adding instance:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/instances/:id', adminMiddleware, async (req, res) => {
    try {
        const instance = await salesforceManager.updateInstance(req.params.id, req.body);
        res.json(instance);
    } catch (error) {
        Logger.error('Error updating instance:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/instances/:id', adminMiddleware, async (req, res) => {
    try {
        await salesforceManager.deleteInstance(req.params.id);
        res.json({ success: true });
    } catch (error) {
        Logger.error('Error deleting instance:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/instances/test', async (req, res) => {
    const { loginUrl, username, password, securityToken, apiVersion, dbType, dbUri, dbName } = req.body;
    let salesforceOk = false, dbOk = false, salesforceError = null, dbError = null;

    try {
        const jsforce = require('jsforce');
        const conn = new jsforce.Connection({ loginUrl, version: apiVersion });
        await conn.login(username, password + (securityToken || ''));
        salesforceOk = true;
    } catch (err) {
        salesforceError = err.message;
    }

    try {
        if (dbType === 'mongodb') {
            const { MongoClient } = require('mongodb');
            const client = new MongoClient(dbUri);
            await client.connect();
            await client.db(dbName).command({ ping: 1 });
            await client.close();
            dbOk = true;
        } else if (dbType === 'postgresql') {
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

            const client = await pool.connect();
            await client.query('SELECT 1');
            await client.release();
            await pool.end();
            dbOk = true;
        } else {
            dbError = 'Unsupported dbType';
        }
    } catch (err) {
        dbError = err.message;
    }
    res.json({ salesforce: salesforceOk, db: dbOk, salesforceError, dbError });
});

app.post('/api/instances/:id/test', async (req, res) => {
    try {
        const instance = (await salesforceManager.getInstances()).find(i => i.id === req.params.id);
        if (!instance) throw new Error('Instance not found');

        const testRes = await fetch('http://localhost:' + PORT + '/api/instances/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(instance)
        });
        const result = await testRes.json();
        res.json(result);
    } catch (error) {
        Logger.error('Error testing connection:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/instances/:id/objects', async (req, res) => {
    try {
        const objects = await salesforceManager.getObjects(req.params.id);
        res.json(objects);
    } catch (error) {
        Logger.error('Error fetching objects:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/instances/:id/objects/:objectName/fields', async (req, res) => {
    try {
        const fields = await salesforceManager.getObjectFields(req.params.id, req.params.objectName);
        res.json(fields);
    } catch (error) {
        Logger.error('Error fetching fields:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/instances/:instanceId/objects/:objectName/records', async (req, res) => {
    try {
        const { instanceId, objectName } = req.params;
        const instance = await salesforceManager.instances.get(instanceId);
        if (!instance) return res.status(404).json({ error: 'Instance not found' });
        const { dbType, dbUri, dbName } = instance;
        let records = [];
        if (dbType === 'postgresql') {
            const pool = await DatabaseManager.getPgPool(dbUri, dbName);
            const client = await pool.connect();
            try {
                const result = await client.query(`SELECT * FROM ${objectName} LIMIT 100`);
                records = result.rows;
            } finally {
                client.release();
                await pool.end();
            }
        } else if (dbType === 'mongodb') {
            const { client, db } = await DatabaseManager.getMongoDb(dbUri, dbName);
            try {
                records = await db.collection(objectName).find({}).limit(100).toArray();
            } finally {
                await client.close();
            }
        } else {
            return res.status(400).json({ error: 'Unsupported dbType' });
        }
        res.json(records);
    } catch (error) {
        Logger.error('Error fetching records:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/sync/manual', async (req, res) => {
    try {
        const { instanceId, objectName, fields, targetDatabase } = req.body;
        const result = await syncManager.manualSync(instanceId, objectName, fields, targetDatabase);
        res.json(result);
    } catch (error) {
        Logger.error('Error in manual sync:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sync/status', async (req, res) => {
    try {
        const status = await syncManager.getSyncStatus();
        res.json(status);
    } catch (error) {
        Logger.error('Error fetching sync status:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/schedules', async (req, res) => {
    try {
        const schedules = await scheduleManager.getSchedules();
        res.json(schedules);
    } catch (error) {
        Logger.error('Error fetching schedules:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/schedules', async (req, res) => {
    try {
        const schedule = await scheduleManager.addSchedule(req.body);
        res.json(schedule);
    } catch (error) {
        Logger.error('Error adding schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/schedules/:id', async (req, res) => {
    try {
        const schedule = await scheduleManager.updateSchedule(req.params.id, req.body);
        res.json(schedule);
    } catch (error) {
        Logger.error('Error updating schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/schedules/:id', async (req, res) => {
    try {
        await scheduleManager.deleteSchedule(req.params.id);
        res.json({ success: true });
    } catch (error) {
        Logger.error('Error deleting schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/schedules/:id/toggle', async (req, res) => {
    try {
        const schedule = await scheduleManager.toggleSchedule(req.params.id);
        res.json(schedule);
    } catch (error) {
        Logger.error('Error toggling schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/logs', async (req, res) => {
    try {
        const { limit = 100, level = 'all' } = req.query;
        const logs = await Logger.getLogs(parseInt(limit), level);
        res.json(logs);
    } catch (error) {
        Logger.error('Error fetching logs:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/instances/:instanceId/local-objects', async (req, res) => {
    try {
        const { instanceId } = req.params;
        const instance = await salesforceManager.instances.get(instanceId);
        if (!instance) return res.status(404).json({ error: 'Instance not found' });
        const { dbType, dbUri, dbName } = instance;
        let objects = [];
        if (dbType === 'postgresql') {
            const pool = await DatabaseManager.getPgPool(dbUri, dbName);
            const client = await pool.connect();
            try {
                const result = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
                objects = result.rows.map(r => ({ name: r.table_name, label: r.table_name }));
            } finally {
                client.release();
                await pool.end();
            }
        } else if (dbType === 'mongodb') {
            const { client, db } = await DatabaseManager.getMongoDb(dbUri, dbName);
            try {
                const colls = await db.listCollections().toArray();
                objects = colls.filter(c => !c.name.startsWith('system.')).map(c => ({ name: c.name, label: c.name }));
            } finally {
                await client.close();
            }
        } else {
            return res.status(400).json({ error: 'Unsupported dbType' });
        }
        res.json(objects);
    } catch (error) {
        Logger.error('Error fetching local objects:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/instances/:instanceId/objects/diff', async (req, res) => {
    try {
        const { instanceId } = req.params;
        const instance = await salesforceManager.instances.get(instanceId);
        if (!instance) return res.status(404).json({ error: 'Instance not found' });
        const { dbType, dbUri, dbName } = instance;
        const sfObjects = await salesforceManager.getObjects(instanceId);
        let localObjects = [];

        if (dbType === 'postgresql') {
            const pool = await DatabaseManager.getPgPool(dbUri, dbName);
            const client = await pool.connect();
            try {
                const result = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
                localObjects = result.rows.map(r => r.table_name);
            } finally {
                client.release();
                await pool.end();
            }
        } else if (dbType === 'mongodb') {
            const { client, db } = await DatabaseManager.getMongoDb(dbUri, dbName);
            try {
                const colls = await db.listCollections().toArray();
                localObjects = colls.filter(c => !c.name.startsWith('system.')).map(c => c.name);
            } finally {
                await client.close();
            }
        } else {
            return res.status(400).json({ error: 'Unsupported dbType' });
        }

        const diff = [];
        for (const obj of sfObjects) {
            let sfCount = 0, localCount = 0;
            try {
                sfCount = await salesforceManager.countRecords(instanceId, obj.name);
            } catch { }
            if (localObjects.includes(obj.name)) {
                if (dbType === 'postgresql') {
                    const pool = await DatabaseManager.getPgPool(dbUri, dbName);
                    const client = await pool.connect();
                    try {
                        const result = await client.query(`SELECT COUNT(*) FROM ${obj.name}`);
                        localCount = parseInt(result.rows[0].count, 10);
                    } finally {
                        client.release();
                        await pool.end();
                    }
                } else if (dbType === 'mongodb') {
                    const { client, db } = await DatabaseManager.getMongoDb(dbUri, dbName);
                    try {
                        localCount = await db.collection(obj.name).countDocuments();
                    } finally {
                        await client.close();
                    }
                }
            }
            diff.push({
                name: obj.name,
                label: obj.label,
                inSalesforce: true,
                inLocal: localObjects.includes(obj.name),
                salesforceCount: sfCount,
                localCount
            });
        }

        for (const localName of localObjects) {
            if (!sfObjects.find(obj => obj.name === localName)) {
                let localCount = 0;
                if (dbType === 'postgresql') {
                    const pool = await DatabaseManager.getPgPool(dbUri, dbName);
                    const client = await pool.connect();
                    try {
                        const result = await client.query(`SELECT COUNT(*) FROM ${localName}`);
                        localCount = parseInt(result.rows[0].count, 10);
                    } finally {
                        client.release();
                        await pool.end();
                    }
                } else if (dbType === 'mongodb') {
                    const { client, db } = await DatabaseManager.getMongoDb(dbUri, dbName);
                    try {
                        localCount = await db.collection(localName).countDocuments();
                    } finally {
                        await client.close();
                    }
                }
                diff.push({
                    name: localName,
                    label: localName,
                    inSalesforce: false,
                    inLocal: true,
                    salesforceCount: 0,
                    localCount
                });
            }
        }
        res.json(diff);
    } catch (error) {
        Logger.error('Error fetching objects diff:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/instances/:instanceId/objects/:objectName/diff', async (req, res) => {
    try {
        const { instanceId, objectName } = req.params;
        const instance = await salesforceManager.instances.get(instanceId);
        if (!instance) return res.status(404).json({ error: 'Instance not found' });
        const { dbType, dbUri, dbName } = instance;
        const objectNameLC = objectName.toLowerCase();
        let inSalesforce = false, salesforceCount = 0, label = objectName;

        try {
            const sfObjects = await salesforceManager.getObjects(instanceId);
            const sfObj = sfObjects.find(obj => obj.name.toLowerCase() === objectNameLC);
            if (sfObj) {
                inSalesforce = true;
                label = sfObj.label;
                salesforceCount = await salesforceManager.countRecords(instanceId, sfObj.name);
            }
        } catch { }

        let inLocal = false, localCount = 0, localName = objectNameLC;
        if (dbType === 'postgresql') {
            const pool = await DatabaseManager.getPgPool(dbUri, dbName);
            const client = await pool.connect();
            try {
                const result = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
                const localTable = result.rows.find(r => r.table_name.toLowerCase() === objectNameLC);
                inLocal = !!localTable;
                if (inLocal) {
                    const countRes = await client.query(`SELECT COUNT(*) FROM "${localTable.table_name}"`);
                    localCount = parseInt(countRes.rows[0].count, 10);
                    localName = localTable.table_name;
                }
            } finally {
                client.release();
                await pool.end();
            }
        } else if (dbType === 'mongodb') {
            const { client, db } = await DatabaseManager.getMongoDb(dbUri, dbName);
            try {
                const colls = await db.listCollections().toArray();
                const localColl = colls.find(c => c.name.toLowerCase() === objectNameLC);
                inLocal = !!localColl;
                if (inLocal) {
                    localCount = await db.collection(localColl.name).countDocuments();
                    localName = localColl.name;
                }
            } finally {
                await client.close();
            }
        }
        res.json({ name: objectName, label, inSalesforce, inLocal, salesforceCount, localCount, localName });
    } catch (error) {
        Logger.error('Error fetching object diff:', error);
        res.status(500).json({ error: error.message });
    }
});

const instanceRoutes = [
    '/api/instances',
    '/api/instances/:id',
    '/api/instances/:id/objects',
    '/api/instances/:id/objects/:objectName/fields',
    '/api/instances/:instanceId/objects/:objectName/records',
    '/api/instances/:instanceId/local-objects',
    '/api/instances/:instanceId/objects/diff',
    '/api/instances/:instanceId/objects/:objectName/diff',
    '/api/sync/manual',
    '/api/sync/status',
    '/api/schedules',
    '/api/schedules/:id',
    '/api/schedules/:id/toggle',
    '/api/logs'
];
instanceRoutes.forEach(route => {
    app.use(route, authMiddleware, instanceAccessMiddleware);
});

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
    });
} else {
    app.use((req, res, next) => {
        if (req.path.startsWith('/api')) {
            return next();
        }

        return res.redirect('http://localhost:5173' + req.url);
    });
}

const startServer = async () => {
    try {
        await databaseManager.init();
        await salesforceManager.init();
        await syncManager.init();
        await scheduleManager.init();

        await createDefaultAdminUser();

        app.listen(PORT, () => {
            Logger.info(`Server running on port ${PORT}`);
        });
    } catch (error) {
        Logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
