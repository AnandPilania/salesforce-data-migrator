const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Logger = require('./../utils/logger');
const { authMiddleware, adminMiddleware } = require('../utils/middlewares');

const router = express.Router();

const DEFAULT_ROLE = 'user';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://root:secret@localhost:27017?authSource=admin';
const USER_DB = process.env.USER_DB || 'usersdb';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

async function getUserCollection() {
    const client = new MongoClient(MONGO_URL);
    await client.connect();
    return { col: client.db(USER_DB).collection('users'), client };
}

async function createDefaultAdminUser() {
    const { col: usersCol, client } = await getUserCollection();

    try {
        const userCount = await usersCol.countDocuments();

        if (userCount === 0) {
            const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@admin.com';
            const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

            const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

            await usersCol.insertOne({
                email: DEFAULT_ADMIN_EMAIL,
                passwordHash,
                role: 'admin',
                createdAt: new Date(),
                instanceIds: []
            });

            Logger.warn(`Created default admin user with email: ${DEFAULT_ADMIN_EMAIL}`);
            Logger.warn(`WARNING: Please change the default password immediately!`);
        }
    } catch (error) {
        Logger.error('Error checking/creating default admin user:', error);
    } finally {
        await client.close();
    }
}

router.post('/auth/register', authMiddleware, adminMiddleware, async (req, res) => {
    const { email, password, instanceIds = [] } = req.body;
    const { col, client } = await getUserCollection();

    try {
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const existingUser = await col.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const newUser = {
            email,
            passwordHash,
            role: DEFAULT_ROLE,
            createdAt: new Date(),
            instanceIds: Array.isArray(instanceIds) ? instanceIds : []
        };

        const result = await col.insertOne(newUser);

        const userResponse = {
            _id: result.insertedId,
            email: newUser.email,
            role: newUser.role,
            instanceIds: newUser.instanceIds
        };

        res.status(201).json(userResponse);
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    } finally {
        await client.close();
    }
});

router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const { col, client } = await getUserCollection();

    try {
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await col.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            {
                userId: user._id.toString(),
                role: user.role,
                instanceIds: user.instanceIds || []
            },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        const userResponse = {
            _id: user._id,
            email: user.email,
            role: user.role,
            instanceIds: user.instanceIds || []
        };

        res.json({ user: userResponse, token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    } finally {
        await client.close();
    }
});

router.get('/auth/me', authMiddleware, async (req, res) => {
    res.json({
        _id: req.user.userId,
        email: req.user.email,
        role: req.user.role,
        instanceIds: req.user.instanceIds || []
    });

    /* const { col, client } = await getUserCollection();

    try {
        const user = await col.findOne(
            { _id: new ObjectId(req.user.userId) },
            { projection: { passwordHash: 0 } }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            _id: user._id,
            email: user.email,
            role: user.role,
            instanceIds: user.instanceIds || []
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    } finally {
        await client.close();
    } */
});

router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
    const { col, client } = await getUserCollection();
    try {
        const users = await col.find({}).project({ passwordHash: 0 }).toArray();
        res.json(users);
    } finally { await client.close(); }
});

router.post('/users/:userId/assign', authMiddleware, adminMiddleware, async (req, res) => {
    const { userId } = req.params;
    const { instanceIds } = req.body;
    const { col, client } = await getUserCollection();
    try {
        await col.updateOne({ _id: new ObjectId(userId) }, { $set: { instanceIds } });
        res.json({ success: true });
    } finally { await client.close(); }
});

router.post('/users/:userId/edit', authMiddleware, adminMiddleware, async (req, res) => {
    const { userId } = req.params;
    const { email, password, instanceIds } = req.body;
    const { col, client } = await getUserCollection();
    try {
        const update = { email, instanceIds };
        if (password && password.length > 0) {
            update.passwordHash = await bcrypt.hash(password, 10);
        }
        await col.updateOne({ _id: new ObjectId(userId) }, { $set: update });
        res.json({ success: true });
    } finally { await client.close(); }
});

router.delete('/users/:userId', authMiddleware, adminMiddleware, async (req, res) => {
    const { userId } = req.params;
    const { col, client } = await getUserCollection();
    try {
        await col.deleteOne({ _id: new ObjectId(userId) });
        res.json({ success: true });
    } finally { await client.close(); }
});

module.exports = {
    router,
    createDefaultAdminUser,
};
