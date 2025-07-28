const { v4: uuidv4 } = require('uuid');
const Logger = require('../utils/logger');
const DatabaseManager = require('./databaseManager');

class SyncManager {
    constructor(salesforceManager, databaseManager) {
        this.salesforceManager = salesforceManager;
        this.databaseManager = databaseManager;
        this.syncHistory = new Map();
        this.activeSyncs = new Map();
    }

    async init() {
        const all = await this.databaseManager.getAllSyncHistory();
        for (const sync of all) {
            this.syncHistory.set(sync.id, sync);
        }
        Logger.info(`Loaded ${all.length} sync history records from DB`);
    }

    async saveSyncResult(syncResult) {
        this.syncHistory.set(syncResult.id, syncResult);
        await this.databaseManager.saveSyncHistory(syncResult);
    }

    async manualSync(instanceId, objectName, selectedFields) {
        const syncId = uuidv4();
        const startTime = new Date();
        try {
            const instance = await this.salesforceManager.instances.get(instanceId);
            if (!instance) throw new Error('Instance not found');
            const { dbType, dbUri, dbName } = instance;
            this.activeSyncs.set(syncId, {
                id: syncId,
                instanceId,
                objectName,
                targetDatabase: dbType,
                status: 'running',
                startTime,
                progress: 0
            });
            Logger.info(`Starting manual sync: ${objectName} to ${dbType}`);
            const fields = selectedFields.map(f => f.name);
            console.log({ fields });
            const records = await this.salesforceManager.bulkQuery(instanceId, objectName, fields);
            if (records.length === 0) {
                throw new Error('No records found to sync');
            }
            const processedRecords = records.map(record => {
                const processed = {};
                selectedFields.forEach(field => {
                    let value = record[field.name];
                    if (value !== null && value !== undefined) {
                        if (field.type === 'datetime' && typeof value === 'string') {
                            value = new Date(value);
                        } else if (field.type === 'date' && typeof value === 'string') {
                            value = new Date(value);
                        } else if (field.type === 'boolean' && typeof value === 'string') {
                            value = value.toLowerCase() === 'true';
                        }
                    }
                    processed[field.name] = value;
                });
                return processed;
            });
            let result;
            const objectSchema = { instanceId, name: objectName, label: objectName };
            if (dbType === 'mongodb') {
                await this.databaseManager.constructor.upsertObjectSchemaMongo(dbUri, dbName, objectSchema);
                await this.databaseManager.constructor.upsertFieldSchemaMongo(dbUri, dbName, selectedFields.map(f => ({ ...f, objectName })));
                result = await this.databaseManager.constructor.insertRecordsMongo(dbUri, dbName, objectName, processedRecords);
            } else if (dbType === 'postgresql') {
                await this.databaseManager.constructor.upsertObjectSchemaPostgres(dbUri, dbName, objectSchema);
                await this.databaseManager.constructor.upsertFieldSchemaPostgres(dbUri, dbName, selectedFields.map(f => ({ ...f, objectName })));
                result = await this.databaseManager.constructor.insertRecordsPostgres(dbUri, dbName, objectName, processedRecords, selectedFields);
            } else {
                throw new Error(`Unsupported target database: ${dbType}`);
            }
            const endTime = new Date();
            const duration = endTime - startTime;
            const syncResult = {
                id: syncId,
                instanceId,
                objectName,
                targetDatabase: dbType,
                status: 'completed',
                startTime,
                endTime,
                duration,
                recordsProcessed: processedRecords.length,
                recordsInserted: result.upsertedCount || 0,
                recordsUpdated: result.modifiedCount || 0,
                fields: selectedFields.map(f => f.name)
            };
            await this.saveSyncResult(syncResult);
            this.activeSyncs.delete(syncId);
            Logger.info(`Manual sync completed: ${objectName} - ${processedRecords.length} records processed`);
            return syncResult;
        } catch (error) {
            const endTime = new Date();
            const syncResult = {
                id: syncId,
                instanceId,
                objectName,
                targetDatabase: 'unknown',
                status: 'failed',
                startTime,
                endTime,
                duration: endTime - startTime,
                error: error.message,
                recordsProcessed: 0,
                recordsInserted: 0,
                recordsUpdated: 0
            };
            await this.saveSyncResult(syncResult);
            this.activeSyncs.delete(syncId);
            Logger.error(`Manual sync failed for ${objectName}:`, error);
            throw error;
        }
    }

