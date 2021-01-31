import * as IORedis from "ioredis";

const Redis = require("ioredis");
const {router, setQueues, BullMQAdapter} = require('bull-board')
const {Queue} = require('bullmq')

const app = require("express")();

const redisOptions: IORedis.RedisOptions = {
    port: parseInt(process.env.REDIS_PORT) || 6379,
    host: process.env.REDIS_HOST || 'localhost',
    family: 4,
    password: process.env.REDIS_PASSWORD || '',
    tls: {},
    db: 0
}

const refreshQueues = async (client: IORedis.Redis, prefix: string) => {
    console.log('Refreshing Queues');
    const keys: string[] = await client.keys(`${prefix}:*`)
        .catch((reason) => {
            console.error(reason);
            return [];
        });
    if (keys.length > 0) {
        const queueNames: Set<string> = new Set(keys.map(key => key.replace(/^.+?:(.+?):.+?$/, '$1')));
        const queues = Array.from(queueNames.keys())
            .map(name => new BullMQAdapter(new Queue(name, {connection: redisOptions})))
        setQueues(queues)
    }
}

const main = async () => {
    const prefix = process.env.BULL_PREFIX || 'bull'
    const port = process.env.PORT || 3000;
    const address = process.env.ADDRESS || "127.0.0.1";
    const listen_path = process.env.LISTENING_PATH || "/";

    // update queues
    const client: IORedis.Redis = new Redis(redisOptions);
    setInterval(refreshQueues, parseInt(process.env.REFRESH_INTERVAL) || 10000)
    try {
        await refreshQueues(client, prefix);
    } catch (e) {
        console.error(e);
    }

    // start server
    app.use(listen_path, router)
    app.listen(port, address, () => {
        console.log(`dashboard service running on port ${port} address ${address}`);
    });
}

main().then(() => {
});
