import time
import errno
import asyncio
import random
import functools
from typing import Callable, Any

from env import FS_CONCURRENCY_LIMIT
from src.models import File

_file_semaphore = asyncio.Semaphore(FS_CONCURRENCY_LIMIT)


def safe_file_op(func: Callable) -> Any:
    result = None
    while True:
        try:
            result = func()
            break
        except OSError as e:
            if e.errno == errno.EMFILE:
                time.sleep(random.randint(200, 600) / 1000)
                continue
            raise
    return result


async def async_safe_file_op(func: Callable) -> Any:
    async with _file_semaphore:
        return await asyncio.to_thread(func)


async def write_file(f: File) -> None: await asyncio.to_thread(functools.partial(safe_file_op, f.write))
