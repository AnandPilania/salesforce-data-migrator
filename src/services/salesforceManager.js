const jsforce = require('jsforce');
const { v4: uuidv4 } = require('uuid');
const Logger = require('../utils/logger');

class SalesforceManager {
    constructor() {
        this.instances = new Map();
        this.connections = new Map();
    }

    async getInstances() {
        return Array.from(this.instances.values());
    }

    async addInstance(instanceData) {
        const instance = {
            id: uuidv4(),
            name: instanceData.name,
            loginUrl: instanceData.loginUrl || 'https://login.salesforce.com',
            username: instanceData.username,
            password: instanceData.password,
            securityToken: instanceData.securityToken,
            apiVersion: instanceData.apiVersion || '59.0',
            created: new Date().toISOString(),
            lastSync: null,
            status: 'inactive'
        };

        this.instances.set(instance.id, instance);
        Logger.info(`Added Salesforce instance: ${instance.name}`);
        return instance;
    }

    async updateInstance(id, updates) {
        const instance = this.instances.get(id);
        if (!instance) {
            throw new Error('Instance not found');
        }

        Object.assign(instance, updates, { updated: new Date().toISOString() });
        this.instances.set(id, instance);

        if (this.connections.has(id)) {
            this.connections.delete(id);
        }

        Logger.info(`Updated Salesforce instance: ${instance.name}`);
        return instance;
    }

    async deleteInstance(id) {
        const instance = this.instances.get(id);
        if (!instance) {
            throw new Error('Instance not found');
        }

        this.instances.delete(id);
        this.connections.delete(id);
        Logger.info(`Deleted Salesforce instance: ${instance.name}`);
    }

    async getConnection(instanceId) {
        if (this.connections.has(instanceId)) {
            const conn = this.connections.get(instanceId);
            if (conn.accessToken) {
                return conn;
            }
        }

        const instance = this.instances.get(instanceId);
        if (!instance) {
            throw new Error('Instance not found');
        }

        const conn = new jsforce.Connection({
            loginUrl: instance.loginUrl,
            version: instance.apiVersion
        });

        try {
            await conn.login(instance.username, instance.password + (instance.securityToken || ''));
            this.connections.set(instanceId, conn);

            const updatedInstance = { ...instance, status: 'active', lastSync: new Date().toISOString() };
            this.instances.set(instanceId, updatedInstance);

            Logger.info(`Connected to Salesforce instance: ${instance.name}`);
            return conn;
        } catch (error) {
            const updatedInstance = { ...instance, status: 'error' };
            this.instances.set(instanceId, updatedInstance);
            Logger.error(`Failed to connect to Salesforce instance ${instance.name}:`, error);
            throw error;
        }
    }

    async testConnection(instanceId) {
        try {
            const conn = await this.getConnection(instanceId);
            const identity = await conn.identity();
            return {
                success: true,
                message: 'Connection successful',
                userInfo: {
                    username: identity.username,
                    userId: identity.user_id,
                    organizationId: identity.organization_id
                }
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    async getObjects(instanceId) {
        try {
            const conn = await this.getConnection(instanceId);
            const describe = await conn.describeGlobal();

            return describe.sobjects
                .filter(obj => obj.queryable && obj.retrieveable)
                .map(obj => ({
                    name: obj.name,
                    label: obj.label,
                    keyPrefix: obj.keyPrefix,
                    custom: obj.custom,
                    createable: obj.createable,
                    updateable: obj.updateable,
                    deletable: obj.deletable
                }))
                .sort((a, b) => a.label.localeCompare(b.label));
        } catch (error) {
            Logger.error(`Error fetching objects for instance ${instanceId}:`, error);
            throw error;
        }
    }

    async getObjectFields(instanceId, objectName) {
        try {
            const conn = await this.getConnection(instanceId);
            const describe = await conn.sobject(objectName).describe();

            return describe.fields.map(field => ({
                name: field.name,
                label: field.label,
                type: field.type,
                length: field.length,
                precision: field.precision,
                scale: field.scale,
                custom: field.custom,
                nillable: field.nillable,
                createable: field.createable,
                updateable: field.updateable,
                referenceTo: field.referenceTo,
                relationshipName: field.relationshipName
            })).sort((a, b) => a.label.localeCompare(b.label));
        } catch (error) {
            Logger.error(`Error fetching fields for object ${objectName} in instance ${instanceId}:`, error);
            throw error;
        }
    }

    async queryRecords(instanceId, objectName, fields, conditions = '', limit = null) {
        try {
            const conn = await this.getConnection(instanceId);
            const fieldList = fields.join(', ');
            let query = `SELECT ${fieldList} FROM ${objectName}`;

            if (conditions) {
                query += ` WHERE ${conditions}`;
            }

            if (limit) {
                query += ` LIMIT ${limit}`;
            }

            const result = await conn.query(query);
            Logger.info(`Queried ${result.records.length} records from ${objectName}`);
            return result.records;
        } catch (error) {
            Logger.error(`Error querying records from ${objectName}:`, error);
            throw error;
        }
    }

    async bulkQuery(instanceId, objectName, fields, batchSize = 10000) {
        try {
            const conn = await this.getConnection(instanceId);
            const fieldList = fields.join(', ');
            const query = `SELECT ${fieldList} FROM ${objectName}`;

            const records = [];
            const queryResult = await conn.query(query);
            records.push(...queryResult.records);

            let nextRecordsUrl = queryResult.nextRecordsUrl;
            while (nextRecordsUrl) {
                const moreResult = await conn.queryMore(nextRecordsUrl);
                records.push(...moreResult.records);
                nextRecordsUrl = moreResult.nextRecordsUrl;
            }

            Logger.info(`Bulk queried ${records.length} records from ${objectName}`);
            return records;
        } catch (error) {
            Logger.error(`Error in bulk query for ${objectName}:`, error);
            throw error;
        }
    }
}

module.exports = SalesforceManager;
