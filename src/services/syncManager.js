const { v4: uuidv4 } = require('uuid');
const Logger = require('../utils/logger');

class SyncManager {
    constructor(salesforceManager, databaseManager) {
        this.salesforceManager = salesforceManager;
        this.databaseManager = databaseManager;
        this.syncHistory = new Map();
        this.activeSyncs = new Map();
    }

    async manualSync(instanceId, objectName, selectedFields, targetDatabase) {
        const syncId = uuidv4();
        const startTime = new Date();

        try {
            this.activeSyncs.set(syncId, {
                id: syncId,
                instanceId,
                objectName,
                targetDatabase,
                status: 'running',
                startTime,
                progress: 0
            });

            Logger.info(`Starting manual sync: ${objectName} to ${targetDatabase}`);

            const fields = selectedFields.map(f => f.name);
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
            if (targetDatabase === 'mongodb') {
                result = await this.databaseManager.insertRecordsMongo(objectName, processedRecords);
            } else if (targetDatabase === 'postgresql') {
                result = await this.databaseManager.insertRecordsPostgres(objectName, processedRecords, selectedFields);
            } else {
                throw new Error(`Unsupported target database: ${targetDatabase}`);
            }

            const endTime = new Date();
            const duration = endTime - startTime;

            const syncResult = {
                id: syncId,
                instanceId,
                objectName,
                targetDatabase,
                status: 'completed',
                startTime,
                endTime,
                duration,
                recordsProcessed: processedRecords.length,
                recordsInserted: result.upsertedCount || 0,
                recordsUpdated: result.modifiedCount || 0,
                fields: selectedFields.map(f => f.name)
            };

            this.syncHistory.set(syncId, syncResult);
            this.activeSyncs.delete(syncId);

            Logger.info(`Manual sync completed: ${objectName} - ${processedRecords.length} records processed`);
            return syncResult;

        } catch (error) {
            const endTime = new Date();
            const syncResult = {
                id: syncId,
                instanceId,
                objectName,
                targetDatabase,
                status: 'failed',
                startTime,
                endTime,
                duration: endTime - startTime,
                error: error.message,
                recordsProcessed: 0,
                recordsInserted: 0,
                recordsUpdated: 0
            };

            this.syncHistory.set(syncId, syncResult);
            this.activeSyncs.delete(syncId);

            Logger.error(`Manual sync failed for ${objectName}:`, error);
            throw error;
        }
    }

    async scheduledSync(scheduleConfig) {
        const syncId = uuidv4();
        const startTime = new Date();

        try {
            this.activeSyncs.set(syncId, {
                id: syncId,
                instanceId: scheduleConfig.instanceId,
                objectName: scheduleConfig.objectName,
                targetDatabase: scheduleConfig.targetDatabase,
                status: 'running',
                startTime,
                progress: 0,
                scheduled: true
            });

            Logger.info(`Starting scheduled sync: ${scheduleConfig.objectName} to ${scheduleConfig.targetDatabase}`);

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
            if (scheduleConfig.targetDatabase === 'mongodb') {
                result = await this.databaseManager.insertRecordsMongo(scheduleConfig.objectName, processedRecords);
            } else if (scheduleConfig.targetDatabase === 'postgresql') {
                result = await this.databaseManager.insertRecordsPostgres(scheduleConfig.objectName, processedRecords, scheduleConfig.fields);
            } else {
                throw new Error(`Unsupported target database: ${scheduleConfig.targetDatabase}`);
            }

            const endTime = new Date();
            const duration = endTime - startTime;

            const syncResult = {
                id: syncId,
                instanceId: scheduleConfig.instanceId,
                objectName: scheduleConfig.objectName,
                targetDatabase: scheduleConfig.targetDatabase,
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

            this.syncHistory.set(syncId, syncResult);
            this.activeSyncs.delete(syncId);

            Logger.info(`Scheduled sync completed: ${scheduleConfig.objectName} - ${processedRecords.length} records processed`);
            return {
                recordsProcessed: processedRecords.length,
                recordsInserted: result.upsertedCount || 0,
                recordsUpdated: result.modifiedCount || 0
            };

        } catch (error) {
            const endTime = new Date();
            const syncResult = {
                id: syncId,
                instanceId: scheduleConfig.instanceId,
                objectName: scheduleConfig.objectName,
                targetDatabase: scheduleConfig.targetDatabase,
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

            this.syncHistory.set(syncId, syncResult);
            this.activeSyncs.delete(syncId);

            Logger.error(`Scheduled sync failed for ${scheduleConfig.objectName}:`, error);
            throw error;
        }
    }

    async getSyncStatus() {
        const activeList = Array.from(this.activeSyncs.values());
        const historyList = Array.from(this.syncHistory.values())
            .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
            .slice(0, 50);

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
