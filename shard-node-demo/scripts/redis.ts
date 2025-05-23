import {
  createClient,
  RedisClientType,
  RedisModules,
  RedisScripts,
} from "@node-redis/client";

// Get and print the value from Redis
async function getAndPrint(
    redis: RedisClientType<RedisModules, RedisScripts>,
    key: string
) {
  const val = await redis.get(key);
  console.log("redis[%s]:%s", key, val);
}

// Read a value from Redis for a given key
async function readRedis(redisUrl: string, key: string) {
  const redis = createClient({ url: redisUrl });
  await redis.connect();
  await getAndPrint(redis, key);
}

// Configuration and handler for the redis-read command
export const redisReadCommand = {
  command: "redis-read",
  describe: "read key",
  builder: {
    key: {
      string: true,
      describe: "key to read",
      default: "coordinator.priorities",
    },
  },
  handler: async (argv: any) => {
    await readRedis(argv.redisUrl, argv.key);
  },
};

// Write priorities to the Redis key 'coordinator.priorities'
async function writeRedisPriorities(redisUrl: string, priorities: number) {
  const redis = createClient({ url: redisUrl });

  let prio_sequencers = "bcd";
  let priostring = "";
  if (priorities == 0) {
    priostring = "ws://sequencer:8548";
  }
  if (priorities > prio_sequencers.length) {
    priorities = prio_sequencers.length;
  }
  for (let index = 0; index < priorities; index++) {
    const this_prio =
        "ws://sequencer_" + prio_sequencers.charAt(index) + ":8548";
    if (index != 0) {
      priostring = priostring + ",";
    }
    priostring = priostring + this_prio;
  }
  await redis.connect();

  await redis.set("coordinator.priorities", priostring);

  await getAndPrint(redis, "coordinator.priorities");
}

// Configuration and handler for the redis-init command, used to initialize Redis priorities
export const redisInitCommand = {
  command: "redis-init",
  describe: "init redis priorities",
  builder: {
    redundancy: {
      string: true,
      describe: "number of servers [0-3]",
      default: 0,
    },
  },
  handler: async (argv: any) => {
    await writeRedisPriorities(argv.redisUrl, argv.redundancy);
  },
};