    async scheduledSync(scheduleConfig) {
        const syncId = uuidv4();
        const startTime = new Date();
        try {
            const instance = await this.salesforceManager.instances.get(scheduleConfig.instanceId);
            if (!instance) throw new Error('Instance not found');
            const { dbType, dbUri, dbName } = instance;
            this.activeSyncs.set(syncId, {
                id: syncId,
                instanceId: scheduleConfig.instanceId,
                objectName: scheduleConfig.objectName,
                targetDatabase: dbType,
                status: 'running',
                startTime,
                progress: 0,
                scheduled: true
            });
            Logger.info(`Starting scheduled sync: ${scheduleConfig.objectName} to ${dbType}`);
            const fields = scheduleConfig.fields.map(f => f.name);
            let query = scheduleConfig.query || '';
            if (scheduleConfig.incrementalField && scheduleConfig.lastSyncTime) {
                const lastSync = new Date(scheduleConfig.lastSyncTime).toISOString();
                query = query ? `${query} AND ${scheduleConfig.incrementalField} > ${lastSync}` : `${scheduleConfig.incrementalField} > ${lastSync}`;
            }
            const records = await this.salesforceManager.queryRecords(
                scheduleConfig.instanceId,
                scheduleConfig.objectName,
                fields,
                query
            );
            if (records.length === 0) {
                Logger.info(`No new records found for scheduled sync: ${scheduleConfig.objectName}`);
                this.activeSyncs.delete(syncId);
                return { recordsProcessed: 0, recordsInserted: 0 };
            }
            const processedRecords = records.map(record => {
                const processed = {};
                scheduleConfig.fields.forEach(field => {
                    let value = record[field.name];
                    if (value !== null && value !== undefined) {
                        if (field.type === 'datetime' && typeof value === 'string') {
                            value = new Date(value);
                        } else if (field.type === 'date' && typeof value === 'string') {
                            value = new Date(value);
                        } else if (field.type === 'boolean' && typeof value === 'string') {
                            value = value.toLowerCase() === 'true';
                        }
                    }
                    processed[field.name] = value;
                });
                return processed;
            });
            let result;
            const objectSchema = { instanceId: scheduleConfig.instanceId, name: scheduleConfig.objectName, label: scheduleConfig.objectName };
            if (dbType === 'mongodb') {
                await this.databaseManager.constructor.upsertObjectSchemaMongo(dbUri, dbName, objectSchema);
                await this.databaseManager.constructor.upsertFieldSchemaMongo(dbUri, dbName, scheduleConfig.fields.map(f => ({ ...f, objectName: scheduleConfig.objectName })));
                result = await this.databaseManager.constructor.insertRecordsMongo(dbUri, dbName, scheduleConfig.objectName, processedRecords);
            } else if (dbType === 'postgresql') {
                await this.databaseManager.constructor.upsertObjectSchemaPostgres(dbUri, dbName, objectSchema);
                await this.databaseManager.constructor.upsertFieldSchemaPostgres(dbUri, dbName, scheduleConfig.fields.map(f => ({ ...f, objectName: scheduleConfig.objectName })));
                result = await this.databaseManager.constructor.insertRecordsPostgres(dbUri, dbName, scheduleConfig.objectName, processedRecords, scheduleConfig.fields);
            } else {
                throw new Error(`Unsupported target database: ${dbType}`);
            }
            const endTime = new Date();
            const duration = endTime - startTime;
            const syncResult = {
                id: syncId,
                instanceId: scheduleConfig.instanceId,
                objectName: scheduleConfig.objectName,
                targetDatabase: dbType,
                status: 'completed',
                startTime,
                endTime,
                duration,
                recordsProcessed: processedRecords.length,
                recordsInserted: result.upsertedCount || 0,
                recordsUpdated: result.modifiedCount || 0,
                scheduled: true,
                scheduleId: scheduleConfig.id
            };
            await this.saveSyncResult(syncResult);
            this.activeSyncs.delete(syncId);
            Logger.info(`Scheduled sync completed: ${scheduleConfig.objectName} - ${processedRecords.length} records processed`);
            return syncResult;
        } catch (error) {
            const endTime = new Date();
            const syncResult = {
                id: syncId,
                instanceId: scheduleConfig.instanceId,
                objectName: scheduleConfig.objectName,
                targetDatabase: 'unknown',
                status: 'failed',
                startTime,
                endTime,
                duration: endTime - startTime,
                error: error.message,
                recordsProcessed: 0,
                recordsInserted: 0,
                recordsUpdated: 0,
                scheduled: true,
                scheduleId: scheduleConfig.id
            };
            await this.saveSyncResult(syncResult);
            this.activeSyncs.delete(syncId);
            Logger.error(`Scheduled sync failed for ${scheduleConfig.objectName}:`, error);
            throw error;
        }
    }

    async getSyncStatus() {
        const activeList = Array.from(this.activeSyncs.values()).map(job => ({
            ...job,
            startedAt: job.startTime ? new Date(job.startTime).toISOString() : undefined
        }));
        const historyList = Array.from(this.syncHistory.values())
            .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
            .slice(0, 50)
            .map(job => ({
                ...job,
                startedAt: job.startTime ? new Date(job.startTime).toISOString() : undefined
            }));

        return {
            active: activeList,
            history: historyList,
            totalSyncs: this.syncHistory.size
        };
    }

    async clearHistory() {
        this.syncHistory.clear();
        Logger.info('Sync history cleared');
    }
}

module.exports = SyncManager;
