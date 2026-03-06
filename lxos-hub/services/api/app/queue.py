from redis import Redis
from rq import Queue
from app.config import REDIS_URL

redis_conn = Redis.from_url(REDIS_URL)

runs_q       = Queue("runs",       connection=redis_conn)
benchmarks_q = Queue("benchmarks", connection=redis_conn)
outbox_q     = Queue("outbox",     connection=redis_conn)
