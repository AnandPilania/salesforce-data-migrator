require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const SalesforceManager = require('./services/salesforceManager');
const DatabaseManager = require('./services/databaseManager');
const SyncManager = require('./services/syncManager');
const ScheduleManager = require('./services/scheduleManager');
const Logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

const salesforceManager = new SalesforceManager();
const databaseManager = new DatabaseManager();
const syncManager = new SyncManager(salesforceManager, databaseManager);
const scheduleManager = new ScheduleManager(syncManager);

app.get('/api/instances', async (req, res) => {
    try {
        const instances = await salesforceManager.getInstances();
        res.json(instances);
    } catch (error) {
        Logger.error('Error fetching instances:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/instances', async (req, res) => {
    try {
        const instance = await salesforceManager.addInstance(req.body);
        res.json(instance);
    } catch (error) {
        Logger.error('Error adding instance:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/instances/:id', async (req, res) => {
    try {
        const instance = await salesforceManager.updateInstance(req.params.id, req.body);
        res.json(instance);
    } catch (error) {
        Logger.error('Error updating instance:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/instances/:id', async (req, res) => {
    try {
        await salesforceManager.deleteInstance(req.params.id);
        res.json({ success: true });
    } catch (error) {
        Logger.error('Error deleting instance:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/instances/:id/test', async (req, res) => {
    try {
        const result = await salesforceManager.testConnection(req.params.id);
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
        await scheduleManager.init();

        app.listen(PORT, () => {
            Logger.info(`Server running on port ${PORT}`);
        });
    } catch (error) {
        Logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
