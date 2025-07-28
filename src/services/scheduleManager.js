const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const Logger = require('../utils/logger');

class ScheduleManager {
    constructor(syncManager, databaseManager) {
        this.syncManager = syncManager;
        this.databaseManager = databaseManager;
        this.schedules = new Map();
        this.cronJobs = new Map();
    }

    async init() {
        const all = await this.databaseManager.getAllSchedules();
        for (const schedule of all) {
            this.schedules.set(schedule.id, schedule);
        }
        Logger.info(`Loaded ${all.length} schedules from DB`);
    }

    async getSchedules() {
        return Array.from(this.schedules.values());
    }

    async addSchedule(scheduleData) {
        const schedule = {
            id: uuidv4(),
            name: scheduleData.name,
            instanceId: scheduleData.instanceId,
            objectName: scheduleData.objectName,
            fields: scheduleData.fields,
            targetDatabase: scheduleData.targetDatabase,
            cronExpression: scheduleData.pattern,
            query: scheduleData.query || '',
            incrementalField: scheduleData.incrementalField || null,
            enabled: scheduleData.enabled !== false,
            created: new Date().toISOString(),
            lastRun: null,
            lastSyncTime: null,
            nextRun: null,
            status: 'inactive'
        };
        this.schedules.set(schedule.id, schedule);
        await this.databaseManager.saveSchedule(schedule);
        if (schedule.enabled) {
            await this.startSchedule(schedule.id);
        }
        Logger.info(`Added schedule: ${schedule.name}`);
        return schedule;
    }

    async updateSchedule(id, updates) {
        const schedule = this.schedules.get(id);
        if (!schedule) {
            throw new Error('Schedule not found');
        }
        const wasEnabled = schedule.enabled;
        updates.cronExpression = updates.pattern;
        Object.assign(schedule, updates, { updated: new Date().toISOString() });
        if (wasEnabled) {
            await this.stopSchedule(id);
        }
        if (schedule.enabled) {
            await this.startSchedule(id);
        }
        this.schedules.set(id, schedule);
        await this.databaseManager.saveSchedule(schedule);
        Logger.info(`Updated schedule: ${schedule.name}`);
        return schedule;
    }

    async deleteSchedule(id) {
        const schedule = this.schedules.get(id);
        if (!schedule) {
            throw new Error('Schedule not found');
        }
        await this.stopSchedule(id);
        this.schedules.delete(id);
        await this.databaseManager.deleteSchedule(id);
        Logger.info(`Deleted schedule: ${schedule.name}`);
    }

    async toggleSchedule(id) {
        const schedule = this.schedules.get(id);
        if (!schedule) {
            throw new Error('Schedule not found');
        }

        schedule.enabled = !schedule.enabled;
        schedule.updated = new Date().toISOString();

        if (schedule.enabled) {
            await this.startSchedule(id);
        } else {
            await this.stopSchedule(id);
        }

        this.schedules.set(id, schedule);
        Logger.info(`Toggled schedule ${schedule.name}: ${schedule.enabled ? 'enabled' : 'disabled'}`);
        return schedule;
    }

    async startSchedule(id) {
        const schedule = this.schedules.get(id);
        if (!schedule) {
            throw new Error('Schedule not found');
        }

        if (this.cronJobs.has(id)) {
            const job = this.cronJobs.get(id);

            if (job && typeof job.stop === 'function') {
                job.stop();
            }

            this.cronJobs.delete(id);
        }

        try {
            const job = cron.schedule(schedule.cronExpression, async () => {
                await this.executeScheduledSync(id);
            }, {
                scheduled: false,
                timezone: process.env.TZ || 'UTC'
            });

            job.start();
            this.cronJobs.set(id, job);

            schedule.status = 'active';
            schedule.nextRun = this.getNextRunTime(schedule.cronExpression);
            this.schedules.set(id, schedule);

            Logger.info(`Started schedule: ${schedule.name} with cron: ${schedule.cronExpression}`);
        } catch (error) {
            schedule.status = 'error';
            this.schedules.set(id, schedule);
            Logger.error(`Failed to start schedule ${schedule.name}:`, error);
            throw error;
        }
    }

    async stopSchedule(id) {
        const schedule = this.schedules.get(id);
        if (!schedule) {
            return;
        }

        if (this.cronJobs.has(id)) {
            const job = this.cronJobs.get(id);
            if (job && typeof job.stop === 'function') {
                job.stop();
            }
            this.cronJobs.delete(id);
        }

        schedule.status = 'inactive';
        schedule.nextRun = null;
        this.schedules.set(id, schedule);

        Logger.info(`Stopped schedule: ${schedule.name}`);
    }

    async executeScheduledSync(id) {
        const schedule = this.schedules.get(id);
        if (!schedule) {
            Logger.error(`Schedule not found: ${id}`);
            return;
        }

        try {
            schedule.status = 'running';
            schedule.lastRun = new Date().toISOString();
            this.schedules.set(id, schedule);

            Logger.info(`Executing scheduled sync: ${schedule.name}`);

            const result = await this.syncManager.scheduledSync(schedule);

            schedule.status = 'active';
            schedule.lastSyncTime = new Date().toISOString();
            schedule.nextRun = this.getNextRunTime(schedule.cronExpression);
            schedule.lastResult = {
                success: true,
                recordsProcessed: result.recordsProcessed,
                recordsInserted: result.recordsInserted,
                recordsUpdated: result.recordsUpdated,
                timestamp: new Date().toISOString()
            };

            this.schedules.set(id, schedule);
            Logger.info(`Scheduled sync completed: ${schedule.name} - ${result.recordsProcessed} records processed`);

        } catch (error) {
            schedule.status = 'error';
            schedule.lastResult = {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
            this.schedules.set(id, schedule);

            Logger.error(`Scheduled sync failed for ${schedule.name}:`, error);
        }
    }

    getNextRunTime(cronExpression) {
        try {
            const task = cron.schedule(cronExpression, () => { }, { scheduled: false });
            const nextRun = task.nextDates(1);
            task.destroy();
            return nextRun[0] ? nextRun[0].toISOString() : null;
        } catch (error) {
            Logger.error('Error calculating next run time:', error);
            return null;
        }
    }

    validateCronExpression(expression) {
        return cron.validate(expression);
    }

    async shutdown() {
        for (const [id] of this.cronJobs) {
            await this.stopSchedule(id);
        }
        Logger.info('Schedule Manager shutdown complete');
    }
}

module.exports = ScheduleManager;
